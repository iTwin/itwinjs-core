/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { UnitProps } from "../Interfaces";
import { ParseError, Parser } from "../Parser";
import { ParserSpec } from "../ParserSpec";
import { Quantity } from "../Quantity";
import { BadUnit } from "../Unit";
import { TestUnitsProvider } from "./TestUtils/TestHelper";

const logTestOutput = false;

describe("Parsing tests:", () => {
  it("Bad unit", async () => {
    const testUnit: UnitProps = new BadUnit();
    assert.isTrue(testUnit.name.length === 0);
    assert.isTrue(testUnit.label.length === 0);
    assert.isTrue(testUnit.phenomenon.length === 0);
    assert.isTrue(testUnit.isValid === false);
  });

  it("Quantity constructor", async () => {
    const noUnitQty = new Quantity();
    assert.isTrue(noUnitQty.magnitude === 0);
    assert.isTrue(noUnitQty.isValid === false);
  });

  it("Quantity convert Meters to inches", async () => {
    const unitsProvider = new TestUnitsProvider();
    const inchUnit = await unitsProvider.findUnit("in", "Units.LENGTH");
    const meterUnit = await unitsProvider.findUnit("m", "Units.LENGTH");
    const meterQty = new Quantity(meterUnit, 1.0);
    const conversion = await unitsProvider.getConversion(meterUnit, inchUnit);
    const inchesQty = meterQty.convertTo(inchUnit, conversion);

    assert.isTrue(meterQty.magnitude === 1.0);
    assert.isTrue(inchesQty!.magnitude === meterQty.magnitude * conversion.factor);
  });

  it("Convert units", async () => {
    const expectedConversionResults = [
      { label: "FT", unitContext: "", cvtTo: [{ label: "\"", factor: 12.0 }] },
      { label: "yd", unitContext: "", cvtTo: [{ label: "\'", factor: 3.0 }, { label: "\"", factor: 36.0 }] },
      { label: "mi", unitContext: "", cvtTo: [{ label: "yrd", factor: 1760.0 }, { label: "\'", factor: 5280.0 }, { label: "\"", factor: 63360.0 }] },
      { label: "°", unitContext: "Units.ANGLE", cvtTo: [{ label: "deg", factor: 1.0 }, { label: "min", factor: 60.0 }, { label: "sec", factor: 3600.0 }] },
      { label: "'", unitContext: "Units.ANGLE", cvtTo: [{ label: "min", factor: 1.0 }, { label: "sec", factor: 60.0 }] },
      { label: "\"", unitContext: "Units.ANGLE", cvtTo: [{ label: "sec", factor: 1.0 }] },
    ];

    const unitsProvider = new TestUnitsProvider();

    for (const tstVal of expectedConversionResults) {
      const unitContext = tstVal.unitContext.length > 0 ? tstVal.unitContext : undefined;
      const fromUnit = await unitsProvider.findUnit(tstVal.label, unitContext);
      for (const toVal of tstVal.cvtTo) {
        const toUnit = await unitsProvider.findUnit(toVal.label, fromUnit.phenomenon);
        const conversionData = await unitsProvider.getConversion(fromUnit, toUnit);
        assert.isTrue(Math.fround(conversionData.factor) === toVal.factor);
      }
    }
  });

  it("Generate Parse Tokens", async () => {

    const format = new Format("test");
    const tests = [
      {input: "", expectedTokens: []},
      {input: "0/1", expectedTokens: [{ value: 0 }]},
      {input: "1/0", expectedTokens: [{ value: 1 }]},
      {input: "1/2", expectedTokens: [{ value: 0.5 }]},
      {input: "-1/2", expectedTokens: [{value: "-", isOperand: true}, { value: 0.5 }]},
      {input: "+1/2", expectedTokens: [{value: "+", isOperand: true}, { value: 0.5 }]},
      {input: "2 /", expectedTokens: [{ value: 2 }]},
      {input: "1.616252eggs", expectedTokens: [{ value: 1.616252 }, { value: "eggs" }]},
      {input: "1.616252E-35eggs", expectedTokens: [{ value: 1.616252e-35 }, { value: "eggs" }]},
      {input: "-1.616252E-35eggs", expectedTokens: [{value: "-", isOperand: true}, { value: 1.616252e-35 }, { value: "eggs" }]},
      {input: "756345.345", expectedTokens: [{ value: 756345.345 }]},
      {input: "12,345.345", expectedTokens: [{ value: 12345.345 }]},
      {input: "3.6252e3 Miles", expectedTokens: [{ value: 3625.2 }, { value: "Miles" }]},
      {input: "-1 1/2 FT", expectedTokens: [{value: "-", isOperand: true}, { value: 1.5 }, { value: "FT" }]},
      {input: "+1 1/2 FT", expectedTokens: [{value: "+", isOperand: true}, { value: 1.5 }, { value: "FT" }]},
      {input: "-135°11'30.5\"", expectedTokens: [{value: "-", isOperand: true}, { value: 135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }]},
      {input: "-2FT 6IN", expectedTokens: [{value: "-", isOperand: true}, { value: 2 }, { value: "FT" }, { value: 6 }, { value: "IN" }]},
      {input: "135°11'30.5\"", expectedTokens: [{ value: 135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }]},
      {input: "2FT 6IN", expectedTokens: [{ value: 2 }, { value: "FT" }, { value: 6 }, { value: "IN" }]},
      {input: "1 1/2 FT", expectedTokens: [{ value: 1.5 }, { value: "FT" }]},
    ];

    let i = 0;
    for (const test of tests) {
      const tokens = Parser.parseQuantitySpecification(test.input, format);
      assert.isTrue(tokens.length === test.expectedTokens.length);

      for (let j = 0; j < tokens.length; j++) {
        assert.isTrue(tokens[j].value === test.expectedTokens[j].value);
      }

      i = i + 1;
    }
  });

  it("Generate Parse Tokens given different decimal and thousand separators", async () => {
    const tests = [
      {input: "1,616252eggs", expectedTokens: [{ value: 1.616252 }, { value: "eggs" }]},
      {input: "1,616252E-35eggs", expectedTokens: [{ value: 1.616252e-35 }, { value: "eggs" }]},
      {input: "-1,616252E-35eggs", expectedTokens: [{value: "-", isOperand: true}, { value: 1.616252e-35 }, { value: "eggs" }]},
      {input: "756345,345", expectedTokens: [{ value: 756345.345 }]},
      {input: "12.345,345", expectedTokens: [{ value: 12345.345 }]},
      {input: "3,6252e3 Miles", expectedTokens: [{ value: 3625.2 }, { value: "Miles" }]},
      {input: "-135°11'30,5\"", expectedTokens: [{value: "-", isOperand: true}, { value: 135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }]},
      {input: "135°11'30,5\"", expectedTokens: [{ value: 135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }]},
    ];

    const formatData = {
      decimalSeparator: ",",
      thousandSeparator: ".",
      type: "Decimal",
    };
    const format = new Format("test");
    const unitsProvider = new TestUnitsProvider();
    await format.fromJSON(unitsProvider, formatData).catch(() => { });

    let i = 0;
    for (const test of tests) {
      const tokens = Parser.parseQuantitySpecification(test.input, format);
      assert.isTrue(tokens.length === test.expectedTokens.length);

      for (let j = 0; j < tokens.length; j++) {
        assert.isTrue(tokens[j].value === test.expectedTokens[j].value);
      }

      i = i + 1;
    }
  });

  it("Look up units", async () => {
    const expectedLookupResults = [
      { label: "FT", name: "Units.FT", unitContext: "" },
      { label: "'", name: "Units.FT", unitContext: "Units.LENGTH" },
      { label: "ft", name: "Units.FT", unitContext: "" },
      { label: "\"", name: "Units.IN", unitContext: "Units.LENGTH" },
      { label: "in", name: "Units.IN", unitContext: "" },
      { label: "IN", name: "Units.IN", unitContext: "" },
      { label: "°", name: "Units.ARC_DEG", unitContext: "Units.ANGLE" },
      { label: "'", name: "Units.ARC_MINUTE", unitContext: "Units.ANGLE" },
      { label: "\"", name: "Units.ARC_SECOND", unitContext: "Units.ANGLE" },
    ];

    const unitProvider = new TestUnitsProvider();

    for (const lookupEntry of expectedLookupResults) {
      const unit = await unitProvider.findUnit(lookupEntry.label, (lookupEntry.unitContext.length > 0) ? lookupEntry.unitContext : undefined);
      assert.isTrue(unit.name === lookupEntry.name);
    }
  });

  it("Convert units", async () => {
    const expectedConversionResults = [
      { label: "FT", unitContext: "", cvtTo: [{ label: "\"", factor: 12.0 }] },
      { label: "yd", unitContext: "", cvtTo: [{ label: "\'", factor: 3.0 }, { label: "\"", factor: 36.0 }] },
      { label: "mi", unitContext: "", cvtTo: [{ label: "yrd", factor: 1760.0 }, { label: "\'", factor: 5280.0 }, { label: "\"", factor: 63360.0 }] },
      { label: "°", unitContext: "Units.ANGLE", cvtTo: [{ label: "deg", factor: 1.0 }, { label: "min", factor: 60.0 }, { label: "sec", factor: 3600.0 }] },
      { label: "'", unitContext: "Units.ANGLE", cvtTo: [{ label: "min", factor: 1.0 }, { label: "sec", factor: 60.0 }] },
      { label: "\"", unitContext: "Units.ANGLE", cvtTo: [{ label: "sec", factor: 1.0 }] },
    ];

    const unitsProvider = new TestUnitsProvider();

    for (const tstVal of expectedConversionResults) {
      const unitContext = tstVal.unitContext.length > 0 ? tstVal.unitContext : undefined;
      const fromUnit = await unitsProvider.findUnit(tstVal.label, unitContext);
      for (const toVal of tstVal.cvtTo) {
        const toUnit = await unitsProvider.findUnit(toVal.label, fromUnit.phenomenon);
        const conversionData = await unitsProvider.getConversion(fromUnit, toUnit);
        assert.isTrue(Math.fround(conversionData.factor) === toVal.factor);
      }
    }
  });

  it("Parse into FT Quantities", async () => {
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

    const testData = [
      { value: "12,345.345", quantity: { magnitude: 12345.345, unitName: "Units.FT" } },
      { value: "3.6252e3 Miles", quantity: { magnitude: 19141056, unitName: "Units.FT" } },
      { value: "3.6252e-3 Miles", quantity: { magnitude: 19.141056, unitName: "Units.FT" } },
      { value: "3.6252e+3 Miles", quantity: { magnitude: 19141056, unitName: "Units.FT" } },
      { value: "-1 1/2FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "-2FT 6IN", quantity: { magnitude: -2.5, unitName: "Units.FT" } },
      { value: "1 1/2 FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "2FT 6IN", quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      { value: `2' 6"`, quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      { value: "-3IN", quantity: { magnitude: -0.25, unitName: "Units.FT" } },
      // Test with invalid unit specifier -- should default to -3 ft
      { value: "-3 ABCDEF", quantity: { magnitude: -3, unitName: "Units.FT" } },

    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      // console.log (`quantityProps=${JSON.stringify(quantityProps)}`);
      expect(Math.fround(quantityProps.magnitude)).to.eql(Math.fround(testEntry.quantity.magnitude));
      expect(quantityProps.unit.name).to.eql(testEntry.quantity.unitName);
    }
  });

  it("Parse into Length Quantities", async () => {
    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    };

    const testData = [
      { value: "12,345.345 FT", quantity: { magnitude: 12345.345, unitName: "Units.FT" } },
      { value: "3.6252e3 Miles", quantity: { magnitude: 3625.2, unitName: "Units.MILE" } },
      { value: "3.6252e-3 Miles", quantity: { magnitude: 0.0036252, unitName: "Units.MILE" } },
      { value: "3.6252e+3 Miles", quantity: { magnitude: 3625.2, unitName: "Units.MILE" } },
      { value: "-1 1/2FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "-2FT 6IN", quantity: { magnitude: -2.5, unitName: "Units.FT" } },
      { value: "1 1/2 FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "2FT 6IN", quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      /*    { value: `2'-6"`, quantity: { magnitude: 2.5, unitName: "Units.FT" } }, ambiguous case since ' can be Unit.FT or Units.ARC_MINUTE would require a Format unit to be defined. */
      { value: "-3IN", quantity: { magnitude: -3.0, unitName: "Units.IN" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      // console.log (`quantityProps=${JSON.stringify(quantityProps)}`);
      expect(Math.fround(quantityProps.magnitude)).to.eql(Math.fround(testEntry.quantity.magnitude));
      expect(quantityProps.unit.name).to.eql(testEntry.quantity.unitName);
    }
  });

  it("Parse into Length FT Quantities w/uom separator", async () => {
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
      uomSeparator: "*",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "12,345.345", quantity: { magnitude: 12345.345, unitName: "Units.FT" } },
      { value: "3.6252e3*Miles", quantity: { magnitude: 19141056, unitName: "Units.FT" } },
      { value: "-1 1/2*FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "-2*FT 6*IN", quantity: { magnitude: -2.5, unitName: "Units.FT" } },
      { value: "1 1/2*FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "2*FT 6*IN", quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      { value: "-3*IN", quantity: { magnitude: -0.25, unitName: "Units.FT" } },
      { value: "2*FT 6*IN - 3*IN", quantity: { magnitude: 2.25, unitName: "Units.FT" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity.unitName);
    }
  });

  it("Parse into Station Quantities", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint"],
      minWidth: 2,
      precision: 2,
      stationOffsetSize: 2,
      type: "Station",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "7563+45.345", quantity: { magnitude: 756345.345, unitName: "Units.FT" } },
      { value: "-7563+45.345", quantity: { magnitude: -756345.345, unitName: "Units.FT" } },
      { value: "-7563+45.345 - 5.5", quantity: { magnitude: -756350.845, unitName: "Units.FT" } },
      { value: "-7563+45.345 + 5.5", quantity: { magnitude: -756339.845, unitName: "Units.FT" } },
      { value: "10m + 7563+45.345 + 5.5", quantity: { magnitude: 32.8084 + 756350.845, unitName: "Units.FT" } },
    ];

    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity.unitName);
    }
  });

  it("Parse into Angle Quantities", async () => {
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
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "-135°11'30.5\"", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: -135.19180555555556, unitName: "Units.ARC_DEG" } },
      { value: "135°11'30.5\"", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: 135.19180555555556, unitName: "Units.ARC_DEG" } },
      { value: "135°11'30.5\" + 5", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: 140.19180555555556, unitName: "Units.ARC_DEG" } },
      { value: "130°10'20.1\" + 5°01'10.4\"", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: 135.19180555555556, unitName: "Units.ARC_DEG" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity.unitName);
    }
  });

  it("Parse into Length Quantities with Fraction dash", async () => {
    const formatData = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: "Fractional",
      uomSeparator: " ",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "-1-1/2FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "1-1/2 FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "1-1/2 FT + 1-1/2 FT", quantity: { magnitude: 3, unitName: "Units.FT" } },
      { value: "1-1/2 FT - 1-1/2 FT", quantity: { magnitude: 0, unitName: "Units.FT" } },
      { value: "-1-1/2 FT - 1-1/2 FT", quantity: { magnitude: -3, unitName: "Units.FT" } },
      { value: "-1-1/2 FT + 1-1/2 FT", quantity: { magnitude: 0, unitName: "Units.FT" } },
      { value: "FT", quantity: { magnitude: 0.0, unitName: "Units.FT" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(!format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity.unitName);
    }
  });

  it("Parse into Survey Length Quantities into meters", async () => {
    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "usft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "1000 usft", magnitude: 304.8006096012192 },  // label should match the label in the Format so it will use SURVEY_FT
      { value: "1000 ft (US Survey)", magnitude: 304.8006096012192 },  // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 USF", magnitude: 304.8006096012192 }, // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 ft", magnitude: 304.8006096012192 },  // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 USF", magnitude: 304.8006096012192 }, // label should match a valid SURVEY_FT label or alternate label
      { value: "1000", magnitude: 304.8006096012192 },  // no label should default to SURVEY_FT from Format
      { value: "1000 ABCDEF", magnitude: 304.8006096012192 },  // invalid label, should default to SURVEY_FT from Format since the unit is provided
      { value: "1000 f", magnitude: 304.8 },  // "f" is only valid for Units.FT so convert based on feet
      { value: "1000'", magnitude: 304.8 },  // "'" is only valid for Units.FT so convert based on feet
      { value: "1100 usft - 100", magnitude: 304.8006096012192 },  // label should match the label in the Format so it will use SURVEY_FT
    ];

    const unitsAndAltLabelsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsAndAltLabelsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    const persistenceUnit = await unitsAndAltLabelsProvider.findUnitByName("Units.M");

    const parserSpec = await ParserSpec.create(format, unitsAndAltLabelsProvider, persistenceUnit, unitsAndAltLabelsProvider);
    for (const testEntry of testData) {
      const result = Parser.parseQuantityString(testEntry.value, parserSpec);
      expect(Parser.isParsedQuantity(result)).to.be.true;
      if (Parser.isParsedQuantity(result)) {
        expect(Math.fround(result.value * 1000000)).to.be.eql(Math.fround(testEntry.magnitude * 1000000));
      }
    }
  });

  it("Parse into Survey Length Quantities", async () => {
    const formatData = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "usft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      allowMathematicOperations: true,
    };

    const testData = [
      { value: "1000 usft", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } },  // label should match the label in the Format so it will use SURVEY_FT
      { value: "1000 ft (US Survey)", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } },  // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 USF", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } }, // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 ft", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } },  // label should match a valid SURVEY_FT label or alternate label
      { value: "1000 USF", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } }, // label should match a valid SURVEY_FT label or alternate label
      { value: "1000", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } },  // no label should default to SURVEY_FT from Format
      { value: "1000 f", quantity: { magnitude: 999.998, unitName: "Units.US_SURVEY_FT" } },  // "f" is only valid for Units.FT so convert based on feet
      { value: "1000'", quantity: { magnitude: 999.998, unitName: "Units.US_SURVEY_FT" } },  // "'" is only valid for Units.FT so convert based on feet
      { value: "1100 usft - 100", quantity: { magnitude: 1000, unitName: "Units.US_SURVEY_FT" } },  // label should match the label in the Format so it will use SURVEY_FT
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      // console.log (`quantityProps=${JSON.stringify(quantityProps)}`);
      expect(Math.fround(quantityProps.magnitude * 1000000)).to.be.eql(Math.fround(testEntry.quantity.magnitude * 1000000));
      expect(quantityProps.unit.name).to.be.eql(testEntry.quantity.unitName);
    }
  });

  it("Parse mathematic operations into quantity async", async () => {
    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
      composite: {
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      allowMathematicOperations: true,
    };

    const testData = [
      // When unitless, the format unit is used to determine unit. (The unit the user is working on.)
      { value: "12,345.345 - 1", quantity: { magnitude: 12344.345, unitName: "Units.M" }},
      { value: "1yd + 2", quantity: { magnitude: 0.9144 + 2, unitName: "Units.M" }},
      { value: "1yd + 1m + 2", quantity: { magnitude: 0.9144 + 3, unitName: "Units.M" }},
      { value: "1 FT + 6IN", quantity: { magnitude: 0.45720000000000005, unitName: "Units.M" }},
      { value: "-1-1", quantity: { magnitude: -2, unitName: "Units.M" }},
      { value: "1 ' + 1 FT", quantity: { magnitude: 0.6096, unitName: "Units.M" }},
      { value: "-1 FT + 1", quantity: { magnitude: -0.3048 + 1, unitName: "Units.M" }},
      { value: "1 F + 1.5", quantity: { magnitude: 0.3048 + 1.5, unitName: "Units.M" }},
      { value: "-2FT 6IN + 6IN", quantity: { magnitude: -0.6096, unitName: "Units.M" }},
      { value: "1 1/2FT + 1/2IN", quantity: { magnitude: 0.45720000000000005 + 0.0127, unitName: "Units.M" }},
      { value: "2' 6\"-0.5", quantity: { magnitude: 0.762 - 0.5, unitName: "Units.M" }},
      { value: "1 yd + 1FT 6IN", quantity: { magnitude: 1.3716, unitName: "Units.M" }},
      { value: "1 m -1FT +6IN", quantity: { magnitude: 1 - 0.1524, unitName: "Units.M" }},
      { value: "-1m 1CM 1mm - 1 FT + 6IN + 1yd", quantity: { magnitude: -0.24899999999999978, unitName: "Units.M" }},
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      // console.log (`quantityProps=${JSON.stringify(quantityProps)}`);
      expect(Math.fround(quantityProps.magnitude)).to.eql(Math.fround(testEntry.quantity.magnitude));
      expect(quantityProps.unit.name).to.eql(testEntry.quantity.unitName);
    }
  });

  it("Parse mathematic operations into an invalid result when maths are not allowed async", async () => {
    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
      composite: {
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      // allowMathematicOperations: false, <- Also test that, when not set, it default to false
    };

    const testData = [
      "12,345.345 - 1",
      "1yd + 2",
      "1yd + 1m + 2",
      "1 FT + 6IN",
      "-1-1",
      "1 ' + 1 FT",
      "-1 FT + 1",
      "1 F + 1.5",
      "-2FT 6IN + 6IN",
      "1 1/2FT + 1/2IN",
      "2' 6\"-0.5",
      "1 yd + 1FT 6IN",
      "1 m -1FT +6IN",
      "-1m 1CM 1mm - 1 FT + 6IN + 1yd",
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData).catch(() => { });

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry, format, unitsProvider);
      expect(quantityProps.isValid).to.eql(false);
      expect(quantityProps.magnitude).to.eql(0);
    }
  });

});

