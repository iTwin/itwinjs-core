/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { UnitConversion, type UnitConversionSource } from "../../UnitConversion/UnitConversion";

describe("UnitConversion", () => {
  describe("evaluate", () => {
    it("identity returns same value", () => {
      expect(UnitConversion.identity.evaluate(42)).toBe(42);
    });

    it("applies factor and offset", () => {
      const conv = new UnitConversion(2.0, 5.0);
      expect(conv.evaluate(10)).toBe(25);
    });
  });

  describe("inverse", () => {
    it("inverts factor and offset", () => {
      const conv = new UnitConversion(2.0, 10.0);
      const inv = conv.inverse();
      expect(inv.factor).toBeCloseTo(0.5);
      expect(inv.offset).toBeCloseTo(-5.0);
    });

    it("round-trips through compose", () => {
      const conv = new UnitConversion(3.0, 7.0);
      const roundTrip = conv.inverse().compose(conv);
      expect(roundTrip.evaluate(100)).toBeCloseTo(100);
    });
  });

  describe("compose", () => {
    it("chains two conversions", () => {
      const a = new UnitConversion(2.0, 0.0);
      const b = new UnitConversion(3.0, 0.0);
      const c = a.compose(b);
      expect(c.factor).toBeCloseTo(6.0);
      expect(c.offset).toBeCloseTo(0.0);
    });

    it("chains with offset", () => {
      const kToC = new UnitConversion(1.0, -273.15); // K → C
      const cToF = new UnitConversion(9 / 5, 32); // C → F
      const kToF = kToC.compose(cToF);
      // 0 K → -273.15 C → -459.67 F
      expect(kToF.evaluate(0)).toBeCloseTo(-459.67, 1);
    });
  });

  describe("multiply", () => {
    it("multiplies factors when offsets are zero", () => {
      const a = new UnitConversion(2.0, 0.0);
      const b = new UnitConversion(3.0, 0.0);
      expect(a.multiply(b).factor).toBeCloseTo(6.0);
    });

    it("throws when offset is non-zero", () => {
      const a = new UnitConversion(2.0, 1.0);
      const b = new UnitConversion(3.0, 0.0);
      expect(() => a.multiply(b)).toThrow();
    });
  });

  describe("raise", () => {
    it("power of 1 returns same", () => {
      const conv = new UnitConversion(5.0, 0.0);
      expect(conv.raise(1).factor).toBeCloseTo(5.0);
    });

    it("power of 0 returns identity", () => {
      const conv = new UnitConversion(5.0, 0.0);
      const r = conv.raise(0);
      expect(r.factor).toBeCloseTo(1.0);
      expect(r.offset).toBeCloseTo(0.0);
    });

    it("raises factor to power", () => {
      const conv = new UnitConversion(2.0, 0.0);
      expect(conv.raise(3).factor).toBeCloseTo(8.0);
    });

    it("negative exponent", () => {
      const conv = new UnitConversion(10.0, 0.0);
      expect(conv.raise(-2).factor).toBeCloseTo(0.01);
    });

    it("throws on non-zero offset with power != 0,1", () => {
      const conv = new UnitConversion(2.0, 1.0);
      expect(() => conv.raise(2)).toThrow();
    });
  });

  describe("from", () => {
    it("creates from UnitConversionSource with numerator/denominator", () => {
      const src: UnitConversionSource = { numerator: 25.4, denominator: 1 };
      const conv = UnitConversion.from(src);
      expect(conv.factor).toBeCloseTo(1 / 25.4);
      expect(conv.offset).toBeCloseTo(0);
    });

    it("creates from source with offset", () => {
      const src: UnitConversionSource = { numerator: 1, denominator: 1, offset: 273.15 };
      const conv = UnitConversion.from(src);
      expect(conv.factor).toBeCloseTo(1.0);
      expect(conv.offset).toBeCloseTo(-273.15);
    });

    it("structurally accepts EC-like objects", () => {
      // Simulates EC Unit shape
      const fakeUnit = { numerator: 12, denominator: 1, offset: 0, name: "FT", definition: "IN" };
      const conv = UnitConversion.from(fakeUnit);
      expect(conv.factor).toBeCloseTo(1 / 12);
    });
  });
});
