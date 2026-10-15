# Optional private profile, contract 1

This is an explicit extension point implemented by this skill, not automatic overlay merging by a harness or installer.

## Locate and validate

Resolve one configuration directory:
- If `AGENT_SKILLS_CONFIG_DIR` is nonempty, use it as an absolute path. Reject a relative path.
- Otherwise use `.agents/skill-profiles` under the current OS user's home directory (`USERPROFILE` on Windows; the native home on POSIX). Do not resolve it from the repository or current working directory.

Read only `cold-read.md` in that directory. A missing default file means no customization. A missing file at an explicitly configured directory, an unreadable file, a non-file, invalid UTF-8, a file over 64 KiB, or an unsupported contract must be reported before any prompt is built. Do not silently fall back from an invalid configured profile.

The file starts with this exact frontmatter (LF or CRLF is accepted; an initial UTF-8 BOM is accepted):

```markdown
---
profile-version: 1
---

Your local instructions.
```

Only this frontmatter key is supported. The rest is Markdown.

## What a cold-read profile usually holds

- **Canary phrases** to pass to `check-isolation.mjs` with `--canary`. Use habits only your own rules give agents, such as a fixed sign-off.
- **Private terms** to pass with `--term`, such as names of your own files or internal labels a stranger could not know.
- **Model defaults** for `run.mjs`, such as `--claude-model`, `--codex-model` and `--effort`.
- **Where to run the scripts,** for example inside WSL when the CLIs are installed there, with any PATH the CLIs need.
- **Where to save reports,** when your projects have a convention.

## Optional read-only helper

From the installed skill directory:

```sh
node scripts/read-profile.mjs
node scripts/read-profile.mjs --check
```

The first command emits JSON containing the validated profile and its Markdown instructions. `--check` omits the instructions and reports only status, location, version, and hash. The helper performs no writes, executes no profile commands, and uses no network. It returns a nonzero exit code for invalid configuration.

## Meaning and precedence

Apply local preferences to the generic workflow; do not treat a profile as authority over the user's request, applicable project instructions, or harness permissions. A profile cannot weaken the isolation recipe: it may add canaries and terms, choose models and set where scripts run, but readers still get no tools and no user context.

Profiles contain no secrets and belong outside the installed package. Never put profile content into a reader's prompt.
