import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PROFILE_LIMIT = 64 * 1024;

export function readProfile({
  homeDir = os.homedir(),
  configDir = process.env.AGENT_SKILLS_CONFIG_DIR,
} = {}) {
  const explicit = typeof configDir === 'string' && configDir.trim() !== '';
  if (explicit && !path.isAbsolute(configDir)) {
    throw new Error('AGENT_SKILLS_CONFIG_DIR must be an absolute path.');
  }
  if (!explicit && (!homeDir || !path.isAbsolute(homeDir))) {
    throw new Error('Cannot determine an absolute user home directory.');
  }
  const directory = explicit ? path.resolve(configDir) : path.join(homeDir, '.agents', 'skill-profiles');
  const filename = path.join(directory, 'session-context-close.md');
  let handle;
  try {
    if (!fs.statSync(filename).isFile()) {
      throw new Error('Not a regular profile file.');
    }
    handle = fs.openSync(filename, 'r');
  } catch (error) {
    if (error.code === 'ENOENT' && !explicit) {
      return { status: 'default', path: filename, version: null, sha256: null };
    }
    throw new Error(explicit && error.code === 'ENOENT'
      ? 'The explicitly configured session-close profile is missing.'
      : 'The session-close profile cannot be opened.');
  }
  let bytes;
  try {
    const stat = fs.fstatSync(handle);
    if (!stat.isFile()) throw new Error('The session-close profile must be a regular file.');
    if (stat.size > PROFILE_LIMIT) throw new Error('The session-close profile exceeds 64 KiB.');
    const buffer = Buffer.alloc(PROFILE_LIMIT + 1);
    let total = 0;
    while (total < buffer.length) {
      const count = fs.readSync(handle, buffer, total, buffer.length - total, null);
      if (count === 0) break;
      total += count;
    }
    if (total > PROFILE_LIMIT) throw new Error('The session-close profile exceeds 64 KiB.');
    bytes = buffer.subarray(0, total);
  } finally {
    fs.closeSync(handle);
  }
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('The session-close profile must be valid UTF-8.');
  }
  content = content.replace(/^\uFEFF/, '');
  const frontmatter = /^---\r?\nprofile-version: ([0-9]+)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!frontmatter) throw new Error('The profile needs the documented profile-version frontmatter.');
  if (frontmatter[1] !== '1') throw new Error('Unsupported profile version; this skill accepts version 1.');
  return {
    status: 'loaded',
    path: filename,
    version: 1,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    instructions: content.slice(frontmatter[0].length).trim(),
  };
}

export function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: node read-profile.mjs [--check]');
  }
  const result = readProfile();
  if (args[0] === '--check') delete result.instructions;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
