# Optional private profile, contract 1

This is an explicit extension point implemented by this skill, not automatic overlay merging by a harness or installer.

## Locate and validate

Resolve one configuration directory:
- If `AGENT_SKILLS_CONFIG_DIR` is nonempty, use it as an absolute path. Reject a relative path.
- Otherwise use `.agents/skill-profiles` under the current OS user's home directory (`USERPROFILE` on Windows; the native home on POSIX). Do not resolve it from the repository or current working directory.

Read only `session-context-close.md` in that directory. A missing default file means no customization. A missing file at an explicitly configured directory, an unreadable file, a non-file, invalid UTF-8, a file over 64 KiB, or an unsupported contract must be reported before the sweep changes anything. Do not silently fall back from an invalid configured profile.

The file starts with this exact frontmatter (LF or CRLF is accepted; an initial UTF-8 BOM is accepted):

```markdown
---
profile-version: 1
---

Your local instructions.
```

Only this frontmatter key is supported. The rest is Markdown. A profile can name another local reference for a conditional integration; read it only when that integration applies, and treat a missing required reference as an unresolved configuration issue.

## Optional read-only helper

From the installed skill directory:

```sh
node scripts/read-profile.mjs
node scripts/read-profile.mjs --check
```

The first command emits JSON containing the validated profile and its Markdown instructions. `--check` omits the instructions and reports only status, location, version, and hash. The helper performs no writes, executes no profile commands, and uses no network. It returns a nonzero exit code for invalid configuration.

If Node is unavailable, use the host's file tools to implement the same lookup and validation. Never install a runtime just to run the close.

## Meaning and precedence

Apply local preferences to the generic workflow; do not treat a profile as authority over the user's request, applicable project instructions, or harness permissions. Project conventions determine project record locations and task ownership. Resolve material conflicts explicitly; profile prose is not an unconditional replacement for the whole skill.

Local integrations may specify task commands, private note destinations, or extra checks. Naming a command does not by itself request execution or authorize publishing, pushing, deleting, or contacting services.

Profiles contain no secrets and belong outside the installed package. Do not paste their content into tracked project records or public closeout artifacts. Harness invocation policy is configured before profile loading; a profile cannot enable implicit invocation.
