// Writes a document's text layer to <out>/document.txt and its link targets to <out>/links.txt.
// PDF needs pdftotext (and, for links, pdfinfo) from poppler. Markdown and plain text pass through.
// Usage: node extract.mjs <document> <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function markdownLinks(text) {
  const links = [];
  for (const [, label, target] of text.matchAll(/\[([^\]]+)\]\((\S+?)(?:\s+"[^"]*")?\)/g)) {
    links.push(`${label} -> ${target}`);
  }
  for (const [url] of text.matchAll(/(?<![(\[])\bhttps?:\/\/[^\s)>\]]+/g)) {
    if (!links.some(line => line.endsWith(url))) links.push(url);
  }
  return [...new Set(links)];
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error && result.error.code === 'ENOENT') return { missing: true };
  return { missing: false, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function extract(document, outDir) {
  if (!fs.existsSync(document) || !fs.statSync(document).isFile()) throw new Error(`No such file: ${document}`);
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(document).toLowerCase();
  let text;
  let links = [];
  const notes = [];
  if (ext === '.pdf') {
    const pdf = run('pdftotext', ['-layout', document, '-']);
    if (pdf.missing) throw new Error('pdftotext is not installed. Install poppler, or give a text or Markdown copy of the document.');
    if (pdf.status !== 0) throw new Error(`pdftotext failed: ${pdf.stderr.trim()}`);
    text = pdf.stdout;
    const info = run('pdfinfo', ['-url', document]);
    if (info.missing || info.status !== 0) {
      notes.push('Link targets were not read; pdfinfo -url is unavailable.');
    } else {
      links = [...new Set(info.stdout.split(/\r?\n/).slice(1)
        .map(line => line.trim().split(/\s+/).slice(2).join(' '))
        .filter(Boolean))];
    }
  } else if (['.md', '.markdown', '.txt', '.text'].includes(ext)) {
    text = fs.readFileSync(document, 'utf8');
    if (ext !== '.txt' && ext !== '.text') links = markdownLinks(text);
  } else {
    throw new Error(`Unsupported file type ${ext || '(none)'}. Use a PDF, Markdown or text file.`);
  }
  text = text.replace(/\f/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  if (!text.trim()) throw new Error('The document has no text layer. Give a text or Markdown copy.');
  fs.writeFileSync(path.join(outDir, 'document.txt'), text);
  if (links.length) fs.writeFileSync(path.join(outDir, 'links.txt'), links.join('\n') + '\n');
  return { document: path.join(outDir, 'document.txt'), links: links.length ? path.join(outDir, 'links.txt') : null, words: text.split(/\s+/).filter(Boolean).length, notes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [document, outDir] = process.argv.slice(2);
    if (!document || !outDir) throw new Error('Usage: node extract.mjs <document> <out-dir>');
    process.stdout.write(JSON.stringify(extract(document, outDir), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
