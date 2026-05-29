import { describe, expect, it } from "vitest";
import { resolveProductSelectionFromOptions } from "@/lib/ai/product-disambiguation";

const closeCocaOptions = [
  { id: "coca-lata", name: "Coca Cola lata" },
  { id: "coca-lata-350", name: "Coca Cola lata 350 ml" },
];

const volumeCocaOptions = [
  { id: "coca-lata-350", name: "Coca-Cola lata 350ml" },
  { id: "coca-600", name: "Coca-Cola 600ml" },
  { id: "coca-2l", name: "Coca-Cola 2L" },
];

describe("product disambiguation pending context resolver", () => {
  it("resolves numeric answers from a pending product choice", () => {
    expect(resolveProductSelectionFromOptions("1", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("a 1", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("opção 1", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("2", closeCocaOptions)).toEqual({
      option: closeCocaOptions[1],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("numero 2", closeCocaOptions)).toEqual({
      option: closeCocaOptions[1],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("número 2", closeCocaOptions)).toEqual({
      option: closeCocaOptions[1],
      status: "selected",
    });
  });

  it("resolves ordinal answers from a pending product choice", () => {
    expect(resolveProductSelectionFromOptions("a primeira", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
  });

  it("resolves variant and volume text from a pending product choice", () => {
    expect(resolveProductSelectionFromOptions("a de 600", volumeCocaOptions)).toEqual({
      option: volumeCocaOptions[1],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("a de 350", volumeCocaOptions)).toEqual({
      option: volumeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("a de lata", volumeCocaOptions)).toEqual({
      option: volumeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("350 ml", volumeCocaOptions)).toEqual({
      option: volumeCocaOptions[0],
      status: "selected",
    });
  });

  it("resolves the shorter exact product when text safely points to it", () => {
    expect(resolveProductSelectionFromOptions("coca lata", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
    expect(resolveProductSelectionFromOptions("coca cola lata eu vendi", closeCocaOptions)).toEqual({
      option: closeCocaOptions[0],
      status: "selected",
    });
  });

  it("keeps unclear contextual text ambiguous instead of choosing alone", () => {
    expect(resolveProductSelectionFromOptions("a lata", closeCocaOptions)).toEqual({
      status: "ambiguous",
    });
    expect(resolveProductSelectionFromOptions("a de lata", closeCocaOptions)).toEqual({
      status: "ambiguous",
    });
    expect(resolveProductSelectionFromOptions("essa", closeCocaOptions)).toEqual({
      status: "ambiguous",
    });
    expect(resolveProductSelectionFromOptions("essa mesmo", closeCocaOptions)).toEqual({
      status: "ambiguous",
    });
    expect(resolveProductSelectionFromOptions("pode ser essa", closeCocaOptions)).toEqual({
      status: "ambiguous",
    });
  });

  it("does not turn a numeric answer without pending options into a critical action", () => {
    expect(resolveProductSelectionFromOptions("1", [])).toEqual({
      status: "no_match",
    });
  });
});
