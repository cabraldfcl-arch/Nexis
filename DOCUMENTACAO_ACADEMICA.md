# NEXIS — Documentação Técnica Acadêmica
### Gestor Financeiro Mobile-First com IA para Microempreendedores

> **Projeto:** NEXIS  
> **Tipo:** TCC / Projeto Integrador  
> **Data:** 2026-05-28  
> **Stack:** Next.js 16 · React 19 · TypeScript 6 · Prisma 7 · SQLite · Zod 4

---

## 1. DEMONSTRAÇÃO DO ESBOÇO DO MVP

### 1.1 Arquitetura do Sistema

O NEXIS adota uma arquitetura **monolítica modular** baseada no padrão **BFF (Backend for Frontend)**, onde o servidor Next.js atua simultaneamente como camada de apresentação e de API, eliminando a necessidade de um backend separado no MVP.

```
┌──────────────────────────────────────────────────────────────────┐
│                  CAMADA DE APRESENTAÇÃO (PWA)                    │
│                                                                  │
│  /dashboard  /products  /sales  /purchases  /expenses            │
│  /assistant                                                      │
│                                                                  │
│  React 19 · Tailwind CSS 4 · PWA (manifest + ícones)            │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Server Components + Server Actions
                            │ (sem round-trip de API explícito)
┌───────────────────────────▼──────────────────────────────────────┐
│              CAMADA DE APLICAÇÃO (Next.js App Router)            │
│                                                                  │
│  app/*/actions.ts   →  Entradas validadas (Zod)                  │
│  lib/finance/       →  Motor financeiro puro (sem efeitos)       │
│  lib/ai/            →  Parser NLP + gerador de rascunhos         │
│  lib/dashboard/     →  Agregação e resumos por período           │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Prisma 7 ORM (transações atômicas)
┌───────────────────────────▼──────────────────────────────────────┐
│                  CAMADA DE PERSISTÊNCIA (SQLite)                 │
│                                                                  │
│  Product · Sale · SaleItem · Purchase · Expense                  │
│  StockMovement · StockLoss · CancellationEvent · ProductAlias    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP (flag desligada no MVP)
┌───────────────────────────▼──────────────────────────────────────┐
│              SERVIÇO EXTERNO (IA Generativa — Opcional)          │
│                                                                  │
│  Entrada: contexto sanitizado (produtos, resumo financeiro)      │
│  Saída:   JSON validado por Zod → rascunho para confirmação      │
│  Garantia: a IA nunca persiste dados sem confirmação humana      │
└──────────────────────────────────────────────────────────────────┘
```

**Decisões arquiteturais relevantes para a banca:**

| Decisão | Justificativa |
|---|---|
| Monolítico modular no MVP | Reduz complexidade operacional sem sacrificar separação de responsabilidades |
| Server Actions (sem REST explícito) | Elimina camada de serialização desnecessária; type-safety end-to-end |
| Motor financeiro isolado em `lib/finance/` | Funções puras e testáveis sem dependência de banco ou framework |
| Centavos inteiros em vez de float | Evita erros de ponto flutuante em cálculos monetários |
| Confirmação obrigatória antes de persistir | Garante integridade dos dados financeiros; IA nunca salva sozinha |

---

### 1.2 Estrutura de Pastas

O projeto adota a **arquitetura baseada em módulos** (feature-based), onde cada módulo de negócio agrupa seus componentes, ações e tipos relacionados.

