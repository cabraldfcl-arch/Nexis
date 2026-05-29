import { describe, expect, it } from "vitest";
import { parseAssistantMessage } from "@/lib/ai/parse-message";
import {
  classifyIntent,
  extractEntities,
  normalizeUserMessage,
} from "@/lib/ai/conversation-engine";

describe("assistant message parser", () => {
  it("normalizes user messages for conversational intelligence", () => {
    const normalized = normalizeUserMessage("Comprei 10 Coca-Cola em lata 350 ml por R$ 3,50 cada unidade.");

    expect(normalized.normalized).toBe("comprei 10 coca cola em lata 350 ml por r$ 3,50 cada unidade");
    expect(normalized.tokens).toContain("coca");
    expect(normalized.tokens).toContain("lata");
    expect(normalized.tokens).toContain("350");
    expect(normalized.tokens).toContain("ml");
  });

  it("classifies intent with action priority before financial reports", () => {
    expect(classifyIntent("apagar coca")).toBe("dangerous");
    expect(classifyIntent("olá boa tarde")).toBe("social");
    expect(classifyIntent("comprei 10 coca")).toBe("purchase_entry");
    expect(classifyIntent("quero lançar uma compra de 10 coca lata 350ml a 3,50 cada")).toBe("purchase_entry");
    expect(classifyIntent("quero cadastrar a compra que fiz")).toBe("purchase_entry");
    expect(classifyIntent("quais compras fiz no mês?")).toBe("financial_question");
    expect(classifyIntent("compras do mês")).toBe("financial_question");
  });

  it("extracts product variants, quantities and unit purchase costs from natural language", () => {
    expect(
      extractEntities(
        "quero cadastrar a compra que eu fiz de 10 coca cola em lata 350 ml, comprei por 3.5 cada unidade dela cadastra para mim por favor este produto",
        "purchase_entry",
      ),
    ).toMatchObject({
      amountKind: "unit",
      productName: "coca cola lata 350 ml",
      quantity: 10,
      unitCostCents: 350,
      variant: "lata 350 ml",
    });
    expect(extractEntities("água 500ml", "product_registration")).toMatchObject({
      productName: "água 500ml",
      variant: "500ml",
    });
    expect(extractEntities("queijo mussarela kg", "product_registration")).toMatchObject({
      productName: "queijo mussarela kg",
      unit: "KG",
      variant: "kg",
    });
  });

  it("responds to social messages without creating reports or drafts", () => {
    expect(parseAssistantMessage("olá boa tarde")).toEqual({
      kind: "social",
      message:
        "Boa tarde! Posso te ajudar a cadastrar produtos, registrar compras, vendas, despesas ou consultar lucro e estoque.",
    });
    expect(parseAssistantMessage("tudo bem?")).toEqual({
      kind: "social",
      message: "Tudo bem. Como posso te ajudar no seu negócio hoje?",
    });
    expect(parseAssistantMessage("o que você faz?")).toEqual({
      kind: "social",
      message:
        "Eu ajudo você a registrar produtos, compras, vendas, despesas e consultar vendas, lucro e estoque.",
    });
  });

  it("recognizes a simple sale draft request", () => {
    expect(parseAssistantMessage("vendi 3 refrigerantes por 7 reais")).toEqual({
      kind: "sale",
      productName: "refrigerantes",
      quantity: 3,
      unitPriceCents: 700,
    });
  });

  it("recognizes a sale without price so the backend can use the registered product price", () => {
    expect(parseAssistantMessage("vendi 2 águas")).toEqual({
      kind: "sale",
      productName: "águas",
      quantity: 2,
      unitPriceCents: null,
    });
  });

  it("recognizes a sale informed by total and derives the unit price", () => {
    expect(parseAssistantMessage("vendi 2 águas no total de 6 reais")).toEqual({
      kind: "sale",
      productName: "águas",
      quantity: 2,
      unitPriceCents: 300,
    });
  });

  it("recognizes generic product sale prompts without saving anything", () => {
    expect(parseAssistantMessage("vendi 4 itens de queijo")).toEqual({
      kind: "sale",
      productName: "itens de queijo",
      quantity: 4,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi 5 bolos por 8 reais cada")).toEqual({
      kind: "sale",
      productName: "bolos",
      quantity: 5,
      unitPriceCents: 800,
    });
    expect(parseAssistantMessage("vendi 3 refrigerantes por 6 reais")).toEqual({
      kind: "sale",
      productName: "refrigerantes",
      quantity: 3,
      unitPriceCents: 600,
    });
    expect(parseAssistantMessage("vendi 100 águas")).toEqual({
      kind: "sale",
      productName: "águas",
      quantity: 100,
      unitPriceCents: null,
    });
  });

  it("recognizes a simple purchase draft request", () => {
    expect(parseAssistantMessage("comprei 10 refrigerantes por 4 reais")).toEqual({
      kind: "purchase",
      productName: "refrigerantes",
      quantity: 10,
      unitCostCents: 400,
    });
  });

  it("recognizes purchase cost with singular real", () => {
    expect(parseAssistantMessage("comprei 5 águas por 1 real cada")).toEqual({
      kind: "purchase",
      productName: "águas",
      quantity: 5,
      unitCostCents: 100,
    });
  });

  it("recognizes generic product purchase prompts", () => {
    expect(parseAssistantMessage("comprei 20 queijos por 10 reais cada")).toEqual({
      kind: "purchase",
      productName: "queijos",
      quantity: 20,
      unitCostCents: 1000,
    });
    expect(parseAssistantMessage("comprei 20 massas por 3 reais cada")).toEqual({
      kind: "purchase",
      productName: "massas",
      quantity: 20,
      unitCostCents: 300,
    });
    expect(parseAssistantMessage("comprei 12 refrigerantes por 4 reais")).toEqual({
      kind: "purchase",
      productName: "refrigerantes",
      quantity: 12,
      unitCostCents: 400,
    });
    expect(parseAssistantMessage("entrou 20 águas no estoque")).toEqual({
      kind: "partial_purchase",
      productName: "águas",
      quantity: 20,
      missingFields: ["unitCostCents"],
    });
  });

  it("keeps long human product purchase registration as an action, not a purchases report", () => {
    expect(
      parseAssistantMessage(
        "quero cadastrar a compra que eu fiz de 10 coca cola em lata 350 ml, comprei por 3.5 cada unidade dela cadastra para mim por favor este produto",
      ),
    ).toEqual({
      kind: "purchase",
      productName: "coca cola lata 350 ml",
      quantity: 10,
      unitCostCents: 350,
    });
  });

  it("recognizes product registration and stock entry wording with variants", () => {
    expect(parseAssistantMessage("cadastre para mim coca lata 350 ml, comprei 10 por 3.50 cada")).toEqual({
      kind: "purchase",
      productName: "coca lata 350 ml",
      quantity: 10,
      unitCostCents: 350,
    });
    expect(parseAssistantMessage("quero lançar uma compra de 10 coca lata 350ml a 3,50 cada")).toEqual({
      kind: "purchase",
      productName: "coca lata 350ml",
      quantity: 10,
      unitCostCents: 350,
    });
  });

  it("recognizes natural stock-entry purchase prompts even when cost is missing", () => {
    expect(parseAssistantMessage("coloca 5 coca cola que eu comprei no estoque")).toEqual({
      kind: "partial_purchase",
      productName: "coca cola",
      quantity: 5,
      missingFields: ["unitCostCents"],
    });
    expect(parseAssistantMessage("comprei 5 coca cola")).toEqual({
      kind: "partial_purchase",
      productName: "coca cola",
      quantity: 5,
      missingFields: ["unitCostCents"],
    });
    expect(parseAssistantMessage("entrou 10 água no estoque")).toEqual({
      kind: "partial_purchase",
      productName: "água",
      quantity: 10,
      missingFields: ["unitCostCents"],
    });
  });

  it("extracts unit purchase cost from natural stock-entry wording", () => {
    expect(parseAssistantMessage("coloca 5 cocas que eu comprei no estoque paguei 4 reais em cada uma delas")).toEqual({
      kind: "purchase",
      productName: "cocas",
      quantity: 5,
      unitCostCents: 400,
    });
    expect(parseAssistantMessage("comprei 5 cocas por 4 reais cada")).toEqual({
      kind: "purchase",
      productName: "cocas",
      quantity: 5,
      unitCostCents: 400,
    });
    expect(parseAssistantMessage("comprei 5 cocas a 4 reais")).toEqual({
      kind: "purchase",
      productName: "cocas",
      quantity: 5,
      unitCostCents: 400,
    });
    expect(parseAssistantMessage("entrou 10 água no estoque, paguei 2 em cada")).toEqual({
      kind: "purchase",
      productName: "água",
      quantity: 10,
      unitCostCents: 200,
    });
    expect(parseAssistantMessage("cada unidade custou 4 reais para 5 cocas que entraram no estoque")).toEqual({
      kind: "purchase",
      productName: "cocas",
      quantity: 5,
      unitCostCents: 400,
    });
  });

  it("extracts commercial measurement units and price basis from purchase wording", () => {
    expect(parseAssistantMessage("comprei 2 caixas de coca lata com 12 unidades cada a 36 a caixa")).toMatchObject({
      kind: "purchase",
      productName: "coca lata",
      quantity: 24,
      unit: "UNIT",
      unitCostCents: 300,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("comprei uma caixa de coca lata 350 ml com 12 unidades cada a 37 a caixa")).toMatchObject({
      kind: "purchase",
      productName: "coca lata 350 ml",
      quantity: 12,
      unit: "UNIT",
      unitCostCents: 308,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(
      parseAssistantMessage(
        "gostaria de cadastrar um produto comprei uma caixa de coca cola de 12 unidades coca lata de 350 ml ficou 37 reais a caixa dela",
      ),
    ).toMatchObject({
      kind: "purchase",
      productName: "coca cola lata 350 ml",
      quantity: 12,
      unit: "UNIT",
      unitCostCents: 308,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("eu comprei hoje 2 kg de macan a 25,50 o kg")).toEqual({
      kind: "purchase",
      productName: "macan",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 2 kg de maçã a 25,50 o kg")).toMatchObject({
      kind: "purchase",
      productName: "maçã",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 2 quilos de maçã por 25,50 o quilo")).toMatchObject({
      kind: "purchase",
      productName: "maçã",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 500 gramas de queijo a 30 o kg")).toMatchObject({
      kind: "purchase",
      productName: "queijo",
      quantity: 0.5,
      unit: "KG",
      unitCostCents: 3000,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 500 gramas de tempero a 0,04 a grama")).toMatchObject({
      kind: "purchase",
      productName: "tempero",
      quantity: 500,
      unit: "GRAM",
      unitCostCents: 4,
      unitLabel: "grama",
      priceBasis: "por grama",
    });
    expect(parseAssistantMessage("bota no estoque 3 metros de areia fina a 90 o metro")).toMatchObject({
      kind: "purchase",
      productName: "areia fina",
      quantity: 3,
      unit: "METER",
      unitCostCents: 9000,
      unitLabel: "metro",
      priceBasis: "por metro",
    });
    expect(parseAssistantMessage("comprei 5 sacos de cimento a 32 o saco")).toMatchObject({
      kind: "purchase",
      productName: "cimento",
      quantity: 5,
      unit: "SACK",
      unitCostCents: 3200,
      unitLabel: "saco",
      priceBasis: "por saco",
    });
    expect(parseAssistantMessage("entrou 2 caixas de tomate a 80 a caixa")).toMatchObject({
      kind: "purchase",
      productName: "tomate",
      quantity: 2,
      unit: "BOX",
      unitCostCents: 8000,
      unitLabel: "caixa",
      priceBasis: "por caixa",
    });
    expect(parseAssistantMessage("comprei 1 fardo de água a 18 o fardo")).toMatchObject({
      kind: "purchase",
      productName: "água",
      quantity: 1,
      unit: "BALE",
      unitCostCents: 1800,
      unitLabel: "fardo",
      priceBasis: "por fardo",
    });
    expect(parseAssistantMessage("comprei 12 pacotes de café a 8 cada pacote")).toMatchObject({
      kind: "purchase",
      productName: "café",
      quantity: 12,
      unit: "PACKAGE",
      unitCostCents: 800,
      unitLabel: "pacote",
      priceBasis: "por pacote",
    });
    expect(parseAssistantMessage("comprei uma dúzia de ovos a 12 a dúzia")).toMatchObject({
      kind: "purchase",
      productName: "ovos",
      quantity: 1,
      unit: "DOZEN",
      unitCostCents: 1200,
      unitLabel: "dúzia",
      priceBasis: "por dúzia",
    });
  });

  it("understands packaged purchases from generic container wording without depending on a brand", () => {
    expect(parseAssistantMessage("comprei uma caixa com 12 unidades de refrigerante por 37 reais")).toMatchObject({
      kind: "purchase",
      productName: "refrigerante",
      quantity: 12,
      unit: "UNIT",
      unitCostCents: 308,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("comprei um fardo com 6 águas de 500 ml por 18 reais")).toMatchObject({
      kind: "purchase",
      productName: "águas 500 ml",
      quantity: 6,
      unit: "UNIT",
      unitCostCents: 300,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("comprei pacote com 10 salgados por 25 reais")).toMatchObject({
      kind: "purchase",
      productName: "salgados",
      quantity: 10,
      unit: "UNIT",
      unitCostCents: 250,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("peguei uma bandeja com 30 ovos por 24 reais")).toMatchObject({
      kind: "purchase",
      productName: "ovos",
      quantity: 30,
      unit: "UNIT",
      unitCostCents: 80,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("comprei uma cartela com 12 doces por 30 reais")).toMatchObject({
      kind: "purchase",
      productName: "doces",
      quantity: 12,
      unit: "UNIT",
      unitCostCents: 250,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
    expect(parseAssistantMessage("comprei 2 caixas com 12 unidades de refrigerante por 37 reais cada caixa")).toMatchObject({
      kind: "purchase",
      productName: "refrigerante",
      quantity: 24,
      unit: "UNIT",
      unitCostCents: 308,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
  });

  it("handles explicit unit, weight and volume totals without treating measures as item counts", () => {
    expect(parseAssistantMessage("comprei 2 kg de maçã a 25,50 o kg")).toMatchObject({
      kind: "purchase",
      productName: "maçã",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 2 quilos de maçã por 51 reais")).toMatchObject({
      kind: "purchase",
      productName: "maçã",
      quantity: 2,
      unit: "KG",
      unitCostCents: 2550,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 500 gramas de queijo por 18 reais")).toMatchObject({
      kind: "purchase",
      productName: "queijo",
      quantity: 0.5,
      unit: "KG",
      unitCostCents: 3600,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 500g de queijo a 36 reais o kg")).toMatchObject({
      kind: "purchase",
      productName: "queijo",
      quantity: 0.5,
      unit: "KG",
      unitCostCents: 3600,
      unitLabel: "kg",
      priceBasis: "por kg",
    });
    expect(parseAssistantMessage("comprei 1 litro de leite por 5 reais")).toMatchObject({
      kind: "purchase",
      productName: "leite",
      quantity: 1,
      unit: "LITER",
      unitCostCents: 500,
      unitLabel: "litro",
      priceBasis: "por litro",
    });
    expect(parseAssistantMessage("comprei 6 unidades de guaraná lata 350 ml por 18 reais")).toMatchObject({
      kind: "purchase",
      productName: "guaraná lata 350 ml",
      quantity: 6,
      unit: "UNIT",
      unitCostCents: 300,
      unitLabel: "unidade",
      priceBasis: "por unidade",
    });
  });

  it("does not invent missing purchase fields for incomplete packaged or ambiguous wording", () => {
    expect(parseAssistantMessage("comprei uma caixa com 12 unidades por 37 reais")).toEqual({
      kind: "unknown",
      message: "Acho que você quer registrar uma compra, mas preciso saber produto, quantidade e custo por unidade.",
    });
    expect(parseAssistantMessage("comprei refrigerante por 37 reais")).toEqual({
      kind: "unknown",
      message: "Acho que você quer registrar uma compra, mas preciso saber produto, quantidade e custo por unidade.",
    });
    expect(parseAssistantMessage("comprei pacote com salgados por 25 reais")).toEqual({
      kind: "unknown",
      message: "Acho que você quer registrar uma compra, mas preciso saber produto, quantidade e custo por unidade.",
    });
    expect(parseAssistantMessage("comprei 5 refrigerantes por 20 reais")).toEqual({
      amountCents: 2000,
      kind: "ambiguous_purchase_cost",
      productName: "refrigerantes",
      quantity: 5,
    });
  });

  it("extracts decimal sale quantities with commercial units", () => {
    expect(parseAssistantMessage("vendi 1,5 kg de maçã")).toEqual({
      kind: "sale",
      productName: "maçã",
      quantity: 1.5,
      unit: "KG",
      unitLabel: "kg",
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi 1 metro de areia fina")).toEqual({
      kind: "sale",
      productName: "areia fina",
      quantity: 1,
      unit: "METER",
      unitLabel: "metro",
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi 125 gramas de tempero")).toEqual({
      kind: "sale",
      productName: "tempero",
      quantity: 125,
      unit: "GRAM",
      unitLabel: "grama",
      unitPriceCents: null,
    });
  });

  it("asks for clarification when purchase cost can be total or unit value", () => {
    expect(parseAssistantMessage("comprei 5 coca por 20 reais")).toEqual({
      amountCents: 2000,
      kind: "ambiguous_purchase_cost",
      productName: "coca",
      quantity: 5,
    });
    expect(parseAssistantMessage("comprei 5 coca por 20 reais total")).toEqual({
      kind: "purchase",
      productName: "coca",
      quantity: 5,
      unitCostCents: 400,
    });
    expect(parseAssistantMessage("comprei 5 coca por 20 reais cada")).toEqual({
      kind: "purchase",
      productName: "coca",
      quantity: 5,
      unitCostCents: 2000,
    });
  });

  it("recognizes simple spoken sale quantities and product qualifiers", () => {
    expect(parseAssistantMessage("vendi 5 coca cola para meu cliente aqui")).toEqual({
      kind: "sale",
      productName: "coca cola",
      quantity: 5,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi uma coca")).toEqual({
      kind: "sale",
      productName: "coca",
      quantity: 1,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi uma coca 600")).toEqual({
      kind: "sale",
      productName: "coca 600",
      quantity: 1,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("vendi uma coca lata")).toEqual({
      kind: "sale",
      productName: "coca lata",
      quantity: 1,
      unitPriceCents: null,
    });
  });

  it("asks for missing product draft fields without inventing values", () => {
    expect(parseAssistantMessage("cadastrar produto refrigerante")).toEqual({
      kind: "product",
      name: "refrigerante",
      category: null,
      unit: "UNIT",
      unitCostCents: null,
      salePriceCents: null,
      initialStock: null,
      minimumStock: null,
      missingFields: ["unitCostCents", "salePriceCents", "initialStock", "minimumStock"],
    });
  });

  it("recognizes a complete product draft request", () => {
    expect(parseAssistantMessage("cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5")).toEqual({
      kind: "product",
      name: "Coca lata",
      category: null,
      unit: "UNIT",
      unitCostCents: 300,
      salePriceCents: 600,
      initialStock: 20,
      minimumStock: 5,
      missingFields: [],
    });
  });

  it("recognizes explicit product draft units used by commerce", () => {
    expect(parseAssistantMessage("cadastre tempero unidade grama custo 0,04 venda 0,08 estoque 500 mínimo 100")).toEqual({
      kind: "product",
      name: "tempero",
      category: null,
      unit: "GRAM",
      unitCostCents: 4,
      salePriceCents: 8,
      initialStock: 500,
      minimumStock: 100,
      missingFields: [],
    });
    expect(parseAssistantMessage("cadastre cimento por saco custo 32 venda 45 estoque 5 mínimo 2")).toEqual({
      kind: "product",
      name: "cimento",
      category: null,
      unit: "SACK",
      unitCostCents: 3200,
      salePriceCents: 4500,
      initialStock: 5,
      minimumStock: 2,
      missingFields: [],
    });
    expect(parseAssistantMessage("cadastre ovos por dúzia custo 12 venda 18 estoque 4 mínimo 1")).toEqual({
      kind: "product",
      name: "ovos",
      category: null,
      unit: "DOZEN",
      unitCostCents: 1200,
      salePriceCents: 1800,
      initialStock: 4,
      minimumStock: 1,
      missingFields: [],
    });
  });

  it("defaults product drafts to unit when the user does not state a unit", () => {
    expect(parseAssistantMessage("cadastre tempero custo 0,04 venda 0,08 estoque 500 mínimo 100")).toMatchObject({
      kind: "product",
      name: "tempero",
      unit: "UNIT",
    });
    expect(parseAssistantMessage("cadastre maçã custo 4 venda 7 estoque 10 mínimo 2")).toMatchObject({
      kind: "product",
      name: "maçã",
      unit: "UNIT",
    });
    expect(parseAssistantMessage("cadastre leite custo 5 venda 8 estoque 10 mínimo 2")).toMatchObject({
      kind: "product",
      name: "leite",
      unit: "UNIT",
    });
    expect(parseAssistantMessage("cadastre areia fina custo 90 venda 130 estoque 3 mínimo 1")).toMatchObject({
      kind: "product",
      name: "areia fina",
      unit: "UNIT",
    });
    expect(parseAssistantMessage("cadastre cimento custo 32 venda 45 estoque 5 mínimo 2")).toMatchObject({
      kind: "product",
      name: "cimento",
      unit: "UNIT",
    });
    expect(parseAssistantMessage("cadastre ovos custo 12 venda 18 estoque 4 mínimo 1")).toMatchObject({
      kind: "product",
      name: "ovos",
      unit: "UNIT",
    });
  });

  it("recognizes product draft wording with price before cost", () => {
    expect(parseAssistantMessage("adicionar produto água mineral preço 3 custo 1 estoque 50 mínimo 10")).toEqual({
      kind: "product",
      name: "água mineral",
      category: null,
      unit: "UNIT",
      unitCostCents: 100,
      salePriceCents: 300,
      initialStock: 50,
      minimumStock: 10,
      missingFields: [],
    });
  });

  it("recognizes a simple utility expense draft request", () => {
    expect(parseAssistantMessage("paguei 120 reais de energia")).toEqual({
      kind: "expense",
      description: "energia",
      category: "UTILITIES",
      amountCents: 12000,
    });
  });

  it("recognizes a natural transport expense sentence with category after the amount", () => {
    expect(parseAssistantMessage("tive despesa de 50 reais com transporte")).toEqual({
      kind: "expense",
      description: "transporte",
      category: "TRANSPORT_LOGISTICS",
      amountCents: 5000,
    });
  });

  it("maps concrete transport examples into the generic transport category", () => {
    for (const description of ["gasolina", "uber", "ônibus", "frete"]) {
      expect(parseAssistantMessage(`paguei 50 reais de ${description}`)).toEqual({
        kind: "expense",
        description,
        category: "TRANSPORT_LOGISTICS",
        amountCents: 5000,
      });
    }
  });

  it("maps concrete operating examples into generic expense categories", () => {
    expect(parseAssistantMessage("gastei 25 com carne")).toEqual({
      kind: "expense",
      description: "carne",
      category: "MERCHANDISE_SUPPLIES",
      amountCents: 2500,
    });
    expect(parseAssistantMessage("paguei 120 de aluguel do ponto")).toEqual({
      kind: "expense",
      description: "aluguel do ponto",
      category: "RENT",
      amountCents: 12000,
    });
    expect(parseAssistantMessage("tive despesa de 15 reais com embalagem")).toEqual({
      kind: "expense",
      description: "embalagem",
      category: "PACKAGING_MATERIAL",
      amountCents: 1500,
    });
    expect(parseAssistantMessage("paguei 10 reais de maquininha")).toMatchObject({
      category: "TAXES_FEES",
      kind: "expense",
    });
    expect(parseAssistantMessage("gastei 30 reais com produto vencido")).toMatchObject({
      category: "LOSS_WASTE",
      kind: "expense",
    });
  });

  it("does not treat service revenue as stock sale while the MVP has no service revenue model", () => {
    for (const message of ["recebi 500 reais de honorário", "recebi 200 reais de consulta"]) {
      expect(parseAssistantMessage(message)).toEqual({
        kind: "unknown",
        message:
          "Receita de serviço sem estoque ainda não está implementada com segurança. Posso te avisar que essa função está no roadmap, mas não vou salvar esse lançamento agora.",
      });
    }
  });

  it("parses product loss or waste as a stock-loss draft request, not as a sale", () => {
    expect(parseAssistantMessage("perdi 5 espetinhos")).toEqual({
      kind: "stock_loss",
      productName: "espetinhos",
      quantity: 5,
      reason: "perda informada pelo usuário",
    });
    expect(parseAssistantMessage("estragaram 2 queijos")).toEqual({
      kind: "stock_loss",
      productName: "queijos",
      quantity: 2,
      reason: "perda informada pelo usuário",
    });
    expect(parseAssistantMessage("quebrou 1 peça")).toEqual({
      kind: "stock_loss",
      productName: "peça",
      quantity: 1,
      reason: "perda informada pelo usuário",
    });
    expect(parseAssistantMessage("joguei fora 3 bolos vencidos")).toEqual({
      kind: "stock_loss",
      productName: "bolos vencidos",
      quantity: 3,
      reason: "perda informada pelo usuário",
    });
  });

  it("recognizes sales question for today", () => {
    expect(parseAssistantMessage("quanto vendi hoje?")).toEqual({
      kind: "question",
      intent: "sales",
      period: "today",
    });
  });

  it("recognizes the required financial question intents and periods", () => {
    expect(parseAssistantMessage("quanto vendi no mês?")).toEqual({
      kind: "question",
      intent: "sales",
      period: "month",
    });
    expect(parseAssistantMessage("qual meu lucro bruto hoje?")).toEqual({
      kind: "question",
      intent: "grossProfit",
      period: "today",
    });
    expect(parseAssistantMessage("qual meu lucro líquido no mês?")).toEqual({
      kind: "question",
      intent: "netProfit",
      period: "month",
    });
    expect(parseAssistantMessage("resumo financeiro do dia")).toEqual({
      kind: "question",
      intent: "dailySummary",
      period: "today",
    });
    expect(parseAssistantMessage("resumo de hoje")).toEqual({
      kind: "question",
      intent: "dailySummary",
      period: "today",
    });
    expect(parseAssistantMessage("quanto tive de despesa hoje?")).toEqual({
      kind: "question",
      intent: "expenses",
      period: "today",
    });
    expect(parseAssistantMessage("quanto ganhei hoje")).toEqual({
      kind: "question",
      intent: "profit",
      period: "today",
    });
  });

  it("recognizes inventory, purchase and top product questions", () => {
    expect(parseAssistantMessage("qual meu estoque atual?")).toEqual({
      kind: "question",
      intent: "inventory",
      period: "month",
    });
    expect(parseAssistantMessage("quanto tenho de estoque?")).toEqual({
      kind: "question",
      intent: "inventory",
      period: "month",
    });
    expect(parseAssistantMessage("tenho quantas águas?")).toEqual({
      kind: "question",
      intent: "inventory",
      period: "month",
      productName: "águas",
    });
    expect(parseAssistantMessage("quantos refrigerantes tenho em estoque?")).toEqual({
      kind: "question",
      intent: "inventory",
      period: "month",
      productName: "refrigerantes",
    });
    expect(parseAssistantMessage("quais produtos estão acabando?")).toEqual({
      kind: "question",
      intent: "lowStock",
      period: "month",
    });
    expect(parseAssistantMessage("o que comprei hoje?")).toEqual({
      kind: "question",
      intent: "purchases",
      period: "today",
    });
    expect(parseAssistantMessage("quais compras fiz no mês?")).toEqual({
      kind: "question",
      intent: "purchases",
      period: "month",
    });
    expect(parseAssistantMessage("compras do mês")).toEqual({
      kind: "question",
      intent: "purchases",
      period: "month",
    });
    expect(parseAssistantMessage("quais produtos vendi mais?")).toEqual({
      kind: "question",
      intent: "topProducts",
      period: "month",
    });
    expect(parseAssistantMessage("produto mais vendido hoje")).toEqual({
      kind: "question",
      intent: "topProducts",
      period: "today",
    });
  });

  it("recognizes profit question for the current month", () => {
    expect(parseAssistantMessage("qual meu lucro no mês?")).toEqual({
      kind: "question",
      intent: "profit",
      period: "month",
    });
  });

  it("rejects ambiguous text without creating a critical draft", () => {
    const ambiguousMessages = [
      {
        message: "sim pode confirmar",
        response: "Não consegui entender com segurança. Tente escrever assim: Vendi 3 refrigerantes por 7 reais.",
      },
      {
        message: "1",
        response: "Não consegui entender com segurança. Tente escrever assim: Vendi 3 refrigerantes por 7 reais.",
      },
      {
        message: "vendi espetinho",
        response: "Acho que você quer registrar uma venda, mas preciso saber o produto e a quantidade.",
      },
      {
        message: "vendi 10",
        response: "Acho que você quer registrar uma venda, mas preciso saber o produto e a quantidade.",
      },
      {
        message: "gastei com gasolina",
        response: "Acho que você quer registrar uma despesa, mas preciso saber o valor e a descrição.",
      },
      {
        message: "comprei carne",
        response: "Acho que você quer registrar uma compra, mas preciso saber produto, quantidade e custo por unidade.",
      },
      {
        message: "vendi coisa hoje",
        response: "Acho que você quer registrar uma venda, mas preciso saber o produto e a quantidade.",
      },
    ];

    for (const { message, response } of ambiguousMessages) {
      expect(parseAssistantMessage(message)).toEqual({
        kind: "unknown",
        message: response,
      });
    }
  });

  it("rejects dangerous commands instead of treating them as questions or drafts", () => {
    const dangerousMessages = [
      "apaga minhas vendas",
      "corrige tudo aí",
      "coloca lucro maior",
      "ignora o custo",
      "vende água mesmo sem estoque",
      "salva sem confirmar",
      "apague minhas vendas",
      "apagar produto",
      "excluir a venda",
      "remover produto",
    ];

    for (const message of dangerousMessages) {
      expect(parseAssistantMessage(message)).toEqual({
        kind: "unknown",
        message: "Não posso apagar, alterar lucro, ignorar custo ou salvar sem confirmação. Revise antes de salvar.",
      });
    }
  });

  it("parses cancellation and correction commands as traceable cancellation draft requests", () => {
    expect(parseAssistantMessage("cancelar a venda de hoje")).toEqual({
      kind: "cancellation",
      reason: "solicitado pelo usuário",
      targetType: "sale",
    });
    expect(parseAssistantMessage("corrigir a despesa")).toEqual({
      kind: "cancellation",
      reason: "solicitado pelo usuário",
      targetType: "expense",
    });
    expect(parseAssistantMessage("desfazer compra")).toEqual({
      kind: "cancellation",
      reason: "solicitado pelo usuário",
      targetType: "purchase",
    });
    expect(parseAssistantMessage("estornar venda")).toEqual({
      kind: "cancellation",
      reason: "solicitado pelo usuário",
      targetType: "sale",
    });
  });

  it("rejects invalid draft values with simple messages", () => {
    expect(parseAssistantMessage("vendi 0 águas por 3 reais")).toEqual({
      kind: "unknown",
      message: "Quantidade vendida precisa ser maior que zero.",
    });
    expect(parseAssistantMessage("vendi 2 águas por 0 reais")).toEqual({
      kind: "unknown",
      message: "Preco de venda precisa ser maior que zero.",
    });
    expect(parseAssistantMessage("comprei 0 refrigerantes por 4 reais")).toEqual({
      kind: "unknown",
      message: "Quantidade comprada precisa ser maior que zero.",
    });
    expect(parseAssistantMessage("gastei 0 com embalagem")).toEqual({
      kind: "unknown",
      message: "Valor da despesa precisa ser maior que zero.",
    });
    expect(parseAssistantMessage("cadastrar produto erro custo -1 venda 3 estoque 1 mínimo 1")).toEqual({
      kind: "unknown",
      message: "Custo para voce nao pode ser negativo.",
    });
    expect(parseAssistantMessage("cadastrar produto erro custo 1 venda -3 estoque 1 mínimo 1")).toEqual({
      kind: "unknown",
      message: "Preco de venda nao pode ser negativo.",
    });
    expect(parseAssistantMessage("cadastrar produto erro custo 1 venda 3 estoque -1 mínimo 1")).toEqual({
      kind: "unknown",
      message: "Estoque inicial nao pode ser negativo.",
    });
  });

  it("converts Brazilian money values to cents", () => {
    expect(parseAssistantMessage("vendi 2 águas por 2,50")).toMatchObject({
      kind: "sale",
      unitPriceCents: 250,
    });
    expect(parseAssistantMessage("vendi 1 água por 10")).toMatchObject({
      kind: "sale",
      unitPriceCents: 1000,
    });
    expect(parseAssistantMessage("vendi 1 água por 10,99")).toMatchObject({
      kind: "sale",
      unitPriceCents: 1099,
    });
  });
});
