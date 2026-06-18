---
name: self-improvement
description: Orchestrate repo-local self-improvement by delegating transcript mining to self-improvement-updater.
disable-model-invocation: true
---

# Self Improvement

Keep `SELF_IMPROVEMENT.md` current by delegating improvement mining to one subagent.

## Trigger

Use when the user asks to continue improving agent behavior, find recurring workflow issues, maintain self-improvement notes, or run the self-improvement loop.

## Workflow

1. Call `self-improvement-updater`.
2. Return the updater result.

## Guardrails

- Keep this skill orchestration-only.
- Do not mine transcripts or edit files in this skill.
- Do not bypass the subagent.