```
nexis/
│
├── app/                          # Roteamento (Next.js App Router)
│   ├── layout.tsx                # Layout raiz, PWA metadata
│   ├── page.tsx                  # Dashboard principal
│   ├── products/
│   │   ├── page.tsx              # Listagem + formulário de produtos
│   │   └── actions.ts            # Server Action: createProductAction()
│   ├── sales/
│   │   ├── page.tsx
│   │   └── actions.ts            # Server Action: createSaleAction()
│   ├── purchases/
│   │   ├── page.tsx
│   │   └── actions.ts            # Server Action: createPurchaseAction()
│   ├── expenses/
│   │   ├── page.tsx
│   │   └── actions.ts            # Server Action: createExpenseAction()
│   ├── assistant/
│   │   ├── page.tsx              # Interface do chat
│   │   └── actions.ts            # sendAssistantMessageAction() — ponto central da IA
│   └── api/
│       └── audio/transcribe/     # Endpoint futuro para STT
│
├── components/                   # Componentes reutilizáveis de UI
│   ├── assistant/
│   │   ├── chat-thread.tsx       # Thread de mensagens
│   │   ├── draft-confirmation.tsx# Tela de confirmação do rascunho
│   │   └── message-input.tsx     # Campo de texto + áudio
│   ├── dashboard/
│   │   ├── summary-card.tsx      # Card de métrica financeira
│   │   └── quick-action-button.tsx
│   ├── transactions/
│   │   ├── sale-form.tsx
│   │   ├── sale-list.tsx
│   │   ├── purchase-form.tsx
│   │   └── purchase-list.tsx
│   └── products/
│       ├── product-form.tsx
│       ├── product-list.tsx
│       └── product-card.tsx
│
├── lib/                          # Lógica de domínio pura
│   ├── finance/
│   │   ├── money.ts              # Tipo MoneyCents, aritmética de centavos
│   │   ├── profit.ts             # Lucro bruto e líquido
│   │   ├── sales.ts              # Faturamento, CMV, métricas de margem
│   │   ├── stock.ts              # Entrada/saída de estoque
│   │   ├── transactions.ts       # Montagem de transações de venda e compra
│   │   └── reports.ts            # Resumos financeiros por período
│   ├── ai/
│   │   ├── parse-message.ts      # Parser de linguagem natural (NLP local)
│   │   ├── answer-question.ts    # Gerador de respostas financeiras
│   │   ├── intent-schema.ts      # Esquemas Zod de intenção
│   │   ├── external-assistant.ts # Conector com LLM externo
│   │   └── nexis-system-prompt.ts# System prompt do assistente
│   ├── dashboard/
│   │   └── summary.ts            # getDashboardSummary()
│   ├── db/                       # Instância Prisma
│   └── validation/               # Esquemas Zod de entrada
│
├── prisma/
│   ├── schema.prisma             # Modelo de dados completo
│   ├── seed.mjs                  # Seed base
│   └── demo-seed-data.mjs        # Dados fictícios para demonstração
│
└── tests/
    ├── ai/                       # Testes do parser e respostas da IA
    ├── finance/                  # Testes do motor financeiro
    └── e2e/                      # Testes Playwright (mobile)
```

---

### 1.3 Código Inicial — A Lógica Central

#### a) Motor financeiro: cálculo de lucro líquido (`lib/finance/profit.ts`)

```typescript
import { sumMoneyCents, validateIntegerMoneyCents,
         validateNonNegativeMoneyCents, type MoneyCents } from "./money";

// Lucro Bruto = Faturamento − Custo das Mercadorias Vendidas
export function calculateGrossProfitCents({
  revenueCents,
  costOfGoodsSoldCents,
}: {
  revenueCents: MoneyCents;
  costOfGoodsSoldCents: MoneyCents;
}): MoneyCents {
  const revenue = validateNonNegativeMoneyCents(revenueCents, "faturamento");
  const cost    = validateNonNegativeMoneyCents(costOfGoodsSoldCents, "custo das vendas");
  return validateIntegerMoneyCents(revenue - cost, "lucro bruto");
}

// Lucro Líquido = Lucro Bruto − Despesas Confirmadas
export function calculateNetProfitCents({
  grossProfitCents,
  confirmedExpensesCents,
}: {
  grossProfitCents: MoneyCents;
  confirmedExpensesCents: MoneyCents;
}): MoneyCents {
  const gross    = validateIntegerMoneyCents(grossProfitCents, "lucro bruto");
  const expenses = validateNonNegativeMoneyCents(confirmedExpensesCents, "despesas");
  return validateIntegerMoneyCents(gross - expenses, "lucro líquido");
}
```

#### b) Entrada principal do assistente com confirmação obrigatória (`app/assistant/actions.ts`)

