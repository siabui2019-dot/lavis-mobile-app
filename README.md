# lavis-mobile-app

## AI memory automation

This repository includes repo-wide Cursor AI memory support at the workspace root:

- `AGENTS.md` stores durable user preferences and stable workspace facts.
- `SELF_IMPROVEMENT.md` stores recurring agent workflow improvements and applied automation lessons.
- `.cursor/agents/memory-creator.md` initializes or seeds memory on demand.
- `.cursor/agents/agents-memory-updater.md` mines high-signal transcript deltas and keeps `AGENTS.md` current.
- `.cursor/agents/self-improvement-updater.md` mines recurring workflow failures, validation gaps, and automation opportunities.
- `.cursor/skills/memory-create/SKILL.md` routes explicit memory creation requests to the memory creator subagent.
- `.cursor/skills/continual-learning/SKILL.md` routes recurring memory maintenance to the memory updater subagent.
- `.cursor/skills/self-improvement/SKILL.md` routes self-improvement maintenance to the self-improvement updater subagent.
- `.cursor/hooks/hooks.json` registers a stop hook that can trigger continual learning automatically.

The hook uses `.cursor/hooks/ai-memory-stop.mjs` and writes runtime state under `.cursor/hooks/state/`, which is ignored by Git.
When the hook triggers, it asks Cursor to run continual learning first and then continue into self-improvement using separate incremental indexes.

The hook analyzes every matching Cursor transcript root it can discover for this repository. It matches roots from:

- the active transcript path from Cursor's stop-hook input
- the current workspace directory name
- the Git remote repository slug/name
- optional aliases in `AI_MEMORY_WORKSPACE_MATCHES`

### Cadence controls

By default, the stop hook asks Cursor to run continual learning after 10 completed root turns, at least 120 minutes since the previous run, and a newer transcript mtime.

You can override the cadence with environment variables:

- `AI_MEMORY_MIN_TURNS`
- `AI_MEMORY_MIN_MINUTES`
- `AI_MEMORY_TRIAL_MODE`
- `AI_MEMORY_TRIAL_MIN_TURNS`
- `AI_MEMORY_TRIAL_MIN_MINUTES`
- `AI_MEMORY_TRIAL_DURATION_MINUTES`

### Cursor project matching controls

By default, the hook checks Cursor project roots under `~/.cursor/projects` and `~/.cursor/workspace`. You can customize discovery with:

- `AI_MEMORY_CURSOR_PROJECT_ROOTS` - comma-separated Cursor project root paths
- `AI_MEMORY_CURSOR_PROJECT_ROOT` - single Cursor project root path
- `AI_MEMORY_WORKSPACE_MATCHES` - comma-separated extra repo/workspace aliases to match
- `AI_MEMORY_INCLUDE_ALL_CURSOR_PROJECTS=true` - include every Cursor project under the configured roots

The root-level configuration applies to every project/package that is later added to this repository.
