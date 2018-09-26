/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { TestUnitsProvider, Unit } from "./TestUtils/TestHelper";
import { Format, FormatterSpec } from "../src/Formatter/Format";
import { Formatter } from "../src/Formatter/Formatter";

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
      await format.fromJson(unitsProvider, formatData).catch(() => { });
      assert.isTrue(format.hasUnits);

      const testEntry = {
        magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2"
      };

      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(false);
    } catch (err) {
      assert.isTrue(err.message === "The Format test has a invalid unit specification..");
      // tslint:disable-next-line:no-console
      //console.log(err.message);
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
      await format.fromJson(unitsProvider, formatData).catch(() => { });
      assert.isTrue(format.hasUnits);

      const testEntry = {
        magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2"
      };

      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(false);
    } catch (err) {
      assert.isTrue(err.message === "The Format test has a invalid unit specification..");
      // tslint:disable-next-line:no-console
      //console.log(err.message);
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.5417'" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.5417'" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05'" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789'" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0'" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12'-6 1/2\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12'-6 1/2\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1'-0 5/8\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789'-0\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12:6 1/2" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12:6 1/2" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1:0 5/8" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345789:0" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0:0" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150 1/2\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150 1/2\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12 5/8\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);

      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150 1/2 in" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150 1/2 in" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12 5/8 in" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468 in" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0 in" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-150.5\"" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "150.5\"" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.6\"" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "148149468\"" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "-3'-3 3/8\"" },
      { magnitude: 1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "3'-3 3/8\"" },
      { magnitude: 0.0254, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-1\"" },
      { magnitude: 12.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "41'-6\"" },
      { magnitude: 0.00000, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue.length > 0);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
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
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const testQuantityData = [
      { magnitude: -1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "-3'-3.37\"" },
      { magnitude: 1.0, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "3'-3.37\"" },
      { magnitude: 0.0254, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-1\"" },
      { magnitude: 12.65, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "41'-6.031\"" },
      { magnitude: 0.00000, unit: { name: "Units.M", label: "m", contextId: "Units.LENGTH" }, result: "0'-0\"" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const spec = await FormatterSpec.create("test", format, unitsProvider, unit);
      const formattedValue = Formatter.formatQuantity(testEntry.magnitude, spec);
      assert.isTrue(formattedValue === testEntry.result);
      assert.isTrue(formattedValue.length > 0);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });
});
