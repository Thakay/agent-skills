---
name: cold-read
description: Run isolated cold reads of a document (a resume, pitch, README, essay, landing page or design doc) by reviewer personas on Claude Code and Codex. Each reader works in an empty folder with no tools, no user settings and no project context. Then check that the isolation held and synthesize what landed and what to fix. Use when the user asks for a cold read, cold readers, a stranger read or persona reviews, or wants to know how a document reads to its real audience.
license: MIT
metadata:
  version: "1.0.0"
  profile-contract: "1"
  isolation-recipe: "1"
---

# Cold read

Find out how a document reads to people who know nothing about its author. Several reviewer personas each read it on one or more model families. Every reader gets the document, the target and its persona inside one prompt, with no tools and no access to the user's files, settings, notes or the web. A reader who has seen the author's context is not cold, so the isolation is the point of the exercise. Never shortcut it.

## Before you start

Load the optional private profile using [the profile contract](references/profile-contract.md), before building any prompt. It usually supplies canary phrases, private terms that must never reach a reader, model defaults, where to run the scripts and where to save reports. A missing default profile means use the defaults below. Report an invalid profile before going on.

The scripts need Node 22 or newer. Reading a PDF needs `pdftotext` from poppler; without it, ask for a text or Markdown copy of the document. Each model family needs its CLI installed and signed in: `claude` for Claude Code, `codex` for Codex. Check with `claude --version` and `codex --version`. Using both families is the default, because a model tends to favor text written in its own style. With only one family, say so in the synthesis.

## 1. Intake

Collect, asking only for what is missing:

- **The document:** a path to a PDF, Markdown or text file.
- **The target:** what the document is for, such as a job posting, a fellowship, an investor, a project's users or a review board. Prefer the target's own text, such as the posting itself.
- **The decision:** what a reader decides after reading, such as "advance to the technical assessment", "take the meeting", "star and try the repo" or "approve the design".
- **Optional:** personas the user wants, fit axes to score, models, and runs per reader (default 1).

## 2. Personas

Derive 3 to 5 personas from the target with [the persona guide](references/personas.md). Each persona has a short key, who they are, what they weigh and what a yes means to them. Choose the fit axes the target cares about, such as "RL side" and "ML Systems side".

Show the user the persona list, the axes, the number of runs (personas × models × runs) and that each run is a paid model call. Proceed when the user agrees. If the request already said to go ahead, proceed and show the list in your first update.

## 3. Build the prompts

Work in a scratch folder outside the user's project. From the installed skill folder:

```sh
node scripts/extract.mjs <document> <scratch>/input
node scripts/build-prompts.mjs <scratch>/spec.json <scratch>/prompts
```

`extract.mjs` writes `document.txt` and, when it finds any, `links.txt`. Write `spec.json` by hand:

```json
{
  "document": "<scratch>/input/document.txt",
  "links": "<scratch>/input/links.txt",
  "target": "The target's own text, or a faithful summary of it.",
  "decision": "advance to the technical assessment",
  "axes": ["RL side", "ML Systems side"],
  "personas": [
    {"key": "screener", "who": "the first-pass reviewer, who reads several hundred applications and decides in about a minute. They weigh clear signals that match the target, credible claims and red flags."}
  ]
}
```

Put nothing in the target or personas that the user would not show a stranger, and nothing from the user's notes. Read one built prompt before running.

## 4. Run the readers

```sh
node scripts/run.mjs --prompts <scratch>/prompts --reports <scratch>/reports --models claude,codex
```

Options: `--runs N`, `--concurrency N`, `--claude-model`, `--codex-model` and `--effort`, taking defaults from the profile when it names them. Run it in the background when the host allows it; it can take several minutes. [The isolation recipe](references/isolation.md) explains every flag. Do not change the flags for one run; change the recipe deliberately.

## 5. Check the isolation

```sh
node scripts/check-isolation.mjs --reports <scratch>/reports --canary "<phrase>" --term "<private term>"
```

Pass every canary phrase and private term from the profile. A canary is a habit the user's own rules give agents, such as a fixed sign-off. If it appears in a report, the user's rules reached that reader. The script also fails a run that used a tool, took more than one turn, left files in its folder or exited with an error. Report the checks to the user before any feedback. Discard a failed report, fix the cause and rerun only that reader.

## 6. Synthesize

Lead with the verdicts, then:

- **A table** of persona by model, with each verdict and fit score.
- **What landed:** lines several readers praised, with counts such as 6/8.
- **Fixes:** each fix with how many readers raised it, and whether it can be made from facts already on record or needs a fact or a decision from the user.
- **Gaps no rewording can fix.**
- **Recurring interview or follow-up questions,** when the target involves a conversation.

Save the reports next to the document in a `cold-reads-<date>` folder, unless the project's own rules name another place. Do not edit the document until the user approves. Never invent a fact to satisfy a reader; list what needs the user's input.

## Limits

Say these when they matter:

- The readers are models. They do not replace a human stranger's read.
- One run per reader is one sample, and repeated runs of the same reader can differ. Trust counts across readers more than any single score; use `--runs 2` or more when a decision rests on a close call.
- A document polished with one model family may read better to that family's readers. Weigh disagreement from the other family.
- The personas carry the author's own view of the target.
- Readers see only the text layer, so visual layout goes unjudged.
