// Builds one self-contained cold-read prompt per persona from a spec file.
// Usage: node build-prompts.mjs <spec.json> <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadSpec(specFile) {
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const base = path.dirname(path.resolve(specFile));
  const resolve = file => (file ? path.resolve(base, file) : null);
  const problems = [];
  if (!spec.document) problems.push('spec.document must name the extracted document text.');
  if (!spec.target && !spec.targetFile) problems.push('spec needs target (text) or targetFile (a path).');
  if (!spec.decision) problems.push('spec.decision must say what a reader decides.');
  if (!Array.isArray(spec.personas) || spec.personas.length === 0) problems.push('spec.personas must list at least one persona.');
  const keys = new Set();
  for (const persona of spec.personas ?? []) {
    if (!persona.key || !KEY_PATTERN.test(persona.key)) problems.push(`Persona key "${persona.key}" must use lowercase letters, digits and single hyphens.`);
    if (keys.has(persona.key)) problems.push(`Persona key "${persona.key}" is repeated.`);
    keys.add(persona.key);
    if (!persona.who || persona.who.trim().length < 20) problems.push(`Persona "${persona.key}" needs a "who" of at least 20 characters.`);
  }
  if (spec.axes && !Array.isArray(spec.axes)) problems.push('spec.axes must be a list.');
  if (problems.length) throw new Error(problems.join('\n'));
  return {
    documentText: fs.readFileSync(resolve(spec.document), 'utf8').trim(),
    linksText: spec.links && fs.existsSync(resolve(spec.links)) ? fs.readFileSync(resolve(spec.links), 'utf8').trim() : '',
    target: (spec.target ?? fs.readFileSync(resolve(spec.targetFile), 'utf8')).trim(),
    decision: spec.decision.trim(),
    axes: spec.axes?.length ? spec.axes : ['overall fit for the target'],
    personas: spec.personas,
    wordLimit: Number.isInteger(spec.wordLimit) ? spec.wordLimit : 600,
  };
}

export function buildPrompt(spec, persona) {
  const who = persona.who.trim().replace(/^you are\s+/i, '');
  const axes = spec.axes.map(axis => `"${axis}"`).join(', ');
  const links = spec.linksText
    ? `\n\nLinks on the document (you cannot open them; they only show what the document points to):\n${spec.linksText}`
    : '';
  return `You are ${who}

You are reading one document cold. You know nothing about its author beyond the document below, and you judge it exactly as it stands.

Rules:
- Use only the target description and the document in this message. Do not run commands, open files, search or look anything up, and do not guess what is behind a link.
- Be candid and specific. You are a busy reader deciding where scarce attention goes, not a coach being kind.

<target>
${spec.target}
</target>

<document>
${spec.documentText}${links}
</document>

Answer in this shape, under ${spec.wordLimit} words, in plain language:
1. Verdict: would you ${spec.decision}? Yes, Maybe or No, with one sentence why.
2. Fit from 1 to 5 on each of these, one line each: ${axes}.
3. First 30 seconds: what you noticed first, and the one thing you will remember.
4. Strongest evidence: up to 3 items, each quoting the line.
5. Doubts: up to 4 items, each quoting the line. Include anything that reads inflated, vague, unclear or off-target.
6. Questions you would ask the author: up to 3.
7. Edits: up to 5 concrete changes to the document (cut, reword, move or add), each tied to a line.
`;
}

export function buildPrompts(specFile, outDir) {
  const spec = loadSpec(specFile);
  fs.mkdirSync(outDir, { recursive: true });
  return spec.personas.map(persona => {
    const prompt = buildPrompt(spec, persona);
    const file = path.join(outDir, `${persona.key}.txt`);
    fs.writeFileSync(file, prompt);
    return { key: persona.key, file, words: prompt.split(/\s+/).filter(Boolean).length };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [specFile, outDir] = process.argv.slice(2);
    if (!specFile || !outDir) throw new Error('Usage: node build-prompts.mjs <spec.json> <out-dir>');
    process.stdout.write(JSON.stringify(buildPrompts(specFile, outDir), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
