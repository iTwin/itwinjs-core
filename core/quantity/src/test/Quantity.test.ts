/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { QuantityError, QuantityStatus } from "../Exception";
import { UnitConversionInvert } from "../Interfaces";
import { Phenomena, type UnitName, Units, UnitSystems } from "../generated/Units.generated";
import { basicUnitConversionData } from "../internal/BasicUnitConversions.generated";
import { _testResetResolvedBasicUnitsDataCache, resolveBasicUnitsData } from "../internal/BasicUnitsResolvedStateCache";
import { almostEqual, applyConversion, Quantity } from "../Quantity";
import type { SerializedUnitSchema } from "../SerializedUnitSchema";
import { isUnitName, UnitConversions } from "../UnitConversions";

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
    const quantity = new Quantity({ name: Units.LENGTH.M, label: "m", phenomenon: Phenomena.LENGTH, isValid: true, system: UnitSystems.SI }, 10);

    let error: unknown;
    try {
      quantity.convertTo({ name: Units.TIME.S, label: "s", phenomenon: Phenomena.TIME, isValid: true, system: UnitSystems.SI }, { factor: 1, offset: 0, error: true });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(QuantityError);
    expect((error as QuantityError).errorNumber).toBe(QuantityStatus.InvalidUnitConversion);
    expect((error as QuantityError).message).toContain(Units.LENGTH.M);
    expect((error as QuantityError).message).toContain(Units.TIME.S);
  });

  it("UnitConversions.convert converts synchronously using built-in canonical units", () => {
    expect(UnitConversions.convert(Units.LENGTH.M, Units.LENGTH.FT, 1)).toBeCloseTo(3.28084, 5);
  });

  it("UnitConversions.getConversion supports repeated synchronous conversions", () => {
    const conversion = UnitConversions.getConversion(Units.LENGTH.M, Units.LENGTH.FT);

    expect(UnitConversions.convertValue(1, conversion)).toBeCloseTo(3.28084, 5);
    expect(UnitConversions.convertValue(2, conversion)).toBeCloseTo(6.56168, 5);
  });

  it("UnitConversions.getConversion returns error metadata for incompatible built-in units", () => {
    expect(UnitConversions.getConversion(Units.LENGTH.M, Units.TIME.S)).toEqual({ factor: 1, offset: 0, error: true });
  });

  it("UnitConversions.isCompatible returns true for compatible built-in units", () => {
    expect(UnitConversions.isCompatible(Units.LENGTH.M, Units.LENGTH.FT)).toBe(true);
  });

  it("UnitConversions.isCompatible returns false for incompatible built-in units", () => {
    expect(UnitConversions.isCompatible(Units.LENGTH.M, Units.TIME.S)).toBe(false);
  });

  it("UnitConversions.isCompatible throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.isCompatible("Units.DOES_NOT_EXIST" as UnitName, Units.LENGTH.FT)).toThrowError(QuantityError);
  });

  it("UnitConversions lookup helpers reject inherited object property names as unknown units", () => {
    for (const unitName of ["__proto__", "constructor", "toString"]) {
      const unknownUnitName = unitName as UnitName;
      for (const call of [
        () => UnitConversions.getConversion(unknownUnitName, Units.LENGTH.FT),
        () => UnitConversions.isCompatible(unknownUnitName, Units.LENGTH.FT),
        () => UnitConversions.convert(unknownUnitName, Units.LENGTH.FT, 1),
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

  it("retries basic-units resolution after an initial load failure", async () => {
    _testResetResolvedBasicUnitsDataCache();

    let attempts = 0;
    const loadSchema = async (): Promise<SerializedUnitSchema> => {
      attempts += 1;
      if (attempts === 1)
        throw new Error("boom");
      return unitsSchema as SerializedUnitSchema;
    };

    await expect(resolveBasicUnitsData(loadSchema)).rejects.toThrow("boom");

    const resolved = await resolveBasicUnitsData(loadSchema);
    expect(resolved.schemaName).toBe(unitsSchema.name);
    expect(attempts).toBe(2);

    _testResetResolvedBasicUnitsDataCache();
  });

  it("generated basic conversion data matches provider-backed conversions for every bundled same-phenomenon unit pair", async () => {
    const provider = new BasicUnitsProvider();
    const resolvedUnits = new Map<string, Awaited<ReturnType<BasicUnitsProvider["findUnitByName"]>>>();
    const unitsByPhenomenon = new Map<string, string[]>();

    await Promise.all(Object.keys(basicUnitConversionData).map(async (unitName) => {
      resolvedUnits.set(unitName, await provider.findUnitByName(unitName));
    }));

    for (const [unitName, entry] of Object.entries(basicUnitConversionData)) {
      const byPhenomenon = unitsByPhenomenon.get(entry[0]) ?? [];
      byPhenomenon.push(unitName);
      unitsByPhenomenon.set(entry[0], byPhenomenon);
    }

    for (const unitNames of unitsByPhenomenon.values()) {
      for (const fromName of unitNames as UnitName[]) {
        for (const toName of unitNames as UnitName[]) {
          const actual = UnitConversions.getConversion(fromName, toName);
          const expected = await provider.getConversion(resolvedUnits.get(fromName)!, resolvedUnits.get(toName)!);
          expect(actual.inversion).toBe(expected.inversion);
          expect(actual.error).toBe(expected.error);
          expect(almostEqual(UnitConversions.convertValue(1.2345, actual), UnitConversions.convertValue(1.2345, expected), 1e-15)).toBe(true);
          expect(almostEqual(UnitConversions.convertValue(9876.54321, actual), UnitConversions.convertValue(9876.54321, expected), 1e-15)).toBe(true);
        }
      }
    }
  });

  it("UnitConversions.convert preserves ordinary zero conversions", () => {
    expect(UnitConversions.convert(Units.LENGTH.FT, Units.LENGTH.M, 0)).toBe(0);
  });

  it("UnitConversions.getConversion throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.getConversion("Units.DOES_NOT_EXIST" as UnitName, Units.LENGTH.FT))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convert throws for unknown built-in unit names", () => {
    expect(() => UnitConversions.convert("Units.DOES_NOT_EXIST" as UnitName, Units.LENGTH.FT, 1))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convert throws for invalid built-in conversions with both unit names", () => {
    let error: unknown;
    try {
      UnitConversions.convert(Units.LENGTH.M, Units.TIME.S, 1);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(QuantityError);
    expect((error as QuantityError).errorNumber).toBe(QuantityStatus.InvalidUnitConversion);
    expect((error as QuantityError).message).toContain(Units.LENGTH.M);
    expect((error as QuantityError).message).toContain(Units.TIME.S);
  });

  it("isUnitName narrows known built-in unit names and rejects unknown strings", () => {
    expect(isUnitName(Units.LENGTH.M)).toBe(true);
    expect(isUnitName("Units.FT")).toBe(true);
    expect(isUnitName("Units.NOT_A_UNIT")).toBe(false);
    expect(isUnitName("")).toBe(false);
    expect(isUnitName("hasOwnProperty")).toBe(false);
    expect(isUnitName("__proto__")).toBe(false);

    const dynamic: string = "Units.M";
    if (isUnitName(dynamic)) {
      // Narrowed to UnitName — safe to pass to getConversion without cast.
      const conversion = UnitConversions.getConversion(dynamic, Units.LENGTH.FT);
      expect(conversion.factor).toBeCloseTo(3.28084, 5);
    } else {
      throw new Error("expected isUnitName narrowing to succeed");
    }
  });
});
