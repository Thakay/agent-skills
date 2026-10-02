# session-context-close

Preserves the information a fresh session cannot cheaply reconstruct: decisions, unfinished work, useful scratch artifacts, live processes, and the actual verification state. It updates existing project records and respects ownership of other people's work.

The skill works with or without Git, persistent memory, a task ledger, or a user profile. Missing capabilities are reported. It does not promise a full-machine backup or reconstruct unavailable conversation history.

## Install and invoke

```sh
npx skills add Thakay/agent-skills --skill session-context-close --global --agent codex --copy
```

Run it explicitly. Discussing, installing, editing, or reviewing the skill is not a request to execute it.

- **Codex:** the bundled `agents/openai.yaml` disables implicit invocation. Use `$session-context-close` and ask it to close the current session.
- **Claude Code:** merge this entry into your existing user or project settings, keeping other keys, then use `/session-context-close`. It restricts invocation natively without editing the installed skill:
  ```json
  {"skillOverrides": {"session-context-close": "user-invocable-only"}}
  ```
- **Other Agent Skills hosts:** the shared instructions require an explicit request, but native invocation controls vary. Configure the host's manual-only setting when available. Do not assume a shared file format provides identical enforcement.

The optional profile reader uses only Node built-ins; hosts without Node can follow the documented file-reading procedure. Windows Codex installation and loader verification are recorded in [validation](VALIDATION.md). Claude Code and other hosts need their own runtime verification.

## Customize without editing the installed skill

A versioned Markdown profile can change preferences, supply local paths, or integrate your task system. It stays outside both this repository and the installed skill, so an update, which replaces the skill files, does not replace your profile. Do not create a second skill with the same name to simulate an override; the skill explicitly loads the profile before doing work.

### 1. Choose the profile location

Default: `.agents/skill-profiles/session-context-close.md` under your native OS home directory.

Windows PowerShell:

```powershell
$profileDirectory = Join-Path $env:USERPROFILE '.agents/skill-profiles'
New-Item -ItemType Directory -Force -Path $profileDirectory
```

POSIX:

```sh
mkdir -p "$HOME/.agents/skill-profiles"
```

Copy [the example](../examples/session-context-close.md) to that directory and edit it. Preserve an existing profile rather than overwriting it. Keep the frontmatter's `profile-version: 1`.

Alternatively set `AGENT_SKILLS_CONFIG_DIR` to an absolute directory containing the file. The harness process must inherit that environment setting; after changing a persistent setting, restart the host if necessary. The default location needs no environment setup.

### 2. Write only your differences

Useful additions include preferred summary length, an existing private notes destination, rules for your task system, or the location of backup status evidence. Keep account data, credentials, personal notes, and raw transcripts out of the distributed repository.

Project-specific handoff paths, commit rules, and verification requirements usually belong in the project's existing instructions. Avoid repeating them in a global profile where they will become stale.

A local task-system integration can say:
- How to recognize a project using the system.
- Which documented commands own task state.
- Where unfinished work and live processes should be recorded.
- Which ownership or lifecycle rules must be preserved.

For substantial conditional instructions, place a sibling reference beside your profile and tell the agent to read it only when relevant. Use profile-directory-relative references and explain that base explicitly. All files in that private configuration directory need their own backup coverage.

Do not use profile prose to enable automatic invocation. Codex's invocation policy lives in the installed `agents/openai.yaml`; other hosts have their own settings.

### 3. Verify

Run the installed skill's `scripts/read-profile.mjs --check` with Node, or inspect the file through the harness. The helper reports the resolved location and a content hash without printing private instructions. See [the full contract](../skills/session-context-close/references/profile-contract.md) for exact validation and fallback behavior.

An absent default profile uses the general workflow. An invalid profile or missing explicitly configured profile must be resolved before the sweep makes changes. The skill never silently drops an invalid customization.

Test a close in a disposable project with an existing handoff, unfinished work, and an unrelated staged file. Confirm it preserves ownership, follows the existing record location, and reports actual verification. Test vague closing language separately: it must not trigger this manual skill.

## Updates and recovery

Preserve profiles in a separate private configuration repository or an explicitly configured backup. Installer lockfiles do not preserve profile contents. A saved local file is not evidence of an off-device backup.

Keep shared preferences consistent across hosts, and use different local profiles for different machine paths. A bootstrap script can assemble shared preferences and machine-specific instructions into this one file; the skill itself does not guess how to merge multiple profiles.

Install a chosen new release, run `--check`, and try the same disposable close again. For rollback, install the previous release; retain your external profile. If the profile contract changes in a future major release, migrate a copy and keep the previous profile until verified.
