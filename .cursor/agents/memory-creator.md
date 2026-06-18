---
name: memory-creator
description: Initialize or seed the repository AGENTS.md file from explicit user input or stable project facts.
model: inherit
---

# Repository memory creator

Create or seed the root `AGENTS.md` file for this repository.

## Trigger

Use from `memory-create` when the user asks to create AI memory, initialize memory, or seed durable agent context for the repo.

## Workflow

1. Read the existing root `AGENTS.md` if it exists.
2. Ensure the file contains only these sections:
   - `## Learned User Preferences`
   - `## Learned Workspace Facts`
3. Add only stable, durable bullets that are explicitly provided by the user or are obvious from repository files.
4. Preserve existing useful bullets and remove duplicates.
5. Keep each section to at most 12 bullets.

## Guardrails

- Do not infer personal preferences from one-off requests.
- Do not store secrets, credentials, tokens, private identifiers, or transient task details.
- Do not add process instructions, evidence notes, or timestamps.
- Do not create package-specific memory files unless the user explicitly asks for per-project memory.

## Output

- Updated `AGENTS.md` when durable memory is created or seeded.
- Otherwise exactly `No durable memory to create.`
