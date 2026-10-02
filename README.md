# Portable session skills

Reusable agent workflows with optional private customization outside the installed package.

## Session context close

`session-context-close` preserves the information a fresh session cannot cheaply reconstruct: decisions, unfinished work, useful scratch artifacts, live processes, and the actual verification state. It updates existing project records and respects ownership of other people's work.

Run it explicitly. In Codex, use `$session-context-close` and ask it to close the current session. In Claude Code, use `/session-context-close` after configuring manual invocation below. Discussing, installing, editing, or reviewing the skill is not a request to execute it.

The skill works with or without Git, persistent memory, a task ledger, or a user profile. Missing capabilities are reported. It does not promise a full-machine backup or reconstruct unavailable conversation history.

## Install

Requires Git and Node.js compatible with the chosen skills CLI release. Replace `OWNER/REPOSITORY` below with the source repository. Authenticate private repository access through your existing Git, GitHub CLI, or SSH setup.

```sh
npx skills@1.7.0 add OWNER/REPOSITORY --skill session-context-close --global --agent codex --copy
```

Choose `--agent claude-code` for Claude or list both agents to install to both. Run the installer separately on each operating system or remote host. Omitting `--global` installs for the current project. Copies avoid relying on symlink support.

To disable installer telemetry, set `DISABLE_TELEMETRY=1` and `DO_NOT_TRACK=1` in the shell running it. In PowerShell use `$env:DISABLE_TELEMETRY = "1"`; in a POSIX shell use `export DISABLE_TELEMETRY=1`. This affects installation reporting, not the skill's behavior.

Inspect first with `npx skills@1.7.0 add OWNER/REPOSITORY --list`. For a named release, use the full repository URL ending in `/tree/v1.0.0` instead of the shorthand. The release tag identifies skill content; `skills@1.7.0` identifies the installer.

## Invocation and compatibility

- **Codex:** bundled `agents/openai.yaml` disables implicit invocation. Use `$session-context-close` explicitly.
- **Claude Code:** merge the following entry into your existing user or project settings; preserve other keys. This provides a native invocation restriction without editing the installed skill:
  ```json
  {"skillOverrides": {"session-context-close": "user-invocable-only"}}
  ```
- **Other Agent Skills hosts:** the shared instructions require an explicit request, but native invocation controls vary. Configure the host's manual-only setting when available. Do not assume a shared file format provides identical enforcement.

The shared manifest uses standard fields. The optional profile reader uses only Node built-ins; hosts without Node can follow the documented file-reading procedure. Windows Codex installation and loader verification are covered in [validation](docs/VALIDATION.md). Claude and other hosts require their own runtime verification.

## Customize

Follow [the customization guide](docs/CUSTOMIZATION.md). A versioned Markdown profile can change preferences, supply local paths, or integrate your task system. It stays outside both this source repository and the installed skill, so replacing the skill does not replace your profile.

Do not create a second skill with the same name to simulate an override. The skill explicitly loads the profile before doing work.

## Maintain and share

Edit reusable behavior in this repository, review the changes, run the checks below, and tag a release. Edit personal behavior in the external profile. Install a chosen release explicitly when reproducibility matters; keep the previous release available for rollback.

```sh
node --test
node tools/verify-distribution.mjs
```

Keep local profiles in a separate private configuration backup with explicit inclusion rules. An installation lockfile describes dependencies; it is not a backup of your custom profile.

No public publication, registry listing, or redistribution license is implied by this repository. Select a license and review the complete Git history before making a public release.

References: [Agent Skills specification](https://agentskills.io/specification), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude skills](https://code.claude.com/docs/en/skills), [skills CLI](https://github.com/vercel-labs/skills).
