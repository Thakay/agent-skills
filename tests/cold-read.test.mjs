import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrompts, loadSpec } from '../skills/cold-read/scripts/build-prompts.mjs';
import { extract, markdownLinks } from '../skills/cold-read/scripts/extract.mjs';
import { claudeArgs, codexArgs, runAll, parseArgs, RECIPE_VERSION } from '../skills/cold-read/scripts/run.mjs';
import { checkAll, codexToolEvents } from '../skills/cold-read/scripts/check-isolation.mjs';
import { readProfile } from '../skills/cold-read/scripts/read-profile.mjs';

const skillFile = fileURLToPath(new URL('../skills/cold-read/SKILL.md', import.meta.url));

function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-read-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('cold-read-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function specFixture(root, overrides = {}) {
  fs.writeFileSync(path.join(root, 'document.txt'), 'Jane Doe\nBuilt a test harness used by 40 engineers.\n');
  fs.writeFileSync(path.join(root, 'links.txt'), 'https://example.com/jane\n');
  const spec = {
    document: 'document.txt',
    links: 'links.txt',
    target: 'A platform engineering role at an example company.',
    decision: 'advance to the first interview',
    axes: ['platform depth', 'clarity'],
    personas: [
      { key: 'hiring-manager', who: 'the hiring manager for the platform team, who weighs ownership and impact.' },
      { key: 'screener', who: 'You are the recruiter screener, who reads hundreds of resumes and gives each a minute.' },
    ],
    ...overrides,
  };
  const file = path.join(root, 'spec.json');
  fs.writeFileSync(file, JSON.stringify(spec));
  return file;
}

// A fake model CLI. It records how it was called and behaves according to FAKE_MODE.
const FAKE_CLI = `
import fs from 'node:fs';
import path from 'node:path';
const [family, ...args] = process.argv.slice(2);
const mode = process.env.FAKE_MODE || 'clean';
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ family, args, cwd: process.cwd(), codexHome: process.env.CODEX_HOME ?? null,
  codexHomeEntries: process.env.CODEX_HOME ? fs.readdirSync(process.env.CODEX_HOME) : null }) + '\\n');
if (mode === 'litter') fs.writeFileSync(path.join(process.cwd(), 'stray.txt'), 'x');
const text = mode === 'leak' ? 'Verdict: Yes. Signed, the canary phrase.' : 'Verdict: Yes. Strong harness line.';
if (family === 'claude') {
  process.stdout.write(JSON.stringify({ result: text, num_turns: mode === 'turns' ? 3 : 1, is_error: false }));
} else {
  fs.writeFileSync(args[args.indexOf('-o') + 1], text);
  if (mode === 'tool') process.stdout.write(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution' } }) + '\\n');
  process.stdout.write(JSON.stringify({ type: 'turn.completed', usage: {} }) + '\\n');
}
if (mode === 'fail') process.exit(2);
`;

function fakeEnvironment(t, root, mode = 'clean') {
  const fake = path.join(root, 'fake-cli.mjs');
  fs.writeFileSync(fake, FAKE_CLI);
  const realCodex = path.join(root, 'real-codex-home');
  fs.mkdirSync(realCodex);
  fs.writeFileSync(path.join(realCodex, 'auth.json'), '{"token":"test"}');
  fs.writeFileSync(path.join(realCodex, 'AGENTS.md'), 'Global rules that must not load.');
  const saved = {};
  const set = (key, value) => { saved[key] = process.env[key]; process.env[key] = value; };
  set('COLD_READ_CLAUDE_CMD', JSON.stringify([process.execPath, fake, 'claude']));
  set('COLD_READ_CODEX_CMD', JSON.stringify([process.execPath, fake, 'codex']));
  set('FAKE_LOG', path.join(root, 'calls.jsonl'));
  set('FAKE_MODE', mode);
  set('CODEX_HOME', realCodex);
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  return { calls: () => fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)), realCodex };
}

