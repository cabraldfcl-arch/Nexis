import { describe, expect, it } from "vitest";
import {
  buildAiProviderDiagnosticOutput,
  getAiProviderDiagnosticExitCode,
  runAiProviderDiagnostic,
  validateAiProviderDiagnosticConfig,
} from "../../scripts/ai/ai-provider-diagnostic.mjs";

const configuredEnv = {
  AI_ASSISTANT_ENABLED: "true",
  AI_API_KEY: "redacted-test-value",
  AI_BASE_URL: "https://example.test/v1",
  AI_MODEL: "demo-model",
  AI_PROVIDER: "openai-compatible",
  AI_TIMEOUT_MS: "50",
};

describe("AI provider diagnostic", () => {
  it("skips the smoke test when external AI is disabled", async () => {
    let called = false;
    const result = await runAiProviderDiagnostic({
      env: { AI_ASSISTANT_ENABLED: "false" },
      fetchImpl: async () => {
        called = true;
        return Response.json({});
      },
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({
      ok: true,
      status: "skipped",
      smokeTest: { attempted: false, result: "skipped" },
      configuration: {
        aiApiKeyConfigured: false,
        aiAssistantEnabled: false,
      },
      error: null,
    });
  });

  it("skips safely when the API key is absent", async () => {
    let called = false;
    const result = await runAiProviderDiagnostic({
      env: {
        AI_ASSISTANT_ENABLED: "true",
        AI_BASE_URL: "https://example.test/v1",
        AI_MODEL: "demo-model",
        AI_PROVIDER: "openai-compatible",
        AI_TIMEOUT_MS: "50",
      },
      fetchImpl: async () => {
        called = true;
        return Response.json({});
      },
    });

    expect(called).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("skipped");
    expect(result.configuration.aiApiKeyConfigured).toBe(false);
    expect(result.skippedReason).toBe("missing_config");
  });

  it("does not call fetch when enabled config is incomplete", async () => {
    let called = false;
    const result = await runAiProviderDiagnostic({
      env: {
        AI_ASSISTANT_ENABLED: "true",
        AI_API_KEY: "redacted-test-value",
        AI_MODEL: "demo-model",
        AI_TIMEOUT_MS: "50",
      },
      fetchImpl: async () => {
        called = true;
        return Response.json({});
      },
    });

    expect(called).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("skipped");
    expect(result.configuration.aiBaseUrlConfigured).toBe(false);
    expect(result.skippedReason).toBe("missing_config");
  });

  it("calls a configured provider with mocked fetch and accepts valid JSON", async () => {
    const calls: { body: unknown; headers: HeadersInit | undefined; url: string }[] = [];
    const result = await runAiProviderDiagnostic({
      env: configuredEnv,
      fetchImpl: async (url, init) => {
        calls.push({
          body: init?.body ? JSON.parse(String(init.body)) : null,
          headers: init?.headers,
          url: String(url),
        });

        return Response.json({
          choices: [{ message: { content: JSON.stringify({ ok: true, message: "ready" }) } }],
        });
      },
      now: (() => {
        const values = [100, 135];
        return () => values.shift() ?? 135;
      })(),
    });

    expect(result).toMatchObject({
      ok: true,
      status: "passed",
      durationMs: 35,
      smokeTest: { attempted: true, result: "passed" },
      error: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/v1/chat/completions");
    expect(JSON.stringify(calls[0]?.body)).not.toContain("redacted-test-value");
  });

  it("fails with a controlled error when provider JSON is invalid", async () => {
    const result = await runAiProviderDiagnostic({
      env: configuredEnv,
      fetchImpl: async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify({ ok: false, message: "not-ready" }) } }],
        }),
    });

    expect(result).toMatchObject({
      ok: false,
      status: "failed",
      smokeTest: { attempted: true, result: "failed" },
      error: { code: "AI_PROVIDER_INVALID_RESPONSE" },
    });
  });

  it("sanitizes provider errors and never prints the key or auth header", async () => {
    const authHeaderName = ["Author", "ization"].join("");
    const bearerPrefix = ["Bear", "er"].join("");
    const result = await runAiProviderDiagnostic({
      env: configuredEnv,
      fetchImpl: async () => {
        throw new Error(`redacted-test-value leaked through ${authHeaderName}: ${bearerPrefix} redacted-test-value`);
      },
    });
    const output = buildAiProviderDiagnosticOutput(result);

    expect(output).not.toContain("redacted-test-value");
    expect(output).not.toContain(authHeaderName);
    expect(output).not.toContain(bearerPrefix);
    expect(result.error).toMatchObject({
      code: "AI_PROVIDER_HTTP_ERROR",
      message: "Falha controlada ao chamar provider de IA.",
    });
  });

  it("validates timeout before attempting the smoke test", () => {
    const config = validateAiProviderDiagnosticConfig({
      ...configuredEnv,
      AI_TIMEOUT_MS: "invalid",
    });

    expect(config.readyForSmokeTest).toBe(false);
    expect(config.timeoutMs).toBe(12_000);
    expect(config.configuration.aiTimeoutMsValid).toBe(false);
  });

  it("uses a failing exit code only when a configured smoke test fails", () => {
    expect(getAiProviderDiagnosticExitCode({ ok: true, status: "skipped" })).toBe(0);
    expect(getAiProviderDiagnosticExitCode({ ok: true, status: "passed" })).toBe(0);
    expect(getAiProviderDiagnosticExitCode({ ok: false, status: "failed" })).toBe(1);
  });
});
