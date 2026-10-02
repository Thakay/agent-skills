---
name: session-context-close
description: Preserve decisions, unfinished work, reusable artifacts, and verification state for the next session. Run only when the user explicitly invokes session-context-close to perform the close; never infer invocation from goodbye, wrap-up, handoff, or apparent session endings. Requests to install, explain, edit, or review this skill do not invoke it.
metadata:
  version: "1.0.0"
  profile-contract: "1"
---

# Session context close

Make the next session able to resume from durable records. Preserve valuable context in its existing canonical home; deliberately leave out information that is cheap to reconstruct.

## Before the sweep

Proceed only when the user explicitly requests this skill's close operation, such as `$session-context-close`, `/session-context-close`, or a direct request to run session-context-close. A quoted command, an example, or discussion of the skill is not invocation. Otherwise do not perform the sweep.

Read the current project's applicable instructions and established record conventions. Then load the optional personal profile using [the profile contract](references/profile-contract.md), before any close-related mutation. Use the helper if Node is available, or the equivalent file-reading procedure. A missing default profile means use the general workflow; an invalid or explicitly configured missing profile must be reported before making changes under an assumed configuration.

The profile supplies preferences and local integrations. Apply it within the current user request, project rules, permissions, and ownership boundaries. Report material conflicts instead of silently choosing. A profile does not authorize unrelated external actions, bypass approvals, or weaken explicit invocation.

Perform the authorized sweep autonomously. Reuse decisions and permissions already established in the session. Ask only for a real missing decision needed to preserve or dispose of work.

## Sweep the actual loss sources

Check each source in order; do not rely only on remembering what seemed important. Stay within this session's scope rather than scanning unrelated home directories or other chats.

1. **Scratch artifacts.** Account for scratch and temporary files this session created. Rescue reusable scripts, analysis, drafts, or test aids into an appropriate existing project or task location, with enough instructions to use them. Discard only clearly disposable session-owned material when authorized; otherwise record what remains. Do not remove another session's files.
2. **Processes and external state.** Account for servers, watchers, tunnels, and jobs this session started or changed. Stop owned temporary processes when safe and within scope, or explicitly hand them off with purpose and stop/recovery instructions. Do not stop unrelated services or cancel scheduled work merely because this chat is ending.
3. **Knowledge that exists only in context.** Capture decisions and their reasons, non-obvious contracts, failed approaches worth avoiding, working commands, and the next action with its traps. Do not invent details unavailable after compaction or from another session; identify the gap.
4. **Memory hygiene.** Where an established persistent memory facility exists, add durable facts, update stale facts, and remove superseded or duplicated entries within this session's authority. Preserve unique information when consolidating. Do not create or alter undocumented harness databases or copy private machine knowledge into tracked project files.
5. **Canonical project records.** Update existing handoffs, decision records, task ledgers, and checklists in place. Keep one authoritative home per fact and link to it. If a task system owns state, follow its documented commands and ownership rules; preserve unfinished claims. If no convention exists, choose the smallest suitable durable record inside the authorized workspace. Do not impose a new documentation hierarchy.
6. **Uncommitted work and verification.** Inspect this session's changed paths and the actual staged state. Follow project commit rules. If committing is appropriate and authorized, stage only explicit session-owned paths and ensure unrelated staged work is excluded from that commit. Otherwise record the remaining paths and why they are uncommitted. With no repository, skip Git. Preserve the last checks actually run, failures, warnings, and untested items; run further checks only when changes or project rules warrant them.

## Select and place information

For each candidate, ask whether a fresh session could cheaply recover it from existing records and code. If so, avoid duplicating it. Keep decisions separate from proposals and successful checks separate from assumptions.

Project facts belong in project records. Reusable machine recipes belong in established private memory or the profile's designated private destination. Code contracts usually belong beside the code or in meaningful tests. Task-system state belongs in that system. If no authorized private destination exists, report the persistence gap rather than publishing private notes.

Do not overwrite newer information, invent test results, mark unfinished work complete, or tidy away unresolved evidence. Saving, committing, pushing, and backing up are distinct states. Report only the ones verified; a commit alone does not establish an off-device backup.

## Closeout

Finish with a short safe-to-close summary: what was persisted and where, what was stopped or deliberately discarded, the last verification state, and any live loose ends with their next action. Mention the active profile briefly without reproducing private contents. If nothing needs preservation, say so. If the close is incomplete, identify exactly what remains.
