export type BetkolDiagnosticError = {
  code: string;
  message: string;
};

export type BetkolDiagnostic = {
  ok: boolean;
  provider: "betkol-cpu";
  commandConfigured: boolean;
  inputFile: string | null;
  durationMs: number;
  stdoutPreview: string;
  stderrPreview: string;
  exitCode: number | null;
  error: BetkolDiagnosticError | null;
};

export type BetkolCommandInput = {
  command: string;
  commandLine: string;
  inputFile: string;
  timeoutMs: number;
};

export type BetkolCommandResult = {
  commandLine: string;
  exitCode: number | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
  timeoutMs: number;
};

export type BetkolContractCheckOptions = {
  env?: Partial<Record<"BETKOL_CPU_COMMAND" | "BETKOL_CPU_TIMEOUT_MS", string>>;
  inputFile?: string | null;
  maxFileSizeBytes?: number;
  now?: () => number;
  runCommand?: (input: BetkolCommandInput) => Promise<BetkolCommandResult>;
};

export const betkolProviderName: "betkol-cpu";
export const defaultTimeoutMs: number;
export const maxInputFileSizeBytes: number;
export const previewMaxLength: number;

export function normalizeTimeoutMs(value?: string | null): number;
export function runBetkolContractCheck(
  options?: BetkolContractCheckOptions,
): Promise<BetkolDiagnostic>;
export function runBetkolCommand(input: BetkolCommandInput): Promise<BetkolCommandResult>;
export function buildCommandLine(command: string, inputFile: string): string;
export function getDiagnosticExitCode(diagnostic: BetkolDiagnostic): number;
