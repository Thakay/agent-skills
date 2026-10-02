import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const intended = new Set([
  '.gitattributes', '.gitignore', 'AGENTS.md', 'CHANGELOG.md', 'README.md', 'package.json',
  'docs/CUSTOMIZATION.md', 'docs/VALIDATION.md', 'examples/session-context-close.md',
  'skills/session-context-close/SKILL.md',
  'skills/session-context-close/agents/openai.yaml',
  'skills/session-context-close/references/profile-contract.md',
  'skills/session-context-close/scripts/read-profile.mjs',
  'tests/profile.test.mjs', 'tools/verify-distribution.mjs',
]);
const found = [];
function walk(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!prefix && entry.name === '.git') continue;
    const relative = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), 'Unexpected symlink: ' + relative);
    if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + '/');
    else found.push(relative);
  }
}
walk(root);
assert.deepEqual([...found].sort(), [...intended].sort(), 'Review unexpected or missing distributed files.');
const hazards = [
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
  /(?:sk-proj-|sk-ant-)[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /(?:https?:\/\/)[^\s/]+:[^\s/]+@/,
  /(?:\/home|\/Users)\/[A-Za-z0-9_.-]+\//,
  /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+[\\/]/,
];
for (const relative of found) {
  const contents = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const hazard of hazards) assert.ok(!hazard.test(contents), 'Potential private data in ' + relative);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(manifest.private, true, 'Prevent accidental npm publication.');
const skill = fs.readFileSync(path.join(root, 'skills/session-context-close/SKILL.md'), 'utf8');
assert.match(skill, /^---\nname: session-context-close\ndescription: [^\n]+\nmetadata:\n/);
const policy = fs.readFileSync(path.join(root, 'skills/session-context-close/agents/openai.yaml'), 'utf8');
assert.match(policy, /policy:\n  allow_implicit_invocation: false/);
console.log('Distribution verified: ' + found.length + ' intended files; private-data pattern checks passed.');
console.log('Automated checks supplement, and do not replace, reviewing all staged content.');