```typescript
export async function sendAssistantMessageAction(
  _prev: AssistantActionState,
  formData: FormData,
): Promise<AssistantActionState> {

  const message = String(formData.get("message") ?? "").trim();

  // 1. Interpreta a intenção da mensagem (NLP local ou IA externa)
  const parsed = await resolveAssistantMessageWithExternalAi(message, {
    context: buildExternalAssistantContext,
  });

  // 2. Para perguntas financeiras: responde diretamente com dados reais do banco
  if (parsed.kind === "question") {
    const context = await getAssistantQuestionContext();
    const answer  = answerQuestionFromContext(parsed, context);
    return { type: "answer", answer };
  }

  // 3. Para ações (venda, compra, despesa): constrói RASCUNHO — nunca persiste
  if (parsed.kind === "sale") {
    const draft = await buildSaleDraftResponse(parsed);
    return { type: "draft", draft };   // aguarda confirmação do usuário
  }

  // 4. Confirmação explícita do usuário → persistência no banco
  // (chamada separada: confirmSaleDraft / confirmPurchaseDraft / etc.)
}
```

#### c) Invariante de precisão monetária (`lib/finance/money.ts`)

```typescript
export type MoneyCents = number; // sempre inteiro; R$ 12,34 → 1234

// Multiplica quantidade (pode ser decimal) por valor em centavos,
// usando aritmética de frações (numerador/denominador via MDC)
// para garantir resultado inteiro exato — sem ponto flutuante.
export function calculateLineTotalCents({
  quantity, unitAmountCents,
}: LineTotalInput): MoneyCents {
  const ratio        = decimalQuantityToRatio(quantity, "quantidade");
  const totalNum     = unitAmountCents * ratio.numerator;

  if (totalNum % ratio.denominator !== 0)
    throw new Error("total deve resultar em centavos inteiros.");

  return totalNum / ratio.denominator;
}
// Exemplo: 2,5 kg × R$ 1,00 → ratio = 5/2 → (100 × 5) / 2 = 250 ✓
```

---

## 2. DIAGRAMA DE FLUXO DE DADOS (DFD)

### 2.1 Nível 0 — Diagrama de Contexto

O DFD de Nível 0 representa o NEXIS como uma **caixa-preta única**, mostrando apenas as entidades externas e os fluxos de informação que entram e saem do sistema.

**Entidades externas:**

| Entidade | Papel | Fluxo de entrada | Fluxo de saída |
|---|---|---|---|
| **Microempreendedor** | Usuário principal | Cadastros, lançamentos, perguntas em linguagem natural, confirmações | Dashboard financeiro, relatórios, alertas de estoque, respostas do assistente |
| **IA Externa (LLM)** | Serviço opcional de NLP | Contexto sanitizado: produtos ativos + resumo financeiro + categorias | JSON estruturado com rascunho de ação (nunca persiste diretamente) |

**Representação textual (para desenhar no Draw.io):**

```
[Microempreendedor]
      │  cadastros, lançamentos,
      │  perguntas, confirmações
      ▼
 ┌─────────┐     contexto (somente leitura)     [IA Externa]
 │  NEXIS  │ ──────────────────────────────────►
 │         │ ◄──────────────────────────────────
 └─────────┘     JSON com rascunho validado
      │
      │  dashboard, lucro, estoque
      ▼
[Microempreendedor]
```

---

### 2.2 Nível 1 — Processos Principais

O DFD de Nível 1 decompõe o sistema nos seus cinco processos centrais, mostrando como o dado flui entre eles e o banco de dados.

#### Processo 1 — Cadastrar Produto

```
[Microempreendedor]
  │  nome, unidade, custo, preço de venda,
  │  estoque inicial, estoque mínimo
  ▼
(1.1) Validar entrada ─── Zod schema ──→ erro? → retorna mensagem
  │
  ▼
(1.2) Normalizar nome ─── lowercase + trim → normalizedName
  │
  ▼
(1.3) Persistir produto ──────────────→ [BD: Product]
  │
  ▼
[Microempreendedor] ← confirmação visual
```

#### Processo 2 — Registrar Venda

```
[Microempreendedor]
  │  produto, quantidade, preço unitário
  ▼
(2.1) Validar entrada ─── Zod
  │
  ▼
(2.2) Verificar estoque disponível ──→ [BD: Product.currentStock]
  │  insuficiente? → erro
  ▼
(2.3) Calcular totais
  │  totalAmountCents = q × preço
  │  totalCostCents   = q × custo_snapshot    ← snapshot congelado
  ▼
(2.4) Persistir (transação atômica)
  │  ├─→ [BD: Sale + SaleItem]
  │  ├─→ [BD: StockMovement] type=SALE, −quantidade
  │  └─→ [BD: Product.currentStock] atualizado
  ▼
[Microempreendedor] ← dashboard atualizado
```

