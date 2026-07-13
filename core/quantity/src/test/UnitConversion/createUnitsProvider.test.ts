/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadUnit } from "../../Unit";
import { BasicUnitsProvider } from "../../BasicUnitsProvider";
import { createUnitsProvider } from "../../CompositeUnitsProvider";
import type { UnitConversionProps, UnitProps, UnitsProvider } from "../../Interfaces";

/** A lightweight stub implementing `UnitsProvider` for controlled tests. */
function makePrimaryStub(overrides: Partial<UnitsProvider> = {}): UnitsProvider {
  return {
    findUnit: async () => new BadUnit(),
    findUnitByName: async () => new BadUnit(),
    getUnitsByFamily: async () => [],
    getConversion: async () => ({ factor: 1, offset: 0 }),
    ...overrides,
  };
}

const VALID_UNIT: UnitProps = { name: "Custom.M", label: "m", phenomenon: "Units.LENGTH", isValid: true, system: "Units.SI" };
const VALID_UNIT2: UnitProps = { name: "Custom.FT", label: "ft", phenomenon: "Units.LENGTH", isValid: true, system: "Units.USCUSTOM" };
const PRIMARY_CONVERSION: UnitConversionProps = { factor: 2.0, offset: 0 };

describe("createUnitsProvider", () => {
  describe("no primary — identity shortcut", () => {
    it("returns a BasicUnitsProvider instance directly when no options supplied", () => {
      const provider = createUnitsProvider();
      expect(provider).toBeInstanceOf(BasicUnitsProvider);
    });

    it("returns a BasicUnitsProvider instance directly when options is empty object", () => {
      const provider = createUnitsProvider({});
      expect(provider).toBeInstanceOf(BasicUnitsProvider);
    });

    it("returns a BasicUnitsProvider instance directly when primary is undefined", () => {
      const provider = createUnitsProvider({ primary: undefined });
      expect(provider).toBeInstanceOf(BasicUnitsProvider);
    });

    it("resolves real units via the bundled data", async () => {
      const provider = createUnitsProvider();
      const unit = await provider.findUnitByName("Units.M");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
    });
  });

  describe("primary wins (default, bisUnitsPolicy: preferSchema)", () => {
    it("returns primary's unit when primary resolves", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnitByName: async () => VALID_UNIT }),
      });
      const unit = await provider.findUnitByName("Custom.M");
      expect(unit).toBe(VALID_UNIT);
    });

    it("returns primary's unit from findUnit", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnit: async () => VALID_UNIT }),
      });
      const unit = await provider.findUnit("m");
      expect(unit).toBe(VALID_UNIT);
    });

    it("falls back to basic when primary returns BadUnit from findUnitByName", async () => {
      const provider = createUnitsProvider({ primary: makePrimaryStub() });
      const unit = await provider.findUnitByName("Units.M");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
    });

    it("falls back to basic when primary throws from findUnitByName", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnitByName: async () => { throw new Error("schema error"); } }),
      });
      const unit = await provider.findUnitByName("Units.M");
      expect(unit.isValid).toBe(true);
      expect(unit.name).toBe("Units.M");
    });

    it("falls back to basic when primary returns BadUnit from findUnit", async () => {
      const provider = createUnitsProvider({ primary: makePrimaryStub() });
      const unit = await provider.findUnit("m");
      expect(unit.isValid).toBe(true);
    });

    it("falls back to basic when primary throws from findUnit", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnit: async () => { throw new Error("schema error"); } }),
      });
      const unit = await provider.findUnit("m");
      expect(unit.isValid).toBe(true);
    });

    it("uses primary conversion when primary succeeds", async () => {
      const from = VALID_UNIT;
      const to = VALID_UNIT2;
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getConversion: async () => PRIMARY_CONVERSION }),
      });
      const conv = await provider.getConversion(from, to);
      expect(conv.factor).toBe(2.0);
    });

    it("falls back to basic conversion when primary throws", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getConversion: async () => { throw new Error("no conversion"); } }),
      });
      const m = await provider.findUnitByName("Units.M");
      const ft = await provider.findUnitByName("Units.FT");
      const conv = await provider.getConversion(m, ft);
      expect(conv.factor).toBeCloseTo(3.28084, 3);
    });

    it("falls back to basic conversion when primary returns { error: true }", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getConversion: async () => ({ factor: 1, offset: 0, error: true }) }),
      });
      const m = await provider.findUnitByName("Units.M");
      const ft = await provider.findUnitByName("Units.FT");
      const conv = await provider.getConversion(m, ft);
      expect(conv.error).not.toBe(true);
      expect(conv.factor).toBeCloseTo(3.28084, 3);
    });
  });

  describe("bisUnitsPolicy: preferBundled", () => {
    it("basic wins when both providers define the unit", async () => {
      const primaryUnit: UnitProps = { name: "Units.M", label: "custom-m", phenomenon: "Units.LENGTH", isValid: true, system: "Units.SI" };
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnitByName: async () => primaryUnit }),
        bisUnitsPolicy: "preferBundled",
      });
      // basic units consulted first; basic has Units.M so basic's version wins
      const unit = await provider.findUnitByName("Units.M");
      expect(unit.label).toBe("m"); // basic provider label, not "custom-m"
    });

    it("primary is consulted when basic can't answer", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ findUnitByName: async () => VALID_UNIT }),
        bisUnitsPolicy: "preferBundled",
      });
      // "Custom.M" is not in BasicUnitsProvider, so it falls back to primary
      const unit = await provider.findUnitByName("Custom.M");
      expect(unit).toBe(VALID_UNIT);
    });

    it("falls back to primary conversion when basic returns { error: true } (cross-phenomenon)", async () => {
      // Basic returns error:true for cross-phenomenon; primary can handle it
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getConversion: async () => PRIMARY_CONVERSION }),
        bisUnitsPolicy: "preferBundled",
      });
      // Units from different phenomena — basic will return { error: true }
      const m = await provider.findUnitByName("Units.M");
      const celsius: UnitProps = { name: "Units.CELSIUS", label: "°C", phenomenon: "Units.TEMPERATURE", isValid: true, system: "Units.SI" };
      const conv = await provider.getConversion(m, celsius);
      // Basic can't convert LENGTH → TEMPERATURE, so primary's result should be used
      expect(conv.factor).toBe(2.0);
      expect(conv.error).not.toBe(true);
    });
  });

  describe("getUnitsByFamily — merge + dedupe", () => {
    it("returns merged list from both providers, deduped by name", async () => {
      // primary returns one unit that overlaps with basic
      const primaryUnit: UnitProps = { name: "Units.M", label: "custom-m", phenomenon: "Units.LENGTH", isValid: true, system: "Units.SI" };
      const extraUnit: UnitProps = { name: "Custom.MY_UNIT", label: "my", phenomenon: "Units.LENGTH", isValid: true, system: "Units.SI" };
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getUnitsByFamily: async () => [primaryUnit, extraUnit] }),
      });

      const units = await provider.getUnitsByFamily("Units.LENGTH");
      // primary's Units.M wins the dedupe (first-seen, primary is first by default)
      const mEntry = units.find((u) => u.name === "Units.M");
      expect(mEntry?.label).toBe("custom-m");
      // Extra unit from primary present
      expect(units.some((u) => u.name === "Custom.MY_UNIT")).toBe(true);
      // Basic units are included for names not in primary
      expect(units.some((u) => u.name === "Units.FT")).toBe(true);
    });

    it("with bisUnitsPolicy: preferBundled, basic's version of duplicate wins", async () => {
      const primaryUnit: UnitProps = { name: "Units.M", label: "custom-m", phenomenon: "Units.LENGTH", isValid: true, system: "Units.SI" };
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getUnitsByFamily: async () => [primaryUnit] }),
        bisUnitsPolicy: "preferBundled",
      });

      const units = await provider.getUnitsByFamily("Units.LENGTH");
      const mEntry = units.find((u) => u.name === "Units.M");
      expect(mEntry?.label).toBe("m"); // basic's label wins
    });

    it("returns basic results only when primary throws", async () => {
      const provider = createUnitsProvider({
        primary: makePrimaryStub({ getUnitsByFamily: async () => { throw new Error("schema error"); } }),
      });
      const units = await provider.getUnitsByFamily("Units.LENGTH");
      expect(units.length).toBeGreaterThan(5);
      expect(units.some((u) => u.name === "Units.M")).toBe(true);
    });

    it("returns empty array for unknown phenomenon when primary also returns nothing", async () => {
      const provider = createUnitsProvider({ primary: makePrimaryStub() });
      const units = await provider.getUnitsByFamily("Units.NONEXISTENT_PHENOMENON");
      expect(units).toHaveLength(0);
    });
  });

  describe("integration with real BasicUnitsProvider", () => {
    let provider: UnitsProvider;

    beforeEach(() => {
      // Primary throws for getConversion so the basic fallback is exercised
      provider = createUnitsProvider({
        primary: makePrimaryStub({
          getConversion: async () => { throw new Error("no conversion in stub"); },
        }),
      });
    });

    it("resolves real unit conversions through the basic fallback", async () => {
      const m = await provider.findUnitByName("Units.M");
      const ft = await provider.findUnitByName("Units.FT");
      expect(m.isValid).toBe(true);
      expect(ft.isValid).toBe(true);
      const conv = await provider.getConversion(m, ft);
      expect(conv.factor).toBeCloseTo(3.28084, 3);
    });

    it("primary is consulted first for findUnit before basic", async () => {
      const spy = vi.fn().mockResolvedValue(new BadUnit());
      const providerWithSpy = createUnitsProvider({ primary: makePrimaryStub({ findUnit: spy }) });
      await providerWithSpy.findUnit("m");
      expect(spy).toHaveBeenCalledWith("m", undefined, undefined, undefined);
    });
  });
});
