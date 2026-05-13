/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { QuantityError, QuantityStatus } from "../Exception";
import { UnitConversionInvert } from "../Interfaces";
import { UnitSchemaNames } from "../generated/Units.generated";
import { basicUnitConversionData } from "../internal/BasicUnitConversions.generated";
import { almostEqual, applyConversion, Quantity } from "../Quantity";
import { UnitConversions } from "../UnitConversions";

const unitsSchemaItems = unitsSchema.items as Record<string, { schemaItemType: string }>;

function expectedBuiltInConversionUnitNames(): string[] {
  return Object.entries(unitsSchemaItems)
    .filter(([, item]) => item.schemaItemType === "Unit" || item.schemaItemType === "InvertedUnit")
    .map(([name]) => `${unitsSchema.name}.${name}`)
    .sort((a, b) => a.localeCompare(b));
}

describe("Quantity", () => {
  it("almost-equal", async () => {
    expect(almostEqual(1.0, 1.0)).to.be.true;
    expect(almostEqual(1.0, 1.1)).to.be.false;
    expect(almostEqual(1.0, 1.0000000000000002)).to.be.true;

    expect(almostEqual(1.0, 1.0000000001)).to.be.false;

    const tolerance = 0.0001;
    expect(almostEqual(1.0, 1.0001, tolerance)).to.be.true;
    expect(almostEqual(1.0, 1.0002, tolerance)).to.be.false;
    expect(almostEqual(10000.01, 10000.02, tolerance)).to.be.true;
  });

  it("convertValue applies factor-only conversion", () => {
    expect(UnitConversions.convertValue(10, { factor: 2, offset: 0 })).toBe(20);
  });

  it("convertValue applies factor and offset conversion", () => {
    expect(UnitConversions.convertValue(10, { factor: 2, offset: 5 })).toBe(25);
  });

  it("convertValue applies pre-conversion inversion", () => {
    const result = UnitConversions.convertValue(2, {
      factor: 3,
      offset: 1,
      inversion: UnitConversionInvert.InvertPreConversion,
    });
    expect(result).toBeCloseTo(2.5);
  });

  it("convertValue applies post-conversion inversion", () => {
    const result = UnitConversions.convertValue(2, {
      factor: 3,
      offset: 1,
      inversion: UnitConversionInvert.InvertPostConversion,
    });
    expect(result).toBeCloseTo(1 / 7);
  });

  it("convertValue throws on invalid unit conversion metadata", () => {
    expect(() => UnitConversions.convertValue(10, { factor: 1, offset: 0, error: true })).toThrowError(QuantityError);

    let error: unknown;
    try {
      UnitConversions.convertValue(10, { factor: 1, offset: 0, error: true });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(QuantityError);
    expect((error as QuantityError).errorNumber).toBe(QuantityStatus.InvalidUnitConversion);
  });

  it("convertValue preserves ordinary zero conversions", () => {
    expect(UnitConversions.convertValue(0, { factor: 3.28084, offset: 0 })).toBe(0);
  });

  it("convertValue throws when pre-inversion would invert zero", () => {
    expect(() => UnitConversions.convertValue(0, {
      factor: 1,
      offset: 0,
      inversion: UnitConversionInvert.InvertPreConversion,
    })).toThrowError(QuantityError);
  });

  it("convertValue throws when post-inversion would invert a zero result", () => {
    expect(() => UnitConversions.convertValue(1, {
      factor: 0,
      offset: 0,
      inversion: UnitConversionInvert.InvertPostConversion,
    })).toThrowError(QuantityError);
  });

  it("applyConversion preserves existing behavior when conversion.error is true", () => {
    expect(applyConversion(10, { factor: 1, offset: 0, error: true })).toBe(10);
  });

  it("Quantity.convertTo throws on invalid unit conversion metadata", () => {
    const quantity = new Quantity({ name: UnitSchemaNames.Units.M, label: "m", phenomenon: UnitSchemaNames.Phenomena.LENGTH, isValid: true, system: UnitSchemaNames.UnitSystems.SI }, 10);

    let error: unknown;
    try {
      quantity.convertTo({ name: UnitSchemaNames.Units.S, label: "s", phenomenon: UnitSchemaNames.Phenomena.TIME, isValid: true, system: UnitSchemaNames.UnitSystems.SI }, { factor: 1, offset: 0, error: true });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(QuantityError);
    expect((error as QuantityError).errorNumber).toBe(QuantityStatus.InvalidUnitConversion);
    expect((error as QuantityError).message).toContain(UnitSchemaNames.Units.M);
    expect((error as QuantityError).message).toContain(UnitSchemaNames.Units.S);
  });

  it("UnitConversions.convert converts synchronously using built-in canonical units", () => {
    expect(UnitConversions.convert(UnitSchemaNames.Units.M, UnitSchemaNames.Units.FT, 1)).toBeCloseTo(3.28084, 5);
  });

  it("UnitConversions.getConversion supports repeated synchronous conversions", () => {
    const conversion = UnitConversions.getConversion(UnitSchemaNames.Units.M, UnitSchemaNames.Units.FT);
    expect(UnitConversions.convertValue(1, conversion)).toBeCloseTo(3.28084, 5);
    expect(UnitConversions.convertValue(2, conversion)).toBeCloseTo(6.56168, 5);
  });

  it("UnitConversions.getConversion returns error metadata for incompatible built-in units", () => {
    expect(UnitConversions.getConversion(UnitSchemaNames.Units.M, UnitSchemaNames.Units.S)).toEqual({ factor: 1, offset: 0, error: true });
  });

  it("UnitConversions.isCompatible returns true for compatible built-in units", () => {
    expect(UnitConversions.isCompatible(UnitSchemaNames.Units.M, UnitSchemaNames.Units.FT)).toBe(true);
  });

  it("UnitConversions.isCompatible returns false for incompatible built-in units", () => {
    expect(UnitConversions.isCompatible(UnitSchemaNames.Units.M, UnitSchemaNames.Units.S)).toBe(false);
  });

  it("UnitConversions.isCompatible throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.isCompatible("Units.DOES_NOT_EXIST", UnitSchemaNames.Units.FT)).toThrowError(QuantityError);
  });

  it("UnitConversions lookup helpers reject inherited object property names as unknown units", () => {
    for (const unitName of ["__proto__", "constructor", "toString"]) {
      for (const call of [
        () => UnitConversions.getConversion(unitName, UnitSchemaNames.Units.FT),
        () => UnitConversions.isCompatible(unitName, UnitSchemaNames.Units.FT),
        () => UnitConversions.convert(unitName, UnitSchemaNames.Units.FT, 1),
      ]) {
        let error: unknown;
        try {
          call();
        } catch (caught) {
          error = caught;
        }

        expect(error).toBeInstanceOf(QuantityError);
        expect((error as QuantityError).errorNumber).toBe(QuantityStatus.UnknownUnit);
      }
    }
  });

  it("generated basic conversion data covers every bundled Unit and InvertedUnit item", () => {
    expect(Object.keys(basicUnitConversionData).sort((a, b) => a.localeCompare(b))).toEqual(expectedBuiltInConversionUnitNames());
  });

  it("generated basic conversion data matches provider-backed conversions across bundled units", async () => {
    const provider = new BasicUnitsProvider();
    const anchorsByPhenomenon = new Map<string, string>();

    for (const [unitName, entry] of Object.entries(basicUnitConversionData)) {
      if (!entry[3] && !anchorsByPhenomenon.has(entry[0]))
        anchorsByPhenomenon.set(entry[0], unitName);
    }

    for (const [unitName, entry] of Object.entries(basicUnitConversionData)) {
      const anchorName = anchorsByPhenomenon.get(entry[0]) ?? unitName;
      const [fromUnit, toUnit] = await Promise.all([
        provider.findUnitByName(unitName),
        provider.findUnitByName(anchorName),
      ]);

      const actual = UnitConversions.getConversion(unitName, anchorName);
      const expected = await provider.getConversion(fromUnit, toUnit);
      expect(actual.inversion).toBe(expected.inversion);
      expect(actual.error).toBe(expected.error);
      expect(almostEqual(UnitConversions.convertValue(1.2345, actual), UnitConversions.convertValue(1.2345, expected), 1e-15)).toBe(true);
      expect(almostEqual(UnitConversions.convertValue(9876.54321, actual), UnitConversions.convertValue(9876.54321, expected), 1e-15)).toBe(true);
    }
  });

  it("UnitConversions.convert preserves ordinary zero conversions", () => {
    expect(UnitConversions.convert(UnitSchemaNames.Units.FT, UnitSchemaNames.Units.M, 0)).toBe(0);
  });

  it("UnitConversions.getConversion throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.getConversion("Units.DOES_NOT_EXIST", UnitSchemaNames.Units.FT))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convert throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.convert("Units.DOES_NOT_EXIST", UnitSchemaNames.Units.FT, 1))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convert throws for invalid built-in conversions with both unit names", () => {
    let error: unknown;
    try {
      UnitConversions.convert(UnitSchemaNames.Units.M, UnitSchemaNames.Units.S, 1);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(QuantityError);
    expect((error as QuantityError).errorNumber).toBe(QuantityStatus.InvalidUnitConversion);
    expect((error as QuantityError).message).toContain(UnitSchemaNames.Units.M);
    expect((error as QuantityError).message).toContain(UnitSchemaNames.Units.S);
  });
});