#### Processo 3 — Registrar Compra

```
[Microempreendedor]
  │  produto, quantidade, custo unitário, fornecedor
  ▼
(3.1) Validar entrada ─── Zod
  │
  ▼
(3.2) Calcular total ─── totalCostCents = q × custo
  │
  ▼
(3.3) Persistir (transação atômica)
  │  ├─→ [BD: Purchase]
  │  ├─→ [BD: StockMovement] type=PURCHASE, +quantidade
  │  └─→ [BD: Product.currentStock e unitCostCents] atualizados
  ▼
[Microempreendedor] ← estoque atualizado
```

#### Processo 4 — Assistente (Linguagem Natural)

```
[Microempreendedor]
  │  mensagem de texto livre
  │  ex.: "vendi 3 pães" / "quanto lucrei hoje?"
  ▼
(4.1) Verificar contexto pendente ──→ [memória de sessão]
  │  (multi-turno: aguardando custo, preço ou confirmação)
  ▼
(4.2) Classificar intenção
  │  ├── pergunta financeira   → Processo (4.3)
  │  ├── venda / compra       → Processo (4.4)
  │  ├── despesa / produto    → Processo (4.4)
  │  └── desconhecida         → mensagem de erro educada
  ▼
(4.3) Responder pergunta
  │  ├─← [BD: Sale + Expense + Product] dados do período
  │  └── calcular: faturamento, lucro bruto, líquido, estoque crítico
  │  └─→ [Microempreendedor] resposta formatada em português
  ▼
(4.4) Construir rascunho ── NUNCA persiste direto
  │  ├── resolve produto por nome + aliases ──→ [BD: ProductAlias]
  │  ├── calcula impacto: estoque, custo, lucro estimado
  │  └─→ [Microempreendedor] rascunho + botão Confirmar
  ▼
(4.5) Confirmação explícita do usuário
  │
  ▼
(4.6) Persistir via Processo 2 ou 3 ou createExpense / createProduct
```

#### Processo 5 — Gerar Dashboard

```
[Microempreendedor] → abre dashboard
  │
  ▼
(5.1) Definir períodos: hoje (00h–23h59) e mês corrente
  │
  ▼
(5.2) Consultar banco
  │  ├─← [BD: Sale + SaleItem] do período
  │  ├─← [BD: Expense] do período
  │  └─← [BD: Product] todos ativos
  ▼
(5.3) Calcular resumo financeiro
  │  Faturamento, CMV, Lucro Bruto, Despesas, Lucro Líquido
  │  Produtos com currentStock < minimumStock
  ▼
(5.4) Retornar DashboardSummary ──→ [Microempreendedor]
  │  cards: hoje + mês + lista de estoque crítico
```

---

## 3. LÓGICA MATEMÁTICA APLICADA

### 3.1 Faturamento (Receita Bruta)

**Fórmula formal:**

```
        n
R = Σ  (qᵢ × pᵢ)
       i=1
```

**Variáveis:**
- `R` — receita total do período (em centavos)
- `qᵢ` — quantidade vendida do item `i`
- `pᵢ` — preço unitário de venda do item `i` (em centavos)
- `n` — total de itens vendidos no período

**Tradução para código (`lib/finance/sales.ts`):**

```typescript
export function calculateRevenueCents(
  sales: readonly SaleInput[],
): MoneyCents {
  // Filtra apenas vendas não canceladas e soma totalAmountCents
  return sumMoneyCents(
    sales
      .filter((s) => s.cancelledAt == null)
      .map((s) => s.totalAmountCents),
    "faturamento",
  );
}
```

---

### 3.2 Custo das Mercadorias Vendidas (CMV) com Snapshot de Custo

**Fórmula formal:**

```
          n
CMV = Σ  (qᵢ × cᵢˢ)
         i=1
```

**Variáveis:**
- `CMV` — custo total das mercadorias vendidas no período
- `qᵢ` — quantidade vendida do item `i`
- `cᵢˢ` — custo unitário **snapshot** do item `i` no momento da venda

