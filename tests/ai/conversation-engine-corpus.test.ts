import { describe, expect, it } from "vitest";
import {
  assessConversationConfidence,
  classifyIntent,
  detectMultipleActions,
  extractEntities,
  type AssistantConversationIntent,
} from "@/lib/ai/conversation-engine";
import { parseAssistantMessage } from "@/lib/ai/parse-message";

type CorpusCase = {
  group: string;
  phrase: string;
  intent: AssistantConversationIntent;
  shouldConsultDb?: boolean;
};

const corpusCases: CorpusCase[] = [
  { group: "social", phrase: "olá", intent: "social" },
  { group: "social", phrase: "boa tarde", intent: "social" },
  { group: "social", phrase: "olá boa tarde", intent: "social" },
  { group: "social", phrase: "tudo bem?", intent: "social" },
  { group: "social", phrase: "bom dia", intent: "social" },
  { group: "social", phrase: "boa noite", intent: "social" },
  { group: "social", phrase: "você pode me ajudar?", intent: "social" },
  { group: "social", phrase: "o que você faz?", intent: "social" },

  { group: "cadastro", phrase: "cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5", intent: "product_registration" },
  { group: "cadastro", phrase: "cadastra pra mim coca cola lata 350ml", intent: "product_registration" },
  {
    group: "cadastro",
    phrase: "quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma",
    intent: "purchase_entry",
    shouldConsultDb: true,
  },
  { group: "cadastro", phrase: "coloca esse produto no sistema", intent: "product_registration" },
  { group: "cadastro", phrase: "cadastre para mim coca lata 350 ml, comprei 10 por 3.50 cada", intent: "purchase_entry" },
  { group: "cadastro", phrase: "cadastra pra mim 10 coca lata que comprei por 4,20 cada", intent: "purchase_entry" },
  { group: "cadastro", phrase: "quero cadastrar a compra que fiz de 10 coca", intent: "purchase_entry" },
  { group: "cadastro", phrase: "adiciona produto água 500ml custo 1 venda 3 estoque 12 mínimo 4", intent: "product_registration" },

  { group: "compra", phrase: "comprei 10 coca por 4 cada", intent: "purchase_entry", shouldConsultDb: true },
  { group: "compra", phrase: "entrou 5 água no estoque", intent: "purchase_entry", shouldConsultDb: true },
  { group: "compra", phrase: "coloca 10 coca no estoque", intent: "purchase_entry", shouldConsultDb: true },
  { group: "compra", phrase: "dei entrada em 12 queijos", intent: "purchase_entry", shouldConsultDb: true },
  { group: "compra", phrase: "chegou mercadoria", intent: "purchase_entry" },
  { group: "compra", phrase: "comprei por 4.20 cada uma", intent: "purchase_entry" },
  { group: "compra", phrase: "paguei 4.20 cada unidade", intent: "purchase_entry" },
  { group: "compra", phrase: "cada uma saiu por 4.20", intent: "purchase_entry" },

  { group: "venda", phrase: "vendi 3 coca", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "cliente levou 2 águas", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "saiu uma coca 600", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "baixou 4 unidades", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "vendi uma coca", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "vendi uma coca lata", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "vendi uma coca 600", intent: "sale_exit", shouldConsultDb: true },
  { group: "venda", phrase: "cliente comprou uma água", intent: "sale_exit", shouldConsultDb: true },

  { group: "despesa", phrase: "gastei 10 com sacola", intent: "expense" },
  { group: "despesa", phrase: "paguei energia 120", intent: "expense" },
  { group: "despesa", phrase: "comprei embalagem por 30", intent: "expense" },
  { group: "despesa", phrase: "paguei gasolina 50", intent: "expense" },
  { group: "despesa", phrase: "paguei 12 reais de sacola", intent: "expense" },
  { group: "despesa", phrase: "gastei 30 com gasolina", intent: "expense" },
  { group: "despesa", phrase: "tive despesa de 50 reais com transporte", intent: "expense" },
  { group: "despesa", phrase: "paguei 25 de maquininha", intent: "expense" },

  { group: "relatorio", phrase: "quanto vendi hoje", intent: "financial_question" },
  { group: "relatorio", phrase: "quanto ganhei hoje", intent: "financial_question" },
  { group: "relatorio", phrase: "qual meu lucro líquido", intent: "financial_question" },
  { group: "relatorio", phrase: "estoque atual", intent: "financial_question" },
  { group: "relatorio", phrase: "produto mais vendido", intent: "financial_question" },
  { group: "relatorio", phrase: "compras do mês", intent: "financial_question" },
  { group: "relatorio", phrase: "quais compras fiz no mês?", intent: "financial_question" },
  { group: "relatorio", phrase: "resumo financeiro do dia", intent: "financial_question" },

  { group: "ambiguo", phrase: "vendi uma coca", intent: "sale_exit", shouldConsultDb: true },
  { group: "ambiguo", phrase: "comprei coca", intent: "purchase_entry", shouldConsultDb: true },
  { group: "ambiguo", phrase: "entrou água", intent: "purchase_entry", shouldConsultDb: true },
  { group: "ambiguo", phrase: "vendi a de 600", intent: "sale_exit", shouldConsultDb: true },
  { group: "ambiguo", phrase: "foi a lata", intent: "unknown", shouldConsultDb: true },
  { group: "ambiguo", phrase: "a primeira", intent: "unknown", shouldConsultDb: true },
  { group: "ambiguo", phrase: "a de 2 litros", intent: "unknown", shouldConsultDb: true },
  { group: "ambiguo", phrase: "garrafa", intent: "unknown", shouldConsultDb: true },

  { group: "inexistente", phrase: "vendi guaraná", intent: "sale_exit", shouldConsultDb: true },
  { group: "inexistente", phrase: "comprei guaraná", intent: "purchase_entry", shouldConsultDb: true },
  { group: "inexistente", phrase: "cadastra guaraná", intent: "product_registration" },
  { group: "inexistente", phrase: "vendi 2 guaraná lata", intent: "sale_exit", shouldConsultDb: true },
  { group: "inexistente", phrase: "comprei 5 guaraná por 3 cada", intent: "purchase_entry", shouldConsultDb: true },
  { group: "inexistente", phrase: "entrou 10 guaraná no estoque", intent: "purchase_entry", shouldConsultDb: true },
  { group: "inexistente", phrase: "coloca guaraná no sistema", intent: "product_registration" },
  { group: "inexistente", phrase: "cadastre esse guaraná", intent: "product_registration" },

  { group: "valor ambiguo", phrase: "comprei 5 coca por 20", intent: "purchase_entry" },
  { group: "valor ambiguo", phrase: "comprei 5 coca por 20 reais", intent: "purchase_entry" },
  { group: "valor ambiguo", phrase: "paguei 20 nas 5", intent: "unknown" },
  { group: "valor ambiguo", phrase: "foi 20 no total", intent: "unknown" },
  { group: "valor ambiguo", phrase: "cada uma foi 4", intent: "unknown" },
  { group: "valor ambiguo", phrase: "comprei 5 coca por 20 reais total", intent: "purchase_entry" },
  { group: "valor ambiguo", phrase: "comprei 5 coca por 20 reais cada", intent: "purchase_entry" },
  { group: "valor ambiguo", phrase: "por 4.20 a unidade", intent: "purchase_entry" },

  { group: "perigoso", phrase: "apagar produto", intent: "dangerous" },
  { group: "perigoso", phrase: "cancelar venda", intent: "dangerous" },
  { group: "perigoso", phrase: "corrigir compra", intent: "dangerous" },
  { group: "perigoso", phrase: "desfazer despesa", intent: "dangerous" },
  { group: "perigoso", phrase: "estornar venda", intent: "dangerous" },
  { group: "perigoso", phrase: "remover produto", intent: "dangerous" },
  { group: "perigoso", phrase: "salva sem confirmar", intent: "dangerous" },
  { group: "perigoso", phrase: "vende água mesmo sem estoque", intent: "dangerous" },
];

