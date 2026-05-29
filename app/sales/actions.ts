"use server";

import { StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { buildSaleTransaction } from "@/lib/finance";
import { saleSchema } from "@/lib/validation/sale";

export type SaleActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const genericSaveError = "Nao foi possivel salvar a venda. Tente novamente.";

export async function createSaleAction(
  _previousState: SaleActionState,
  formData: FormData,
): Promise<SaleActionState> {
  const parsed = parseSaleActionFormData(formData);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        select: {
          active: true,
          currentStock: true,
          id: true,
          salePriceCents: true,
          unitCostCents: true,
        },
        where: { id: parsed.data.productId },
      });

      if (!product) {
        throw new Error("Produto nao encontrado.");
      }

      const saleTransaction = buildSaleTransaction({
        product: {
          active: product.active,
          currentStock: Number(product.currentStock),
          id: product.id,
          salePriceCents: product.salePriceCents,
          unitCostCents: product.unitCostCents,
        },
        quantity: parsed.data.quantity,
        unitPriceCents: parsed.data.unitPriceCents,
      });

      const sale = await tx.sale.create({
        data: {
          totalAmountCents: saleTransaction.item.totalAmountCents,
        },
      });

      const saleItem = await tx.saleItem.create({
        data: {
          productId: saleTransaction.item.productId,
          quantity: saleTransaction.item.quantity.toString(),
          saleId: sale.id,
          totalAmountCents: saleTransaction.item.totalAmountCents,
          totalCostCents: saleTransaction.item.totalCostCents,
          unitCostSnapshotCents: saleTransaction.item.unitCostSnapshotCents,
          unitPriceCents: saleTransaction.item.unitPriceCents,
        },
      });

      await tx.product.update({
        data: { currentStock: saleTransaction.nextStock.toString() },
        where: { id: product.id },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: saleTransaction.movementQuantity.toString(),
          reason: "SALE",
          saleItemId: saleItem.id,
          type: StockMovementType.SALE,
        },
      });
    });

    revalidateTransactions();

    return { status: "success", message: "Venda confirmada." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, genericSaveError) };
  }
}

function parseSaleActionFormData(formData: FormData) {
  let parsed;

  try {
    parsed = saleSchema.safeParse({
      productId: formData.get("productId"),
      quantity: formData.get("quantity"),
      unitPrice: formData.get("unitPrice"),
    });
  } catch (error) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Confira os campos da venda.",
      },
    };
  }

  if (!parsed.success) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: "Confira os campos destacados.",
        fieldErrors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([field, messages]) => [
            field,
            messages?.[0] ?? "Campo invalido.",
          ]),
        ),
      },
    };
  }

  return { success: true as const, data: parsed.data };
}

function revalidateTransactions(): void {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/sales");
}

function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