> **Invariante:** `cᵢˢ` é capturado no instante da venda e armazenado em `SaleItem.unitCostSnapshotCents`. Variações futuras no custo do produto **não retroagem** sobre vendas já registradas — equivalente ao método contábil PEPS (Primeiro a Entrar, Primeiro a Sair).

**Tradução para código (`lib/finance/sales.ts`):**

```typescript
export function calculateCostOfGoodsSoldCents(
  sales: readonly SaleInput[],
): MoneyCents {
  const costs: MoneyCents[] = [];

  for (const sale of sales) {
    if (sale.cancelledAt != null) continue;

    for (const item of sale.items) {
      // Usa unitCostSnapshotCents: custo congelado no momento da venda
      costs.push(
        calculateLineTotalCents({
          quantity: item.quantity,
          unitAmountCents: item.unitCostSnapshotCents,
        }),
      );
    }
  }

  return sumMoneyCents(costs, "CMV");
}
```

---

### 3.3 Lucro Bruto

**Fórmula formal:**

```
LB = R − CMV
```

**Variáveis:**
- `LB` — lucro bruto do período
- `R`  — faturamento (receita bruta)
- `CMV` — custo das mercadorias vendidas

**Tradução para código (`lib/finance/profit.ts`):**

```typescript
export function calculateGrossProfitCents({
  revenueCents,
  costOfGoodsSoldCents,
}: {
  revenueCents: MoneyCents;
  costOfGoodsSoldCents: MoneyCents;
}): MoneyCents {
  const revenue = validateNonNegativeMoneyCents(revenueCents, "faturamento");
  const cost    = validateNonNegativeMoneyCents(costOfGoodsSoldCents, "CMV");
  return validateIntegerMoneyCents(revenue - cost, "lucro bruto");
}
```

---

### 3.4 Despesas Confirmadas

**Fórmula formal:**

```
        m
D = Σ  dⱼ · 𝟙[confirmedⱼ = true]
       j=1
```

**Variáveis:**
- `D`  — total de despesas confirmadas do período
- `dⱼ` — valor monetário da despesa `j`
- `𝟙[·]` — função indicadora: vale 1 se a condição for verdadeira, 0 caso contrário
- `m`  — total de despesas no período

> **Regra de negócio:** Despesas pendentes (`confirmed = false`) são exibidas para controle, mas **não reduzem o lucro líquido**. Apenas despesas confirmadas afetam o resultado.

**Tradução para código (`lib/finance/profit.ts`):**

```typescript
export function calculateConfirmedExpensesCents(
  expenses: readonly ExpenseInput[],
): MoneyCents {
  return sumMoneyCents(
    expenses.map((e) => (e.confirmed ? e.amountCents : 0)),
    "despesas confirmadas",
  );
}
```

---

### 3.5 Lucro Líquido

**Fórmula formal:**

```
LL = LB − D
```

**Variáveis:**
- `LL` — lucro líquido do período
- `LB` — lucro bruto
- `D`  — despesas confirmadas

**Tradução para código (`lib/finance/profit.ts`):**

```typescript
export function calculateNetProfitCents({
  grossProfitCents,
  confirmedExpensesCents,
}: {
  grossProfitCents: MoneyCents;
  confirmedExpensesCents: MoneyCents;
}): MoneyCents {
  const gross    = validateIntegerMoneyCents(grossProfitCents, "lucro bruto");
  const expenses = validateNonNegativeMoneyCents(confirmedExpensesCents, "despesas");
  return validateIntegerMoneyCents(gross - expenses, "lucro líquido");
}
```

---

### 3.6 Margem de Lucro e Markup por Produto

**Fórmulas formais:**

```
Margem (%) = ((pᵢ − cᵢ) / pᵢ) × 100

Markup = pᵢ / cᵢ
```

**Variáveis:**
- `pᵢ` — preço de venda unitário do produto `i`
- `cᵢ` — custo unitário do produto `i`
- `Margem` — percentual do preço de venda que representa lucro
- `Markup` — quantas vezes o preço de venda supera o custo

**Tradução para código (`lib/finance/sales.ts`):**

