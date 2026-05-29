import { describe, expect, it } from "vitest";
import {
  classifyIntent,
  extractEntities,
  resolveProduct,
  type AssistantConversationIntent,
} from "@/lib/ai/conversation-engine";
import { parseAssistantMessage } from "@/lib/ai/parse-message";
import { resolveProductSelectionFromOptions } from "@/lib/ai/product-disambiguation";

type HumanFuzzCase = {
  domain: string;
  intent: AssistantConversationIntent;
  phrase: string;
};

const serviceUnsupportedMessage =
  "Receita de serviço sem estoque ainda não está implementada com segurança. Posso te avisar que essa função está no roadmap, mas não vou salvar esse lançamento agora.";

const humanFuzzCorpus: HumanFuzzCase[] = [
  // Bebidas / mercearia
  { domain: "bebidas", phrase: "cadastrar Coca lata 350ml custo 3 venda 6 estoque 20 mínimo 5", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastrar Coca 600ml custo 4 venda 8 estoque 12 mínimo 3", intent: "product_registration" },
  { domain: "bebidas", phrase: "adiciona água 500ml custo 1 venda 3 estoque 24 mínimo 6", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastra fardo de água custo 12 venda 20 estoque 5 mínimo 1", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastre refrigerante 2L custo 6 venda 10 estoque 8 mínimo 2", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastra guaraná lata custo 2 venda 5 estoque 30 mínimo 5", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastre café pacote custo 9 venda 14 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "bebidas", phrase: "cadastre açúcar kg custo 4 venda 7 estoque 15 mínimo 3", intent: "product_registration" },
  { domain: "bebidas", phrase: "comprei 10 coca lata por 3 cada", intent: "purchase_entry" },
  { domain: "bebidas", phrase: "entrou 6 fardo de água no estoque", intent: "purchase_entry" },
  { domain: "bebidas", phrase: "vendi uma coca 600ml", intent: "sale_exit" },
  { domain: "bebidas", phrase: "cliente levou 2 água 500ml", intent: "sale_exit" },
  { domain: "bebidas", phrase: "comprei 2 pacote de café por 18 cada", intent: "purchase_entry" },
  { domain: "bebidas", phrase: "vendi 3 guaraná lata", intent: "sale_exit" },
  { domain: "unidades", phrase: "eu comprei hoje 2 kg de macan a 25,50 o kg", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 2 kg de maçã a 25,50 o kg", intent: "purchase_entry" },
  { domain: "unidades", phrase: "vendo maçã por 35 o kg", intent: "unknown" },
  { domain: "unidades", phrase: "estoque mínimo 0,5 kg", intent: "unknown" },
  { domain: "unidades", phrase: "vendi 1,5 kg de maçã", intent: "sale_exit" },
  { domain: "unidades", phrase: "comprei 2 quilos de maçã por 25,50 o quilo", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 500 gramas de queijo a 30 o kg", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 3 litros de leite a 6 o litro", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 500 ml de suco a 10 o litro", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 8 unidades de sabonete a 2 a unidade", intent: "purchase_entry" },

  // Espetinho / comida
  { domain: "comida", phrase: "cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5", intent: "purchase_entry" },
  { domain: "comida", phrase: "cadastre espetinho de frango custo 3 venda 7 estoque 20 mínimo 5", intent: "product_registration" },
  { domain: "comida", phrase: "gastei 30 com carvão", intent: "expense" },
  { domain: "comida", phrase: "gastei 10 com molho", intent: "expense" },
  { domain: "comida", phrase: "gastei 30 com embalagem", intent: "expense" },
  { domain: "comida", phrase: "cadastre queijo mussarela kg custo 28 venda 45 estoque 12 mínimo 3", intent: "product_registration" },
  { domain: "comida", phrase: "cadastre pão de alho custo 5 venda 9 estoque 16 mínimo 4", intent: "product_registration" },
  { domain: "comida", phrase: "cadastre marmita custo 12 venda 20 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "comida", phrase: "vendi 2 espetinho de carne", intent: "sale_exit" },
  { domain: "comida", phrase: "cliente levou uma marmita", intent: "sale_exit" },
  { domain: "comida", phrase: "comprei 3 kg de queijo mussarela por 28 cada", intent: "purchase_entry" },
  { domain: "comida", phrase: "entrou 10 pão de alho no estoque", intent: "purchase_entry" },
  { domain: "comida", phrase: "cliente levou 4 espetinho de frango", intent: "sale_exit" },
  { domain: "comida", phrase: "paguei 25 de molho e embalagem", intent: "expense" },

  // Material de construção / areia
  { domain: "construcao", phrase: "bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1", intent: "purchase_entry" },
  { domain: "construcao", phrase: "bota no estoque 4 metro de areia grossa paguei 85 cada metro e vendo por 125 mínimo 1", intent: "purchase_entry" },
  { domain: "construcao", phrase: "entrou 10 saco de cimento paguei 32 cada vendo a 45 mínimo 2", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 3 metros de areia fina a 90 o metro", intent: "purchase_entry" },
  { domain: "unidades", phrase: "vendi 1 metro de areia fina", intent: "sale_exit" },
  { domain: "unidades", phrase: "comprei 4 m2 de piso a 55 o m2", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 2 m² de piso a 55 o metro quadrado", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 2 m3 de brita a 120 o m3", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 1 m³ de brita a 120 o metro cúbico", intent: "purchase_entry" },
  { domain: "construcao", phrase: "cadastre brita custo 70 venda 110 estoque 5 mínimo 1", intent: "product_registration" },
  { domain: "construcao", phrase: "cadastre tijolo custo 1 venda 2 estoque 500 mínimo 100", intent: "product_registration" },
  { domain: "construcao", phrase: "cadastre cal custo 12 venda 20 estoque 8 mínimo 2", intent: "product_registration" },
  { domain: "construcao", phrase: "cadastre piso caixa custo 35 venda 55 estoque 6 mínimo 1", intent: "product_registration" },
  { domain: "construcao", phrase: "cadastre argamassa custo 18 venda 28 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "construcao", phrase: "vendi a areia grossa", intent: "sale_exit" },
  { domain: "construcao", phrase: "cliente levou 1 metro de areia fina", intent: "sale_exit" },
  { domain: "construcao", phrase: "comprei 5 saco de cimento por 160", intent: "purchase_entry" },
  { domain: "construcao", phrase: "quanto tenho de areia no estoque?", intent: "financial_question" },
  { domain: "construcao", phrase: "cliente levou 2 caixa de piso", intent: "sale_exit" },
  { domain: "construcao", phrase: "entrou 30 tijolo no estoque", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 5 sacos de cimento a 32 o saco", intent: "purchase_entry" },
  { domain: "unidades", phrase: "entrou 2 caixas de tomate a 80 a caixa", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 1 fardo de água a 18 o fardo", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 12 pacotes de café a 8 cada pacote", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei uma dúzia de ovos a 12 a dúzia", intent: "purchase_entry" },
  { domain: "unidades", phrase: "comprei 6 peças de roupa a 20 a peça", intent: "purchase_entry" },
  { domain: "unidades", phrase: "vendi 2 caixas de tomate", intent: "sale_exit" },
  { domain: "unidades", phrase: "vendi 1 saco de cimento", intent: "sale_exit" },
  { domain: "unidades", phrase: "vendi 3 pacotes de café", intent: "sale_exit" },
  { domain: "unidades", phrase: "vendi meia dúzia de ovos", intent: "sale_exit" },

  // Agro fictício
  { domain: "agro", phrase: "comprei 5 fertilizante fictício por 80 cada, vendo por 120", intent: "purchase_entry" },
  { domain: "agro", phrase: "cadastre defensivo agrícola fictício custo 50 venda 75 estoque 4 mínimo 1", intent: "product_registration" },
  { domain: "agro", phrase: "cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1", intent: "product_registration" },
  { domain: "agro", phrase: "cadastre ração custo 60 venda 90 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "agro", phrase: "cadastre semente de milho custo 30 venda 48 estoque 12 mínimo 3", intent: "product_registration" },
  { domain: "agro", phrase: "comprei fertilizante", intent: "purchase_entry" },
  { domain: "agro", phrase: "vendi 2 ração", intent: "sale_exit" },
  { domain: "agro", phrase: "entrou 6 semente de milho no estoque", intent: "purchase_entry" },
  { domain: "agro", phrase: "quanto tenho de ração no estoque?", intent: "financial_question" },
  { domain: "agro", phrase: "produto mais vendido hoje", intent: "financial_question" },
  { domain: "agro", phrase: "entrou 8 ração no estoque", intent: "purchase_entry" },
  { domain: "agro", phrase: "vendi 1 semente de milho", intent: "sale_exit" },

  // Produtos sensíveis fictícios
  { domain: "sensivel", phrase: "cadastre veneno fictício custo 20 venda 35 estoque 3 mínimo 1", intent: "product_registration" },
  { domain: "sensivel", phrase: "cadastre produto químico fictício custo 40 venda 70 estoque 2 mínimo 1", intent: "product_registration" },
  { domain: "sensivel", phrase: "cadastre soro fictício custo 15 venda 25 estoque 5 mínimo 1", intent: "product_registration" },
  { domain: "sensivel", phrase: "cadastre medicamento fictício custo 9 venda 16 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "sensivel", phrase: "cadastre arma fictícia custo 100 venda 150 estoque 1 mínimo 0", intent: "product_registration" },
  { domain: "sensivel", phrase: "cadastre explosivo fictício custo 100 venda 180 estoque 1 mínimo 0", intent: "product_registration" },
  { domain: "sensivel", phrase: "comprei 2 veneno fictício por 20 cada", intent: "purchase_entry" },
  { domain: "sensivel", phrase: "vendi 1 produto químico fictício", intent: "sale_exit" },

  // Serviços sem estoque
  { domain: "servico", phrase: "fiz um corte de cabelo de 40 reais", intent: "unknown" },
  { domain: "servico", phrase: "fiz uma consulta de 100 reais", intent: "unknown" },
  { domain: "servico", phrase: "fiz instalação por 80 reais", intent: "unknown" },
  { domain: "servico", phrase: "cobrei 50 de manutenção", intent: "unknown" },
  { domain: "servico", phrase: "recebi 30 de frete", intent: "unknown" },
  { domain: "servico", phrase: "ganhei 90 com limpeza", intent: "unknown" },
  { domain: "servico", phrase: "recebi 200 reais de consulta", intent: "unknown" },
  { domain: "servico", phrase: "cobrei 120 por manutenção", intent: "unknown" },

  // Despesas
  { domain: "despesa", phrase: "paguei aluguel 800", intent: "expense" },
  { domain: "despesa", phrase: "paguei 120 de energia", intent: "expense" },
  { domain: "despesa", phrase: "paguei internet 90", intent: "expense" },
  { domain: "despesa", phrase: "gastei 50 com gasolina", intent: "expense" },
  { domain: "despesa", phrase: "gastei 30 com embalagem", intent: "expense" },
  { domain: "despesa", phrase: "paguei taxa 15", intent: "expense" },
  { domain: "despesa", phrase: "paguei funcionário 120", intent: "expense" },
  { domain: "despesa", phrase: "gastei 70 com manutenção", intent: "expense" },
  { domain: "despesa", phrase: "paguei frete pago 35", intent: "expense" },
  { domain: "despesa", phrase: "paguei taxa de maquininha 10", intent: "expense" },

  // Relatórios
  { domain: "relatorio", phrase: "quanto vendi hoje?", intent: "financial_question" },
  { domain: "relatorio", phrase: "quanto ganhei hoje?", intent: "financial_question" },
  { domain: "relatorio", phrase: "qual meu lucro líquido?", intent: "financial_question" },
  { domain: "relatorio", phrase: "qual meu lucro bruto?", intent: "financial_question" },
  { domain: "relatorio", phrase: "estoque atual", intent: "financial_question" },
  { domain: "relatorio", phrase: "qual produto mais vendido?", intent: "financial_question" },
  { domain: "relatorio", phrase: "compras do mês", intent: "financial_question" },
  { domain: "relatorio", phrase: "resumo do dia", intent: "financial_question" },
  { domain: "relatorio", phrase: "resumo do mês", intent: "financial_question" },
  { domain: "relatorio", phrase: "quanto tenho de cimento no estoque?", intent: "financial_question" },

  // Ambiguidade e respostas de contexto
  { domain: "ambiguo", phrase: "vendi uma coca", intent: "sale_exit" },
  { domain: "ambiguo", phrase: "vendi areia", intent: "sale_exit" },
  { domain: "ambiguo", phrase: "comprei fertilizante", intent: "purchase_entry" },
  { domain: "ambiguo", phrase: "saiu água", intent: "sale_exit" },
  { domain: "ambiguo", phrase: "a de 600", intent: "unknown" },
  { domain: "ambiguo", phrase: "a lata", intent: "unknown" },
  { domain: "ambiguo", phrase: "a fina", intent: "unknown" },
  { domain: "ambiguo", phrase: "a grossa", intent: "unknown" },
  { domain: "ambiguo", phrase: "o saco", intent: "unknown" },
  { domain: "ambiguo", phrase: "a caixa", intent: "unknown" },
  { domain: "ambiguo", phrase: "a primeira", intent: "unknown" },
  { domain: "ambiguo", phrase: "opção 2", intent: "unknown" },

  // Frases erradas e informais
  { domain: "informal", phrase: "cadatra 10 refrigerante custo 3 venda 6 estoque 10 mínimo 2", intent: "product_registration" },
  { domain: "informal", phrase: "conprei 5 água por 2 cada", intent: "purchase_entry" },
  { domain: "informal", phrase: "vedi 2 coca lata", intent: "sale_exit" },
  { domain: "informal", phrase: "cadastra pra mim 10 refrigerante que comprei por 4,20 cada", intent: "purchase_entry" },
  { domain: "informal", phrase: "comprei 3 areia fina por 90 cada", intent: "purchase_entry" },
  { domain: "informal", phrase: "paguei 20 nas cinco", intent: "unknown" },
  { domain: "informal", phrase: "bota no estoque 4 saco de cimento", intent: "purchase_entry" },
  { domain: "informal", phrase: "entrou mercadoria", intent: "purchase_entry" },
  { domain: "informal", phrase: "o cliente pego 2 agua", intent: "sale_exit" },
  { domain: "informal", phrase: "saiu 2 unidade", intent: "sale_exit" },
  { domain: "informal", phrase: "3 real cada", intent: "unknown" },
  { domain: "informal", phrase: "4,20 cada", intent: "unknown" },

  // Produto inexistente, bloqueios e ações misturadas
  { domain: "seguro", phrase: "vendi 2 guaraná", intent: "sale_exit" },
  { domain: "seguro", phrase: "comprei guaraná", intent: "purchase_entry" },
  { domain: "seguro", phrase: "comprei areia, vendi cimento e gastei 10", intent: "purchase_entry" },
  { domain: "seguro", phrase: "apagar produto areia", intent: "dangerous" },
  { domain: "seguro", phrase: "corrigir venda de cimento", intent: "dangerous" },
  { domain: "seguro", phrase: "cancelar despesa de energia", intent: "dangerous" },
  { domain: "seguro", phrase: "estornar venda de água", intent: "dangerous" },
  { domain: "seguro", phrase: "vende cimento mesmo sem estoque", intent: "dangerous" },
];

describe("assistant human fuzz corpus", () => {
  it("keeps at least 120 varied real-language phrases across business domains", () => {
    expect(humanFuzzCorpus.length).toBeGreaterThanOrEqual(120);
  });

  it.each(humanFuzzCorpus)("$domain: $phrase -> $intent", ({ phrase, intent }) => {
    expect(classifyIntent(phrase)).toBe(intent);
  });

  it("extracts complete food and construction stock registrations as safe product drafts", () => {
    expect(parseAssistantMessage("cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5")).toEqual({
      category: null,
      initialStock: 20,
      initialStockSource: "purchase",
      kind: "product",
      minimumStock: 5,
      missingFields: [],
      name: "espetinho de carne",
      salePriceCents: 800,
      unit: "UNIT",
      unitCostCents: 400,
    });

    expect(
      parseAssistantMessage("bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1"),
    ).toEqual({
      category: null,
      initialStock: 3,
      initialStockSource: "purchase",
      kind: "product",
      minimumStock: 1,
      missingFields: [],
      name: "areia fina",
      salePriceCents: 13000,
      unit: "METER",
      unitCostCents: 9000,
    });

    expect(parseAssistantMessage("entrou 10 saco de cimento paguei 32 cada vendo a 45 mínimo 2")).toEqual({
      category: null,
      initialStock: 10,
      initialStockSource: "purchase",
      kind: "product",
      minimumStock: 2,
      missingFields: [],
      name: "cimento",
      salePriceCents: 4500,
      unit: "SACK",
      unitCostCents: 3200,
    });
  });

  it("keeps ambiguous total/unit purchase values as questions instead of drafts", () => {
    expect(parseAssistantMessage("comprei 5 saco de cimento por 160")).toEqual({
      amountCents: 16000,
      kind: "ambiguous_purchase_cost",
      productName: "saco de cimento",
      quantity: 5,
    });
  });

  it("handles domain-specific reports and product names without turning them into actions", () => {
    expect(parseAssistantMessage("quanto tenho de areia no estoque?")).toEqual({
      kind: "question",
      intent: "inventory",
      period: "month",
      productName: "areia",
    });
    expect(parseAssistantMessage("resumo do mês")).toEqual({
      kind: "question",
      intent: "dailySummary",
      period: "month",
    });
  });

  it("keeps service revenue unsupported instead of forcing a physical product sale", () => {
    for (const phrase of ["fiz um corte de cabelo de 40 reais", "fiz instalação por 80 reais", "cobrei 120 por manutenção"]) {
      expect(parseAssistantMessage(phrase)).toEqual({
        kind: "unknown",
        message: serviceUnsupportedMessage,
      });
    }
  });

  it("parses informal typos without changing critical safety behavior", () => {
    expect(parseAssistantMessage("conprei 5 água por 2 cada")).toEqual({
      kind: "purchase",
      productName: "água",
      quantity: 5,
      unitCostCents: 200,
    });
    expect(parseAssistantMessage("vedi 2 coca lata")).toEqual({
      kind: "sale",
      productName: "coca lata",
      quantity: 2,
      unitPriceCents: null,
    });
    expect(parseAssistantMessage("o cliente pego 2 agua")).toEqual({
      kind: "sale",
      productName: "agua",
      quantity: 2,
      unitPriceCents: null,
    });
  });

  it("treats sensitive fictitious products as financial products only, without usage instructions", () => {
    expect(parseAssistantMessage("cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1")).toEqual({
      category: null,
      initialStock: 5,
      kind: "product",
      minimumStock: 1,
      missingFields: [],
      name: "glifosato fictício",
      salePriceCents: 12000,
      unit: "UNIT",
      unitCostCents: 8000,
    });
  });

  it("resolves ambiguous products in non-Coca domains", () => {
    expect(resolveProduct("areia", [{ name: "Areia fina metro" }, { name: "Areia grossa metro" }])).toMatchObject({
      status: "ambiguous_match",
    });
    expect(resolveProduct("areia grossa", [{ name: "Areia fina metro" }, { name: "Areia grossa metro" }])).toMatchObject({
      status: "unique_match",
      product: { name: "Areia grossa metro" },
    });
    expect(
      resolveProductSelectionFromOptions("a com gás", [
        { id: "agua-500", name: "Água 500ml" },
        { id: "agua-1l", name: "Água 1L" },
        { id: "agua-gas", name: "Água com gás 500ml" },
      ]),
    ).toEqual({
      option: { id: "agua-gas", name: "Água com gás 500ml" },
      status: "selected",
    });
  });

  it("detects mixed actions and refuses to run everything at once", () => {
    expect(parseAssistantMessage("comprei areia, vendi cimento e gastei 10")).toEqual({
      kind: "unknown",
      message: "Consigo registrar uma coisa por vez. O que você quer lançar primeiro: compra, venda ou despesa?",
    });
  });

  it("extracts units and variants for kg, caixa, litro and domain packaging words", () => {
    expect(extractEntities("cadastre queijo mussarela kg custo 28 venda 45 estoque 12 mínimo 3", "product_registration")).toMatchObject({
      productName: "queijo mussarela kg",
      unit: "KG",
      variant: "kg",
    });
    expect(extractEntities("cadastre piso caixa custo 35 venda 55 estoque 6 mínimo 1", "product_registration")).toMatchObject({
      productName: "piso caixa",
      unit: "BOX",
      variant: "caixa",
    });
    expect(extractEntities("cadastrar refrigerante 2L custo 6 venda 10 estoque 8 mínimo 2", "product_registration")).toMatchObject({
      productName: "refrigerante 2l",
      unit: "LITER",
      variant: "2l",
    });
  });
});
