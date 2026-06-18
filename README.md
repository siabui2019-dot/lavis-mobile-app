# lavis-mobile-app

## AI memory automation

This repository includes repo-wide Cursor AI memory support at the workspace root:

- `AGENTS.md` stores durable user preferences and stable workspace facts.
- `.cursor/agents/memory-creator.md` initializes or seeds memory on demand.
- `.cursor/agents/agents-memory-updater.md` mines high-signal transcript deltas and keeps `AGENTS.md` current.
- `.cursor/skills/memory-create/SKILL.md` routes explicit memory creation requests to the memory creator subagent.
- `.cursor/skills/continual-learning/SKILL.md` routes recurring memory maintenance to the memory updater subagent.
- `.cursor/hooks/hooks.json` registers a stop hook that can trigger continual learning automatically.

The hook uses `.cursor/hooks/ai-memory-stop.mjs` and writes runtime state under `.cursor/hooks/state/`, which is ignored by Git.

### Cadence controls

By default, the stop hook asks Cursor to run continual learning after 10 completed root turns, at least 120 minutes since the previous run, and a newer transcript mtime.

You can override the cadence with environment variables:

- `AI_MEMORY_MIN_TURNS`
- `AI_MEMORY_MIN_MINUTES`
- `AI_MEMORY_TRIAL_MODE`
- `AI_MEMORY_TRIAL_MIN_TURNS`
- `AI_MEMORY_TRIAL_MIN_MINUTES`
- `AI_MEMORY_TRIAL_DURATION_MINUTES`

The root-level configuration applies to every project/package that is later added to this repository.
