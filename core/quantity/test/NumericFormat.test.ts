/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { TestUnitsProvider, Unit } from "./TestUtils/TestHelper";
import { Quantity } from "../src/Quantity";
import { Format } from "../src/Formatter/Format";
import { Formatter } from "../src/Formatter/Formatter";

describe("Numeric Formats tests:", () => {
  it("Feet to 4 Decimal places w/trailing zeros ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel", "trailZeroes", "use1000Separator"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: ",",
      decimalSeparator: ".",
    };

    const formatter = new Formatter();
    const defaultRoundFactor = formatter.roundFactor;
    formatter.roundFactor = 0.5;
    assert.isTrue(formatter.roundFactor === 0.5);
    formatter.roundFactor = defaultRoundFactor;

    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.5417 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.5417 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.0500 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12,345,789.0000 FT" },
      { magnitude: 10000000, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "10,000,000.0000 FT" },
      { magnitude: 100000, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "100,000.0000 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0.0000 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet w/no precision prepend label", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["applyRounding", "showUnitLabel", "prependUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-ft 13" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 13" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 1" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "FT 12345789" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 0" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet w/no precision negatives in parens", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["applyRounding", "showUnitLabel", "prependUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "negativeParentheses",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "(ft 13)" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 13" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 1" },
      { magnitude: -12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "(FT 12345789)" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "ft 0" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet show decimal point/ sign all", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["applyRounding", "showUnitLabel", "keepDecimalPoint"],
      precision: 3,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "signAlways",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.542 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "+12.542 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "+1.05 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "+12345789. FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "+0. ft" },
      { magnitude: 0.99999, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "+1. ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet show decimal point/ sign none", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["applyRounding", "showUnitLabel", "keepDecimalPoint"],
      precision: 3,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "noSign",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.542 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.542 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12345789. FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0. ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet w/no precision but with keepSingleZero", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["applyRounding", "showUnitLabel", "keepSingleZero"],
      precision: 0,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-13.0 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "13.0 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.0 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12345789.0 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0.0 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet to 2 Decimal places w/trailing zeros ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel", "trailZeroes"],
      precision: 2,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.54 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.54 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12345789.00 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0.00 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet to 2 Decimal places/zero empty ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel", "zeroEmpty"],
      precision: 2,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.54 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.54 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12345789 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });


  it("Feet to 2 Decimal places no trailing zeros ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12.54 ft" },
      { magnitude: 12.5416666666667, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12.54 ft" },
      { magnitude: 1.05000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12345789 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet in scientific notation zero normalized", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Scientific",
      scientificType: "zeroNormalized",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.541e5, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-0.1254e7 ft" },
      { magnitude: 5027745120, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0.5028e10 ft" },
      { magnitude: 0.0000000105, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0.105e-7 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "0.1235e8 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0e0 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      //console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet in scientific notation ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Scientific",
      scientificType: "normalized",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.541e5, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-1.2541e6 ft" },
      { magnitude: 5027745120, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "5.0277e9 ft" },
      { magnitude: 0.0000000105, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.05e-8 ft" },
      { magnitude: 12345789, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "1.2346e7 FT" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0e0 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet in forced scientific notation ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -1.01e12, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-1.01e12 ft" },
      { magnitude: 1.01e12, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1.01e12 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      //console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });


  it("Imperial Station Formatting", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["trailZeroes"],
      minWidth: 10,
      precision: 2,
      stationOffsetSize: 2,
      type: "Station",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: 123.456, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1+23.46" },
      { magnitude: 123456.789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1234+56.79" },
      { magnitude: 1234567890, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12345678+90.00" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0+00.00" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Metric Station Formatting", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepDecimalPoint"],
      minWidth: 3,
      precision: 2,
      stationOffsetSize: 3,
      type: "Station",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: 123.456, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0+123.46" },
      { magnitude: 123456.789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "123+456.79" },
      { magnitude: 1234567890, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1234567+890." },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0+000." },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Metric Station Formatting no decimal point unless needed", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: [],
      minWidth: 3,
      precision: 2,
      stationOffsetSize: 3,
      type: "Station",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: 123.456, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0+123.46" },
      { magnitude: 123456.789, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "123+456.79" },
      { magnitude: 1234567890, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "1234567+890" },
      { magnitude: 0.00000, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "0+000" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

  it("Feet (fractional) ", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: "Fractional",
      uomSeparator: " ",
    };

    const formatter = new Formatter();
    const format = new Format("test", unitsProvider);
    await format.fromJson(formatData).catch(() => { });
    assert.isTrue(!format.hasComposite);

    const testQuantityData = [
      { magnitude: -12.125, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "-12-1/8 ft" },
      { magnitude: 12.125, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12-1/8 ft" },
      { magnitude: 12.25, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12-1/4 ft" },
      { magnitude: 12.50, unit: { name: "Units.FT", label: "FT", contextId: "Units.LENGTH" }, result: "12-1/2 FT" },
      { magnitude: 12.625, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12-5/8 ft" },
      { magnitude: 12.75, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12-3/4 ft" },
      { magnitude: 12.875, unit: { name: "Units.FT", label: "ft", contextId: "Units.LENGTH" }, result: "12-7/8 ft" },
    ];

    for (const testEntry of testQuantityData) {
      const unit = new Unit(testEntry.unit.name, testEntry.unit.label, testEntry.unit.contextId);
      const quantity = new Quantity(unit, testEntry.magnitude);
      const formattedValue = await formatter.formatQuantity(quantity, format);
      assert.isTrue(formattedValue === testEntry.result);
      // tslint:disable-next-line:no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });

});
