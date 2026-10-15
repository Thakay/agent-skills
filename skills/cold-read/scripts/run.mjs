// Runs every prompt through each model CLI, one empty temporary folder per run, using isolation recipe 1
// (see references/isolation.md). Writes <model>-<persona>[-r<n>].md, .raw, .err and .meta.json per run.
// Usage: node run.mjs --prompts <dir> --reports <dir> [--models claude,codex] [--runs 1] [--concurrency 8]
//                     [--claude-model <name>] [--codex-model <name>] [--effort <level>] [--timeout-minutes 30]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const RECIPE_VERSION = '1';
export const MODELS = ['claude', 'codex'];
const RUN_PREFIX = 'cold-read-run-';

export function claudeArgs(prompt, { model, effort } = {}) {
  return [
    '-p', prompt,
    ...(model ? ['--model', model] : []),
    ...(effort ? ['--effort', effort] : []),
    '--tools', '',
    '--setting-sources', 'project,local',
    '--strict-mcp-config',
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',
    '--output-format', 'json',
  ];
}

export function codexArgs(prompt, reportFile, { model, effort } = {}) {
  return [
    'exec',
    ...(model ? ['-m', model] : []),
    ...(effort ? ['-c', `model_reasoning_effort="${effort}"`] : []),
    '-c', 'approval_policy="never"',
    '-c', 'web_search="disabled"',
    '-c', 'features.apps=false',
    '-c', 'features.browser_use=false',
    '--sandbox', 'read-only',
    '--skip-git-repo-check',
    '--ephemeral',
    '--json',
    '-o', reportFile,
    prompt,
  ];
}

export function command(model, env = process.env) {
  const override = env[`COLD_READ_${model.toUpperCase()}_CMD`];
  if (override) {
    const parsed = JSON.parse(override);
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(part => typeof part === 'string')) {
      throw new Error(`COLD_READ_${model.toUpperCase()}_CMD must be a JSON array of strings.`);
    }
    return parsed;
  }
  if (process.platform === 'win32') {
    throw new Error(`Run this script inside WSL or another POSIX shell where the ${model} CLI is installed, or set COLD_READ_${model.toUpperCase()}_CMD.`);
  }
  return [model];
}

// A Codex home holding only a link to the login file, so no global AGENTS.md, config or memories load.
export function bareCodexHome(root, env = process.env) {
  const home = path.join(root, 'codex-home');
  fs.mkdirSync(home, { recursive: true });
  const source = path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'auth.json');
  if (fs.existsSync(source)) {
    try {
      fs.symlinkSync(source, path.join(home, 'auth.json'));
    } catch {
      fs.copyFileSync(source, path.join(home, 'auth.json'));
    }
  }
  return home;
}

function removeRunFolder(folder) {
  const resolved = path.resolve(folder);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith(RUN_PREFIX)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

function runOne(job, options) {
  return new Promise(resolve => {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), RUN_PREFIX));
    const base = path.join(options.reports, job.name);
    const report = `${base}.md`;
    const prompt = fs.readFileSync(job.promptFile, 'utf8');
    const args = job.model === 'claude'
      ? claudeArgs(prompt, { model: options.claudeModel, effort: options.effort })
      : codexArgs(prompt, report, { model: options.codexModel, effort: options.effort });
    const env = job.model === 'codex' ? { ...process.env, CODEX_HOME: options.codexHome } : { ...process.env };
    const [program, ...prefix] = command(job.model);
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(program, [...prefix, ...args], { cwd: workdir, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, options.timeoutMinutes * 60 * 1000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const finish = (exit, spawnError) => {
      clearTimeout(timer);
      fs.writeFileSync(`${base}.raw`, stdout);
      fs.writeFileSync(`${base}.err`, spawnError ? `${spawnError.message}\n${stderr}` : stderr);
      if (job.model === 'claude') {
        let text = '';
        try { text = JSON.parse(stdout).result ?? ''; } catch { /* left empty; the check reports it */ }
        fs.writeFileSync(report, text);
      } else if (!fs.existsSync(report)) {
        fs.writeFileSync(report, '');
      }
      const entries = fs.readdirSync(workdir);
      const meta = {
        model: job.model, persona: job.persona, run: job.run, recipe: RECIPE_VERSION,
        exit, timedOut, seconds: Math.round((Date.now() - started) / 100) / 10, workdirEntries: entries,
      };
      fs.writeFileSync(`${base}.meta.json`, JSON.stringify(meta, null, 2) + '\n');
      removeRunFolder(workdir);
      resolve(meta);
    };
    child.on('error', error => finish(null, error));
    child.on('close', code => finish(code, null));
  });
}

export function parseArgs(argv) {
  const options = { models: MODELS, runs: 1, concurrency: 8, timeoutMinutes: 30 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      if (i + 1 >= argv.length) throw new Error(`${flag} needs a value.`);
      return argv[++i];
    };
    if (flag === '--prompts') options.prompts = value();
    else if (flag === '--reports') options.reports = value();
    else if (flag === '--models') options.models = value().split(',').map(m => m.trim()).filter(Boolean);
    else if (flag === '--runs') options.runs = Number(value());
    else if (flag === '--concurrency') options.concurrency = Number(value());
    else if (flag === '--claude-model') options.claudeModel = value();
    else if (flag === '--codex-model') options.codexModel = value();
    else if (flag === '--effort') options.effort = value();
    else if (flag === '--timeout-minutes') options.timeoutMinutes = Number(value());
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (!options.prompts || !options.reports) throw new Error('Usage: node run.mjs --prompts <dir> --reports <dir> [options]');
  for (const model of options.models) if (!MODELS.includes(model)) throw new Error(`Unknown model family ${model}; use claude, codex or both.`);
  for (const key of ['runs', 'concurrency', 'timeoutMinutes']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`--${key} must be a whole number of at least 1.`);
  }
  return options;
}

export async function runAll(options) {
  const promptFiles = fs.readdirSync(options.prompts).filter(f => f.endsWith('.txt')).sort();
  if (!promptFiles.length) throw new Error(`No .txt prompts in ${options.prompts}.`);
  fs.mkdirSync(options.reports, { recursive: true });
  const homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-read-home-'));
  const jobs = [];
  for (const file of promptFiles) {
    const persona = path.basename(file, '.txt');
    for (const model of options.models) {
      for (let run = 1; run <= options.runs; run++) {
        jobs.push({ model, persona, run, promptFile: path.join(options.prompts, file),
          name: options.runs > 1 ? `${model}-${persona}-r${run}` : `${model}-${persona}` });
      }
    }
  }
  try {
    const shared = { ...options, codexHome: options.models.includes('codex') ? bareCodexHome(homeRoot) : null };
    const results = [];
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        results.push(await runOne(job, shared));
      }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency, jobs.length) }, worker));
    return results.sort((a, b) => `${a.model}${a.persona}${a.run}`.localeCompare(`${b.model}${b.persona}${b.run}`));
  } finally {
    fs.rmSync(homeRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const results = await runAll(options);
    for (const r of results) {
      process.stdout.write(`${r.model} ${r.persona} run ${r.run}: exit ${r.exit}, ${r.seconds}s, folder entries ${r.workdirEntries.length}\n`);
    }
    process.stdout.write(`Done: ${results.length} run(s). Next: node check-isolation.mjs --reports ${options.reports}\n`);
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