describe("Synchronous Parsing tests:", async () => {
  const unitsProvider = new TestUnitsProvider();
  const outUnit = await unitsProvider.findUnitByName("Units.M");
  // specs to convert parsed unit in an output unit of meter
  const meterConversionSpecs = await Parser.createUnitConversionSpecs(unitsProvider, "Units.M", [
    { unitName: "Units.M" },
    { unitName: "Units.MM" },
    { unitName: "Units.CM" },
    { unitName: "Units.IN" },
    { unitName: "Units.FT", altLabels: ["foot", "feet"] },
    { unitName: "Units.YRD", altLabels: ["yd", "yds"] },
  ], unitsProvider);

  const formatData = {
    composite: {
      includeZero: true,
      spacer: "-",
      units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
    },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
    allowMathematicOperations: true,
  };
  const format = new Format("test");
  await format.fromJSON(unitsProvider, formatData).catch(() => { });

  const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit, unitsProvider);
  const formatSpec = await FormatterSpec.create("test", format, unitsProvider, outUnit);

  const angleFormatData = {
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
    precision: 2,
    type: "Decimal",
    uomSeparator: "",
    allowMathematicOperations: true,
  };

  const angleFormat = new Format("testAngle");
  await angleFormat.fromJSON(unitsProvider, angleFormatData).catch(() => { });
  const outAngleUnit = await unitsProvider.findUnitByName("Units.ARC_DEG");
  const angleParserSpec = await ParserSpec.create(angleFormat, unitsProvider, outAngleUnit, unitsProvider);
  const angleFormatSpec = await FormatterSpec.create("test", angleFormat, unitsProvider, outAngleUnit);

  it("Parse mathematic operations into quantity synchronously", () => {
    const testData = [
      // When unitless, the format unit is used to determine unit.
      { value: "12,345.345 - 1", magnitude: 3762.861156 - 0.3048},
      { value: "1yd + 2", magnitude: 0.9144 + 0.6096},
      { value: "1yd + 1m + 2", magnitude: 0.9144 + 1 + 0.6096},
      { value: "1 FT + 6IN", magnitude: 0.45720000000000005 },
      { value: "-1-1", magnitude: -0.6096 },
      { value: "1 ' + 1 FT", magnitude: 0.6096 },
      { value: "-1 FT + 1", magnitude: 0 },
      { value: "1 F + 1.5", magnitude: 0.762 },
      { value: "-2FT 6IN + 6IN", magnitude: -0.6096 },
      { value: "1 1/2FT + 1/2IN", magnitude: 0.45720000000000005 + 0.0127 },
      { value: "2' 6\"-0.5", magnitude: 0.6096 },
      { value: "1 yd + 1FT 6IN", magnitude: 1.3716 },
      { value: "1 m -1FT +6IN", magnitude: 1 - 0.1524 },
      { value: "-1m 1CM 1mm - 1 FT + 6IN + 1yd", magnitude: -0.24899999999999978 },
    ];

    if (logTestOutput) {
      for (const spec of meterConversionSpecs) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }

    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry.value, parserSpec);
      if (logTestOutput) {
        if (Parser.isParsedQuantity(parseResult))
          console.log(`input=${testEntry.value} output=${parseResult.value}`); // eslint-disable-line no-console
        else if (Parser.isParseError(parseResult))
          console.log(`input=${testEntry.value} error=${parseResult.error}`); // eslint-disable-line no-console
      }
      assert.isTrue(Parser.isParsedQuantity(parseResult));
      if (Parser.isParsedQuantity(parseResult))
        expect(parseResult.value).closeTo(testEntry.magnitude, 0.0001);
    }
  });

  it("Parse mathematic operations into an ParserError when maths are not allowed synchronously", async () => {
    const formatDataMathNotAllowed = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
      allowMathematicOperations: false,
    };
    const formatMathNotAllowed = new Format("test");
    await formatMathNotAllowed.fromJSON(unitsProvider, formatDataMathNotAllowed).catch(() => { });

    const testData = [
      "12,345.345 - 1",
      "1yd + 2",
      "1yd + 1m + 2",
      "1 FT + 6IN",
      "-1-1",
      "1 ' + 1 FT",
      "-1 FT + 1",
      "1 F + 1.5",
      "-2FT 6IN + 6IN",
      "1 1/2FT + 1/2IN",
      "2' 6\"-0.5",
      "1 yd + 1FT 6IN",
      "1 m -1FT +6IN",
      "-1m 1CM 1mm - 1 FT + 6IN + 1yd",
    ];

    if (logTestOutput) {
      for (const spec of meterConversionSpecs) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }

    const noAllowMathParserSpec = await ParserSpec.create(formatMathNotAllowed, unitsProvider, outUnit, unitsProvider);
    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry, noAllowMathParserSpec);
      if (logTestOutput) {
        if (Parser.isParsedQuantity(parseResult))
          console.log(`input=${testEntry} output=${parseResult.value}`); // eslint-disable-line no-console
        else if (Parser.isParseError(parseResult))
          console.log(`input=${testEntry} error=${parseResult.error}`); // eslint-disable-line no-console
      }
      assert.isTrue(Parser.isParseError(parseResult));
      if (Parser.isParseError(parseResult))
        expect(parseResult.error).to.eql(ParseError.MathematicOperationFoundButIsNotAllowed);
    }
  });

  it("Parse taking the first unit if no unit specified in the Format.", async () => {
    const formatDataUnitless = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
      allowMathematicOperations: true,
    };
    const formatUnitless = new Format("test");
    await formatUnitless.fromJSON(unitsProvider, formatDataUnitless).catch(() => { });

    const testData = [
      { value: "12,345.345 - 1", magnitude: 12345.345 - 1}, // unitless
      { value: "1m + 1FT + 1", magnitude: 1 + 0.3048 + 1}, // default to meters
      { value: "1FT + 1m + 1", magnitude: 0.3048 + 1 + 0.3048}, // default to feet
      { value: "1 + 1 FT + 1m", magnitude: 0.3048 + 0.3048 + 1 }, // default to feet
    ];

    if (logTestOutput) {
      for (const spec of meterConversionSpecs) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }

    const unitlessParserSpec = await ParserSpec.create(formatUnitless, unitsProvider, outUnit, unitsProvider);
    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry.value, unitlessParserSpec);
      if (logTestOutput) {
        if (Parser.isParsedQuantity(parseResult))
          console.log(`input=${testEntry.value} output=${parseResult.value}`); // eslint-disable-line no-console
        else if (Parser.isParseError(parseResult))
          console.log(`input=${testEntry.value} error=${parseResult.error}`); // eslint-disable-line no-console
      }
      assert.isTrue(Parser.isParsedQuantity(parseResult));
      if (Parser.isParsedQuantity(parseResult))
        expect(parseResult.value).closeTo(testEntry.magnitude, 0.0001);
    }
  });

  it("Parse into length values using custom parse labels", () => {
    const testData = [
      // if no quantity is provided then the format unit is used to determine unit
      { value: "12,345.345", magnitude: 3762.861156 },
      { value: "1", magnitude: 0.3048 },
      { value: "1 '", magnitude: 0.3048 },
      { value: "-1", magnitude: -0.3048 },
      { value: "1 FT", magnitude: 0.3048 },
      { value: "FT", magnitude: 0 },
      { value: "-1 FT", magnitude: -0.3048 },
      { value: "1 F", magnitude: 0.3048 },
      { value: "1/2 F", magnitude: 0.3048 / 2 },
      { value: "-2FT 6IN", magnitude: -0.762 },
      { value: "1 1/2FT", magnitude: 0.45720000000000005 },
      { value: "2' 6\"", magnitude: 0.762 },
      { value: "1 yd", magnitude: 0.9144 },
      { value: "1yd", magnitude: 0.9144 },
      { value: "1 yds", magnitude: 0.9144 },
      { value: "1yrd", magnitude: 0.9144 },
      { value: "1 m", magnitude: 1 },
      { value: "1m", magnitude: 1 },
      { value: "1 MM", magnitude: 0.001 },
      { value: "1MM", magnitude: 0.001 },
      { value: "1000MM", magnitude: 1 },
      { value: "1CM", magnitude: 0.01 },
      { value: "1 CM", magnitude: 0.01 },
      { value: "100cm", magnitude: 1 },
      { value: "-100cm", magnitude: -1 },
    ];

    if (logTestOutput) {
      for (const spec of meterConversionSpecs) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }
    const newParserSpec = new ParserSpec(outUnit, format, meterConversionSpecs);
    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry.value, newParserSpec);
      if (logTestOutput) {
        if (Parser.isParsedQuantity(parseResult))
          console.log(`input=${testEntry.value} output=${parseResult.value}`); // eslint-disable-line no-console
        else if (Parser.isParseError(parseResult))
          console.log(`input=${testEntry.value} error=${parseResult.error}`); // eslint-disable-line no-console
      }
      assert.isTrue(Parser.isParsedQuantity(parseResult));
      if (Parser.isParsedQuantity(parseResult))
        expect(parseResult.value).closeTo(testEntry.magnitude, 0.0001);
    }
  });

  it("Parse into length values using default parse labels", () => {
    const testData = [
      // if no quantity is provided then the format unit is used to determine unit
      { value: "12,345.345", magnitude: 3762.861156 },
      { value: "1", magnitude: 0.3048 },
      { value: "1 '", magnitude: 0.3048 },
      { value: "1 FT", magnitude: 0.3048 },
      { value: "1 F", magnitude: 0.3048 },
      { value: "-2 FT 6 IN", magnitude: -0.762 },
      { value: "1 1/2FT", magnitude: 0.45720000000000005 },
      { value: "2FT 6IN", magnitude: 0.762 },
      { value: "1 yd", magnitude: 0.9144 },
      { value: "1yd", magnitude: 0.9144 },
      { value: "1 yrd", magnitude: 0.9144 },
      { value: "1 m", magnitude: 1 },
      { value: "1m", magnitude: 1 },
      { value: "1 MM", magnitude: 0.001 },
      { value: "1MM", magnitude: 0.001 },
      { value: "1000MM", magnitude: 1 },
      { value: "1CM", magnitude: 0.01 },
      { value: "1 CM", magnitude: 0.01 },
      { value: "100cm", magnitude: 1 },
      { value: "-100cm", magnitude: -1 },
      { value: "27'", magnitude: 8.2296 },
    ];

    if (logTestOutput) {
      for (const spec of parserSpec.unitConversions) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }

    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry.value, parserSpec);
      assert.isTrue(Parser.isParsedQuantity(parseResult));
      if (Parser.isParsedQuantity(parseResult)) {
        if (logTestOutput) {
          // eslint-disable-next-line no-console
          console.log(`input=${testEntry.value} output=${parseResult.value}`);
        }
        expect(parseResult.value).closeTo(testEntry.magnitude, 0.0001);
        const formattedValue = Formatter.formatQuantity(parseResult.value, formatSpec);

        if (logTestOutput) {
          // eslint-disable-next-line no-console
          console.log(`    formatted value=${formattedValue}`);
        }
      }
    }
  });

  it("Parse into angle values using default parse labels", () => {
    const testData = [
      // if no quantity is provided then the format unit is used to determine unit
      { value: "15^30'", magnitude: 15.5 },
      { value: "15.5", magnitude: 15.5 },
      { value: "10.0 + 5.5", magnitude: 15.5 },
    ];

    if (logTestOutput) {
      for (const spec of angleParserSpec.unitConversions) {
        // eslint-disable-next-line no-console
        console.log(`unit ${spec.name} factor= ${spec.conversion.factor} labels=${spec.parseLabels}`);
      }
    }

    for (const testEntry of testData) {
      const parseResult = Parser.parseQuantityString(testEntry.value, angleParserSpec);
      assert.isTrue(Parser.isParsedQuantity(parseResult));
      if (Parser.isParsedQuantity(parseResult)) {
        if (logTestOutput) {
          // eslint-disable-next-line no-console
          console.log(`input=${testEntry.value} output=${parseResult.value}`);
        }
        expect(parseResult.value).closeTo(testEntry.magnitude, 0.0001);
        const formattedValue = Formatter.formatQuantity(parseResult.value, angleFormatSpec);

        if (logTestOutput) {
          // eslint-disable-next-line no-console
          console.log(`    formatted value=${formattedValue}`);
        }
      }
    }
  });

});
