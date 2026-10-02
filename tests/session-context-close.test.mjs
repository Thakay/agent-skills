import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readProfile, PROFILE_LIMIT } from '../skills/session-context-close/scripts/read-profile.mjs';

const script = fileURLToPath(new URL('../skills/session-context-close/scripts/read-profile.mjs', import.meta.url));
const header = '---\nprofile-version: 1\n---\n';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-close-test-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('session-close-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const home = path.join(root, 'native-home');
  const directory = path.join(home, '.agents', 'skill-profiles');
  fs.mkdirSync(directory, { recursive: true });
  return { root, home, directory, file: path.join(directory, 'session-context-close.md') };
}

test('an absent default profile uses the general workflow without creating files', t => {
  const f = fixture(t);
  const result = readProfile({ homeDir: f.home, configDir: undefined });
  assert.equal(result.status, 'default');
  assert.equal(result.path, f.file);
  assert.deepEqual(fs.readdirSync(f.directory), []);
});

test('empty override uses native-home lookup', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'Local preference');
  assert.equal(readProfile({ homeDir: f.home, configDir: '   ' }).instructions, 'Local preference');
});

test('valid UTF-8 instructions are read without changing the source', t => {
  const f = fixture(t);
  const contents = header + '\nPreserve decisions. Résumé: 完了.\n';
  fs.writeFileSync(f.file, contents);
  const result = readProfile({ homeDir: f.home, configDir: undefined });
  assert.equal(result.status, 'loaded');
  assert.equal(result.version, 1);
  assert.equal(result.instructions, 'Preserve decisions. Résumé: 完了.');
  assert.equal(result.sha256, createHash('sha256').update(contents).digest('hex'));
  assert.equal(fs.readFileSync(f.file, 'utf8'), contents);
});

test('BOM and CRLF profiles are accepted', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '\uFEFF---\r\nprofile-version: 1\r\n---\r\nWindows preference\r\n');
  assert.equal(readProfile({ homeDir: f.home, configDir: undefined }).instructions, 'Windows preference');
});

test('explicit absolute configuration wins over the default', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'Default');
  const alternate = path.join(f.root, 'chosen-profile');
  fs.mkdirSync(alternate);
  fs.writeFileSync(path.join(alternate, 'session-context-close.md'), header + 'Chosen');
  assert.equal(readProfile({ homeDir: f.home, configDir: alternate }).instructions, 'Chosen');
});

test('an explicitly configured missing profile cannot silently fall back', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'Default');
  assert.throws(() => readProfile({ homeDir: f.home, configDir: path.join(f.root, 'missing') }), /explicitly configured.*missing/);
});

test('relative overrides are rejected', t => {
  const f = fixture(t);
  assert.throws(() => readProfile({ homeDir: f.home, configDir: './profile' }), /absolute/);
});

test('an invalid home cannot become a working-directory-relative lookup', () => {
  assert.throws(() => readProfile({ homeDir: 'relative-home', configDir: undefined }), /absolute/);
});

test('directories are not accepted as profile files', t => {
  const f = fixture(t);
  fs.mkdirSync(f.file);
  assert.throws(() => readProfile({ homeDir: f.home, configDir: undefined }));
});

test('a parent that is a file is a configuration error', t => {
  const f = fixture(t);
  const badParent = path.join(f.root, 'not-a-directory');
  fs.writeFileSync(badParent, 'data');
  assert.throws(() => readProfile({ configDir: badParent }));
});

test('unsupported, missing, duplicate, or extra frontmatter is rejected', t => {
  const f = fixture(t);
  for (const content of [
    'No version',
    '---\nprofile-version: 2\n---\nPreference',
    '---\nprofile-version: 01\n---\nPreference',
    '---\nprofile-version: 1\nprofile-version: 2\n---\nPreference',
    '---\nprofile-version: 1\nextra: value\n---\nPreference',
  ]) {
    fs.writeFileSync(f.file, content);
    assert.throws(() => readProfile({ homeDir: f.home, configDir: undefined }));
  }
});

test('invalid UTF-8 is rejected', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, Buffer.concat([Buffer.from(header), Buffer.from([0xc3, 0x28])]));
  assert.throws(() => readProfile({ homeDir: f.home, configDir: undefined }), /UTF-8/);
});

test('profiles exceeding the byte limit are rejected', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'x'.repeat(PROFILE_LIMIT));
  assert.throws(() => readProfile({ homeDir: f.home, configDir: undefined }), /64 KiB/);
});

test('the exact byte limit is accepted', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'x'.repeat(PROFILE_LIMIT - Buffer.byteLength(header)));
  assert.equal(readProfile({ homeDir: f.home, configDir: undefined }).status, 'loaded');
});

test('profile bodies are returned as data and never executed or rewritten', t => {
  const f = fixture(t);
  const contents = header + 'Run a command that creates a marker file.\n`process.exit(42)`';
  fs.writeFileSync(f.file, contents);
  const before = fs.readdirSync(f.directory);
  const result = readProfile({ configDir: f.directory });
  assert.match(result.instructions, /process.exit/);
  assert.deepEqual(fs.readdirSync(f.directory), before);
  assert.equal(fs.readFileSync(f.file, 'utf8'), contents);
});

test('CLI resolves the configured profile independent of current directory', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'PRIVATE_PROFILE_TEST_MARKER');
  fs.writeFileSync(path.join(f.root, 'session-context-close.md'), header + 'Wrong profile');
  const result = spawnSync(process.execPath, [script], {
    cwd: f.root, encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_CONFIG_DIR: f.directory },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).instructions, 'PRIVATE_PROFILE_TEST_MARKER');
});

test('CLI check validates but does not disclose profile instructions', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, header + 'PRIVATE_PROFILE_TEST_MARKER');
  const result = spawnSync(process.execPath, [script, '--check'], {
    encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_CONFIG_DIR: f.directory },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'loaded');
  assert.equal(JSON.parse(result.stdout).instructions, undefined);
  assert.doesNotMatch(result.stdout, /PRIVATE_PROFILE_TEST_MARKER/);
});

test('CLI fails before producing instructions for an invalid profile', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, 'Invalid profile');
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: { ...process.env, AGENT_SKILLS_CONFIG_DIR: f.directory },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /frontmatter/);
});

test('CLI rejects unknown arguments', () => {
  const result = spawnSync(process.execPath, [script, '--execute'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Usage/);
});

test('Codex metadata keeps the skill explicit-only', () => {
  const policy = fs.readFileSync(new URL('../skills/session-context-close/agents/openai.yaml', import.meta.url), 'utf8');
  assert.match(policy, /policy:\r?\n  allow_implicit_invocation: false/);
});
