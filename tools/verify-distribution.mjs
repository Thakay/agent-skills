import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const problems = [];

// Everything that could be committed: tracked files plus untracked files that are not ignored.
const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
  .split('\0').filter(file => file && fs.existsSync(path.join(root, file)));
const fileSet = new Set(files);

const topLevel = new Set([
  '.gitattributes', '.github', '.gitignore', 'AGENTS.md', 'CHANGELOG.md', 'CLAUDE.md', 'CONTRIBUTING.md',
  'LICENSE', 'README.md', 'docs', 'examples', 'package.json', 'skills', 'tests', 'tools',
]);
for (const file of files) {
  if (!topLevel.has(file.split('/')[0])) problems.push(`Unexpected top-level path: ${file}`);
  if (fs.lstatSync(path.join(root, file)).isSymbolicLink()) problems.push(`Symlinks are not distributed: ${file}`);
}

const hazards = [
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
  /(?:sk-proj-|sk-ant-)[A-Za-z0-9_-]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /(?:https?:\/\/)[^\s/]+:[^\s/]+@/,
  /(?:\/home|\/Users)\/[A-Za-z0-9_.-]+\//,
  /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+[\\/]/,
];

// Optional maintainer-only list of personal terms. The .private/ folder is gitignored, so CI never sees it.
const denylistFile = path.join(root, '.private', 'denylist.txt');
const denylist = fs.existsSync(denylistFile)
  ? fs.readFileSync(denylistFile, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
  : null;
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole words, ignoring case, so a short name does not match inside a longer word.
const denied = (denylist ?? []).map(term => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'iu'));
const scanDenied = (text, where) => denied.forEach((pattern, index) => {
  if (pattern.test(text)) problems.push(`Denylist entry ${index + 1} matches ${where}`);
});

for (const file of files) {
  scanDenied(file, `the path ${file}`);
  read(file).split('\n').forEach((line, index) => {
    if (hazards.some(pattern => pattern.test(line))) problems.push(`Possible secret or personal path: ${file}:${index + 1}`);
    scanDenied(line, `${file}:${index + 1}`);
  });
}
if (denylist) {
  for (const name of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) scanDenied(git('var', name), `your git identity (${name})`);
  for (const entry of git('log', '--all', '--format=%h %an %ae %cn %ce%n%B%x00').split('\0')) {
    scanDenied(entry, `commit ${entry.trim().split(' ')[0]}`);
  }
  for (const entry of git('for-each-ref', 'refs/tags', '--format=%(refname:short) %(taggername) %(taggeremail) %(contents)%00').split('\0')) {
    scanDenied(entry, `tag ${entry.trim().split(' ')[0]}`);
  }
}

// Relative Markdown links must resolve; links in an installed skill must stay inside its folder.
for (const file of files.filter(file => file.endsWith('.md'))) {
  const skillRoot = file.startsWith('skills/') ? `skills/${file.split('/')[1]}/` : null;
  const text = read(file).replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1/gm, '');
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(target.split('#')[0])));
    if (!fs.existsSync(path.join(root, resolved))) problems.push(`Broken link in ${file}: ${target}`);
    else if (skillRoot && !resolved.startsWith(skillRoot)) problems.push(`${file} links outside its skill folder: ${target}`);
  }
}

// Reads the top-level scalar fields of SKILL.md frontmatter, including folded block scalars.
function frontmatter(text) {
  const block = /^﻿?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!block) return null;
  const fields = {};
  const lines = block[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!field) continue;
    let value = field[2].trim();
    if (/^[>|][+-]?$/.test(value)) {
      const folded = [];
      while (i + 1 < lines.length && /^(\s|$)/.test(lines[i + 1])) folded.push(lines[++i].trim());
      value = folded.join(' ').trim();
    } else if (/^(["']).*\1$/.test(value)) {
      value = value.slice(1, -1);
    }
    fields[field[1]] = value;
  }
  return fields;
}

const readme = read('README.md');
const skills = new Set();
for (const file of files.filter(file => file.startsWith('skills/'))) {
  const parts = file.split('/');
  if (parts.length < 3) problems.push(`Put files inside a skill folder: ${file}`);
  else skills.add(parts[1]);
}
for (const name of [...skills].sort()) {
  const skillFile = `skills/${name}/SKILL.md`;
  const fields = fileSet.has(skillFile) ? frontmatter(read(skillFile)) : null;
  if (!fields) {
    problems.push(`${skillFile} is missing or has no frontmatter`);
    continue;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    problems.push(`Skill folder "${name}" must be at most 64 lowercase letters, digits, and single hyphens`);
  }
  if (fields.name !== name) problems.push(`${skillFile}: name must match the folder name`);
  if (!fields.description || fields.description.length > 1024) problems.push(`${skillFile}: description must be 1 to 1024 characters`);
  if (!fields.license) problems.push(`${skillFile}: add a license field, such as license: MIT`);
  if (!fileSet.has(`docs/${name}.md`) || !readme.includes(`](docs/${name}.md)`)) {
    problems.push(`Add docs/${name}.md and link it from the README Skills table`);
  }
}
if (!skills.size) problems.push('No skills found under skills/.');

if (JSON.parse(read('package.json')).private !== true) problems.push('package.json must keep "private": true to prevent npm publication.');

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}
console.log(`Verified ${skills.size} skill(s) and ${files.length} files.`);
console.log(denylist
  ? `Local denylist: ${denylist.length} term(s) checked against files, git identity, commits, and tags.`
  : 'No local denylist at .private/denylist.txt; personal-term scan skipped.');
console.log('Automated checks supplement, and do not replace, reviewing all staged content.');
