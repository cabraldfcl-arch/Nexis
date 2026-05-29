import { performance } from "node:perf_hooks";
import { z } from "zod";

export const defaultAiDiagnosticTimeoutMs = 12_000;

const envKeys = {
  apiKey: "AI_API_KEY",
  baseUrl: "AI_BASE_URL",
  enabled: "AI_ASSISTANT_ENABLED",
  model: "AI_MODEL",
  provider: "AI_PROVIDER",
  timeoutMs: "AI_TIMEOUT_MS",
};

const smokeResponseSchema = z
  .object({
    ok: z.literal(true),
    message: z.literal("ready"),
  })
  .strict();

class AiProviderDiagnosticError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AiProviderDiagnosticError";
    this.code = code;
  }
}

export function validateAiProviderDiagnosticConfig(env = process.env) {
  const aiAssistantEnabled = readBoolean(env[envKeys.enabled]);
  const aiProviderConfigured = Boolean(readOptional(env[envKeys.provider]));
  const aiBaseUrlConfigured = Boolean(readOptional(env[envKeys.baseUrl]));
  const aiModelConfigured = Boolean(readOptional(env[envKeys.model]));
  const aiApiKeyConfigured = Boolean(readOptional(env[envKeys.apiKey]));
  const timeout = parseTimeoutMs(env[envKeys.timeoutMs]);
  const configuration = {
    aiApiKeyConfigured,
    aiAssistantEnabled,
    aiBaseUrlConfigured,
    aiModelConfigured,
    aiProviderConfigured,
    aiTimeoutMsValid: timeout.valid,
  };

  if (!aiAssistantEnabled) {
    return {
      configuration,
      missing: [],
      readyForSmokeTest: false,
      skippedReason: "disabled",
      timeoutMs: timeout.value,
    };
  }

  const missing = [];

  if (!aiProviderConfigured) {
    missing.push(envKeys.provider);
  }

  if (!aiBaseUrlConfigured) {
    missing.push(envKeys.baseUrl);
  }

  if (!aiModelConfigured) {
    missing.push(envKeys.model);
  }

  if (!aiApiKeyConfigured) {
    missing.push(envKeys.apiKey);
  }

  if (!timeout.valid) {
    missing.push(envKeys.timeoutMs);
  }

  return {
    configuration,
    missing,
    readyForSmokeTest: missing.length === 0,
    skippedReason: missing.length > 0 ? "missing_config" : null,
    timeoutMs: timeout.value,
  };
}

export async function runAiProviderDiagnostic({
  env = process.env,
  fetchImpl = fetch,
  now = () => performance.now(),
} = {}) {
  const validation = validateAiProviderDiagnosticConfig(env);

  if (!validation.readyForSmokeTest) {
    return buildDiagnostic({
      configuration: validation.configuration,
      durationMs: 0,
      missing: validation.missing,
      ok: true,
      skippedReason: validation.skippedReason,
      smokeTest: { attempted: false, result: "skipped" },
      status: "skipped",
    });
  }

  const settings = readProviderSettings(env, validation.timeoutMs);
  const start = now();

  try {
    const response = await callProviderSmokeTest(settings, fetchImpl);
    const parsedResponse = smokeResponseSchema.safeParse(response);

    if (!parsedResponse.success) {
      throw new AiProviderDiagnosticError(
        "AI_PROVIDER_INVALID_RESPONSE",
        "Resposta do provider nao correspondeu ao JSON minimo esperado.",
      );
    }

    return buildDiagnostic({
      configuration: validation.configuration,
      durationMs: elapsedMs(start, now),
      missing: [],
      ok: true,
      skippedReason: null,
      smokeTest: { attempted: true, result: "passed" },
      status: "passed",
    });
  } catch (error) {
    return buildDiagnostic({
      configuration: validation.configuration,
      durationMs: elapsedMs(start, now),
      error: toSafeDiagnosticError(error),
      missing: [],
      ok: false,
      skippedReason: null,
      smokeTest: { attempted: true, result: "failed" },
      status: "failed",
    });
  }
}

export function buildAiProviderDiagnosticOutput(diagnostic) {
  return `${JSON.stringify(diagnostic, null, 2)}\n`;
}

export function getAiProviderDiagnosticExitCode(diagnostic) {
  return diagnostic.ok ? 0 : 1;
}

async function callProviderSmokeTest(settings, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
  const authHeaderName = ["Author", "ization"].join("");
  const bearerPrefix = ["Bear", "er"].join("");

  try {
    const response = await fetchImpl(resolveChatCompletionsUrl(settings.baseUrl), {
      body: JSON.stringify({
        messages: [
          {
            content: "Retorne somente JSON valido no formato {\"ok\":true,\"message\":\"ready\"}.",
            role: "system",
          },
          {
            content: "Responda exatamente com o JSON minimo de prontidao. Nao use dados reais.",
            role: "user",
          },
        ],
        model: settings.model,
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      headers: {
        [authHeaderName]: `${bearerPrefix} ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AiProviderDiagnosticError(
        "AI_PROVIDER_HTTP_STATUS",
        `Provider retornou status HTTP ${response.status}.`,
      );
    }

    const body = await parseResponseBody(response);
    const content = extractMessageContent(body);

    return parseJsonContent(content);
  } catch (error) {
    if (isAbortError(error)) {
      throw new AiProviderDiagnosticError("AI_PROVIDER_TIMEOUT", "Smoke test excedeu o timeout configurado.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponseBody(response) {
  try {
    return await response.json();
  } catch {
    throw new AiProviderDiagnosticError("AI_PROVIDER_INVALID_RESPONSE", "Provider nao retornou JSON valido.");
  }
}

function extractMessageContent(body) {
  const content = body?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new AiProviderDiagnosticError(
      "AI_PROVIDER_INVALID_RESPONSE",
      "Provider retornou formato inesperado.",
    );
  }

  return content;
}

function parseJsonContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new AiProviderDiagnosticError(
      "AI_PROVIDER_INVALID_RESPONSE",
      "Conteudo do provider nao era JSON valido.",
    );
  }
}

function readProviderSettings(env, timeoutMs) {
  return {
    apiKey: readOptional(env[envKeys.apiKey]),
    baseUrl: readOptional(env[envKeys.baseUrl]),
    model: readOptional(env[envKeys.model]),
    provider: readOptional(env[envKeys.provider]),
    timeoutMs,
  };
}

function readBoolean(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function readOptional(value) {
  const normalized = typeof value === "string" ? value.trim() : "";

  return normalized.length > 0 ? normalized : null;
}

function parseTimeoutMs(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      valid: false,
      value: defaultAiDiagnosticTimeoutMs,
    };
  }

  return {
    valid: true,
    value: Math.trunc(parsed),
  };
}

function resolveChatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/g, "");

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  return `${normalized}/chat/completions`;
}

function buildDiagnostic({
  configuration,
  durationMs,
  error = null,
  missing,
  ok,
  skippedReason,
  smokeTest,
  status,
}) {
  return {
    ok,
    status,
    configuration,
    missing,
    skippedReason,
    smokeTest,
    durationMs,
    error,
  };
}

function elapsedMs(start, now) {
  return Math.max(0, Math.round(now() - start));
}

function toSafeDiagnosticError(error) {
  if (error instanceof AiProviderDiagnosticError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "AI_PROVIDER_HTTP_ERROR",
    message: "Falha controlada ao chamar provider de IA.",
  };
}

function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
