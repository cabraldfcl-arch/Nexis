"use server";

import { ProductUnit } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  assertNoDuplicateProductName,
  createProductRecord,
  normalizeProductNameForDuplicate,
  productCreationErrorMessage,
} from "@/lib/products/create-product";
import { productFormSchema } from "@/lib/validation/product";

export type ProductActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const genericSaveError = "Nao foi possivel salvar o produto. Tente novamente.";

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const parsed = parseProductActionFormData(formData);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    const assistantProduct = formData.get("assistantProduct") === "true";
    const initialPurchase = formData.get("initialPurchase") === "true";

    await prisma.$transaction(async (tx) =>
      createProductRecord(tx, parsed.data, {
        aliasSource: assistantProduct ? "AI_CONFIRMED" : "MANUAL",
        initialStockSource: initialPurchase ? "purchase" : "adjustment",
        origin: assistantProduct ? "ASSISTANT_TEXT" : "MANUAL",
      }),
    );

    revalidateProducts();

    return { status: "success", message: "Produto salvo." };
  } catch (error) {
    return { status: "error", message: productCreationErrorMessage(error, genericSaveError) };
  }
}

export async function updateProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const productId = getRequiredProductId(formData);

  if (!productId) {
    return { status: "error", message: "Produto nao encontrado para editar." };
  }

  const parsed = parseProductActionFormData(formData);

  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await assertNoDuplicateProductName(tx, parsed.data.name, { excludeProductId: productId });

      const currentProduct = await tx.product.findUnique({
        select: { currentStock: true },
        where: { id: productId },
      });

      if (!currentProduct) {
        throw new Error("Produto nao encontrado.");
      }

      await tx.product.update({
        data: {
          name: parsed.data.name,
          normalizedName: normalizeProductNameForDuplicate(parsed.data.name),
          category: parsed.data.category,
          unit: parsed.data.unit as ProductUnit,
          unitCostCents: parsed.data.unitCostCents,
          salePriceCents: parsed.data.salePriceCents,
          currentStock: currentProduct.currentStock.toString(),
          minimumStock: parsed.data.minimumStock.toString(),
        },
        where: { id: productId },
      });
    });

    revalidateProducts();

    return { status: "success", message: "Produto atualizado." };
  } catch (error) {
    return { status: "error", message: productCreationErrorMessage(error, genericSaveError) };
  }
}

export async function setProductActiveAction(formData: FormData): Promise<void> {
  const productId = getRequiredProductId(formData);
  const active = formData.get("active") === "true";

  if (!productId) {
    return;
  }

  await prisma.product.update({
    data: { active },
    where: { id: productId },
  });

  revalidateProducts();
}

function parseProductActionFormData(formData: FormData) {
  let parsed;

  try {
    parsed = productFormSchema.safeParse({
      name: formData.get("name"),
      category: formData.get("category"),
      unit: formData.get("unit"),
      unitCost: formData.get("unitCost"),
      salePrice: formData.get("salePrice"),
      initialStock: formData.get("initialStock"),
      minimumStock: formData.get("minimumStock"),
      packageQuantity: formData.get("packageQuantity"),
      unitsPerPackage: formData.get("unitsPerPackage"),
      packageCost: formData.get("packageCost"),
    });
  } catch (error) {
    return {
      success: false as const,
      error: {
        status: "error" as const,
        message: error instanceof Error ? error.message : "Confira os campos do produto.",
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

function getRequiredProductId(formData: FormData): string | null {
  const productId = formData.get("productId");

  if (typeof productId !== "string" || productId.trim().length === 0) {
    return null;
  }

  return productId;
}

function revalidateProducts(): void {
  revalidatePath("/");
  revalidatePath("/products");
}
