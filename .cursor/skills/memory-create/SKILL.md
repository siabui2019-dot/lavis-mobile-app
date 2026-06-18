---
name: memory-create
description: Create or seed repository-wide AI memory by delegating AGENTS.md initialization to memory-creator.
disable-model-invocation: true
---

# Memory Create

Create or seed repo-wide AI memory by delegating the durable memory write to one subagent.

## Trigger

Use when the user asks to create AI memory, initialize memory, seed agent memory, or add durable context for every project in this repository.

## Workflow

1. Call `memory-creator`.
2. Return the creator result.

## Guardrails

- Keep this skill orchestration-only.
- Do not infer memory in this skill.
- Do not bypass the subagent.
