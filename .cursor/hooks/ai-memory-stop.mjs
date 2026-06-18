import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const STATE_PATH = resolve(".cursor/hooks/state/ai-memory.json");
const INDEX_PATH = resolve(".cursor/hooks/state/continual-learning-index.json");
const DEFAULT_MIN_TURNS = 10;
const DEFAULT_MIN_MINUTES = 120;
const TRIAL_DEFAULT_MIN_TURNS = 3;
const TRIAL_DEFAULT_MIN_MINUTES = 15;
const TRIAL_DEFAULT_DURATION_MINUTES = 24 * 60;

const FOLLOWUP_MESSAGE =
  "Run the `continual-learning` skill now. Use the `agents-memory-updater` subagent for the full memory update flow. " +
  `Use incremental transcript processing with index file \`${INDEX_PATH}\`: only consider transcripts not in the index or transcripts whose mtime is newer than indexed mtime. ` +
  "Have the subagent refresh index mtimes, remove entries for deleted transcripts, and update `AGENTS.md` only for high-signal recurring user corrections and durable workspace facts. " +
  "Exclude one-off/transient details and secrets. If no meaningful updates exist, respond exactly: No high-signal memory updates.";

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

function shouldCountTurn(input) {
  return input.status === "completed" && input.loop_count === 0;
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
    const transcriptMtimeMs = getTranscriptMtimeMs(input.transcript_path);
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

      console.log(JSON.stringify({ followup_message: FOLLOWUP_MESSAGE }));
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
