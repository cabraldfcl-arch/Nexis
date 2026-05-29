import { describe, expect, it } from "vitest";
import { parseAssistantMessage } from "@/lib/ai/parse-message";

describe("assistant required human business scenarios", () => {
  it("parses boxed and bundled product registration drafts without brand-specific rules", () => {
    expect(
      parseAssistantMessage(
        "quero cadastrar coca lata 350 ml, comprei uma caixa com 12 unidades por 37 reais, vou vender cada latinha por 5 reais e quando tiver só 6 me avisa",
      ),
    ).toMatchObject({
      initialStock: 12,
      kind: "product",
      minimumStock: 6,
      name: "coca lata 350 ml",
      salePriceCents: 500,
      unit: "UNIT",
      unitCostCents: 308,
    });

    expect(
      parseAssistantMessage(
        "cadastro aí pra mim refrigerante coca cola lata de 350ml. Peguei 1 caixa fechada com 12, deu 37,00 a caixa. Cada uma sai a 5,00 pra vender. mínimo 6.",
      ),
    ).toMatchObject({
      initialStock: 12,
      kind: "product",
      minimumStock: 6,
      name: "refrigerante coca cola lata 350 ml",
      salePriceCents: 500,
      unit: "UNIT",
      unitCostCents: 308,
    });

    expect(
      parseAssistantMessage(
        "comprei 2 fardos de água mineral 500 ml, cada fardo vem 12 garrafinhas e custou 18 reais cada fardo. vou vender cada água por 2,50. estoque mínimo 10",
      ),
    ).toMatchObject({
      initialStock: 24,
      kind: "product",
      minimumStock: 10,
      name: "água mineral 500 ml",
      salePriceCents: 250,
      unit: "UNIT",
      unitCostCents: 150,
    });

    expect(
      parseAssistantMessage(
        "coloca aí doce paçoca, veio uma cartela com 50 unidades por 35 reais, vendo cada uma por 1 real, mínimo 10",
      ),
    ).toMatchObject({
      initialStock: 50,
      kind: "product",
      minimumStock: 10,
      name: "doce paçoca",
      salePriceCents: 100,
      unit: "UNIT",
      unitCostCents: 70,
    });
  });

  it("asks for missing stock minimum instead of inventing it", () => {
    expect(
      parseAssistantMessage(
        "peguei 3 fardos de água sem gás 500ml, cada fardo com 12 unidades, tudo ficou 72 reais, vendo cada uma por 2 reais",
      ),
    ).toMatchObject({
      initialStock: 36,
      kind: "product",
      minimumStock: null,
      missingFields: ["minimumStock"],
      name: "água sem gás 500 ml",
      salePriceCents: 200,
      unit: "UNIT",
      unitCostCents: 200,
    });

    expect(
      parseAssistantMessage("cadastra ovo branco, comprei uma bandeja com 30 ovos por 24 reais e vendo cada ovo a 1 real"),
    ).toMatchObject({
      initialStock: 30,
      kind: "product",
      minimumStock: null,
      missingFields: ["minimumStock"],
      name: "ovo branco",
      salePriceCents: 100,
      unit: "UNIT",
      unitCostCents: 80,
    });
  });

  it("does not guess when pacote may be the sold product or only the purchase package", () => {
    expect(
      parseAssistantMessage(
        "cadastro pacote de salgadinho pequeno, comprei um pacote fechado com 10 unidades por 25 reais, vendo cada um por 4 reais",
      ),
    ).toEqual({
      kind: "unknown",
      message:
        "Não tenho certeza se você vende o pacote fechado ou cada salgadinho separado. Me diga: você vende o pacote fechado ou vende cada salgadinho separado?",
    });
  });

  it("parses kg, gram and liter product drafts without treating measures as unit counts", () => {
    expect(
      parseAssistantMessage(
        "cadastra maçã gala, comprei 2 kg por 51 reais, vendo o kg a 35 reais, estoque mínimo 1 kg",
      ),
    ).toMatchObject({
      initialStock: 2,
      kind: "product",
      minimumStock: 1,
      name: "maçã gala",
      salePriceCents: 3500,
      unit: "KG",
      unitCostCents: 2550,
    });

    expect(
      parseAssistantMessage("comprei hoje 5 quilos de queijo minas a 32 reais o quilo, vou vender a 48 o kg, mínimo 1 quilo"),
    ).toMatchObject({
      initialStock: 5,
      kind: "product",
      minimumStock: 1,
      name: "queijo minas",
      salePriceCents: 4800,
      unit: "KG",
      unitCostCents: 3200,
    });

    expect(parseAssistantMessage("cadastra queijo ralado, comprei 500 gramas por 18 reais e vendo 100 gramas por 5 reais")).toMatchObject({
      initialStock: 0.5,
      kind: "product",
      minimumStock: null,
      missingFields: ["minimumStock"],
      name: "queijo ralado",
      salePriceCents: 5000,
      unit: "KG",
      unitCostCents: 3600,
    });

    expect(
      parseAssistantMessage(
        "cadastro leite integral, comprei 12 litros por 60 reais, vendo cada litro a 7 reais, mínimo 3 litros",
      ),
    ).toMatchObject({
      initialStock: 12,
      kind: "product",
      minimumStock: 3,
      name: "leite integral",
      salePriceCents: 700,
      unit: "LITER",
      unitCostCents: 500,
    });
  });

  it("keeps ml as a product variant when the stock is sold by unit", () => {
    expect(
      parseAssistantMessage("cadastra suco uva 300 ml, comprei uma caixa com 24 unidades por 48 reais, vendo cada um por 3,50"),
    ).toMatchObject({
      initialStock: 24,
      kind: "product",
      minimumStock: null,
      missingFields: ["minimumStock"],
      name: "suco uva 300 ml",
      salePriceCents: 350,
      unit: "UNIT",
      unitCostCents: 200,
    });
  });

  it("keeps caixa as part of the sold product when no inner-unit sale is stated", () => {
    expect(
      parseAssistantMessage("cadastra caixa de bombom, comprei 5 caixas por 12 reais cada e vendo a caixa por 18 reais"),
    ).toMatchObject({
      initialStock: 5,
      kind: "product",
      minimumStock: null,
      missingFields: ["minimumStock"],
      name: "caixa de bombom",
      salePriceCents: 1800,
      unit: "BOX",
      unitCostCents: 1200,
    });
  });

  it("keeps incomplete purchases and unsupported operations safe", () => {
    expect(parseAssistantMessage("comprei uma caixa com 12 coca lata 350 por 37 reais")).toMatchObject({
      kind: "purchase",
      productName: "coca lata 350 ml",
      quantity: 12,
      unit: "UNIT",
      unitCostCents: 308,
    });

    expect(parseAssistantMessage("gastei 37 reais com sacolinha e embalagem")).toEqual({
      amountCents: 3700,
      category: "PACKAGING_MATERIAL",
      description: "sacolinha e embalagem",
      kind: "expense",
    });

    expect(parseAssistantMessage("perdi 3 águas que estouraram no freezer")).toEqual({
      kind: "stock_loss",
      productName: "águas",
      quantity: 3,
      reason: "estouraram no freezer",
    });

    expect(parseAssistantMessage("cancela aquela venda de água que fiz agora")).toEqual({
      kind: "cancellation",
      productName: "água",
      reason: "solicitado pelo usuário",
      targetType: "sale",
    });
  });

  it("parses the messy boxed soda phrase without depending on a literal sentence", () => {
    expect(
      parseAssistantMessage(
        "moço coloca aí pra mim, peguei lá 2 caixa de refri guaraná lata 350, vem 12 em cada, paguei 80 nas duas caixa, acho que vou vender 4,50 cada, quando tiver 8 avisa",
      ),
    ).toMatchObject({
      initialStock: 24,
      kind: "product",
      minimumStock: 8,
      name: "refri guaraná lata 350 ml",
      salePriceCents: 450,
      unit: "UNIT",
      unitCostCents: 333,
    });
  });

  it("recognizes deterministic inventory and profit summary questions", () => {
    expect(parseAssistantMessage("quanto tenho de água 500 ml no estoque?")).toEqual({
      intent: "inventory",
      kind: "question",
      period: "month",
      productName: "água 500 ml",
    });
    expect(parseAssistantMessage("me mostra um resumo do que vendi e do lucro de hoje")).toEqual({
      intent: "dailySummary",
      kind: "question",
      period: "today",
    });
  });
});
