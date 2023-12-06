/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { BasicUnit } from "../Unit";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatTraits } from "../core-quantity";

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

    try {
      const format = new Format("test");
      await format.fromJSON(unitsProvider, formatData).catch(() => { });
      assert.isTrue(format.hasUnits);

      const testEntry = { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2" };

      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(false);
    } catch (err: any) {
      assert.strictEqual(err.message, "The Format test has a invalid unit specification..");
    }
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

    try {
      const format = new Format("test");
      await format.fromJSON(unitsProvider, formatData).catch(() => { });
      assert.isTrue(format.hasUnits);

      const testEntry = {
        magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2",
      };

      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(false);
    } catch (err: any) {
      assert.strictEqual(err.message, "The Format test has a invalid unit specification..");
      // eslint-disable-next-line no-console
      // console.log(err.message);
    }
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
      await format.fromJSON(unitsProvider, formatData).catch(() => { });
      assert.isTrue(format.hasUnits, `Test case number ${testEntry.testCaseNum} failed`);
      assert.equal(format.hasFormatTraitSet(FormatTraits.KeepSingleZero), testEntry.keepSingleZero, `Test case number ${testEntry.testCaseNum} failed`);
      assert.equal(format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint), testEntry.keepDecimalPoint, `Test case number ${testEntry.testCaseNum} failed`);
      assert.equal(format.hasFormatTraitSet(FormatTraits.TrailZeroes), testEntry.trailZeroes, `Test case number ${testEntry.testCaseNum} failed`);

      const spec = await FormatterSpec.create("test", format, unitsProvider, new BasicUnit(unit.name, unit.label, unit.contextId));
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.equal(formattedValue, testEntry.result, `Test case number ${testEntry.testCaseNum} failed`);
      assert.isTrue(formattedValue.length > 0, `Test case number ${testEntry.testCaseNum} failed`);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("FT-IN Composite (no labels)", async () => {
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.strictEqual(formattedValue, testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue === testEntry.result);
      assert.isTrue(formattedValue.length > 0);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30.27146435�" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153.10973366�" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue === testEntry.result);
      assert.isTrue(formattedValue.length > 0);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30.0�" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153.0�" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue === testEntry.result);
      assert.isTrue(formattedValue.length > 0);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: 0.5283367223037165, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "30�16'17.27166\"" },
      { magnitude: 2.6722689691318213, unit: { name: "Units.RAD", label: "rad", contextId: "Units.ANGLE" }, result: "153�6'35.041176\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new BasicUnit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue === testEntry.result);
      assert.isTrue(formattedValue.length > 0);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

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
      assert.isTrue(formattedValue.length > 0);
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Composite Format with empty and unset labels", async () => {
    const unitsProvider = new TestUnitsProvider();

    const compositeFormat = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{name: "Units.KM"},{name: "Units.M", label: ""},{name: "Units.CM", label: "CM"},{name: "Units.MM", label: "'"}],
      },
      formatTraits: ["keepSingleZero", "applyRounding"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    };
    const format = new Format("test");
    assert.isDefined(format);

    await format.fromJSON(unitsProvider, compositeFormat).catch(() => { });
    expect(JSON.stringify(format.toJSON().composite)).to.eql(`{"spacer":"","includeZero":true,"units":[{"name":"Units.KM"},{"name":"Units.M","label":""},{"name":"Units.CM","label":"CM"},{"name":"Units.MM","label":"'"}]}`);
  });
});
