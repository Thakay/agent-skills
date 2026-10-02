# Contributing

Issues and pull requests are welcome. A skill belongs here when it helps beyond one person's setup: no personal accounts, machine paths, private projects, or private task systems. Personal behavior belongs in a local profile; [session-context-close](docs/session-context-close.md#customize-without-editing-the-installed-skill) shows the pattern.

## Layout

| Path | Holds | Installed with the skill |
|---|---|---|
| `skills/<name>/` | `SKILL.md`, plus optional `scripts/`, `references/`, `assets/`, and host metadata such as `agents/openai.yaml` | Yes |
| `docs/<name>.md` | The human guide: what the skill does, how to invoke it on each host, customization, limits | No |
| `examples/<name>.md` | An example profile, if the skill reads one | No |
| `tests/<name>.test.mjs` | Tests for the skill's scripts and metadata | No |

The installer copies only `skills/<name>/`, so keep that folder self-contained: its links and imports stay inside it.

## Add a skill

1. Create `skills/<name>/SKILL.md`. The name uses lowercase letters, digits, and single hyphens (64 characters at most) and matches the folder.

   ```markdown
   ---
   name: <name>
   description: What the skill does and when to use it, in the words a user would say. At most 1024 characters.
   license: MIT
   metadata:
     version: "1.0.0"
   ---

   # <Title>

   Instructions for the agent.
   ```

   Keep `SKILL.md` under 500 lines and move detail into `references/`. See the [Agent Skills specification](https://agentskills.io/specification).
2. If the skill must run only on request, say so in the description and use each host's manual-only control: `agents/openai.yaml` for [Codex](https://developers.openai.com/codex/skills), and a documented `skillOverrides` setting for [Claude Code](https://code.claude.com/docs/en/skills).
3. Write `docs/<name>.md` and add a row to the Skills table in `README.md`.
4. Test any script. Use only Node built-ins, so the checks need no install.
5. Add a line under `## Unreleased` at the top of `CHANGELOG.md` (create the heading if missing), starting with the skill name.

## Change a skill

Bump `metadata.version` in its `SKILL.md` whenever its files change: patch for fixes and wording, minor for new behavior, major when users must change how they invoke or configure it. Keep documented contracts, such as a profile format, compatible within a major version. Add a CHANGELOG line as above.

## Check before you commit

```sh
npm run check
```

This runs the tests and `tools/verify-distribution.mjs`. The verifier checks the top-level layout, each skill's frontmatter, guide, and README row, relative links, and common secret and home-directory patterns. CI runs the same checks on Linux and Windows for every pull request.

To catch personal terms the generic patterns miss, keep a local denylist at `.private/denylist.txt`. The folder is gitignored, so CI never sees it. Put one term per line, such as a name, email, hostname, or private project; lines starting with `#` are comments. Terms match whole words, ignoring case, in file contents and paths, your git identity, commit messages, and tags.

Review every staged file before committing, and stage explicit paths.

## Release

1. Move the `Unreleased` entries in `CHANGELOG.md` under a new version heading, and set the same `version` in `package.json`.
2. Commit, then tag and push: `git tag -a vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`.

The repository version covers the whole collection; each skill's `metadata.version` tracks that skill alone.
