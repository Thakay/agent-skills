---
profile-version: 1
---

# Example local preferences

- Canary phrases: pass each to `check-isolation.mjs` as `--canary`. Replace these with habits only your own rules give agents.
  - `<your sign-off line>`
  - `<a signature phrase from your rules>`
- Private terms: pass each as `--term`. Use words a stranger could not know, such as your own file names or internal labels.
  - `<a private file name>`
  - `<an internal label>`
- Models: run both families. Claude Code with `--claude-model <model>`, Codex with `--codex-model <model>`, both at `--effort high`.
- Where to run: the scripts and both CLIs run in `<your shell or WSL distribution>`. Add `<a PATH entry>` if a CLI is not found.
- Reports: save them next to the document in `cold-reads-<date>/`.

Keep machine paths and real terms in your private copy only.
