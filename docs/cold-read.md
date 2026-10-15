# cold-read

Shows how a document reads to strangers. Reviewer personas chosen for the document's target, such as a hiring manager, a peer engineer and a first-pass screener, each read it on Claude Code and on Codex. Every reader runs in an empty temporary folder with no tools, no user settings, no memories and no project files, so it sees only the document, the target and its persona. The skill then checks that the isolation held and combines the reports into verdicts, what landed and what to fix.

It works for resumes, fellowship and grant applications, pitch decks, READMEs, essays, design docs and landing pages.

## Requirements

- Node.js 22 or newer.
- At least one signed-in model CLI: `claude` (Claude Code) and `codex` (Codex). Both is the default, because readers from one model family tend to favor text written in that family's style.
- For PDFs, `pdftotext` and `pdfinfo` from poppler. Without them, give the skill a text or Markdown copy.
- A POSIX shell for the runner. On Windows, run the scripts inside WSL where the CLIs are installed.

Each reader is a paid model call. Four personas on two models make eight calls.

## Install and invoke

```sh
npx skills add Thakay/agent-skills --skill cold-read --global --agent claude-code --copy
```

Use `--agent codex`, or name both agents, to install it for Codex as well. Then ask for a cold read, for example "run a cold read of my resume for this posting". In Codex, `$cold-read` invokes it directly.

The skill derives the personas and shows them before spending anything, unless your request already said to go ahead.

## What it does

1. Collects the document, the target (ideally the target's own text, such as a posting) and the decision a reader makes.
2. Derives 3 to 5 personas and the fit axes the target cares about.
3. Extracts the document's text and links, and builds one self-contained prompt per persona.
4. Runs every prompt on each model, each in its own empty folder, under the [isolation recipe](../skills/cold-read/references/isolation.md).
5. Checks every run: no tool calls, one turn, an empty folder, a clean exit, and none of your canary phrases or private terms in the report.
6. Writes a synthesis and saves the reports next to the document. It does not edit the document without your approval.

## Customize without editing the installed skill

An optional Markdown profile at `.agents/skill-profiles/cold-read.md` under your home directory holds your local settings. It survives updates, which replace the skill files. Copy [the example](../examples/cold-read.md) and edit it. The [profile contract](../skills/cold-read/references/profile-contract.md) describes the format.

The most useful setting is a canary: a habit only your own rules give agents, such as a fixed sign-off line. If a report contains it, your rules leaked into that reader, and the check fails the run.

## Limits

- Readers are models and do not replace a human stranger's read.
- One run per reader is one sample. Repeated runs can differ, so weigh agreement across readers over any single score, and use `--runs 2` or more for close calls.
- A document polished with one model family may read better to that family's readers.
- Personas carry the author's view of the target.
- Readers see the text layer only, so visual layout is not judged.
- The runner is tested on Linux. Native Windows needs `COLD_READ_CLAUDE_CMD` and `COLD_READ_CODEX_CMD` set to JSON command arrays and is not runtime-tested.

## Origin

The isolation recipe was developed and tested in [ste-eval](https://github.com/Thakay/ste-eval), a blind-judged eval of Claude Code and Codex. Changes to the recipe are versioned through `isolation-recipe` in the skill's frontmatter.
