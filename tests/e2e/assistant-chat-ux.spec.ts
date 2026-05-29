import { expect, test, type Locator, type Page } from "@playwright/test";
import { getE2EProductCreationState, resetE2EDatabase } from "./helpers/e2e-database";

test.describe("assistant chat mobile UX", () => {
  test.beforeEach(async () => {
    await resetE2EDatabase();
  });

  test("keeps the composer visible and uses an internal message scroll on mobile", async ({ page }) => {
    await delayAssistantPosts(page);
    await page.goto("/assistant");

    await expect(page.getByText("Demo por texto", { exact: true })).toBeVisible();
    await expect(page.getByTestId("assistant-composer")).toBeVisible();
    await expect(page.getByTestId("assistant-message-list")).toBeVisible();

    const initialLayout = await readChatLayout(page);
    expect(initialLayout.composerVisible).toBe(true);
    expect(initialLayout.documentScrollWidth).toBeLessThanOrEqual(initialLayout.viewportWidth + 2);

    for (const message of [
      "quanto vendi hoje?",
      "qual meu lucro bruto hoje?",
      "qual meu lucro líquido hoje?",
      "qual meu estoque atual?",
      "produto mais vendido hoje",
      "resumo financeiro do dia",
      "o que comprei hoje?",
      "gastei 0 com embalagem",
    ]) {
      await askNexis(page, message, { expectPending: true });
      await expect(latestAssistantMessage(page)).toBeVisible();
    }

    await expect(page.getByTestId("user-message").filter({ hasText: "resumo financeiro do dia" })).toBeVisible();
    await expect(latestAssistantMessage(page).getByText("Valor da despesa precisa ser maior que zero.")).toBeVisible();

    const longConversationLayout = await readChatLayout(page);
    expect(longConversationLayout.composerVisible).toBe(true);
    expect(longConversationLayout.messageListOverflowY).toBe("auto");
    expect(longConversationLayout.messageListScrollHeight).toBeGreaterThan(
      longConversationLayout.messageListClientHeight + 20,
    );
    expect(longConversationLayout.documentScrollHeight).toBeLessThanOrEqual(
      longConversationLayout.viewportHeight + 4,
    );
    expect(longConversationLayout.documentScrollWidth).toBeLessThanOrEqual(
      longConversationLayout.viewportWidth + 2,
    );
  });

  test("opens the product form with assistant prefill and saves only through the product button", async ({ page }) => {
    const productName = "Chat Mate";

    await delayAssistantPosts(page);
    await page.goto("/assistant");

    await page.getByLabel("Mensagem").fill("cadastrar Chat Mate custo 3 venda 6 estoque 2 mínimo 1");
    await Promise.all([
      page.waitForURL(/\/products\?/, { timeout: 10_000 }),
      page.getByRole("button", { name: "Enviar para NEXIS" }).click(),
    ]);

    await expect(page.getByRole("heading", { name: "Adicionar produto" })).toBeVisible();
    await expect(page.getByLabel("Nome do produto")).toHaveValue(productName);
    await expect(page.getByLabel("Custo para voce")).toHaveValue("3,00");
    await expect(page.getByLabel("Preço cadastrado")).toHaveValue("6,00");
    await expect(page.getByLabel("Estoque inicial")).toHaveValue("2");
    await expect(page.getByLabel("Estoque minimo")).toHaveValue("1");
    await expect(getE2EProductCreationState(productName)).resolves.toMatchObject({ productCount: 0 });

    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByText("Produto salvo.")).toBeVisible();
    await expect(page.getByText("Salvando...")).toHaveCount(0);
    await expect(getE2EProductCreationState(productName)).resolves.toMatchObject({
      adjustmentMovementCount: 1,
      currentStock: 2,
      productCount: 1,
      totalAdjustmentQuantity: 2,
    });
  });
});

async function askNexis(page: Page, message: string, options: { expectPending?: boolean } = {}) {
  const previousAssistantMessageCount = await page.getByTestId("assistant-message").count();
  const pendingVisible = options.expectPending
    ? page.getByTestId("assistant-pending").waitFor({ state: "visible", timeout: 5000 })
    : Promise.resolve();

  await page.getByLabel("Mensagem").fill(message);
  await page.getByRole("button", { name: "Enviar para NEXIS" }).click();
  await pendingVisible;
  await expect(page.getByLabel("Mensagem")).toHaveValue("");
  await expect(page.getByTestId("assistant-message")).toHaveCount(previousAssistantMessageCount + 1);
}

async function delayAssistantPosts(page: Page) {
  await page.route("**/assistant**", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await route.continue();
  });
}

function latestAssistantMessage(page: Page): Locator {
  return page.getByTestId("assistant-message").last();
}

type ChatLayoutMetrics = {
  composerVisible: boolean;
  documentScrollHeight: number;
  documentScrollWidth: number;
  messageListClientHeight: number;
  messageListOverflowY: string;
  messageListScrollHeight: number;
  viewportHeight: number;
  viewportWidth: number;
};

async function readChatLayout(page: Page): Promise<ChatLayoutMetrics> {
  return page.evaluate(() => {
    const composer = document.querySelector<HTMLElement>('[data-testid="assistant-composer"]');
    const messageList = document.querySelector<HTMLElement>('[data-testid="assistant-message-list"]');
    const composerRect = composer?.getBoundingClientRect();

    return {
      composerVisible: Boolean(
        composerRect && composerRect.top >= 0 && composerRect.bottom <= window.innerHeight + 2,
      ),
      documentScrollHeight: document.documentElement.scrollHeight,
      documentScrollWidth: document.documentElement.scrollWidth,
      messageListClientHeight: messageList?.clientHeight ?? 0,
      messageListOverflowY: messageList ? window.getComputedStyle(messageList).overflowY : "",
      messageListScrollHeight: messageList?.scrollHeight ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
}
