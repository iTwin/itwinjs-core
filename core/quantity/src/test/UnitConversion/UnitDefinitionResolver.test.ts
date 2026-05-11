/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { UnitDefinitionResolver } from "../../UnitConversion/UnitDefinitionResolver";
import type { SerializedUnitSchema } from "../../SerializedUnitSchema";

// Load the real bundled schema
// eslint-disable-next-line @typescript-eslint/no-require-imports
const unitsSchema: SerializedUnitSchema = require("../../assets/Units.json");

describe("UnitDefinitionResolver", () => {
  const resolver = new UnitDefinitionResolver(unitsSchema);
  const resolved = resolver.resolveAll();

  // BIS Units schema v01.00.09 — update this constant when sourceEcSchemaVersion in Units.json changes
  const EXPECTED_UNIT_COUNT = 492;

  it(`resolves all ${EXPECTED_UNIT_COUNT} units`, () => {
    expect(resolved.size).toBe(EXPECTED_UNIT_COUNT);
  });

  it("base unit M resolves to identity", () => {
    const m = resolved.get("M");
    expect(m).toBeDefined();
    expect(m!.conversion.factor).toBeCloseTo(1.0);
    expect(m!.conversion.offset).toBeCloseTo(0.0);
  });

  it("IN resolves correctly (1 IN = 0.0254 M)", () => {
    const inch = resolved.get("IN");
    const m = resolved.get("M");
    expect(inch).toBeDefined();
    expect(m).toBeDefined();
    // conversion maps base(M) → unit. So inch.conversion.evaluate(0.0254) should ≈ 1.
    // inverse(inch).compose(m) gives IN → M
    const inToM = inch!.conversion.inverse().compose(m!.conversion);
    expect(inToM.evaluate(1)).toBeCloseTo(0.0254, 6);
  });

  it("FT resolves correctly (1 FT = 0.3048 M)", () => {
    const ft = resolved.get("FT");
    const m = resolved.get("M");
    expect(ft).toBeDefined();
    expect(m).toBeDefined();
    const ftToM = ft!.conversion.inverse().compose(m!.conversion);
    expect(ftToM.evaluate(1)).toBeCloseTo(0.3048, 6);
  });

  it("temperature conversions: CELSIUS to FAHRENHEIT", () => {
    const celsius = resolved.get("CELSIUS");
    const fahrenheit = resolved.get("FAHRENHEIT");
    expect(celsius).toBeDefined();
    expect(fahrenheit).toBeDefined();

    const cToF = celsius!.conversion.inverse().compose(fahrenheit!.conversion);
    // 0°C = 32°F
    expect(cToF.evaluate(0)).toBeCloseTo(32, 1);
    // 100°C = 212°F
    expect(cToF.evaluate(100)).toBeCloseTo(212, 1);
    // -40°C = -40°F
    expect(cToF.evaluate(-40)).toBeCloseTo(-40, 1);
  });

  it("temperature conversions: KELVIN to CELSIUS", () => {
    const k = resolved.get("K");
    const celsius = resolved.get("CELSIUS");
    expect(k).toBeDefined();
    expect(celsius).toBeDefined();

    const kToC = k!.conversion.inverse().compose(celsius!.conversion);
    // 273.15 K = 0°C
    expect(kToC.evaluate(273.15)).toBeCloseTo(0, 1);
    // 0 K = -273.15°C
    expect(kToC.evaluate(0)).toBeCloseTo(-273.15, 1);
  });

  it("compound unit: SQ_FT resolves correctly", () => {
    const sqft = resolved.get("SQ_FT");
    const sqm = resolved.get("SQ_M");
    expect(sqft).toBeDefined();
    expect(sqm).toBeDefined();

    // sqft → sqm: 1 SQ_FT = 0.0929 SQ_M
    const sqftToSqm = sqft!.conversion.inverse().compose(sqm!.conversion);
    expect(sqftToSqm.evaluate(1)).toBeCloseTo(0.09290304, 6);
  });

  it("constant-based unit: ARC_DEG resolves correctly", () => {
    const deg = resolved.get("ARC_DEG");
    const rad = resolved.get("RAD");
    expect(deg).toBeDefined();
    expect(rad).toBeDefined();

    const degToRad = deg!.conversion.inverse().compose(rad!.conversion);
    // 180 DEG = PI RAD
    expect(degToRad.evaluate(180)).toBeCloseTo(Math.PI, 6);
  });

  it("all resolved conversions have finite factor and offset", () => {
    for (const [name, entry] of resolved) {
      expect(Number.isFinite(entry.conversion.factor), `${name} has non-finite factor: ${entry.conversion.factor}`).toBe(true);
      expect(Number.isFinite(entry.conversion.offset), `${name} has non-finite offset: ${entry.conversion.offset}`).toBe(true);
    }
  });
});
