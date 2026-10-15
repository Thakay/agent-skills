// Checks that every cold-read run stayed isolated before anyone trusts its report.
// Usage: node check-isolation.mjs --reports <dir> [--canary <phrase>]... [--term <text>]...
// Exit code 1 when any run fails. Writes <dir>/isolation.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CODEX_TOOL_ITEMS = new Set(['command_execution', 'web_search', 'mcp_tool_call', 'file_change']);

export function codexToolEvents(raw) {
  let count = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    const itemType = event?.item?.type;
    if (CODEX_TOOL_ITEMS.has(itemType) || /web_search/.test(String(event?.type ?? ''))) count++;
  }
  return count;
}

export function checkRun(reportsDir, metaFile, { canaries = [], terms = [] } = {}) {
  const meta = JSON.parse(fs.readFileSync(path.join(reportsDir, metaFile), 'utf8'));
  const base = path.join(reportsDir, metaFile.replace(/\.meta\.json$/, ''));
  const read = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
  const report = read(`${base}.md`);
  const raw = read(`${base}.raw`);
  const failures = [];
  if (meta.exit !== 0) failures.push(meta.timedOut ? 'timed out' : `exited with ${meta.exit}`);
  if (!report.trim()) failures.push('empty report');
  if (meta.workdirEntries?.length) failures.push(`left files in its folder: ${meta.workdirEntries.join(', ')}`);
  if (meta.model === 'claude') {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { failures.push('output is not the expected JSON'); }
    if (parsed?.is_error) failures.push('the CLI reported an error');
    if (parsed && parsed.num_turns !== undefined && parsed.num_turns !== 1) failures.push(`took ${parsed.num_turns} turns, not 1`);
  } else {
    const tools = codexToolEvents(raw);
    if (tools) failures.push(`made ${tools} tool call(s)`);
  }
  const lower = report.toLowerCase();
  for (const phrase of canaries) if (phrase && lower.includes(phrase.toLowerCase())) failures.push(`canary "${phrase}" appears`);
  for (const term of terms) if (term && lower.includes(term.toLowerCase())) failures.push(`private term "${term}" appears`);
  return { name: path.basename(base), model: meta.model, persona: meta.persona, run: meta.run, pass: failures.length === 0, failures };
}

export function checkAll(reportsDir, options) {
  const metas = fs.readdirSync(reportsDir).filter(f => f.endsWith('.meta.json')).sort();
  if (!metas.length) throw new Error(`No .meta.json files in ${reportsDir}; run run.mjs first.`);
  return metas.map(meta => checkRun(reportsDir, meta, options));
}

export function parseArgs(argv) {
  const options = { canaries: [], terms: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (i + 1 >= argv.length) throw new Error(`${flag} needs a value.`);
    const value = argv[++i];
    if (flag === '--reports') options.reports = value;
    else if (flag === '--canary') options.canaries.push(value);
    else if (flag === '--term') options.terms.push(value);
    else throw new Error(`Unknown option ${flag}.`);
  }
  if (!options.reports) throw new Error('Usage: node check-isolation.mjs --reports <dir> [--canary <phrase>]... [--term <text>]...');
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const results = checkAll(options.reports, options);
    for (const r of results) {
      process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : `: ${r.failures.join('; ')}`}\n`);
    }
    const failed = results.filter(r => !r.pass).length;
    fs.writeFileSync(path.join(options.reports, 'isolation.json'),
      JSON.stringify({ canaries: options.canaries.length, terms: options.terms.length, results }, null, 2) + '\n');
    process.stdout.write(failed
      ? `${failed} of ${results.length} run(s) failed. Discard those reports, fix the cause and rerun them.\n`
      : `All ${results.length} run(s) passed with ${options.canaries.length} canary phrase(s) and ${options.terms.length} private term(s).\n`);
    if (failed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
