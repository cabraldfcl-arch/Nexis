import { validateQuantity } from "./money";

export type StockAdjustmentDirection = "increase" | "decrease";

export type StockMovementInput =
  | {
      type: "purchase";
      quantity: number;
      confirmed: boolean;
    }
  | {
      type: "sale";
      quantity: number;
      confirmed: boolean;
    }
  | {
      type: "adjustment";
      quantity: number;
      direction: StockAdjustmentDirection;
      confirmed: boolean;
    };

export type StockProductInput = {
  currentStock: number;
  minimumStock: number;
  active?: boolean;
};

export function calculateStockAfterPurchase({
  currentStock,
  quantityPurchased,
}: {
  currentStock: number;
  quantityPurchased: number;
}): number {
  return validateStockResult(
    validateStockQuantity(currentStock, "estoque atual") +
      validateStockQuantity(quantityPurchased, "quantidade comprada"),
  );
}

export function calculateStockAfterSale({
  currentStock,
  quantitySold,
}: {
  currentStock: number;
  quantitySold: number;
}): number {
  const stock = validateStockQuantity(currentStock, "estoque atual");
  const quantity = validateStockQuantity(quantitySold, "quantidade vendida");
  const result = stock - quantity;

  if (result < 0) {
    throw new Error("estoque insuficiente para a venda.");
  }

  return validateStockResult(result);
}

export function calculateStockAfterAdjustment({
  currentStock,
  quantity,
  direction,
}: {
  currentStock: number;
  quantity: number;
  direction: StockAdjustmentDirection;
}): number {
  if (direction === "increase") {
    return calculateStockAfterPurchase({ currentStock, quantityPurchased: quantity });
  }

  if (direction === "decrease") {
    return calculateStockAfterSale({ currentStock, quantitySold: quantity });
  }

  throw new Error("direcao do ajuste de estoque invalida.");
}

export function applyStockMovements({
  initialStock,
  movements,
}: {
  initialStock: number;
  movements: readonly StockMovementInput[];
}): number {
  if (!Array.isArray(movements)) {
    throw new Error("movimentos de estoque devem ser uma lista.");
  }

  return movements.reduce((stock, movement) => {
    validateMovement(movement);

    if (!movement.confirmed) {
      return stock;
    }

    if (movement.type === "purchase") {
      return calculateStockAfterPurchase({ currentStock: stock, quantityPurchased: movement.quantity });
    }

    if (movement.type === "sale") {
      return calculateStockAfterSale({ currentStock: stock, quantitySold: movement.quantity });
    }

    return calculateStockAfterAdjustment({
      currentStock: stock,
      quantity: movement.quantity,
      direction: movement.direction,
    });
  }, validateStockQuantity(initialStock, "estoque inicial"));
}

export function hasLowStock({ currentStock, minimumStock }: StockProductInput): boolean {
  return (
    validateStockQuantity(currentStock, "estoque atual") <
    validateStockQuantity(minimumStock, "estoque minimo")
  );
}

export function countLowStockProducts(products: readonly StockProductInput[]): number {
  if (!Array.isArray(products)) {
    throw new Error("produtos de estoque devem ser uma lista.");
  }

  return products.filter((product) => product.active !== false && hasLowStock(product)).length;
}

function validateMovement(movement: StockMovementInput): void {
  if (typeof movement.confirmed !== "boolean") {
    throw new Error("movimento de estoque deve informar confirmacao.");
  }

  validateStockQuantity(movement.quantity, "quantidade do movimento");

  if (movement.type === "adjustment" && movement.direction !== "increase" && movement.direction !== "decrease") {
    throw new Error("direcao do ajuste de estoque invalida.");
  }

  if (movement.type !== "purchase" && movement.type !== "sale" && movement.type !== "adjustment") {
    throw new Error("tipo de movimento de estoque invalido.");
  }
}

function validateStockQuantity(value: number, fieldName: string): number {
  return validateQuantity(value, fieldName);
}

function validateStockResult(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("estoque calculado invalido.");
  }

  return value;
}
