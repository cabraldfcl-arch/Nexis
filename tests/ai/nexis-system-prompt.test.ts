import { describe, expect, it } from "vitest";
import { nexisAssistantSystemPrompt } from "@/lib/ai/nexis-system-prompt";

describe("NEXIS assistant system prompt", () => {
  it("describes the exact top-level JSON contract expected from external AI", () => {
    expect(nexisAssistantSystemPrompt).toContain("confidence");
    expect(nexisAssistantSystemPrompt).toContain("entities");
    expect(nexisAssistantSystemPrompt).toContain("missingFields");
    expect(nexisAssistantSystemPrompt).toContain("ambiguity");
    expect(nexisAssistantSystemPrompt).toContain("nextQuestion");
    expect(nexisAssistantSystemPrompt).toContain("draftCandidate");
    expect(nexisAssistantSystemPrompt).toContain("intent");
    expect(nexisAssistantSystemPrompt).toContain("needsReview");
    expect(nexisAssistantSystemPrompt).toContain("userMessage");
    expect(nexisAssistantSystemPrompt).toContain("sem wrapper");
    expect(nexisAssistantSystemPrompt).toContain("Se intent=question, question e obrigatoria");
    expect(nexisAssistantSystemPrompt).toContain("Se intent terminar com _draft, draft e obrigatorio");
    expect(nexisAssistantSystemPrompt).toContain("partial_purchase");
    expect(nexisAssistantSystemPrompt).toContain("social");
    expect(nexisAssistantSystemPrompt).toContain("ambiguous_purchase_cost");
    expect(nexisAssistantSystemPrompt).toContain("Prioridade de intencao");
    expect(nexisAssistantSystemPrompt).toContain("campos faltantes");
    expect(nexisAssistantSystemPrompt).toContain("cada unidade");
    expect(nexisAssistantSystemPrompt).toContain("por 4 a unidade");
    expect(nexisAssistantSystemPrompt).toContain("caixa com 12 unidades de refrigerante");
    expect(nexisAssistantSystemPrompt).toContain("Nao infira unidade por marca ou nome especifico");
    expect(nexisAssistantSystemPrompt).toContain("total da compra");
    expect(nexisAssistantSystemPrompt).toContain("nao escolha sozinho");
    expect(nexisAssistantSystemPrompt).toContain("lucro => profit");
    expect(nexisAssistantSystemPrompt).toContain("singular/plural");
  });
});
