/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { QuantityError, QuantityStatus } from "../Exception";
import { UnitConversionInvert } from "../Interfaces";
import { basicUnitConversionData } from "../internal/BasicUnitConversions.generated";
import { UnitSchemaNames } from "../generated/Units.generated";
import { almostEqual, applyConversion, Quantity } from "../Quantity";
import { UnitConversions } from "../UnitConversions";

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
    expect(() => quantity.convertTo({ name: UnitSchemaNames.Units.S, label: "s", phenomenon: UnitSchemaNames.Phenomena.TIME, isValid: true, system: UnitSchemaNames.UnitSystems.SI }, { factor: 1, offset: 0, error: true }))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convert resolves unit name strings and converts asynchronously", async () => {
    const provider = new BasicUnitsProvider();
    const value = await UnitConversions.convert(
      provider,
      UnitSchemaNames.Units.M,
      UnitSchemaNames.Units.FT,
      1,
    );
    expect(value).toBeCloseTo(3.28084, 5);
  });

  it("UnitConversions.getConversion accepts resolved UnitProps for repeated conversions", async () => {
    const provider = new BasicUnitsProvider();
    const from = await provider.findUnitByName(UnitSchemaNames.Units.M);
    const to = await provider.findUnitByName(UnitSchemaNames.Units.FT);
    const conversion = await UnitConversions.getConversion(provider, from, to);
    expect(UnitConversions.convertValue(1, conversion)).toBeCloseTo(3.28084, 5);
    expect(UnitConversions.convertValue(2, conversion)).toBeCloseTo(6.56168, 5);
  });

  it("UnitConversions.convert throws for unknown provider-backed unit names", async () => {
    const provider = new BasicUnitsProvider();
    await expect(UnitConversions.convert(provider, "Units.DOES_NOT_EXIST", UnitSchemaNames.Units.FT, 1))
      .rejects.toThrowError(QuantityError);
  });

  it("UnitConversions.convert throws for invalid provider-backed conversions", async () => {
    const provider = new BasicUnitsProvider();
    await expect(UnitConversions.convert(provider, UnitSchemaNames.Units.M, UnitSchemaNames.Units.S, 1))
      .rejects.toThrowError(QuantityError);
  });

  it("UnitConversions.convertBasic converts synchronously using built-in basic units", () => {
    expect(UnitConversions.convertBasic(UnitSchemaNames.Units.M, UnitSchemaNames.Units.FT, 1)).toBeCloseTo(3.28084, 5);
  });

  it("UnitConversions.getBasicConversion supports repeated synchronous conversions", () => {
    const conversion = UnitConversions.getBasicConversion(UnitSchemaNames.Units.M, UnitSchemaNames.Units.FT);
    expect(UnitConversions.convertValue(1, conversion)).toBeCloseTo(3.28084, 5);
    expect(UnitConversions.convertValue(2, conversion)).toBeCloseTo(6.56168, 5);
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

      const actual = UnitConversions.getBasicConversion(unitName, anchorName);
      const expected = await provider.getConversion(fromUnit, toUnit);
      expect(actual.inversion).toBe(expected.inversion);
      expect(actual.error).toBe(expected.error);
      expect(almostEqual(UnitConversions.convertValue(1.2345, actual), UnitConversions.convertValue(1.2345, expected), 1e-15)).toBe(true);
      expect(almostEqual(UnitConversions.convertValue(9876.54321, actual), UnitConversions.convertValue(9876.54321, expected), 1e-15)).toBe(true);
    }
  });

  it("UnitConversions.convertBasic preserves ordinary zero conversions", () => {
    expect(UnitConversions.convertBasic(UnitSchemaNames.Units.FT, UnitSchemaNames.Units.M, 0)).toBe(0);
  });

  it("UnitConversions.convertBasic throws for unknown basic unit names", () => {
    expect(() => UnitConversions.convertBasic("Units.DOES_NOT_EXIST", UnitSchemaNames.Units.FT, 1))
      .toThrowError(QuantityError);
  });

  it("UnitConversions.convertBasic throws for invalid basic conversions", () => {
    expect(() => UnitConversions.convertBasic(UnitSchemaNames.Units.M, UnitSchemaNames.Units.S, 1))
      .toThrowError(QuantityError);
  });
});
