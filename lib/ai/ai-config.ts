import { AiAssistantError } from "./ai-errors";

export type AiAssistantEnvKey =
  | "AI_ASSISTANT_ENABLED"
  | "AI_ASSISTANT_REVIEW_PASS_ENABLED"
  | "AI_PROVIDER"
  | "AI_BASE_URL"
  | "AI_MODEL"
  | "AI_API_KEY"
  | "AI_TIMEOUT_MS";

export type AiAssistantEnv = Partial<Record<AiAssistantEnvKey, string | undefined>> & {
  [key: string]: string | undefined;
};

export type DisabledAiAssistantConfig = {
  configured: false;
  enabled: false;
  provider: string;
  reason: "disabled";
  reviewPassEnabled: boolean;
  timeoutMs: number;
};

export type MissingAiAssistantConfig = {
  configured: false;
  enabled: true;
  missing: AiAssistantEnvKey[];
  provider: string;
  reason: "missing_config";
  reviewPassEnabled: boolean;
  timeoutMs: number;
};

export type ConfiguredAiAssistantConfig = {
  apiKey: string;
  baseUrl: string;
  configured: true;
  enabled: true;
  model: string;
  provider: string;
  reviewPassEnabled: boolean;
  timeoutMs: number;
};

export type AiAssistantConfig =
  | DisabledAiAssistantConfig
  | MissingAiAssistantConfig
  | ConfiguredAiAssistantConfig;

const defaultProvider = "openai-compatible";
const defaultTimeoutMs = 12000;
const requiredWhenEnabled: AiAssistantEnvKey[] = ["AI_BASE_URL", "AI_MODEL", "AI_API_KEY"];

export function getAiAssistantConfig(env: AiAssistantEnv = process.env): AiAssistantConfig {
  const enabled = readBoolean(env.AI_ASSISTANT_ENABLED);
  const provider = readOptional(env.AI_PROVIDER) ?? defaultProvider;
  const reviewPassEnabled = readBoolean(env.AI_ASSISTANT_REVIEW_PASS_ENABLED);
  const timeoutMs = readTimeoutMs(env.AI_TIMEOUT_MS);

  if (!enabled) {
    return {
      configured: false,
      enabled: false,
      provider,
      reason: "disabled",
      reviewPassEnabled,
      timeoutMs,
    };
  }

  const missing = requiredWhenEnabled.filter((key) => !readOptional(env[key]));

  if (missing.length > 0) {
    return {
      configured: false,
      enabled: true,
      missing,
      provider,
      reason: "missing_config",
      reviewPassEnabled,
      timeoutMs,
    };
  }

  return {
    apiKey: readOptional(env.AI_API_KEY) ?? "",
    baseUrl: readOptional(env.AI_BASE_URL) ?? "",
    configured: true,
    enabled: true,
    model: readOptional(env.AI_MODEL) ?? "",
    provider,
    reviewPassEnabled,
    timeoutMs,
  };
}

export function requireConfiguredAiAssistantConfig(config: AiAssistantConfig): ConfiguredAiAssistantConfig {
  if (!config.configured) {
    throw new AiAssistantError("AI_ASSISTANT_NOT_CONFIGURED", "IA externa ainda não configurada.");
  }

  return config;
}

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readOptional(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function readTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultTimeoutMs;
  }

  return Math.trunc(parsed);
}
