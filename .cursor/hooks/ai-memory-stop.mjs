import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const STATE_PATH = resolve(".cursor/hooks/state/ai-memory.json");
const INDEX_PATH = resolve(".cursor/hooks/state/continual-learning-index.json");
const SELF_IMPROVEMENT_INDEX_PATH = resolve(".cursor/hooks/state/self-improvement-index.json");
const DEFAULT_CURSOR_PROJECT_ROOTS = [
  join(homedir(), ".cursor", "projects"),
  join(homedir(), ".cursor", "workspace"),
];
const DEFAULT_MIN_TURNS = 10;
const DEFAULT_MIN_MINUTES = 120;
const TRIAL_DEFAULT_MIN_TURNS = 3;
const TRIAL_DEFAULT_MIN_MINUTES = 15;
const TRIAL_DEFAULT_DURATION_MINUTES = 24 * 60;

function parsePositiveInt(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function readEnvValue(primary, legacy) {
  return process.env[primary] ?? process.env[legacy];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseRemoteRepoSlug(remoteUrl) {
  const trimmed = remoteUrl.trim().replace(/\.git$/, "");
  const sshMatch = trimmed.match(/[:/]([^/:]+\/[^/]+)$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  try {
    const url = new URL(trimmed);
    return url.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function getRemoteRepoSlug() {
  const gitConfigPath = resolve(".git/config");
  if (!existsSync(gitConfigPath)) {
    return null;
  }

  try {
    const config = readFileSync(gitConfigPath, "utf-8");
    for (const line of config.split("\n")) {
      const match = line.match(/^\s*url\s*=\s*(.+)$/);
      if (match) {
        const slug = parseRemoteRepoSlug(match[1]);
        if (slug) {
          return slug;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getRepoIdentifiers() {
  const remoteSlug = getRemoteRepoSlug();
  const remoteRepoName = remoteSlug ? basename(remoteSlug) : null;

  return unique([
    basename(process.cwd()),
    remoteSlug,
    remoteRepoName,
    ...splitList(process.env.AI_MEMORY_WORKSPACE_MATCHES),
  ]);
}

function getCursorProjectRoots() {
  const configuredRoots = splitList(
    readEnvValue("AI_MEMORY_CURSOR_PROJECT_ROOTS", "AI_MEMORY_CURSOR_PROJECTS_ROOTS") ??
      readEnvValue("AI_MEMORY_CURSOR_PROJECT_ROOT", "AI_MEMORY_CURSOR_PROJECTS_ROOT")
  ).map((projectRoot) => resolve(projectRoot));

  return unique([...configuredRoots, ...DEFAULT_CURSOR_PROJECT_ROOTS]);
}

function isMatchingProjectName(projectName, repoIdentifiers) {
  const normalizedProjectName = normalizeIdentifier(projectName);
  return repoIdentifiers
    .map(normalizeIdentifier)
    .filter((identifier) => identifier.length >= 3)
    .some(
      (identifier) =>
        normalizedProjectName === identifier || normalizedProjectName.includes(identifier)
    );
}

function getTranscriptRootFromPath(transcriptPath) {
  if (!transcriptPath) {
    return null;
  }

  const resolvedPath = resolve(transcriptPath);
  const marker = "/agent-transcripts";
  const markerIndex = resolvedPath.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  return resolvedPath.slice(0, markerIndex + marker.length);
}

function addProjectTranscriptRoot(roots, projectPath) {
  const transcriptRoot = join(projectPath, "agent-transcripts");
  if (existsSync(transcriptRoot)) {
    roots.add(resolve(transcriptRoot));
  }
}

function discoverMatchingTranscriptRoots(transcriptPath) {
  const roots = new Set();
  const activeTranscriptRoot = getTranscriptRootFromPath(transcriptPath);
  if (activeTranscriptRoot) {
    roots.add(activeTranscriptRoot);
  }

  const repoIdentifiers = getRepoIdentifiers();
  const includeAllCursorProjects = parseBoolean(process.env.AI_MEMORY_INCLUDE_ALL_CURSOR_PROJECTS);

  for (const projectRoot of getCursorProjectRoots()) {
    if (!existsSync(projectRoot)) {
      continue;
    }

    addProjectTranscriptRoot(roots, projectRoot);

    let entries = [];
    try {
      entries = readdirSync(projectRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (includeAllCursorProjects || isMatchingProjectName(entry.name, repoIdentifiers)) {
        addProjectTranscriptRoot(roots, join(projectRoot, entry.name));
      }
    }
  }

  return [...roots].sort();
}

function fallbackState() {
  return {
    version: 1,
    lastRunAtMs: 0,
    turnsSinceLastRun: 0,
    lastTranscriptMtimeMs: null,
    lastProcessedGenerationId: null,
    trialStartedAtMs: null,
  };
}

function sanitizeState(parsed) {
  if (!parsed || parsed.version !== 1) {
    return fallbackState();
  }

  return {
    version: 1,
    lastRunAtMs:
      typeof parsed.lastRunAtMs === "number" && Number.isFinite(parsed.lastRunAtMs)
        ? parsed.lastRunAtMs
        : 0,
    turnsSinceLastRun:
      typeof parsed.turnsSinceLastRun === "number" &&
      Number.isFinite(parsed.turnsSinceLastRun) &&
      parsed.turnsSinceLastRun >= 0
        ? parsed.turnsSinceLastRun
        : 0,
    lastTranscriptMtimeMs:
      typeof parsed.lastTranscriptMtimeMs === "number" &&
      Number.isFinite(parsed.lastTranscriptMtimeMs)
        ? parsed.lastTranscriptMtimeMs
        : null,
    lastProcessedGenerationId:
      typeof parsed.lastProcessedGenerationId === "string"
        ? parsed.lastProcessedGenerationId
        : null,
    trialStartedAtMs:
      typeof parsed.trialStartedAtMs === "number" && Number.isFinite(parsed.trialStartedAtMs)
        ? parsed.trialStartedAtMs
        : null,
  };
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return fallbackState();
  }

  try {
    return sanitizeState(JSON.parse(readFileSync(STATE_PATH, "utf-8")));
  } catch {
    return fallbackState();
  }
}

function saveState(state) {
  const directory = dirname(STATE_PATH);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

function getTranscriptMtimeMs(transcriptPath) {
  if (!transcriptPath) {
    return null;
  }

  try {
    return statSync(transcriptPath).mtimeMs;
  } catch {
    return null;
  }
}

function getLatestTranscriptMtimeMs(transcriptRoots, activeTranscriptPath) {
  let latestMtimeMs = getTranscriptMtimeMs(activeTranscriptPath);
  const stack = transcriptRoots.filter((transcriptRoot) => existsSync(transcriptRoot));

  while (stack.length > 0) {
    const currentPath = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      const entryMtimeMs = getTranscriptMtimeMs(entryPath);
      if (
        entryMtimeMs !== null &&
        (latestMtimeMs === null || entryMtimeMs > latestMtimeMs)
      ) {
        latestMtimeMs = entryMtimeMs;
      }
    }
  }

  return latestMtimeMs;
}

function shouldCountTurn(input) {
  return input.status === "completed" && input.loop_count === 0;
}

function buildFollowupMessage(matchingTranscriptRoots, repoIdentifiers) {
  const matchingRoots =
    matchingTranscriptRoots.length > 0
      ? matchingTranscriptRoots.map((root) => `\`${root}\``).join(", ")
      : "no matching Cursor transcript roots were discovered";
  const identifiers = repoIdentifiers.map((identifier) => `\`${identifier}\``).join(", ");

  return (
    "Run the `continual-learning` skill now. Use the `agents-memory-updater` subagent for the full memory update flow. " +
    `Analyze every matching Cursor transcript root for this repo: ${matchingRoots}. ` +
    `Repo/workspace identifiers used for matching: ${identifiers || "`workspace`"}. ` +
    `Use incremental transcript processing with index file \`${INDEX_PATH}\`: only consider transcripts not in the index or transcripts whose mtime is newer than indexed mtime. ` +
    "Have the subagent refresh index mtimes, remove entries for deleted transcripts, and update `AGENTS.md` only for high-signal recurring user corrections and durable workspace facts. " +
    "Exclude one-off/transient details and secrets. If no meaningful updates exist, respond exactly: No high-signal memory updates. " +
    "Then run the `self-improvement` skill. Use the `self-improvement-updater` subagent to inspect the same matching transcript roots for recurring workflow failures, validation gaps, and repo automation opportunities. " +
    `Use separate incremental transcript processing with index file \`${SELF_IMPROVEMENT_INDEX_PATH}\`. ` +
    "Update `SELF_IMPROVEMENT.md` only with durable, actionable improvement candidates or applied improvements. If no meaningful updates exist, respond exactly: No self-improvement updates."
  );
}

async function readHookInput() {
  let input = "";

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return JSON.parse(input);
}

async function main() {
  try {
    const input = await readHookInput();
    const state = loadState();
    const repoIdentifiers = getRepoIdentifiers();
    const matchingTranscriptRoots = discoverMatchingTranscriptRoots(input.transcript_path);

    if (input.generation_id && input.generation_id === state.lastProcessedGenerationId) {
      console.log(JSON.stringify({}));
      return 0;
    }

    state.lastProcessedGenerationId = input.generation_id ?? null;

    const countedTurn = shouldCountTurn(input);
    const turnIncrement = countedTurn ? 1 : 0;
    const turnsSinceLastRun = state.turnsSinceLastRun + turnIncrement;
    const now = Date.now();

    const trialEnabled = parseBoolean(
      readEnvValue("AI_MEMORY_TRIAL_MODE", "CONTINUAL_LEARNING_TRIAL_MODE")
    );
    if (trialEnabled && countedTurn && state.trialStartedAtMs === null) {
      state.trialStartedAtMs = now;
    }

    const trialDurationMinutes = parsePositiveInt(
      readEnvValue(
        "AI_MEMORY_TRIAL_DURATION_MINUTES",
        "CONTINUAL_LEARNING_TRIAL_DURATION_MINUTES"
      ),
      TRIAL_DEFAULT_DURATION_MINUTES
    );
    const trialMinTurns = parsePositiveInt(
      readEnvValue("AI_MEMORY_TRIAL_MIN_TURNS", "CONTINUAL_LEARNING_TRIAL_MIN_TURNS"),
      TRIAL_DEFAULT_MIN_TURNS
    );
    const trialMinMinutes = parsePositiveInt(
      readEnvValue("AI_MEMORY_TRIAL_MIN_MINUTES", "CONTINUAL_LEARNING_TRIAL_MIN_MINUTES"),
      TRIAL_DEFAULT_MIN_MINUTES
    );
    const inTrialWindow =
      trialEnabled &&
      state.trialStartedAtMs !== null &&
      now - state.trialStartedAtMs < trialDurationMinutes * 60_000;

    const minTurns = parsePositiveInt(
      readEnvValue("AI_MEMORY_MIN_TURNS", "CONTINUAL_LEARNING_MIN_TURNS"),
      DEFAULT_MIN_TURNS
    );
    const minMinutes = parsePositiveInt(
      readEnvValue("AI_MEMORY_MIN_MINUTES", "CONTINUAL_LEARNING_MIN_MINUTES"),
      DEFAULT_MIN_MINUTES
    );

    const effectiveMinTurns = inTrialWindow ? trialMinTurns : minTurns;
    const effectiveMinMinutes = inTrialWindow ? trialMinMinutes : minMinutes;
    const minutesSinceLastRun =
      state.lastRunAtMs > 0 ? Math.floor((now - state.lastRunAtMs) / 60000) : Infinity;
    const transcriptMtimeMs = getLatestTranscriptMtimeMs(
      matchingTranscriptRoots,
      input.transcript_path
    );
    const hasTranscriptAdvanced =
      transcriptMtimeMs !== null &&
      (state.lastTranscriptMtimeMs === null || transcriptMtimeMs > state.lastTranscriptMtimeMs);
    const shouldTrigger =
      countedTurn &&
      turnsSinceLastRun >= effectiveMinTurns &&
      minutesSinceLastRun >= effectiveMinMinutes &&
      hasTranscriptAdvanced;

    if (shouldTrigger) {
      state.lastRunAtMs = now;
      state.turnsSinceLastRun = 0;
      state.lastTranscriptMtimeMs = transcriptMtimeMs;
      saveState(state);

      console.log(
        JSON.stringify({
          followup_message: buildFollowupMessage(matchingTranscriptRoots, repoIdentifiers),
        })
      );
      return 0;
    }

    state.turnsSinceLastRun = turnsSinceLastRun;
    saveState(state);
    console.log(JSON.stringify({}));
    return 0;
  } catch (error) {
    console.error("[ai-memory-stop] failed", error);
    console.log(JSON.stringify({}));
    return 0;
  }
}

const exitCode = await main();
process.exit(exitCode);