describe("assistant intelligence corpus", () => {
  it("keeps at least 80 real-language corpus phrases under deterministic intent checks", () => {
    expect(corpusCases.length).toBeGreaterThanOrEqual(80);
  });

  it.each(corpusCases)("$group: $phrase -> $intent", ({ phrase, intent }) => {
    expect(classifyIntent(phrase)).toBe(intent);
  });

  it("extracts the real print phrase without asking for cost again", () => {
    const phrase = "quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma";

    expect(extractEntities(phrase, "purchase_entry")).toMatchObject({
      amountKind: "unit",
      productName: "coca cola lata",
      quantity: 10,
      unitCostCents: 420,
      variant: "lata",
    });
    expect(parseAssistantMessage(phrase)).toEqual({
      kind: "purchase",
      productName: "coca cola lata",
      quantity: 10,
      unitCostCents: 420,
    });
  });

  it("extracts the observed kg typo phrase as a complete purchase entry", () => {
    const phrase = "eu comprei hoje 2 kg de macan a 25,50 o kg";

    expect(extractEntities(phrase, "purchase_entry")).toMatchObject({
      amountKind: "unit",
      productName: "macan",
      priceBasis: "por kg",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
    });
    expect(parseAssistantMessage(phrase)).toMatchObject({
      kind: "purchase",
      productName: "macan",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
    });
  });

  it("recognizes commercial units across weight, volume, construction and packaging", () => {
    const phrases = [
      "comprei 2 kg de maçã a 25,50 o kg",
      "comprei 3 litros de leite a 6 o litro",
      "comprei 500 ml de suco a 10 o litro",
      "comprei 4 m2 de piso a 55 o m2",
      "comprei 2 m³ de brita a 120 o m³",
      "comprei 5 sacos de cimento a 32 o saco",
      "comprei 1 fardo de água a 18 o fardo",
      "comprei 12 pacotes de café a 8 cada pacote",
      "comprei uma dúzia de ovos a 12 a dúzia",
    ];

    for (const phrase of phrases) {
      expect(classifyIntent(phrase)).toBe("purchase_entry");
      expect(parseAssistantMessage(phrase)).toMatchObject({
        kind: "purchase",
      });
      expect(extractEntities(phrase, "purchase_entry")).toMatchObject({
        amountKind: "unit",
      });
    }
  });

  it("recognizes common unit-cost wording around cada and unidade", () => {
    const phrases = [
      "quero cadastrar 10 coca que comprei por 4.20 cada uma",
      "quero cadastrar 10 coca que paguei 4.20 cada unidade",
      "quero cadastrar 10 coca, 4,20 em cada",
      "quero cadastrar 10 coca, cada uma saiu por 4.20",
      "quero cadastrar 10 coca a 4.20 cada",
      "quero cadastrar 10 coca por 4.20 a unidade",
    ];

    for (const phrase of phrases) {
      expect(extractEntities(phrase, "purchase_entry")).toMatchObject({
        amountKind: "unit",
        quantity: 10,
        unitCostCents: 420,
      });
      expect(parseAssistantMessage(phrase)).toMatchObject({
        kind: "purchase",
        quantity: 10,
        unitCostCents: 420,
      });
    }
  });

  it("keeps action priority above reports and asks useful safe-mode questions", () => {
    expect(parseAssistantMessage("quero cadastrar a compra que fiz de 10 coca")).toEqual({
      kind: "partial_purchase",
      missingFields: ["unitCostCents"],
      productName: "coca",
      quantity: 10,
    });
    expect(parseAssistantMessage("compras do mês")).toEqual({
      kind: "question",
      intent: "purchases",
      period: "month",
    });
  });

  it("detects mixed actions and refuses to execute all at once", () => {
    expect(detectMultipleActions("comprei coca, vendi água e gastei 10")).toMatchObject({
      hasMultipleActions: true,
    });
    expect(parseAssistantMessage("comprei coca, vendi água e gastei 10")).toEqual({
      kind: "unknown",
      message: "Consigo registrar uma coisa por vez. O que você quer lançar primeiro: compra, venda ou despesa?",
    });
  });

  it("tracks confidence for complete, partial and unsafe interpretations", () => {
    expect(assessConversationConfidence("comprei 5 coca por 20 reais cada")).toBe("HIGH");
    expect(assessConversationConfidence("comprei 5 coca por 20 reais")).toBe("MEDIUM");
    expect(assessConversationConfidence("comprei coca, vendi água e gastei 10")).toBe("LOW");
  });

  it("parses natural sale and expense phrasings from the corpus", () => {
    expect(parseAssistantMessage("cliente levou 2 águas")).toEqual({
      kind: "sale",
      productName: "águas",
      quantity: 2,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("saiu uma coca 600")).toEqual({
      kind: "sale",
      productName: "coca 600",
      quantity: 1,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("comprei embalagem por 30")).toEqual({
      amountCents: 3000,
      category: "PACKAGING_MATERIAL",
      description: "embalagem",
      kind: "expense",
    });
    expect(extractEntities("gastei 30 com gasolina", "expense")).toMatchObject({
      amountCents: 3000,
      expenseCategory: "TRANSPORT_LOGISTICS",
    });
  });
});
