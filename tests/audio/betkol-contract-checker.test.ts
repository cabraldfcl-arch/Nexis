import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeTimeoutMs,
  runBetkolContractCheck,
} from "../../scripts/audio/betkol-contract-checker.mjs";

async function withTempAudioFile<T>(callback: (filePath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "nexis-betkol-test-"));
  const filePath = path.join(dir, "audio.webm");

  try {
    await writeFile(filePath, Buffer.from([1, 2, 3]));
    return await callback(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("BetKol CPU contract checker", () => {
  it("returns a controlled not configured diagnostic when command is missing", async () => {
    const result = await runBetkolContractCheck({
      env: {},
      inputFile: "audio.webm",
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "betkol-cpu",
      commandConfigured: false,
      inputFile: null,
      durationMs: 0,
      stdoutPreview: "",
      stderrPreview: "",
      exitCode: null,
      error: {
        code: "BETKOL_CPU_COMMAND_MISSING",
      },
    });
  });

  it("fails clearly when the input file does not exist", async () => {
    const result = await runBetkolContractCheck({
      env: { BETKOL_CPU_COMMAND: "betkol" },
      inputFile: "/tmp/nexis-missing-audio.webm",
    });

    expect(result.ok).toBe(false);
    expect(result.commandConfigured).toBe(true);
    expect(result.error).toMatchObject({
      code: "BETKOL_INPUT_FILE_NOT_FOUND",
    });
  });

  it("uses a configurable timeout with a safe fallback", () => {
    expect(normalizeTimeoutMs("250")).toBe(250);
    expect(normalizeTimeoutMs("")).toBe(10_000);
    expect(normalizeTimeoutMs("invalid")).toBe(10_000);
    expect(normalizeTimeoutMs("-1")).toBe(10_000);
  });

  it("captures stdout, stderr, exit code and duration without BetKol real", async () => {
    await withTempAudioFile(async (filePath) => {
      const result = await runBetkolContractCheck({
        env: {
          BETKOL_CPU_COMMAND: "fake-betkol",
          BETKOL_CPU_TIMEOUT_MS: "1234",
        },
        inputFile: filePath,
        now: (() => {
          const values = [100, 145];
          return () => values.shift() ?? 145;
        })(),
        runCommand: async ({ command, timeoutMs }) => ({
          commandLine: command,
          exitCode: 0,
          stderr: "diagnostic stderr",
          stdout: "texto transcrito",
          timedOut: false,
          timeoutMs,
        }),
      });

      expect(result).toMatchObject({
        ok: true,
        provider: "betkol-cpu",
        commandConfigured: true,
        inputFile: path.resolve(filePath),
        durationMs: 45,
        stdoutPreview: "texto transcrito",
        stderrPreview: "diagnostic stderr",
        exitCode: 0,
        error: null,
      });
    });
  });

  it("reports stderr and non-zero exit codes as command failures", async () => {
    await withTempAudioFile(async (filePath) => {
      const result = await runBetkolContractCheck({
        env: { BETKOL_CPU_COMMAND: "fake-betkol" },
        inputFile: filePath,
        runCommand: async () => ({
          commandLine: "fake-betkol",
          exitCode: 7,
          stderr: "falha do processo",
          stdout: "",
          timedOut: false,
          timeoutMs: 10_000,
        }),
      });

      expect(result).toMatchObject({
        ok: false,
        stderrPreview: "falha do processo",
        exitCode: 7,
        error: {
          code: "BETKOL_CPU_EXIT_NON_ZERO",
        },
      });
    });
  });

  it("reports timeout without requiring BetKol real", async () => {
    await withTempAudioFile(async (filePath) => {
      const result = await runBetkolContractCheck({
        env: {
          BETKOL_CPU_COMMAND: "fake-betkol",
          BETKOL_CPU_TIMEOUT_MS: "50",
        },
        inputFile: filePath,
        runCommand: async ({ timeoutMs }) => ({
          commandLine: "fake-betkol",
          exitCode: null,
          stderr: "processo encerrado por timeout",
          stdout: "",
          timedOut: true,
          timeoutMs,
        }),
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: null,
        stderrPreview: "processo encerrado por timeout",
        error: {
          code: "BETKOL_CPU_TIMEOUT",
        },
      });
    });
  });
});
