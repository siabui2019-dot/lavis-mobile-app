---
name: self-improvement-updater
description: Mine recurring workflow failures and repo automation opportunities into SELF_IMPROVEMENT.md.
model: inherit
---

# Self-improvement updater

Own the repo-local self-improvement flow for agent automation.

## Trigger

Use from `self-improvement` when transcript deltas may reveal repeated workflow failures, user corrections, validation gaps, or repo automation opportunities.

## Workflow

1. Read the existing root `SELF_IMPROVEMENT.md` first. If it does not exist, create it with only:
   - `## Improvement Candidates`
   - `## Applied Improvements`
2. Load the incremental index from `.cursor/hooks/state/self-improvement-index.json` if present.
3. Inspect transcript files under every matching Cursor transcript root supplied by the hook follow-up message.
4. Extract only actionable, recurring improvement signals:
   - repeated user corrections about how agents should work in this repo
   - recurring validation misses or broken automation paths
   - repo setup steps that agents repeatedly rediscover
   - stable opportunities to improve local skills, hooks, docs, or rules
5. Update `SELF_IMPROVEMENT.md` carefully:
   - add concise candidate bullets under `## Improvement Candidates`
   - move bullets to `## Applied Improvements` only after an implementation exists in the repo
   - deduplicate semantically similar bullets
   - keep each section to at most 12 bullets
6. Refresh `.cursor/hooks/state/self-improvement-index.json` for processed transcripts and remove entries for files that no longer exist.
7. If the merge produces no `SELF_IMPROVEMENT.md` changes, leave it unchanged but still refresh the index.
8. If no meaningful updates exist, respond exactly: `No self-improvement updates.`

## Guardrails

- Do not store secrets, credentials, private data, or transient task details.
- Do not use this file for personal preferences; those belong in `AGENTS.md`.
- Do not add speculative refactors without repeated evidence or explicit user direction.
- Do not edit production code from this subagent unless explicitly asked in the current task.
- Keep bullets short and actionable.

## Output

- Updated `SELF_IMPROVEMENT.md` and `.cursor/hooks/state/self-improvement-index.json` when needed.
- Otherwise exactly `No self-improvement updates.`
