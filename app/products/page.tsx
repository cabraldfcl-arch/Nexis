import { ArrowLeft, PackagePlus } from "lucide-react";
import Link from "next/link";
import { ProductForm, type ProductFormInitialValues } from "@/components/products/product-form";
import { ProductList, type ProductListItem } from "@/components/products/product-list";
import { prisma } from "@/lib/db/prisma";
import { productUnitValues, type ProductUnitValue } from "@/lib/validation/product";
import { createProductAction } from "./actions";

export const dynamic = "force-dynamic";

const productListLimit = 50;

type ProductsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const assistantInitialValues = parseAssistantProductInitialValues(resolvedSearchParams);
  const assistantSensitiveProductWarning = paramValue(resolvedSearchParams, "sensitiveProductWarning") === "1";
  const products = await prisma.product.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    take: productListLimit,
  });
  const productItems: ProductListItem[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    unit: product.unit,
    unitCostCents: product.unitCostCents,
    salePriceCents: product.salePriceCents,
    currentStock: Number(product.currentStock),
    minimumStock: Number(product.minimumStock),
    active: product.active,
  }));

  return (
    <main className="min-h-dvh bg-[#f6f7f4] text-zinc-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-zinc-200 pb-5">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <PackagePlus aria-hidden="true" className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">Produtos</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Produtos</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                Cadastre o que voce vende com custo, preço cadastrado e estoque minimo.
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="new-product-heading" className="py-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 id="new-product-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Adicionar produto
            </h2>
            {assistantInitialValues ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold leading-6 text-emerald-900">
                NEXIS preencheu o que conseguiu entender. Revise os campos antes de salvar.
                {assistantSensitiveProductWarning ? (
                  <>
                    {" "}
                    Registre apenas operacoes legais e autorizadas; este cadastro e somente financeiro/cadastral.
                  </>
                ) : null}
              </p>
            ) : null}
            <ProductForm
              action={createProductAction}
              initialValues={assistantInitialValues}
              submitLabel="Salvar produto"
            />
          </div>
        </section>

        <section aria-labelledby="product-list-heading" className="pb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="product-list-heading" className="text-lg font-semibold tracking-normal text-zinc-950">
              Produtos cadastrados
            </h2>
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
              {productItems.length}/{productListLimit}
            </span>
          </div>
          <p className="mb-3 text-sm text-zinc-600">
            Mostrando {productItems.length} de ate {productListLimit} produtos para manter a tela rapida.
          </p>
          <ProductList products={productItems} />
        </section>
      </div>
    </main>
  );
}

function parseAssistantProductInitialValues(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): ProductFormInitialValues | undefined {
  if (paramValue(searchParams, "assistantProduct") !== "1") {
    return undefined;
  }

  return {
    assistantProduct: true,
    category: paramValue(searchParams, "category") ?? null,
    initialPurchase: paramValue(searchParams, "initialPurchase") === "1",
    initialStock: numberParam(searchParams, "initialStock"),
    minimumStock: numberParam(searchParams, "minimumStock"),
    name: paramValue(searchParams, "name"),
    salePriceCents: integerParam(searchParams, "salePriceCents"),
    unit: unitParam(searchParams, "unit"),
    unitCostCents: integerParam(searchParams, "unitCostCents"),
  };
}

function paramValue(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = searchParams?.[key];
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim();

  return trimmed ? trimmed : undefined;
}

function unitParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): ProductUnitValue | undefined {
  const value = paramValue(searchParams, key);

  return value && productUnitValues.includes(value as ProductUnitValue) ? value as ProductUnitValue : undefined;
}

function integerParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): number | undefined {
  const value = paramValue(searchParams, key);

  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function numberParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): number | undefined {
  const value = paramValue(searchParams, key);

  if (!value || !/^\d+(\.\d+)?$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}