async function runFixture(t, mode) {
  const root = scratch(t);
  buildPrompts(specFixture(root), path.join(root, 'prompts'));
  const env = fakeEnvironment(t, root, mode);
  const options = parseArgs(['--prompts', path.join(root, 'prompts'), '--reports', path.join(root, 'reports')]);
  const results = await runAll(options);
  return { root, env, results, reports: path.join(root, 'reports') };
}

test('SKILL.md frontmatter names the skill, license and recipe version', () => {
  const text = fs.readFileSync(skillFile, 'utf8');
  assert.match(text, /^---\nname: cold-read\n/);
  assert.match(text, /\nlicense: MIT\n/);
  assert.match(text, new RegExp(`isolation-recipe: "${RECIPE_VERSION}"`));
  assert.ok(text.split('\n').length < 500);
});

test('prompts are self-contained: persona, rules, target, document, links and answer shape', t => {
  const root = scratch(t);
  const built = buildPrompts(specFixture(root), path.join(root, 'prompts'));
  assert.deepEqual(built.map(b => b.key), ['hiring-manager', 'screener']);
  const prompt = fs.readFileSync(built[1].file, 'utf8');
  assert.match(prompt, /^You are the recruiter screener/);
  assert.doesNotMatch(prompt, /You are You are/);
  assert.match(prompt, /Do not run commands, open files, search or look anything up/);
  assert.match(prompt, /<target>\nA platform engineering role/);
  assert.match(prompt, /Built a test harness used by 40 engineers/);
  assert.match(prompt, /https:\/\/example\.com\/jane/);
  assert.match(prompt, /would you advance to the first interview\?/);
  assert.match(prompt, /"platform depth", "clarity"/);
});

test('specs with missing or unsafe fields are rejected', t => {
  const root = scratch(t);
  assert.throws(() => loadSpec(specFixture(root, { decision: '' })), /decision/);
  assert.throws(() => loadSpec(specFixture(root, { personas: [{ key: 'Bad Key', who: 'someone who reads it carefully.' }] })), /lowercase/);
  assert.throws(() => loadSpec(specFixture(root, { personas: [
    { key: 'peer', who: 'a peer engineer who weighs depth.' }, { key: 'peer', who: 'another peer engineer who weighs depth.' }] })), /repeated/);
});

