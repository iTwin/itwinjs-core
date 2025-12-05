/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { BasicUnit } from "../Unit";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { DecimalPrecision, FormatTraits } from "../core-quantity";

describe("Composite Formats tests:", () => {
  it("Bad Composite unit order", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "\"",
            name: "Units.IN",
          },
          {
            label: "'",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testEntry = { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2" };

    const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
    const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

    expect(() => Formatter.formatQuantity(testEntry.magnitude, spec)).to.throw("The Format test has a invalid unit specification.");
  });

  it("Bad Composite unit with offset", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.BOGUS.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testEntry = {
      magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2",
    };

    const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
    const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

    expect(() => Formatter.formatQuantity(testEntry.magnitude, spec)).toThrow("The Format test has a invalid unit specification.");
  });

  it("Single Composite with label override", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.5417'" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.5417'" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05'" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789'" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0'" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("Test FormatTrait combinations on trailing zeroes", async () => {
    const unitsProvider = new TestUnitsProvider();
    const unit = { name: "Units.M", label: "m", contextId: "Units.LENGTH" };

    const testQuantityData = [
      { testCaseNum: 1, keepSingleZero: false, keepDecimalPoint: false, trailZeroes: false, magnitude: 1, result: "1000 mm" },
      { testCaseNum: 2, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: false, magnitude: 1, result: "1000. mm" },
      { testCaseNum: 3, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: true, magnitude: 1, result: "1000.000000 mm" },
      { testCaseNum: 4, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: false, magnitude: 1, result: "1000 mm" },
      { testCaseNum: 5, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: true, magnitude: 1, result: "1000.000000 mm" },
      { testCaseNum: 6, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: false, magnitude: 1, result: "1000.0 mm" },
      { testCaseNum: 7, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: true, magnitude: 1, result: "1000.000000 mm" },

      { testCaseNum: 8, keepSingleZero: false, keepDecimalPoint: false, trailZeroes: false, magnitude: 0.0254, result: "25.4 mm" },
      { testCaseNum: 9, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: false, magnitude: 0.0254, result: "25.4 mm" },
      { testCaseNum: 10, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: true, magnitude: 0.0254, result: "25.400000 mm" },
      { testCaseNum: 11, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: false, magnitude: 0.0254, result: "25.4 mm" },
      { testCaseNum: 12, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: true, magnitude: 0.0254, result: "25.400000 mm" },
      { testCaseNum: 13, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: false, magnitude: 0.0254, result: "25.4 mm" },
      { testCaseNum: 14, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: true, magnitude: 0.0254, result: "25.400000 mm" },

      { testCaseNum: 15, keepSingleZero: false, keepDecimalPoint: false, trailZeroes: false, magnitude: 12.65, result: "12650 mm" },
      { testCaseNum: 16, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: false, magnitude: 12.65, result: "12650. mm" },
      { testCaseNum: 17, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: true, magnitude: 12.65, result: "12650.000000 mm" },
      { testCaseNum: 18, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: false, magnitude: 12.65, result: "12650 mm" },
      { testCaseNum: 19, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: true, magnitude: 12.65, result: "12650.000000 mm" },
      { testCaseNum: 20, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: false, magnitude: 12.65, result: "12650.0 mm" },
      { testCaseNum: 21, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: true, magnitude: 12.65, result: "12650.000000 mm" },

      { testCaseNum: 22, keepSingleZero: false, keepDecimalPoint: false, trailZeroes: false, magnitude: 0.00000, result: "0 mm" },
      { testCaseNum: 23, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: false, magnitude: 0.00000, result: "0. mm" },
      { testCaseNum: 24, keepSingleZero: false, keepDecimalPoint: true, trailZeroes: true, magnitude: 0.00000, result: "0.000000 mm" },
      { testCaseNum: 25, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: false, magnitude: 0.00000, result: "0 mm" },
      { testCaseNum: 26, keepSingleZero: true, keepDecimalPoint: false, trailZeroes: true, magnitude: 0.00000, result: "0.000000 mm" },
      { testCaseNum: 27, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: false, magnitude: 0.00000, result: "0.0 mm" },
      { testCaseNum: 28, keepSingleZero: true, keepDecimalPoint: true, trailZeroes: true, magnitude: 0.00000, result: "0.000000 mm" },
    ];

    for (const testEntry of testQuantityData) {
      const formatData = {
        composite: {
          spacer: " ",
          units: [
            {
              label: "mm",
              name: "Units.MM",
              contextId: "Units.LENGTH",
            },
          ],
        },
        formatTraits: ["showUnitLabel"],
        precision: 6,
        type: "Decimal",
      };

      if (testEntry.keepSingleZero)
        formatData.formatTraits.push("keepSingleZero");
      if (testEntry.keepDecimalPoint)
        formatData.formatTraits.push("keepDecimalPoint");
      if (testEntry.trailZeroes)
        formatData.formatTraits.push("trailZeroes");

      const format = new Format("test");
      await format.fromJSON(unitsProvider, formatData);
      expect(format.hasUnits).to.be.true;
      expect(format.hasFormatTraitSet(FormatTraits.KeepSingleZero)).toEqual(testEntry.keepSingleZero);
      expect(format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint)).toEqual(testEntry.keepDecimalPoint);
      expect(format.hasFormatTraitSet(FormatTraits.TrailZeroes)).toEqual(testEntry.trailZeroes);

      const spec = await FormatterSpec.create("test", format, unitsProvider, new BasicUnit(unit.name, unit.label, unit.contextId));
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });

  it("FT-IN Composite - quantity in FT", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12'-6 1/2\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12'-6 1/2\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1'-0 5/8\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789'-0\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0'-0\"" },
      { magnitude: 11.9999999999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("FT-IN Composite (no labels)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: ":",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12:6 1/2" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1:0 5/8" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789:0" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0:0" },
      { magnitude: 11.9999999999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:0" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("IN Composite - quantity in FT", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150 1/2\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150 1/2\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12 5/8\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0\"" },
      { magnitude: 11.9999999999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "144\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("IN Composite - quantity in FT w/default unit label", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: " ",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150 1/2 in" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150 1/2 in" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12 5/8 in" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468 in" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0 in" },
      { magnitude: 11.9999999999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "144 in" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("Inches Composite (decimal) - quantity in FT", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["showUnitLabel", "zeroEmpty"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150.5\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150.5\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.6\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "" },
      { magnitude: 11.9999999999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "144\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("FT-IN Composite - quantity in Meters", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "-3'-3 3/8\"" },
      { magnitude: 1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "3'-3 3/8\"" },
      { magnitude: 0.0254, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-1\"" },
      { magnitude: 12.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "41'-6\"" },
      { magnitude: 0.00000, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

  it("FT-IN Composite (decimal) - quantity in Meters", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 3,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: -1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "-3'-3.37\"" },
      { magnitude: 1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "3'-3.37\"" },
      { magnitude: 0.0254, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-1\"" },
      { magnitude: 12.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "41'-6.031\"" },
      { magnitude: 0.00000, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });

  it("Rad to Degrees (precision 8)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "�",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30.27146435�" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153.10973366�" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });

  it("Rad to Degrees (precision 0)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "�",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30.0�" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153.0�" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });

  it("Rad to DMS (precision 8)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "�",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30�16'17.27166\"" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153�6'35.041176\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });
  it("Rad to DMS (precision 3)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "�",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 3,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30�16'17.272\"" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153�6'35.041\"" },
      { magnitude: Math.PI, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "180�0'0\"" },
      { magnitude: Math.PI / 2, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "90�0'0\"" },
      { magnitude: Math.PI / 6, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30�0'0\"" },
      { magnitude: Math.PI / 4, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "45�0'0\"" },
      { magnitude: 2 * Math.PI, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "360�0'0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).to.be.eql(testEntry.result);
      expect(formattedValue.length).toBeGreaterThan(0);
    }
  });

  it("Composite Format with empty and unset labels", async () => {
    const unitsProvider = new TestUnitsProvider();

    const compositeFormat = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ name: "Units.KM" }, { name: "Units.M", label: "" }, { name: "Units.CM", label: "CM" }, { name: "Units.MM", label: "'" }],
      },
      formatTraits: ["keepSingleZero", "applyRounding"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    };
    const format = new Format("test");
    expect(format).toBeDefined();

    await format.fromJSON(unitsProvider, compositeFormat);
    expect(JSON.stringify(format.toJSON().composite)).to.eql(`{"spacer":"","includeZero":true,"units":[{"name":"Units.KM"},{"name":"Units.M","label":""},{"name":"Units.CM","label":"CM"},{"name":"Units.MM","label":"'"}]}`);
  });

  it("Test roundFactor with Composite Format", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["applyRounding"],
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    expect(format.hasUnits).toBe(true);

    const testQuantityData = [
      { magnitude: 1, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0, result: "1" },
      { magnitude: 1, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.5, result: "1" },
      { magnitude: 1, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.1, result: "1" },
      { magnitude: 1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.1, result: "1.2" },
      { magnitude: 1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.05, precision: 1, result: "1.3" }, // apply rounding but precision is higher

      { magnitude: 1, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.6, result: "1.2" },
      { magnitude: 1, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.3, result: "0.9" },


      { magnitude: 987.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 100, result: "1000" },
      { magnitude: 987.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 1000, result: "1000" },
      { magnitude: 987.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 2000, result: "0" },

      // negative value
      { magnitude: -1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.1, result: "-1.2" },
      { magnitude: -1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: -0.5, result: "-1" },
      { magnitude: -1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: 0.5, result: "-1" },
      { magnitude: 1.23, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, roundFactor: -0.5, result: "1" }, // TODO: should this one give an error?

      // with unit conversion
      { magnitude: 1, unit: { name: "Units.IN", label: "in", contextId: "Units.LENGTH" }, result: "0.0254" }, // round factor defaults to 0
      { magnitude: 1, unit: { name: "Units.IN", label: "in", contextId: "Units.LENGTH" }, roundFactor: 0.5, result: "0" },
      { magnitude: 1, unit: { name: "Units.IN", label: "in", contextId: "Units.LENGTH" }, roundFactor: 0.01, result: "0.03" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      if (testEntry.roundFactor)
        format.roundFactor = testEntry.roundFactor;
      if (testEntry.precision)
        format.precision = testEntry.precision;
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);

      expect(formattedValue.length).toBeGreaterThan(0);
      expect(formattedValue).toBe(testEntry.result);

      // reset format back to default
      format.roundFactor = 0.0;
      format.precision = DecimalPrecision.Six;
    }
  });

  it("Fractional composite rounding with carry-over to parent unit", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      // Cases where rounding SHOULD trigger carry-over (11.999+ inches rounds to 12" = 1')
      { magnitude: 17.9999999, result: "18'-0\"", description: "17.9999999 ft rounds up to 18'" },
      { magnitude: 11.9999999, result: "12'-0\"", description: "11.9999999 ft rounds up to 12'" },
      { magnitude: 5.9999999, result: "6'-0\"", description: "5.9999999 ft rounds up to 6'" },
      { magnitude: 0.9999999, result: "1'-0\"", description: "0.9999999 ft rounds up to 1'" },
      { magnitude: 1.9999999, result: "2'-0\"", description: "1.9999999 ft rounds up to 2'" },

      // Cases where rounding should NOT trigger carry-over
      { magnitude: 17.99, result: "17'-11 7/8\"", description: "17.99 ft stays as 17'-11 7/8\"" },
      { magnitude: 17.5, result: "17'-6\"", description: "17.5 ft stays as 17'-6\"" },
      { magnitude: 17.0, result: "17'-0\"", description: "17.0 ft exact" },
      { magnitude: 11.95, result: "11'-11 3/8\"", description: "11.95 ft stays as 11'-11 3/8\"" },
      { magnitude: 0.5, result: "0'-6\"", description: "0.5 ft stays as 0'-6\"" },

      // Edge cases with small values that shouldn't carry over
      { magnitude: 0.083333333, result: "0'-1\"", description: "exactly 1 inch" },
      { magnitude: 0.916666666, result: "0'-11\"", description: "exactly 11 inches" },

      // Negative values with carry-over
      { magnitude: -17.9999999, result: "-18'-0\"", description: "negative value with carry-over" },
      { magnitude: -0.9999999, result: "-1'-0\"", description: "negative fraction with carry-over" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit("Units.FT", "ft", "Units.LENGTH");
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).to.be.equal(testEntry.result);
    }
  });

  it("Fractional composite rounding with DMS (degrees-minutes-seconds)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      // Cases where rounding SHOULD trigger carry-over (59.999+ seconds rounds to 60" = 1')
      { magnitude: 0.016666666, result: "0°1'0\"", description: "0.0166666... degrees (59.999... seconds rounds to 1 minute)" },
      { magnitude: 0.5166666666, result: "0°31'0\"", description: "seconds round to full minute" },

      // Cases where rounding should NOT trigger carry-over
      { magnitude: 0.516, result: "0°30'57 5/8\"", description: "normal rounding without carry-over" },
      { magnitude: 0.5, result: "0°30'0\"", description: "exact half degree" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit("Units.ARC_DEG", "°", "Units.ANGLE");
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).to.be.equal(testEntry.result);
    }
  });

  it("Decimal composite should NOT use fractional carry-over logic", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      // Decimal format doesn't use the fractional carry-over logic
      { magnitude: 17.9999999, result: "17'-12\"", description: "decimal format rounds 17.999... inches to 12 without carry-over" },
      { magnitude: 17.99, result: "17'-11.88\"", description: "decimal format normal rounding" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit("Units.FT", "ft", "Units.LENGTH");
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).to.be.equal(testEntry.result);
    }
  });

  it("FT-IN Composite with highest precision (12)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel", "trailZeroes"],
      precision: 12,
      type: "Decimal",
      uomSeparator: "",
    };

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);
    expect(format.hasUnits).to.be.true;

    const testQuantityData = [
      { magnitude: 1.0, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1'-0.000000000000\"" },
      { magnitude: 1.5, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1'-6.000000000000\"" },
      { magnitude: Math.PI, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "3'-1.699111843080\"" },
      { magnitude: 0.123456789012, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0'-1.481481468144\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      expect(formattedValue).toEqual(testEntry.result);
    }
  });

});
