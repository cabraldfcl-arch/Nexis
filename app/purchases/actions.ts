"use server";

import { ProductUnit, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { buildPurchaseTransaction } from "@/lib/finance";
import { purchaseSchema } from "@/lib/validation/purchase";

export type PurchaseActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const genericSaveError = "Nao foi possivel salvar a compra. Tente novamente.";

export async function createPurchaseAction(
  _previousState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const parsed = parsePurchaseActionFormData(formData);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        select: { active: true, currentStock: true, id: true, unit: true },
        where: { id: parsed.data.productId },
      });

      if (!product) {
        throw new Error("Produto nao encontrado.");
      }

      if (!product.active) {
        throw new Error("Produto inativo nao pode receber compra.");
      }

      if (parsed.usesPackageConversion && product.unit !== ProductUnit.UNIT) {
        throw new Error("Compra por embalagem so pode ser convertida para produto vendido por unidade.");
      }

      const purchaseTransaction = buildPurchaseTransaction({
        currentStock: Number(product.currentStock),
        quantity: parsed.data.quantity,
        unitCostCents: parsed.data.unitCostCents,
      });

      const purchase = await tx.purchase.create({
        data: {
          productId: product.id,
          quantity: parsed.data.quantity.toString(),
          unitCostCents: parsed.data.unitCostCents,
          totalCostCents: purchaseTransaction.totalCostCents,
          supplier: parsed.data.supplier,
        },
      });

      await tx.product.update({
        data: {
          currentStock: purchaseTransaction.nextStock.toString(),
          unitCostCents: parsed.data.unitCostCents,
        },
        where: { id: product.id },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          purchaseId: purchase.id,
          quantity: purchaseTransaction.movementQuantity.toString(),
          reason: "PURCHASE",
          type: StockMovementType.PURCHASE,
        },
      });
    });

    revalidateTransactions();

    return { status: "success", message: "Compra confirmada." };
  } catch (error) {
    return { status: "error", message: userFacingError(error, genericSaveError) };
  }
}

function parsePurchaseActionFormData(formData: FormData) {
  const usesPackageConversion = hasFormValue(formData.get("packageQuantity")) ||
    hasFormValue(formData.get("unitsPerPackage")) ||
    hasFormValue(formData.get("packageCost"));
  let parsed;

  try {
    parsed = purchaseSchema.safeParse({
      productId: formData.get("productId"),
      quantity: formData.get("quantity"),
      unitCost: formData.get("unitCost"),
      supplier: formData.get("supplier"),
      packageQuantity: formData.get("packageQuantity"),
      unitsPerPackage: formData.get("unitsPerPackage"),
      packageCost: formData.get("packageCost"),
    });
  } catch (error) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Confira os campos da compra.",
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

  return { success: true as const, data: parsed.data, usesPackageConversion };
}

function revalidateTransactions(): void {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/purchases");
}

function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function hasFormValue(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null;
}
