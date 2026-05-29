# NEXIS — Material de Apresentação MVP

> Gestor financeiro mobile-first com IA para microempreendedores e pequenos comerciantes.
> Produzido em 2026-05-28 para a equipe de apresentação.

---

## 1. Esboço do MVP

### Stack tecnológico

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Linguagem | TypeScript 6 |
| Backend | Next.js App Router (Server Actions + API Routes) |
| ORM | Prisma 7 |
| Banco de dados | SQLite (Better SQLite3) |
| Validação | Zod 4 |
| Testes | Vitest 4 + Playwright |

### Arquitetura em blocos

```
┌──────────────────────────────────────────────────────────────────┐
│                        CELULAR (PWA)                             │
│  Dashboard │ Produtos │ Vendas │ Compras │ Despesas │ Assistente │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP — Next.js App Router
┌───────────────────────────▼──────────────────────────────────────┐
│                   SERVIDOR (Next.js / Node)                      │
│                                                                  │
│  app/*/actions.ts      lib/finance/         lib/ai/             │
│  (Server Actions)      profit.ts            parse-message.ts    │
│  ↑ formulários         money.ts             answer-question.ts  │
│  ↑ confirmações        reports.ts           intent-schema.ts    │
│                        transactions.ts                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Prisma 7 ORM
┌───────────────────────────▼──────────────────────────────────────┐
│                      BANCO (SQLite)                              │
│  Product │ Sale + SaleItem │ Purchase │ Expense │ StockMovement  │
│  StockLoss │ ProductAlias │ CancellationEvent                    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ (flag desligada por padrão no MVP)
┌───────────────────────────▼──────────────────────────────────────┐
│                  IA EXTERNA (Claude / OpenAI)                    │
│  Recebe: produtos ativos + resumo financeiro + categorias        │
│  Retorna: JSON validado por Zod → rascunho para confirmação      │
└──────────────────────────────────────────────────────────────────┘
```

### Estrutura de pastas do projeto

```
NEXIS/
├── app/                     ← Rotas (Next.js App Router)
│   ├── page.tsx             ← Dashboard (hoje + mês)
│   ├── products/            ← Cadastro de produtos
│   ├── sales/               ← Registro de vendas
│   ├── purchases/           ← Registro de compras
│   ├── expenses/            ← Despesas
│   └── assistant/           ← Chat com IA
│       └── actions.ts       ← Ponto de entrada do assistente
├── components/
│   ├── assistant/           ← Chat, rascunho, confirmação
│   ├── transactions/        ← Forms e listas de venda/compra
│   └── products/            ← Cadastro e listagem
├── lib/
│   ├── finance/
│   │   ├── money.ts         ← Aritmética monetária em centavos
│   │   ├── profit.ts        ← Lucro bruto e líquido
│   │   ├── sales.ts         ← Faturamento e CMV
│   │   ├── stock.ts         ← Movimentação de estoque
│   │   ├── transactions.ts  ← Montagem de transações
│   │   └── reports.ts       ← Resumos de período
│   ├── ai/
│   │   ├── parse-message.ts       ← Parser de linguagem natural
│   │   ├── answer-question.ts     ← Respostas financeiras
│   │   ├── intent-schema.ts       ← Tipos de intenção (Zod)
│   │   └── nexis-system-prompt.ts ← Prompt do assistente
│   └── dashboard/
│       └── summary.ts       ← Dados do dashboard (hoje + mês)
└── prisma/
    └── schema.prisma        ← Modelo de dados completo
```

### Trecho de código — fluxo de confirmação (app/assistant/actions.ts)

A IA **nunca salva dados direto**. Sempre gera um rascunho que o usuário precisa confirmar:

```typescript
// Usuário digita: "vendi 3 pães"
// Sistema monta o rascunho:
const draft: SaleDraft = {
  type: "sale",
  productName: "Pão Francês",
  quantity: 3,
  unitPriceCents: 150,          // R$ 1,50
  totalAmountCents: 450,        // R$ 4,50
  estimatedGrossProfitCents: 120, // R$ 1,20
  stockBefore: 50,
  stockAfter: 47,               // mostra impacto ANTES de confirmar
};
// → Usuário vê rascunho → clica "Confirmar" → dado é salvo
```

---

## 2. Diagrama de Fluxo de Dados (DFD)

### Nível 0 — Diagrama de Contexto

```
              [Microempreendedor]
                     │
         cadastra    │   recebe
         lança       │   dashboard
         confirma    │   lucro, estoque
                     │
         ┌───────────▼──────────┐
         │                      │
         │        NEXIS         │ ──→ [IA Externa]
         │                      │      (leitura apenas,
         └───────────┬──────────┘       contexto sanitizado)
                     │
                     ▼
               [Banco SQLite]
```

