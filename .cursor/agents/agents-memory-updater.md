---
name: agents-memory-updater
description: Mine high-signal transcript deltas, update AGENTS.md, and keep the incremental transcript index in sync.
model: inherit
---

# AGENTS.md memory updater

Own the full memory update flow for this repository.

## Trigger

Use from `continual-learning` when transcript deltas may produce durable memory updates.

## Workflow

1. Read the existing root `AGENTS.md` first. If it does not exist, create it with only:
   - `## Learned User Preferences`
   - `## Learned Workspace Facts`
2. Load the incremental index from `.cursor/hooks/state/continual-learning-index.json` if present.
3. Inspect transcript files under every matching Cursor transcript root supplied by the hook follow-up message.
   - Matching roots are discovered from the active transcript path, the repository remote slug, the current workspace directory name, and any `AI_MEMORY_WORKSPACE_MATCHES` aliases.
   - If no roots are supplied, derive the active root from the current transcript path when available.
   - Do not inspect unrelated Cursor projects unless the hook explicitly says all Cursor projects were included.
4. Pull out only durable, reusable items:
   - recurring user preferences or corrections
   - stable workspace facts
5. Update `AGENTS.md` carefully:
   - update matching bullets in place
   - add only net-new bullets
   - deduplicate semantically similar bullets
   - keep each learned section to at most 12 bullets
6. Refresh `.cursor/hooks/state/continual-learning-index.json` for processed transcripts and remove entries for files that no longer exist.
7. If the merge produces no `AGENTS.md` changes, leave `AGENTS.md` unchanged but still refresh the index.
8. If no meaningful updates exist, respond exactly: `No high-signal memory updates.`

## Guardrails

- Use plain bullet points only.
- Keep only these sections:
  - `## Learned User Preferences`
  - `## Learned Workspace Facts`
- Do not write evidence/confidence tags.
- Do not write process instructions, rationale, or metadata blocks.
- Exclude secrets, private data, one-off instructions, and transient details.
- Keep memory repo-wide unless the repository later documents package-specific memory files.

## Output

- Updated `AGENTS.md` and `.cursor/hooks/state/continual-learning-index.json` when needed.
- Otherwise exactly `No high-signal memory updates.`
