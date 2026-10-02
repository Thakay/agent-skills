# Validation

What was verified for each skill version. Add a section when you verify a new one.

## session-context-close 1.0.0

Verified on Windows with Node.js 24.19.0 and skills CLI 1.7.0:

- All 19 dependency-free profile tests passed: native-home lookup, explicit overrides, missing and invalid profiles, UTF-8 and CRLF, size limits, CLI exit status, instruction omission in check mode, and read-only handling of profile text.
- The Codex skill-creator frontmatter validator passed.
- Installation from the private GitHub repository through npx succeeded, targeting only Codex with copy mode and installer telemetry disabled.
- All four installed skill files matched the source by SHA-256.
- The installed Codex app-server's native skills listing found exactly one enabled user skill with the expected interface and no skill-specific parsing errors.
- Explicit-only Codex metadata was present in the installed package. The installed helper loaded the external profile from the ordinary sandbox without escalation.
- Reinstalling the managed skill preserved both external customization files byte-for-byte.
- Eight pre-existing Windows configuration/skill preservation checks passed. The reference skill in the separate WSL environment retained its original hash; no WSL changes were made.
- The 15-file distribution passed its inventory and private-data pattern checks. Source files were also reviewed against the private reference material for identifying details and private integrations.

## Setup issues resolved

The initially proposed configuration folder was blocked by the Windows sandbox. The tested default is now `.agents/skill-profiles` under the native user home. The official validator initially lacked its YAML dependency; an isolated temporary dependency resolved that without changing the global Python environment. Trailing blank lines were fixed before the first commit. The installer used the shared `.agents/skills` location, and verification was corrected to use that actual destination.

## Reproduce and understand the limits

Run `node --test` and `node tools/verify-distribution.mjs`. Validate the external profile with the installed `scripts/read-profile.mjs --check`.

These checks establish profile handling, package integrity, installation, and native discovery. They do not prove every future model decision. No close operation was run against a live user project as an installation test; semantic trigger behavior and full end-to-end handoffs remain behavior to evaluate in a disposable project. Claude Code and other hosts were not modified or runtime-tested.

Raw logs, actual account names and paths, private profiles, and reference hashes remain outside this repository. Reinstall survival does not establish off-device backup coverage for local customization.
