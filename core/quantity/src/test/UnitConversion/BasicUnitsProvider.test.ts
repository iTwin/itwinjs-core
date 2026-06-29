/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { BasicUnitsProvider } from "../../BasicUnitsProvider";

describe("BasicUnitsProvider", () => {
  const provider = new BasicUnitsProvider();

  describe("findUnitByName", () => {
    it("finds meter by qualified name", async () => {
      const unit = await provider.findUnitByName("Units.M");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
      expect(unit.label).toBe("m");
    });

    it("finds foot by qualified name", async () => {
      const unit = await provider.findUnitByName("Units.FT");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.FT");
    });

    it("returns invalid for unknown name", async () => {
      const unit = await provider.findUnitByName("Units.NONEXISTENT");
      expect(unit.isValid).toBe(false);
    });
  });

  describe("findUnit", () => {
    it("finds unit by label", async () => {
      const unit = await provider.findUnit("m");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
    });

    it("finds unit by label case-insensitively", async () => {
      const unit = await provider.findUnit("M");
      expect(unit.isValid).toBe(true);
    });

    it("filters by phenomenon", async () => {
      const unit = await provider.findUnit("ft", undefined, "Units.LENGTH");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.FT");
    });

    it("returns BadUnit when schemaName is provided and is not 'Units'", async () => {
      const unit = await provider.findUnit("m", "NonExistentSchema");
      expect(unit.isValid).toBe(false);
    });

    it("succeeds when schemaName is 'Units'", async () => {
      const unit = await provider.findUnit("m", "Units");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
    });

    it("returns invalid for unknown label", async () => {
      const unit = await provider.findUnit("nonexistent_unit_xyz");
      expect(unit.isValid).toBe(false);
    });
  });

  describe("getUnitsByFamily", () => {
    it("returns length units", async () => {
      const units = await provider.getUnitsByFamily("Units.LENGTH");
      expect(units.length).toBeGreaterThan(5);
      expect(units.some((u) => u.name === "Units.M")).toBe(true);
      expect(units.some((u) => u.name === "Units.FT")).toBe(true);
    });

    it("returns empty array for unknown phenomenon", async () => {
      const units = await provider.getUnitsByFamily("u:NONEXISTENT");
      expect(units).toHaveLength(0);
    });
  });

  describe("getConversion", () => {
    it("converts meters to feet", async () => {
      const m = await provider.findUnitByName("Units.M");
      const ft = await provider.findUnitByName("Units.FT");
      const conv = await provider.getConversion(m, ft);
      // 1 M = 3.28084 FT
      expect(conv.factor * 1 + conv.offset).toBeCloseTo(3.28084, 3);
    });

    it("converts feet to meters", async () => {
      const ft = await provider.findUnitByName("Units.FT");
      const m = await provider.findUnitByName("Units.M");
      const conv = await provider.getConversion(ft, m);
      // 1 FT = 0.3048 M
      expect(conv.factor * 1 + conv.offset).toBeCloseTo(0.3048, 4);
    });

    it("converts Celsius to Fahrenheit", async () => {
      const c = await provider.findUnitByName("Units.CELSIUS");
      const f = await provider.findUnitByName("Units.FAHRENHEIT");
      const conv = await provider.getConversion(c, f);
      // 0°C = 32°F
      expect(conv.factor * 0 + conv.offset).toBeCloseTo(32, 1);
      // 100°C = 212°F
      expect(conv.factor * 100 + conv.offset).toBeCloseTo(212, 1);
    });

    it("converts Kelvin to Celsius", async () => {
      const k = await provider.findUnitByName("Units.K");
      const c = await provider.findUnitByName("Units.CELSIUS");
      const conv = await provider.getConversion(k, c);
      // 273.15 K = 0°C
      expect(conv.factor * 273.15 + conv.offset).toBeCloseTo(0, 1);
    });

    it("identity conversion (same unit)", async () => {
      const m = await provider.findUnitByName("Units.M");
      const conv = await provider.getConversion(m, m);
      expect(conv.factor).toBeCloseTo(1.0);
      expect(conv.offset).toBeCloseTo(0.0);
    });

    it("converts degrees to radians", async () => {
      const deg = await provider.findUnitByName("Units.ARC_DEG");
      const rad = await provider.findUnitByName("Units.RAD");
      const conv = await provider.getConversion(deg, rad);
      // 180 DEG = PI RAD
      expect(conv.factor * 180 + conv.offset).toBeCloseTo(Math.PI, 6);
    });

    it("converts square meters to square feet", async () => {
      const sqm = await provider.findUnitByName("Units.SQ_M");
      const sqft = await provider.findUnitByName("Units.SQ_FT");
      const conv = await provider.getConversion(sqm, sqft);
      // 1 SQ_M = 10.7639 SQ_FT
      expect(conv.factor * 1 + conv.offset).toBeCloseTo(10.7639, 3);
    });
  });

  describe("inverted units", () => {
    it("finds inverted unit by name", async () => {
      const unit = await provider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
      expect(unit.isValid).toBe(true);
    });

    it("converts between inverted and non-inverted units", async () => {
      const horizontal = await provider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
      const vertical = await provider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
      // These are inverses of each other
      expect(horizontal.isValid).toBe(true);
      expect(vertical.isValid).toBe(true);
      const conv = await provider.getConversion(horizontal, vertical);
      // Should have inversion set
      expect(conv.inversion).toBeDefined();
    });

    it("converts between two inverted units (both-inverted path)", async () => {
      // HORIZONTAL_PER_VERTICAL inverts VERTICAL_PER_HORIZONTAL (m/m slope)
      // FT_HORIZONTAL_PER_FT_VERTICAL inverts FT_PER_FT (ft/ft slope)
      const hpv = await provider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
      const ftHpv = await provider.findUnitByName("Units.FT_HORIZONTAL_PER_FT_VERTICAL");
      expect(hpv.isValid).toBe(true);
      expect(ftHpv.isValid).toBe(true);
      // Both are InvertedUnit items — this exercises the "both inverted" branch
      const conv = await provider.getConversion(hpv, ftHpv);
      expect(conv.factor).toBeDefined();
      expect(conv.offset).toBeDefined();
      // Both are dimensionless slope ratios, so the conversion factor should be ~1.0
      expect(conv.factor).toBeCloseTo(1.0, 5);
      expect(conv.offset).toBeCloseTo(0.0, 5);
      // No inversion flag expected — both inversions cancel out in the "both inverted" path
      expect(conv.inversion).toBeUndefined();
    });

    it("rejects cross-phenomenon conversions with error flag", async () => {
      const metre = await provider.findUnitByName("Units.M");
      const second = await provider.findUnitByName("Units.S");
      expect(metre.isValid).toBe(true);
      expect(second.isValid).toBe(true);
      const conv = await provider.getConversion(metre, second);
      expect(conv.error).toBe(true);
      expect(conv.factor).toBe(1.0);
      expect(conv.offset).toBe(0.0);
    });
  });
});
