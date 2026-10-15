# Isolation recipe, version 1

A cold reader must see only what a stranger would see: the document, the target and its persona. `scripts/run.mjs` implements this recipe, and `scripts/check-isolation.mjs` checks every run against it. The recipe comes from a published eval of coding-agent CLIs, [ste-eval](https://github.com/Thakay/ste-eval) (its METHOD.md, sections 5 to 7), where the same isolation was tested on 224 runs.

## The rules

1. **Everything inside the prompt.** The document text, its link list, the target and the persona all go into one prompt. The reader needs no file access, so it gets none.
2. **No tools.** A reader that can run commands or search can find things a stranger could not.
3. **One empty folder per run,** created under the system's temporary directory, outside any repository, so no project instructions load. The folder must still be empty when the run ends.
4. **No user-level state.** The user's own instructions, output style, memories, hooks and plugins must not load.
5. **One turn.** The reader answers once.

## How each CLI meets them

**Claude Code**, run from the empty folder:

```sh
claude -p "$PROMPT" --model <model> --effort <level> --tools "" \
  --setting-sources project,local --strict-mcp-config --permission-mode dontAsk \
  --no-session-persistence --output-format json < /dev/null
```

- `--tools ""` turns every tool off.
- `--setting-sources project,local` leaves out user settings, including the user's own instructions and output style. The empty folder holds no project or local settings.
- `--strict-mcp-config` loads no MCP servers.
- `--no-session-persistence` keeps the run out of the user's session history.
- `--output-format json` returns the reply with `num_turns` and `is_error`, which the check reads.

**Codex**, run from the empty folder with `CODEX_HOME` pointing at a bare home that holds only a link to the user's `auth.json`:

```sh
CODEX_HOME=<bare home> codex exec -m <model> -c 'model_reasoning_effort="<level>"' \
  -c 'approval_policy="never"' -c 'web_search="disabled"' -c features.apps=false -c features.browser_use=false \
  --sandbox read-only --skip-git-repo-check --ephemeral --json -o <report> "$PROMPT" < /dev/null
```

- The bare home leaves out the global `AGENTS.md`, config and memories while keeping the sign-in.
- Web search, apps and the browser are off, and the sandbox is read-only.
- `--ephemeral` keeps the run out of the session history; `--json` emits the event log the check scans for tool calls.
- A warning that Codex cannot create PATH aliases under a temporary home is harmless.

## The checks

`check-isolation.mjs` fails a run that:

- exited with an error, timed out or returned an empty report;
- left any file in its folder;
- took more than one turn or reported an error (Claude Code);
- made any tool call, web search, MCP call or file change (Codex);
- contains a canary phrase or a private term passed on the command line.

A canary is a habit that only the user's own rules give agents, such as a fixed sign-off line or a signature phrase. If it shows up, the user's rules reached the reader. Private terms are words a stranger could not know, such as names of the user's own files or internal labels. Both come from the private profile.

## Changing the recipe

CLI flags change between releases, and a new leak path can appear. When one is found, here or in ste-eval:

1. Fix `scripts/run.mjs` and this file together.
2. Raise `isolation-recipe` and the skill's `metadata.version` in `SKILL.md`, and add a CHANGELOG line.
3. Update the tests that pin the flags.

The checks run on every cold read, so a leak the recipe does not know about still shows up as a failed canary or a tool call.