### Nível 1 — Processos principais

```
[Usuário]
   │
   ├─→ (1) CADASTRAR PRODUTO ──────────────→ [BD: Product]
   │         nome, preço, custo, unidade
   │
   ├─→ (2) REGISTRAR VENDA ──────────────→ [BD: Sale + SaleItem]
   │         produto, qtd, preço             │ guarda snapshot de custo
   │                                         ▼
   │                                   [BD: StockMovement]
   │                                    type=SALE, −quantidade
   │                                         │
   │                                    atualiza currentStock
   │
   ├─→ (3) REGISTRAR COMPRA ─────────────→ [BD: Purchase]
   │         produto, qtd, custo/unidade     │
   │                                         ▼
   │                                   [BD: StockMovement]
   │                                    type=PURCHASE, +quantidade
   │                                         │
   │                                    atualiza currentStock
   │                                    atualiza unitCostCents
   │
   ├─→ (4) REGISTRAR DESPESA ────────────→ [BD: Expense]
   │         descrição, categoria,            confirmed = true/false
   │         valor, confirmada?
   │
   ├─→ (5) ASSISTENTE (TEXTO) ───────────→ lib/ai/parse-message.ts
   │         mensagem em linguagem natural    │
   │                                     classifica intenção:
   │                                     venda / compra / despesa /
   │                                     produto / pergunta financeira
   │                                          │
   │                                     gera rascunho
   │                                          │
   │                                   ← exibe para o usuário
   │                                     [AGUARDA CONFIRMAÇÃO]
   │                                          │
   │                                    confirma → persiste
   │
   └─→ (6) VER DASHBOARD ────────────────→ lib/dashboard/summary.ts
               hoje + mês                    lê Sale+Expense+Product
                                             chama generateFinancialSummary()
                                             ← faturamento, lucro bruto,
                                                lucro líquido, estoque crítico
```

### Fluxo detalhado do assistente (multi-turno)

```
Usuário: "comprei 10 refrigerantes"
         │
         ▼
  [parse-message.ts]
   detecta: partial_purchase
   falta: unitCostCents
         │
         ▼
  Resposta: "Você pagou quanto por unidade?"
  salva contexto pendente: purchase_missing_unit_cost
         │
  Usuário: "5 reais"
         │
         ▼
  [resolve contexto pendente]
   unitCostCents = 500 centavos
         │
         ▼
  [busca Product por nome + aliases] ← [BD: Product + ProductAlias]
         │
         ▼
  [buildPurchaseDraft()]
   totalCostCents = 10 × 500 = 5.000 centavos
   stockAfter = atual + 10
         │
         ▼
  [rascunho exibido → usuário confirma]
         │
         ▼
  [persistPurchaseDraft()] → [BD: Purchase + StockMovement]
```

---

## 3. Lógica Matemática Aplicada

### Fórmulas do motor financeiro

**Faturamento (Receita):**

```
R = Σ (qᵢ × pᵢ)
```

onde `qᵢ` = quantidade vendida e `pᵢ` = preço unitário de venda

**Custo das Mercadorias Vendidas (CMV) — com snapshot:**

```
CMV = Σ (qᵢ × cᵢˢⁿᵃᵖˢʰᵒᵗ)
```

onde `cᵢˢⁿᵃᵖˢʰᵒᵗ` é o custo **no momento da venda** (não o custo atual do produto)

**Lucro Bruto:**

```
LB = R − CMV
```

**Despesas Confirmadas:**

```
D = Σ dⱼ  (apenas onde confirmada = true)
```

**Lucro Líquido:**

```
LL = LB − D
```

**Margem de Lucro (%):**

```
Margem = ((pᵢ − cᵢ) / pᵢ) × 100
```

**Markup:**

```
Markup = pᵢ / cᵢ
```

**Estoque Crítico:**

```
alerta  se  currentStock < minimumStock
ok      caso contrário
```

### Mapa fórmula → código

