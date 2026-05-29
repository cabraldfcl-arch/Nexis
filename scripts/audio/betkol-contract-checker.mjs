import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

export const betkolProviderName = "betkol-cpu";
export const defaultTimeoutMs = 10_000;
export const maxInputFileSizeBytes = 5 * 1024 * 1024;
export const previewMaxLength = 1_000;

export function normalizeTimeoutMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return defaultTimeoutMs;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTimeoutMs;
}

export async function runBetkolContractCheck({
  env = process.env,
  inputFile = null,
  maxFileSizeBytes = maxInputFileSizeBytes,
  now = () => performance.now(),
  runCommand = runBetkolCommand,
} = {}) {
  const command = readCommand(env);

  if (!command) {
    return buildDiagnostic({
      commandConfigured: false,
      error: {
        code: "BETKOL_CPU_COMMAND_MISSING",
        message: "Configure BETKOL_CPU_COMMAND para diagnosticar BetKol CPU.",
      },
    });
  }

  const inputValidation = await validateInputFile(inputFile, maxFileSizeBytes);

  if (!inputValidation.ok) {
    return buildDiagnostic({
      commandConfigured: true,
      error: inputValidation.error,
      inputFile: inputValidation.inputFile,
    });
  }

  const timeoutMs = normalizeTimeoutMs(env.BETKOL_CPU_TIMEOUT_MS);
  const start = now();
  const commandResult = await runCommand({
    command,
    commandLine: buildCommandLine(command, inputValidation.inputFile),
    inputFile: inputValidation.inputFile,
    timeoutMs,
  });
  const durationMs = Math.max(0, Math.round(now() - start));
  const error = resolveCommandError(commandResult);

  return buildDiagnostic({
    commandConfigured: true,
    durationMs,
    error,
    exitCode: commandResult.exitCode,
    inputFile: inputValidation.inputFile,
    stderrPreview: previewText(commandResult.stderr),
    stdoutPreview: previewText(commandResult.stdout),
  });
}

export async function runBetkolCommand({ commandLine, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolve({
        commandLine,
        exitCode: result.exitCode,
        stderr,
        stdout,
        timedOut,
        timeoutMs,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk);
    });

    child.stderr?.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk);
    });

    child.on("error", (error) => {
      stderr = appendLimited(stderr, error.message);
      finish({ exitCode: null });
    });

    child.on("close", (code) => {
      finish({ exitCode: code });
    });
  });
}

export function buildCommandLine(command, inputFile) {
  const escapedInputFile = shellEscape(inputFile);

  if (command.includes("{inputFile}")) {
    return command.replaceAll("{inputFile}", escapedInputFile);
  }

  return `${command} ${escapedInputFile}`;
}

export function getDiagnosticExitCode(diagnostic) {
  if (diagnostic.ok) {
    return 0;
  }

  switch (diagnostic.error?.code) {
    case "BETKOL_CPU_COMMAND_MISSING":
      return 2;
    case "BETKOL_INPUT_FILE_MISSING":
    case "BETKOL_INPUT_FILE_NOT_FOUND":
    case "BETKOL_INPUT_FILE_NOT_FILE":
    case "BETKOL_INPUT_FILE_TOO_LARGE":
      return 3;
    case "BETKOL_CPU_TIMEOUT":
      return 124;
    default:
      return 1;
  }
}

function readCommand(env) {
  return typeof env.BETKOL_CPU_COMMAND === "string" ? env.BETKOL_CPU_COMMAND.trim() : "";
}

async function validateInputFile(inputFile, maxFileSizeBytes) {
  if (typeof inputFile !== "string" || inputFile.trim().length === 0) {
    return {
      ok: false,
      inputFile: null,
      error: {
        code: "BETKOL_INPUT_FILE_MISSING",
        message: "Informe o caminho de um arquivo de audio para diagnosticar.",
      },
    };
  }

  const resolvedInputFile = path.resolve(inputFile);

  try {
    const fileStat = await stat(resolvedInputFile);

    if (!fileStat.isFile()) {
      return {
        ok: false,
        inputFile: resolvedInputFile,
        error: {
          code: "BETKOL_INPUT_FILE_NOT_FILE",
          message: "O caminho informado nao e um arquivo.",
        },
      };
    }

    if (fileStat.size > maxFileSizeBytes) {
      return {
        ok: false,
        inputFile: resolvedInputFile,
        error: {
          code: "BETKOL_INPUT_FILE_TOO_LARGE",
          message: "O arquivo de audio excede o tamanho maximo aceito pelo diagnostico.",
        },
      };
    }

    return {
      ok: true,
      inputFile: resolvedInputFile,
    };
  } catch {
    return {
      ok: false,
      inputFile: resolvedInputFile,
      error: {
        code: "BETKOL_INPUT_FILE_NOT_FOUND",
        message: "O arquivo de audio informado nao existe.",
      },
    };
  }
}

function resolveCommandError(commandResult) {
  if (commandResult.timedOut) {
    return {
      code: "BETKOL_CPU_TIMEOUT",
      message: "O comando BetKol CPU excedeu o timeout configurado.",
    };
  }

  if (commandResult.exitCode !== 0) {
    return {
      code: "BETKOL_CPU_EXIT_NON_ZERO",
      message: "O comando BetKol CPU terminou com codigo diferente de zero.",
    };
  }

  return null;
}

function buildDiagnostic({
  commandConfigured,
  durationMs = 0,
  error = null,
  exitCode = null,
  inputFile = null,
  stderrPreview = "",
  stdoutPreview = "",
}) {
  return {
    ok: error === null,
    provider: betkolProviderName,
    commandConfigured,
    inputFile,
    durationMs,
    stdoutPreview,
    stderrPreview,
    exitCode,
    error,
  };
}

function previewText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.length > previewMaxLength ? value.slice(0, previewMaxLength) : value;
}

function appendLimited(current, chunk) {
  return previewText(`${current}${String(chunk)}`);
}

function shellEscape(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