```typescript
export function calculateSaleItemProfitMetrics(item: SaleItemInput): {
  unitProfitCents: MoneyCents;
  grossProfitCents: MoneyCents;
  marginPercent: number | null;   // null se preço = 0
  markupMultiplier: number | null; // null se custo = 0
  belowCost: boolean;
} {
  const unitProfit = item.unitPriceCents - item.unitCostSnapshotCents;
  const grossProfit = calculateLineTotalCents({
    quantity: item.quantity,
    unitAmountCents: unitProfit,
  });

  const marginPercent =
    item.unitPriceCents > 0
      ? (unitProfit / item.unitPriceCents) * 100
      : null;

  const markupMultiplier =
    item.unitCostSnapshotCents > 0
      ? item.unitPriceCents / item.unitCostSnapshotCents
      : null;

  return {
    unitProfitCents: unitProfit,
    grossProfitCents: grossProfit,
    marginPercent,
    markupMultiplier,
    belowCost: unitProfit < 0,
  };
}
```

---

### 3.7 Invariante de Precisão Monetária — Aritmética de Frações

**Problema:** Quantidades decimais (ex.: 2,5 kg) multiplicadas por preços inteiros em centavos podem gerar resultados não inteiros com aritmética de ponto flutuante.

**Solução formal — conversão para fração irredutível:**

```
Dado q ∈ ℚ  (ex.: 2,5 = 5/2)
Seja r = p/q → numerador/denominador  (fração irredutível via MDC)

total = (centavos × numerador) / denominador

Condição: (centavos × numerador) mod denominador = 0
          caso contrário: erro — quantidade inválida para esta unidade
```

**Tradução para código (`lib/finance/money.ts`):**

```typescript
// Converte quantidade decimal em fração irredutível (p/q)
function decimalQuantityToRatio(value: number, fieldName: string): {
  numerator: number;
  denominator: number;
} {
  // "2.5" → numerator=5, denominator=2
  const [whole, fraction = ""] = value.toString().split(".");
  const digits      = `${whole}${fraction}`;
  const denominator = 10 ** fraction.length;
  const numerator   = Number(digits);
  const divisor     = greatestCommonDivisor(numerator, denominator);

  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

// MDC (Algoritmo de Euclides)
function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) { [a, b] = [b, a % b]; }
  return a || 1;
}

// Resultado: 2,5 kg × 100 ¢/kg → (100 × 5) / 2 = 250 ¢ = R$ 2,50 ✓
```

---

### 3.8 Exemplo Numérico Integrado (para a banca)

```
Período: hoje

Vendas realizadas:
  10 pães a R$ 1,50   → totalAmountCents = 10 × 150 = 1.500 ¢
  Custo snapshot: R$ 0,80/pão → CMV = 10 × 80 = 800 ¢

Despesas:
  Luz: R$ 3,00 (confirmada) → 300 ¢
  Aluguel: R$ 5,00 (pendente, NÃO entra no cálculo)

Cálculo completo:
  R   = 1.500 ¢ = R$ 15,00
  CMV =   800 ¢ = R$  8,00
  LB  =   700 ¢ = R$  7,00   (LB = R − CMV)
  D   =   300 ¢ = R$  3,00   (apenas confirmadas)
  LL  =   400 ¢ = R$  4,00   (LL = LB − D)

  Margem  = (150 − 80) / 150 × 100 = 46,7%
  Markup  = 150 / 80               = 1,875×

Internamente: todos os valores são inteiros em centavos.
Nenhuma operação de ponto flutuante ocorre no motor financeiro.
```

---

## Apêndice — Roteiro de Demo ao Vivo

```bash
# 1. Preparar banco com dados fictícios para apresentação
npm run db:reset-demo

# 2. Iniciar servidor
npm run dev
# → http://localhost:3000

# 3. Para demo no celular (mesma rede Wi-Fi)
npm run dev -- --hostname 0.0.0.0
# → http://SEU_IP_LOCAL:3000 no celular
```

**Sequência de demonstração (≈ 60 segundos):**

1. **Dashboard** — mostrar faturamento, lucro bruto e lucro líquido calculados ao vivo.
2. **Assistente** — digitar `"vendi 2 pães"` — exibir rascunho com impacto no estoque antes de qualquer persistência.
3. **Confirmar** — clicar o botão; dado salvo; dashboard atualiza instantaneamente.
4. **Pergunta financeira** — digitar `"quanto lucrei hoje?"` — sistema lê o banco e responde em linguagem natural.