| Fórmula | Arquivo | Função |
|---|---|---|
| `qᵢ × pᵢ` (total da linha) | `lib/finance/money.ts` | `calculateLineTotalCents()` |
| `R = Σ(qᵢ × pᵢ)` | `lib/finance/sales.ts` | `calculateRevenueCents()` |
| `CMV = Σ(qᵢ × cᵢˢⁿᵃᵖˢʰᵒᵗ)` | `lib/finance/sales.ts` | `calculateCostOfGoodsSoldCents()` |
| `LB = R − CMV` | `lib/finance/profit.ts` | `calculateGrossProfitCents()` |
| `D = Σ dⱼ (confirmadas)` | `lib/finance/profit.ts` | `calculateConfirmedExpensesCents()` |
| `LL = LB − D` | `lib/finance/profit.ts` | `calculateNetProfitCents()` |
| `Margem` e `Markup` | `lib/finance/sales.ts` | `calculateSaleItemProfitMetrics()` |
| `currentStock < minimumStock` | `lib/finance/stock.ts` | `hasLowStock()` |
| Resumo do período | `lib/finance/reports.ts` | `generateFinancialSummary()` |

---

### Por que o snapshot de custo importa

O banco guarda `unitCostSnapshotCents` em cada item de venda:

```
SaleItem {
  unitPriceCents          ← preço cobrado do cliente
  unitCostSnapshotCents   ← custo no momento da venda  ← snapshot
  totalAmountCents        ← q × preço
  totalCostCents          ← q × custo_snapshot
}
```

Se o fornecedor aumentar o preço do produto depois, o lucro das vendas passadas **não se altera**. O snapshot congela o valor correto no tempo da transação — equivalente ao método PEPS/FIFO contábil.

---

### Por que centavos inteiros (invariante de precisão)

Todos os valores monetários são armazenados e calculados como **inteiros em centavos** (`type MoneyCents = number`):

```typescript
// lib/finance/money.ts

// Ponto flutuante mente:
0.1 + 0.2 === 0.30000000000000004  // ERRADO

// Centavos inteiros são exatos:
10 + 20 === 30  // R$ 0,30 — CORRETO

// Quantidade fracionária (ex.: 2,5 kg a R$ 1,00/kg):
// converte 2,5 → fração 5/2 (via MDC — Máximo Divisor Comum)
// total = (100 × 5) / 2 = 250 centavos = R$ 2,50  — exato

if (!Number.isSafeInteger(value)) {
  throw new Error("deve ser informado em centavos inteiros seguros.");
}
```

---

### Rastreabilidade como estrutura de dados

Cada movimentação de estoque gera um registro **imutável** em `StockMovement`. Nunca há DELETE — cancelamentos criam um `CancellationEvent` e um movimento `REVERSAL`:

| type | quando ocorre | efeito |
|---|---|---|
| `PURCHASE` | compra registrada | `+quantidade` |
| `SALE` | venda confirmada | `−quantidade` |
| `LOSS` | perda / quebra | `−quantidade` |
| `REVERSAL` | cancelamento | desfaz movimento anterior |
| `ADJUSTMENT` | ajuste manual | `±quantidade` |

Isso é um requisito formal de sistemas financeiros: a trilha de auditoria é sempre preservada.

---

### Exemplo numérico completo

```
Dados do dia:
  Vendeu 10 pães a R$ 1,50 cada
  Custo dos pães: R$ 0,80 cada
  Despesa confirmada: conta de luz R$ 3,00

Cálculo:
  Faturamento  = 10 × 1,50        = R$ 15,00
  CMV          = 10 × 0,80        = R$  8,00
  Lucro Bruto  = 15,00 − 8,00     = R$  7,00
  Despesas     =                    R$  3,00
  Lucro Líquido = 7,00 − 3,00     = R$  4,00
  Margem       = (1,50−0,80)/1,50 = 46,7%
  Markup       = 1,50 / 0,80      = 1,875×

Internamente (centavos — sem ponto flutuante):
  faturamento = 1500
  CMV         = 800
  LB          = 700
  despesas    = 300
  LL          = 400
```

---

## 4. Roteiro de Demo ao Vivo

```bash
# Preparar banco com dados fictícios prontos
npm run db:reset-demo

# Iniciar servidor local
npm run dev
# → Abrir http://localhost:3000
```

**Sequência sugerida (30 segundos):**

1. **Dashboard** — mostrar faturamento, lucro bruto e lucro líquido do mês calculados em tempo real a partir do banco.
2. **Assistente** — digitar `"vendi 2 pães"` — mostrar rascunho com impacto no estoque **antes** de qualquer confirmação.
3. **Confirmar** — clicar no botão; dado salvo; dashboard atualiza na hora.

**Para demo no celular (mesma rede Wi-Fi):**

```bash
npm run dev -- --hostname 0.0.0.0
# Abrir http://SEU_IP_LOCAL:3000 no celular
```

**Para instalar como app (PWA):**
- Android/Chrome → "Instalar app" ou "Adicionar à tela inicial"
- iPhone/Safari → "Compartilhar" → "Adicionar à Tela de Início"
