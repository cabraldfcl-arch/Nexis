import { describe, expect, it } from "vitest";
import * as answerQuestionModule from "@/lib/ai/answer-question";
import { answerQuestionFromSummary } from "@/lib/ai/answer-question";
import { buildDashboardSummary } from "@/lib/dashboard/summary";

const now = new Date(2026, 4, 22, 12, 0, 0, 0);
const answerQuestionFromContext = (
  answerQuestionModule as {
    answerQuestionFromContext?: (question: unknown, context: unknown) => unknown;
  }
).answerQuestionFromContext;

describe("assistant question answers", () => {
  it("answers basic financial questions safely when the database is empty", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [],
      expenses: [],
      products: [],
    });
    const emptyContext = {
      inventory: {
        lowStockCount: 0,
        lowStockProducts: [],
        products: [],
        totalActiveProducts: 0,
      },
      summary,
    };

    expect(answerQuestionFromSummary({ kind: "question", intent: "sales", period: "today" }, summary)).toMatchObject({
      title: "Vendas hoje",
      value: "R$ 0,00",
    });
    expect(answerQuestionFromSummary({ kind: "question", intent: "netProfit", period: "today" }, summary)).toMatchObject({
      title: "Lucro líquido hoje",
      value: "R$ 0,00",
    });
    expect(
      answerQuestionFromContext?.({ kind: "question", intent: "inventory", period: "month" }, emptyContext),
    ).toMatchObject({
      body: "Nenhum produto ativo está cadastrado para consultar estoque.",
      title: "Estoque atual",
      value: "0",
    });
  });

  it("answers sales questions using in-memory deterministic summary data", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "sale_today",
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
        },
      ],
      expenses: [],
      products: [],
    });

    expect(answerQuestionFromSummary({ kind: "question", intent: "sales", period: "today" }, summary)).toMatchObject({
      title: "Vendas hoje",
      value: "R$ 21,00",
    });
  });

  it("keeps unconfirmed expenses out of profit answers", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "sale_today",
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
        },
      ],
      expenses: [
        {
          id: "pending",
          paidAt: new Date(2026, 4, 22, 11, 0, 0, 0),
          amountCents: 9999,
          confirmed: false,
        },
      ],
      products: [],
    });

    const answer = answerQuestionFromSummary({ kind: "question", intent: "profit", period: "today" }, summary);

    expect(answer.value).toBe("R$ 9,00");
    expect(answer.body).toContain("despesas confirmadas foram R$ 0,00");
  });

  it("answers gross and net profit as separate deterministic concepts", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "sale_today",
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
        },
      ],
      expenses: [
        {
          id: "confirmed",
          paidAt: new Date(2026, 4, 22, 11, 0, 0, 0),
          amountCents: 500,
          confirmed: true,
        },
        {
          id: "pending",
          paidAt: new Date(2026, 4, 22, 11, 30, 0, 0),
          amountCents: 9999,
          confirmed: false,
        },
      ],
      products: [],
    });

    const gross = answerQuestionFromSummary(
      { kind: "question", intent: "grossProfit", period: "today" } as never,
      summary,
    );
    const net = answerQuestionFromSummary(
      { kind: "question", intent: "netProfit", period: "today" } as never,
      summary,
    );

    expect(gross).toMatchObject({
      title: "Lucro bruto hoje",
      value: "R$ 9,00",
    });
    expect(gross.body).toContain("vendas menos custo dos produtos vendidos");
    expect(net).toMatchObject({
      title: "Lucro líquido hoje",
      value: "R$ 4,00",
    });
    expect(net.body).toContain("lucro bruto menos despesas confirmadas");
    expect(net.body).toContain("despesas pendentes somam R$ 99,99");
  });

  it("answers inventory, purchases and top products from deterministic report context", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [],
      expenses: [],
      products: [
        { id: "agua", name: "Água mineral", currentStock: 3, minimumStock: 10, active: true },
        { id: "refri", name: "Refrigerante lata", currentStock: 23, minimumStock: 12, active: true },
      ],
    });
    const context = {
      inventory: {
        lowStockCount: 1,
        lowStockProducts: [{ currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" }],
        products: [
          { currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" },
          { currentStock: 23, id: "refri", minimumStock: 12, name: "Refrigerante lata" },
        ],
        totalActiveProducts: 2,
      },
      inventoryMatch: {
        product: { currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" },
        status: "found",
      },
      purchases: {
        count: 2,
        items: [
          {
            productName: "Água mineral",
            purchasedAt: new Date(2026, 4, 22, 8, 0, 0, 0),
            quantity: 25,
            totalCostCents: 2500,
            unitCostCents: 100,
          },
        ],
        totalCostCents: 13000,
      },
      summary,
      topProducts: {
        items: [
          {
            grossProfitCents: 4400,
            productId: "agua",
            productName: "Água mineral",
            quantity: 22,
            revenueCents: 6600,
          },
        ],
      },
    };

    expect(
      answerQuestionFromContext?.(
        { kind: "question", intent: "inventory", period: "month", productName: "águas" },
        context,
      ),
    ).toMatchObject({
      title: "Estoque atual",
      value: "3",
    });
    expect(
      answerQuestionFromContext?.({ kind: "question", intent: "purchases", period: "today" }, context),
    ).toMatchObject({
      title: "Compras hoje",
      value: "R$ 130,00",
    });
    expect(
      answerQuestionFromContext?.({ kind: "question", intent: "topProducts", period: "today" }, context),
    ).toMatchObject({
      title: "Produto mais vendido hoje",
      value: "Água mineral",
    });
  });

  it("answers daily summaries and unsupported cash flow safely", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [
        {
          id: "sale_today",
          soldAt: new Date(2026, 4, 22, 10, 0, 0, 0),
          totalAmountCents: 2100,
          items: [
            {
              quantity: 3,
              unitPriceCents: 700,
              unitCostSnapshotCents: 400,
              totalAmountCents: 2100,
              totalCostCents: 1200,
            },
          ],
        },
      ],
      expenses: [
        {
          id: "confirmed",
          paidAt: new Date(2026, 4, 22, 11, 0, 0, 0),
          amountCents: 500,
          confirmed: true,
        },
        {
          id: "pending",
          paidAt: new Date(2026, 4, 22, 11, 30, 0, 0),
          amountCents: 800,
          confirmed: false,
        },
      ],
      products: [{ id: "agua", name: "Água mineral", currentStock: 3, minimumStock: 10, active: true }],
    });
    const context = {
      inventory: {
        lowStockCount: 1,
        lowStockProducts: [{ currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" }],
        products: [{ currentStock: 3, id: "agua", minimumStock: 10, name: "Água mineral" }],
        totalActiveProducts: 1,
      },
      purchases: { count: 1, items: [], totalCostCents: 2500 },
      summary,
    };

    const daily = answerQuestionFromContext?.(
      { kind: "question", intent: "dailySummary", period: "today" },
      context,
    );
    const cashFlow = answerQuestionFromSummary(
      { kind: "question", intent: "cashFlow", period: "month" } as never,
      summary,
    );

    expect(daily).toMatchObject({
      title: "Resumo financeiro hoje",
      value: "R$ 4,00",
    });
    expect(JSON.stringify(daily)).toContain("compras somaram R$ 25,00");
    expect(JSON.stringify(daily)).toContain("despesas pendentes somam R$ 8,00");
    expect(cashFlow.body).toBe("Ainda não tenho essa consulta implementada com segurança.");
  });

  it("does not include inactive products in low stock answers", () => {
    const summary = buildDashboardSummary({
      now,
      sales: [],
      expenses: [],
      products: [
        { id: "active", name: "Agua", currentStock: 1, minimumStock: 3, active: true },
        { id: "inactive", name: "Inativo", currentStock: 0, minimumStock: 10, active: false },
      ],
    });

    const answer = answerQuestionFromSummary({ kind: "question", intent: "lowStock", period: "month" }, summary);

    expect(answer.body).toContain("Agua");
    expect(answer.body).not.toContain("Inativo");
  });
});