test('Markdown passes through with its links; unsupported types are refused', t => {
  const root = scratch(t);
  const doc = path.join(root, 'readme.md');
  fs.writeFileSync(doc, '# Tool\nSee [the docs](https://example.com/docs) and https://example.com/raw\n');
  const result = extract(doc, path.join(root, 'out'));
  assert.match(fs.readFileSync(result.document, 'utf8'), /# Tool/);
  assert.deepEqual(markdownLinks(fs.readFileSync(doc, 'utf8')), ['the docs -> https://example.com/docs', 'https://example.com/raw']);
  const other = path.join(root, 'deck.key');
  fs.writeFileSync(other, 'x');
  assert.throws(() => extract(other, path.join(root, 'out2')), /Unsupported file type/);
});

test('the recipe flags stay pinned', () => {
  const claude = claudeArgs('PROMPT', { model: 'm', effort: 'high' });
  for (const flag of ['--setting-sources', '--strict-mcp-config', '--no-session-persistence', '--permission-mode']) assert.ok(claude.includes(flag), flag);
  assert.equal(claude[claude.indexOf('--tools') + 1], '');
  assert.equal(claude[claude.indexOf('--setting-sources') + 1], 'project,local');
  const codex = codexArgs('PROMPT', '/tmp/report.md', { model: 'm', effort: 'high' });
  for (const value of ['approval_policy="never"', 'web_search="disabled"', 'features.apps=false', 'features.browser_use=false',
    '--skip-git-repo-check', '--ephemeral', '--json']) assert.ok(codex.includes(value), value);
  assert.equal(codex[codex.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(codex.at(-1), 'PROMPT');
});

test('each run gets its own empty temporary folder and a bare Codex home', async t => {
  const { env, results, reports } = await runFixture(t, 'clean');
  assert.equal(results.length, 4);
  const calls = env.calls();
  const folders = new Set(calls.map(call => call.cwd));
  assert.equal(folders.size, 4);
  for (const call of calls) {
    assert.equal(path.dirname(path.resolve(call.cwd)), path.resolve(fs.realpathSync(os.tmpdir())));
    assert.ok(!fs.existsSync(call.cwd), 'run folders are removed afterwards');
  }
  for (const call of calls.filter(c => c.family === 'codex')) {
    assert.notEqual(call.codexHome, env.realCodex);
    assert.deepEqual(call.codexHomeEntries, ['auth.json']);
  }
  for (const r of results) {
    assert.equal(r.recipe, RECIPE_VERSION);
    assert.deepEqual(r.workdirEntries, []);
  }
  const checks = checkAll(reports, { canaries: ['canary phrase'], terms: ['internal-label'] });
  assert.ok(checks.every(c => c.pass), JSON.stringify(checks));
  assert.match(fs.readFileSync(path.join(reports, 'claude-screener.md'), 'utf8'), /Strong harness line/);
});

test('the check fails a leaked canary and a private term', async t => {
  const { reports } = await runFixture(t, 'leak');
  const checks = checkAll(reports, { canaries: ['canary phrase'], terms: ['signed'] });
  assert.ok(checks.every(c => !c.pass));
  assert.ok(checks.every(c => c.failures.some(f => f.includes('canary'))));
  assert.ok(checks.every(c => c.failures.some(f => f.includes('private term'))));
});

test('the check fails tool calls, extra turns, stray files and errors', async t => {
  const tool = checkAll((await runFixture(t, 'tool')).reports, {});
  assert.ok(tool.filter(c => c.model === 'codex').every(c => c.failures.some(f => f.includes('tool call'))));
  const turns = checkAll((await runFixture(t, 'turns')).reports, {});
  assert.ok(turns.filter(c => c.model === 'claude').every(c => c.failures.some(f => f.includes('turns'))));
  const litter = checkAll((await runFixture(t, 'litter')).reports, {});
  assert.ok(litter.every(c => c.failures.some(f => f.includes('left files'))));
  const failed = checkAll((await runFixture(t, 'fail')).reports, {});
  assert.ok(failed.every(c => c.failures.some(f => f.includes('exited with 2'))));
});

test('Codex tool events are counted from the JSON event log', () => {
  const log = [
    { type: 'item.completed', item: { type: 'agent_message' } },
    { type: 'item.completed', item: { type: 'web_search' } },
    { type: 'item.completed', item: { type: 'mcp_tool_call' } },
  ].map(e => JSON.stringify(e)).join('\n');
  assert.equal(codexToolEvents(log + '\nnot json\n'), 2);
});

test('the profile is optional, read when present and rejected when malformed', t => {
  const root = scratch(t);
  const home = path.join(root, 'home');
  const directory = path.join(home, '.agents', 'skill-profiles');
  fs.mkdirSync(directory, { recursive: true });
  assert.equal(readProfile({ homeDir: home, configDir: undefined }).status, 'default');
  fs.writeFileSync(path.join(directory, 'cold-read.md'), '---\nprofile-version: 1\n---\nCanary: example sign-off\n');
  assert.equal(readProfile({ homeDir: home, configDir: undefined }).instructions, 'Canary: example sign-off');
  fs.writeFileSync(path.join(directory, 'cold-read.md'), 'no frontmatter');
  assert.throws(() => readProfile({ homeDir: home, configDir: undefined }), /frontmatter/);
  assert.throws(() => readProfile({ homeDir: home, configDir: 'relative' }), /absolute/);
});
