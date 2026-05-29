import { describe, expect, it } from "vitest";
import { getAiAssistantConfig, requireConfiguredAiAssistantConfig } from "@/lib/ai/ai-config";
import { AiAssistantError } from "@/lib/ai/ai-errors";

describe("AI assistant server-side config", () => {
  it("keeps external AI disabled by default", () => {
    expect(getAiAssistantConfig({})).toMatchObject({
      configured: false,
      enabled: false,
      reason: "disabled",
      timeoutMs: 12000,
    });
  });

  it("reports missing server-side config without throwing during fallback flow", () => {
    const config = getAiAssistantConfig({
      AI_ASSISTANT_ENABLED: "true",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "demo-model",
    });

    expect(config).toMatchObject({
      configured: false,
      enabled: true,
      reason: "missing_config",
    });

    if (config.enabled && !config.configured) {
      expect(config.missing).toContain("AI_API_KEY");
    }
  });

  it("throws a controlled error when a provider requires a missing API key", () => {
    const config = getAiAssistantConfig({
      AI_ASSISTANT_ENABLED: "true",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "demo-model",
    });

    expect(() => requireConfiguredAiAssistantConfig(config)).toThrow(AiAssistantError);
    expect(() => requireConfiguredAiAssistantConfig(config)).toThrow("IA externa ainda não configurada.");
  });

  it("accepts configured generic provider values and a custom timeout", () => {
    const config = getAiAssistantConfig({
      AI_ASSISTANT_ENABLED: "true",
      AI_ASSISTANT_REVIEW_PASS_ENABLED: "true",
      AI_API_KEY: "test-key",
      AI_BASE_URL: "https://example.test/v1",
      AI_MODEL: "demo-model",
      AI_PROVIDER: "openai-compatible",
      AI_TIMEOUT_MS: "2500",
    });

    expect(config).toMatchObject({
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      configured: true,
      enabled: true,
      model: "demo-model",
      provider: "openai-compatible",
      reviewPassEnabled: true,
      timeoutMs: 2500,
    });
  });
});
