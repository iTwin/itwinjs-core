/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Parser } from "../src/Parser";
import { UnitProps, BadUnit } from "../src/Interfaces";
import { Format } from "../src/Formatter/Format";
import { Quantity } from "../src/Quantity";
import { TestUnitsProvider } from "./TestUtils/TestHelper";

describe("Parsing tests:", () => {
  it("Bad unit", async () => {
    let testUnit: UnitProps = new BadUnit();
    assert.isTrue(testUnit.name.length === 0);
    assert.isTrue(testUnit.label.length === 0);
    assert.isTrue(testUnit.unitFamily.length === 0);
    assert.isTrue(testUnit.isValid === false);
  });

  it("Quantity constructor", async () => {
    let noUnitQty = new Quantity();
    assert.isTrue(noUnitQty.magnitude === 0);
    assert.isTrue(noUnitQty.isValid === false);
  });

  it("Quantity convert Meters to inches", async () => {
    const unitsProvider = new TestUnitsProvider();
    const inchUnit = await unitsProvider.findUnit("in", "Units.LENGTH");
    const meterUnit = await unitsProvider.findUnit("m", "Units.LENGTH");
    const meterQty = new Quantity(meterUnit, 1.0);
    const conversion = await unitsProvider.getConversion(meterUnit, inchUnit);
    let inchesQty = meterQty.convertTo(inchUnit, conversion);

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
        const toUnit = await unitsProvider.findUnit(toVal.label, fromUnit.unitFamily);
        const conversionData = await unitsProvider.getConversion(fromUnit, toUnit);
        assert.isTrue(Math.fround(conversionData.factor) === toVal.factor);
      }
    }
  });


  it("Generate Parse Tokens", async () => {

    const format = new Format("test");
    const testStrings = ["", "0/1", "1/0", "1/2", "-1/2", "+1/2", "2 /", "1.616252eggs", "1.616252E-35eggs", "-1.616252E-35eggs", "756345.345", "12,345.345", "3.6252e3 Miles", "-1 1/2 FT", "+1 1/2 FT", "-135°11'30.5\"", "-2FT 6IN", "135°11'30.5\"", "2FT 6IN", "1 1/2 FT"];

    const expectedTokens = [
      [],
      [{ value: 0 }],
      [{ value: 1 }],
      [{ value: 0.5 }],
      [{ value: -0.5 }],
      [{ value: 0.5 }],
      [{ value: 2 }],
      [{ value: 1.616252 }, { value: "eggs" }],
      [{ value: 1.616252e-35 }, { value: "eggs" }],
      [{ value: -1.616252e-35 }, { value: "eggs" }],
      [{ value: 756345.345 }],
      [{ value: 12345.345 }],
      [{ value: 3625.2 }, { value: "Miles" }],
      [{ value: -1.5 }, { value: "FT" }],
      [{ value: 1.5 }, { value: "FT" }],
      [{ value: -135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }],
      [{ value: -2 }, { value: "FT" }, { value: 6 }, { value: "IN" }],
      [{ value: 135 }, { value: "°" }, { value: 11 }, { value: "'" }, { value: 30.5 }, { value: "\"" }],
      [{ value: 2 }, { value: "FT" }, { value: 6 }, { value: "IN" }],
      [{ value: 1.5 }, { value: "FT" }],
    ];

    let i = 0;
    for (const strVal of testStrings) {
      const tokens = Parser.parseQuantitySpecification(strVal, format);
      assert.isTrue(tokens.length === expectedTokens[i].length);

      // tslint:disable-next-line:prefer-for-of
      for (let j = 0; j < tokens.length; j++) {
        assert.isTrue(tokens[j].value === expectedTokens[i][j].value);
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
        const toUnit = await unitsProvider.findUnit(toVal.label, fromUnit.unitFamily);
        const conversionData = await unitsProvider.getConversion(fromUnit, toUnit);
        assert.isTrue(Math.fround(conversionData.factor) === toVal.factor);
      }
    }
  });

  it("Parse into Length Quantities", async () => {
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
      { value: "3.6252e3 Miles", quantity: { magnitude: 3625.2, unitName: "Units.MILE" } },
      { value: "3.6252e-3 Miles", quantity: { magnitude: 0.0036252, unitName: "Units.MILE" } },
      { value: "3.6252e+3 Miles", quantity: { magnitude: 3625.2, unitName: "Units.MILE" } },
      { value: "-1 1/2FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "-2FT 6IN", quantity: { magnitude: -2.5, unitName: "Units.FT" } },
      { value: "1 1/2 FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "2FT 6IN", quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      { value: "-3IN", quantity: { magnitude: -3.0, unitName: "Units.IN" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity!.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity!.unitName);
    }
  });

  it("Parse into Length Quantities w/uom separator", async () => {
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
    };

    const testData = [
      { value: "12,345.345", quantity: { magnitude: 12345.345, unitName: "Units.FT" } },
      { value: "3.6252e3*Miles", quantity: { magnitude: 3625.2, unitName: "Units.MILE" } },
      { value: "-1 1/2*FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "-2*FT 6*IN", quantity: { magnitude: -2.5, unitName: "Units.FT" } },
      { value: "1 1/2*FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "2*FT 6*IN", quantity: { magnitude: 2.5, unitName: "Units.FT" } },
      { value: "-3*IN", quantity: { magnitude: -3.0, unitName: "Units.IN" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity!.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity!.unitName);
    }
  });


  it("Parse into Station Quantities", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatData = {
      "composite": {
        "includeZero": true,
        "spacer": " ",
        "units": [
          {
            "label": "ft",
            "name": "Units.FT"
          }
        ]
      },
      "formatTraits": ["trailZeroes", "keepSingleZero", "keepDecimalPoint"],
      "minWidth": 2,
      "precision": 2,
      "stationOffsetSize": 2,
      "type": "Station"
    };

    const testData = [
      { value: "7563+45.345", quantity: { magnitude: 756345.345, unitName: "Units.FT" } },
      { value: "-7563+45.345", quantity: { magnitude: -756345.345, unitName: "Units.FT" } },
    ];


    const format = new Format("test");
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity!.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity!.unitName);
    }
  });

  it("Parse into Angle Quantities", async () => {
    const formatData = {
      "composite": {
        "includeZero": true,
        "spacer": "",
        "units": [
          {
            "label": "°",
            "name": "Units.ARC_DEG"
          },
          {
            "label": "'",
            "name": "Units.ARC_MINUTE"
          },
          {
            "label": "\"",
            "name": "Units.ARC_SECOND"
          }
        ]
      },
      "formatTraits": ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      "precision": 4,
      "type": "Decimal",
      "uomSeparator": ""
    };

    const testData = [
      { value: "-135°11'30.5\"", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: -135.19180555555556, unitName: "Units.ARC_DEG" } },
      { value: "135°11'30.5\"", defaultUnit: "Units.ARC_DEG", quantity: { magnitude: 135.19180555555556, unitName: "Units.ARC_DEG" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity!.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity!.unitName);
    }
  });

  it("Parse into Length Quantities with Fraction dash", async () => {
    const formatData = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: "Fractional",
      uomSeparator: " ",
    };

    const testData = [
      { value: "-1-1/2FT", quantity: { magnitude: -1.5, unitName: "Units.FT" } },
      { value: "1-1/2 FT", quantity: { magnitude: 1.5, unitName: "Units.FT" } },
      { value: "FT", quantity: { magnitude: 0.0, unitName: "Units.FT" } },
    ];

    const unitsProvider = new TestUnitsProvider();
    const format = new Format("test");
    await format.fromJson(unitsProvider, formatData).catch(() => { });
    assert.isTrue(!format.hasUnits);

    for (const testEntry of testData) {
      const quantityProps = await Parser.parseIntoQuantity(testEntry.value, format, unitsProvider);
      assert.isTrue(Math.fround(quantityProps.magnitude) === Math.fround(testEntry.quantity!.magnitude));
      assert.isTrue(quantityProps.unit.name === testEntry.quantity!.unitName);
    }
  });
});
