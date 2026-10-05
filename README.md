# Agent skills

[![skills.sh](https://skills.sh/b/Thakay/agent-skills)](https://skills.sh/Thakay/agent-skills)
[![Check](https://github.com/Thakay/agent-skills/actions/workflows/check.yml/badge.svg)](https://github.com/Thakay/agent-skills/actions/workflows/check.yml)

Portable agent workflows for Codex, Claude Code, and other [Agent Skills](https://agentskills.io/specification) hosts. Each skill works as installed. Some also read an optional private profile that you keep outside this repository, so updates never overwrite your customization.

## Skills

| Skill | What it does |
|---|---|
| [session-context-close](docs/session-context-close.md) | Preserves decisions, unfinished work, reusable artifacts, and verification state so the next session can pick up where this one stopped. Runs only when invoked explicitly. |

To keep agent tasks recorded, checked, and committed across sessions, see [SAKO](https://github.com/Thakay/sako), a task ledger and finish gate for coding agents. `uvx sako init` installs its own `sako` skill for Claude Code and Codex.

## Install

Requires Git and Node.js. List the skills in this collection:

```sh
npx skills add Thakay/agent-skills --list
```

Install one globally for Codex, as a copy:

```sh
npx skills add Thakay/agent-skills --skill session-context-close --global --agent codex --copy
```

- Use `--agent claude-code` for Claude Code, or name both agents.
- Omit `--global` to install into the current project only.
- `--copy` avoids relying on symlink support. Run the installer separately on each operating system or remote host.
- To pin a release, pass the repository URL with a tag instead of the shorthand, such as `https://github.com/Thakay/agent-skills/tree/v1.1.0`.

Each skill's guide covers how to invoke it on each host and how to customize it.

The installer sends anonymous usage telemetry, which is how [skills.sh](https://skills.sh) counts installs. To opt out, set `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` in the shell that runs it.

## Contributing

New skills and fixes are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
