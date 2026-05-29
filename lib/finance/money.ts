export type MoneyCents = number;

export type LineTotalInput = {
  quantity: number;
  unitAmountCents: MoneyCents;
  quantityFieldName?: string;
  unitAmountFieldName?: string;
};

export type RoundedUnitAmountInput = {
  totalAmountCents: MoneyCents;
  totalFieldName?: string;
  unitFieldName?: string;
  units: number;
};

type DecimalRatio = {
  numerator: number;
  denominator: number;
};

export function validateIntegerMoneyCents(value: number, fieldName: string): MoneyCents {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} deve ser um numero finito em centavos.`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} deve ser informado em centavos inteiros seguros.`);
  }

  return value;
}

export function validateNonNegativeMoneyCents(value: number, fieldName: string): MoneyCents {
  const cents = validateIntegerMoneyCents(value, fieldName);

  if (cents < 0) {
    throw new Error(`${fieldName} nao pode ser negativo.`);
  }

  return cents;
}

export function validateQuantity(value: number, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fieldName} deve ser um numero finito.`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} nao pode ser negativa.`);
  }

  if (value > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${fieldName} excede a precisao numerica segura.`);
  }

  return value;
}

export function calculateLineTotalCents({
  quantity,
  unitAmountCents,
  quantityFieldName = "quantidade",
  unitAmountFieldName = "valor unitario",
}: LineTotalInput): MoneyCents {
  validateQuantity(quantity, quantityFieldName);
  const cents = validateNonNegativeMoneyCents(unitAmountCents, unitAmountFieldName);
  const ratio = decimalQuantityToRatio(quantity, quantityFieldName);
  const totalNumerator = cents * ratio.numerator;

  if (!Number.isSafeInteger(totalNumerator)) {
    throw new Error(`total calculado para ${unitAmountFieldName} excede centavos inteiros seguros.`);
  }

  if (totalNumerator % ratio.denominator !== 0) {
    throw new Error(
      `total calculado para ${unitAmountFieldName} deve resultar em centavos inteiros; revise ${quantityFieldName}.`,
    );
  }

  return totalNumerator / ratio.denominator;
}

export function calculateRoundedUnitAmountCents({
  totalAmountCents,
  totalFieldName = "valor total",
  unitFieldName = "unidades",
  units,
}: RoundedUnitAmountInput): MoneyCents {
  const cents = validateNonNegativeMoneyCents(totalAmountCents, totalFieldName);
  const unitCount = validateQuantity(units, unitFieldName);

  if (unitCount <= 0) {
    throw new Error(`${unitFieldName} precisa ser maior que zero.`);
  }

  const rounded = Math.round(cents / unitCount);

  if (!Number.isSafeInteger(rounded) || rounded <= 0) {
    throw new Error(`${totalFieldName} dividido por ${unitFieldName} precisa resultar em centavos positivos.`);
  }

  return rounded;
}

export function formatCentsToBRL(value: MoneyCents): string {
  const cents = validateIntegerMoneyCents(value, "valor monetario");

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
}

export function sumMoneyCents(values: readonly MoneyCents[], fieldName: string): MoneyCents {
  let total = 0;

  for (const value of values) {
    const cents = validateIntegerMoneyCents(value, fieldName);
    total += cents;

    if (!Number.isSafeInteger(total)) {
      throw new Error(`${fieldName} excede centavos inteiros seguros.`);
    }
  }

  return total;
}

function decimalQuantityToRatio(value: number, fieldName: string): DecimalRatio {
  const text = value.toString().toLowerCase();
  const [mantissa, exponentText] = text.split("e");
  const exponent = exponentText === undefined ? 0 : Number(exponentText);

  if (!Number.isInteger(exponent)) {
    throw new Error(`${fieldName} deve ter precisao decimal segura.`);
  }

  const [wholePart, fractionPart = ""] = mantissa.split(".");
  const rawDigits = `${wholePart}${fractionPart}`.replace(/^\+/, "");
  const digits = rawDigits.replace(/^0+(?=\d)/, "") || "0";
  const decimalPlaces = fractionPart.length - exponent;

  let numerator = Number(digits);
  let denominator = 1;

  if (!Number.isSafeInteger(numerator)) {
    throw new Error(`${fieldName} excede a precisao numerica segura.`);
  }

  if (decimalPlaces > 0) {
    denominator = 10 ** decimalPlaces;
  } else if (decimalPlaces < 0) {
    numerator *= 10 ** Math.abs(decimalPlaces);
  }

  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new Error(`${fieldName} excede a precisao decimal segura.`);
  }

  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }

  return a || 1;
}
