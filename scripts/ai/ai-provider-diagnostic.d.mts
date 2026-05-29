export type AiProviderDiagnosticConfiguration = {
  aiApiKeyConfigured: boolean;
  aiAssistantEnabled: boolean;
  aiBaseUrlConfigured: boolean;
  aiModelConfigured: boolean;
  aiProviderConfigured: boolean;
  aiTimeoutMsValid: boolean;
};

export type AiProviderDiagnosticSmokeTest = {
  attempted: boolean;
  result: "failed" | "passed" | "skipped";
};

export type AiProviderDiagnosticError = {
  code: string;
  message: string;
};

export type AiProviderDiagnostic = {
  ok: boolean;
  status: "failed" | "passed" | "skipped";
  configuration: AiProviderDiagnosticConfiguration;
  missing: string[];
  skippedReason: "disabled" | "missing_config" | null;
  smokeTest: AiProviderDiagnosticSmokeTest;
  durationMs: number;
  error: AiProviderDiagnosticError | null;
};

export type AiProviderDiagnosticConfigValidation = {
  configuration: AiProviderDiagnosticConfiguration;
  missing: string[];
  readyForSmokeTest: boolean;
  skippedReason: "disabled" | "missing_config" | null;
  timeoutMs: number;
};

export type AiProviderDiagnosticOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export const defaultAiDiagnosticTimeoutMs: number;

export function validateAiProviderDiagnosticConfig(
  env?: Record<string, string | undefined>,
): AiProviderDiagnosticConfigValidation;
export function runAiProviderDiagnostic(options?: AiProviderDiagnosticOptions): Promise<AiProviderDiagnostic>;
export function buildAiProviderDiagnosticOutput(diagnostic: AiProviderDiagnostic): string;
export function getAiProviderDiagnosticExitCode(diagnostic: Pick<AiProviderDiagnostic, "ok" | "status">): number;
