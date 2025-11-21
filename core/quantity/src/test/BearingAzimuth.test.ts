/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, ParseError, Parser, ParserSpec, QuantityError, UnitProps, UnitsProvider } from "../core-quantity";

describe("Bearing format tests:", () => {
  let unitsProvider: TestUnitsProvider;
  let degree: UnitProps;
  let rad: UnitProps;
  let bearingDMS: Format;

  // Set up used in all tests
  beforeEach(async () => {
    unitsProvider = new TestUnitsProvider();

    degree = await unitsProvider.findUnitByName("Units.ARC_DEG");
    rad = await unitsProvider.findUnitByName("Units.RAD");

    const bearingDMSJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        spacer: ":",
        units: [
          { name: "Units.ARC_DEG" },
          { name: "Units.ARC_MINUTE" },
          { name: "Units.ARC_SECOND" },
        ],
      },
    };

    bearingDMS = new Format("BearingDMS");
    await bearingDMS.fromJSON(unitsProvider, bearingDMSJson);
  });

  it("should have valid units and format", () => {
    expect(degree.isValid).to.be.true;
    expect(rad.isValid).to.be.true;
    expect(bearingDMS.hasUnits).to.be.true;
  });

  it("Roundtrip persisted radian to and from bearing", async () => {
    const bearingDMSWithLabelJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };

    const bearingDecimalJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 6,
      precision: 3,
      type: "Bearing",
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const bearingDMSWithLabel = new Format("BearingDMSWithLabel");
    await bearingDMSWithLabel.fromJSON(unitsProvider, bearingDMSWithLabelJson);
    expect(bearingDMSWithLabel.hasUnits).to.be.true;

    const bearingDecimal = new Format("BearingDecimal");
    await bearingDecimal.fromJSON(unitsProvider, bearingDecimalJson);
    expect(bearingDecimal.hasUnits).to.be.true;

    const bearingDMSFormatter = await FormatterSpec.create("RadToBearingDMS", bearingDMS, unitsProvider, rad);
    const bearingDMSWithLabelFormatter = await FormatterSpec.create("RadToBearingDMSWithLabel", bearingDMSWithLabel, unitsProvider, rad);
    const bearingDecimalFormatter = await FormatterSpec.create("RadToBearingDecimal", bearingDecimal, unitsProvider, rad);

    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, rad);
    const bearingDMSWithLabelParser = await ParserSpec.create(bearingDMSWithLabel, unitsProvider, rad);
    const bearingDecimalParser = await ParserSpec.create(bearingDecimal, unitsProvider, rad);

    interface TestData {
      input: number;
      unit: UnitProps;
      dms: string;
      dmsWithLabel: string;
      decimal: string;
    }

    const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180);
    const testData: TestData[] = [
      { input: 0.0, unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 5.0, unit: rad, dms: "N05:00:00E", dmsWithLabel: "N05°00'00\"E", decimal: "N05.000°E" },
      { input: 45.0, unit: rad, dms: "N45:00:00E", dmsWithLabel: "N45°00'00\"E", decimal: "N45.000°E" },
      { input: 45.5028, unit: rad, dms: "N45:30:10E", dmsWithLabel: "N45°30'10\"E", decimal: "N45.503°E" },
      { input: 90.0, unit: rad, dms: "N90:00:00E", dmsWithLabel: "N90°00'00\"E", decimal: "N90.000°E" },
      { input: 135.0, unit: rad, dms: "S45:00:00E", dmsWithLabel: "S45°00'00\"E", decimal: "S45.000°E" },
      { input: 180.0, unit: rad, dms: "S00:00:00E", dmsWithLabel: "S00°00'00\"E", decimal: "S00.000°E" },
      { input: 225.0, unit: rad, dms: "S45:00:00W", dmsWithLabel: "S45°00'00\"W", decimal: "S45.000°W" },
      { input: 234.4972, unit: rad, dms: "S54:29:50W", dmsWithLabel: "S54°29'50\"W", decimal: "S54.497°W" },
      { input: 270.0, unit: rad, dms: "N90:00:00W", dmsWithLabel: "N90°00'00\"W", decimal: "N90.000°W" },
      { input: 315.0, unit: rad, dms: "N45:00:00W", dmsWithLabel: "N45°00'00\"W", decimal: "N45.000°W" },
      { input: 0.0, unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 52.0, unit: rad, dms: "N52:00:00E", dmsWithLabel: "N52°00'00\"E", decimal: "N52.000°E" },
      { input: 110.0, unit: rad, dms: "S70:00:00E", dmsWithLabel: "S70°00'00\"E", decimal: "S70.000°E" },
      { input: 580.0, unit: rad, dms: "S40:00:00W", dmsWithLabel: "S40°00'00\"W", decimal: "S40.000°W" },
      { input: 1000.0, unit: rad, dms: "N80:00:00W", dmsWithLabel: "N80°00'00\"W", decimal: "N80.000°W" },
    ];

    for (const entry of testData) {
      const radians = degreesToRadians(entry.input);
      const normalizedAngle = radians % (2 * Math.PI);

      const resultBearingDMS = Formatter.formatQuantity(radians, bearingDMSFormatter);
      expect(resultBearingDMS).to.be.eql(entry.dms);
      const parseBearingDMSResult = Parser.parseQuantityString(resultBearingDMS, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseBearingDMSResult)) {
        expect.fail(`Expected a parsed from bearing DMS input string ${resultBearingDMS}`);
      }
      expect(parseBearingDMSResult.value, `Parsed result for ${entry.input} from formatted ${resultBearingDMS}`).closeTo(normalizedAngle, 0.0001);

      const resultBearingDMSWithLabel = Formatter.formatQuantity(radians, bearingDMSWithLabelFormatter);
      expect(resultBearingDMSWithLabel).to.be.eql(entry.dmsWithLabel);
      const parseBearingDMSWithLabelResult = Parser.parseQuantityString(resultBearingDMSWithLabel, bearingDMSWithLabelParser);
      if (!Parser.isParsedQuantity(parseBearingDMSWithLabelResult)) {
        expect.fail(`Expected a parsed from bearing DMS with label input string ${resultBearingDMSWithLabel}`);
      }
      expect(parseBearingDMSWithLabelResult.value, `Parsed result for ${normalizedAngle} from formatted ${resultBearingDMSWithLabel}`).closeTo(normalizedAngle, 0.0001);

      const resultBearingDecimal = Formatter.formatQuantity(radians, bearingDecimalFormatter);
      expect(resultBearingDecimal).to.be.eql(entry.decimal);
      const parseBearingDecimalResult = Parser.parseQuantityString(resultBearingDecimal, bearingDecimalParser);
      if (!Parser.isParsedQuantity(parseBearingDecimalResult)) {
        expect.fail(`Expected a parsed from bearing decimal input string ${resultBearingDecimal}`);
      }
      expect(parseBearingDecimalResult.value, `Parsed result for ${normalizedAngle} from formatted ${resultBearingDecimal}`).closeTo(normalizedAngle, 0.0001);
    }
  });

  it("should handle mixed case directions in bearing strings", async () => {
    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, degree);

    const testData = [
      { input: "N45:00:00E", expected: 45.0 },
      { input: "n45:00:00e", expected: 45.0 },
      { input: "s45:00:00w", expected: 225.0 },
      { input: "S45:00:00E", expected: 135.0 },
    ];

    for (const entry of testData) {
      const parseResult = Parser.parseQuantityString(entry.input, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseResult)) {
        expect.fail(`Expected a parsed quantity for input ${entry.input}`);
      }
      expect(parseResult.value).to.be.eql(entry.expected);
    }
  });

  it("correctly parse and format supported bearing strings, reject unsupported strings, using Units.RAD and Units.ARC_DEG", async () => {
    const bearingFormatProps: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };

    const bearingFormat = new Format("bearing-flexible-parser");
    await bearingFormat.fromJSON(unitsProvider, bearingFormatProps);
    const bearingParserDeg = await ParserSpec.create(bearingFormat, unitsProvider, degree);
    const bearingFormatterDeg = await FormatterSpec.create("bearing-flexible-formatter", bearingFormat, unitsProvider, degree);
    const bearingParserRad = await ParserSpec.create(bearingFormat, unitsProvider, rad);
    const bearingFormatterRad = await FormatterSpec.create("bearing-flexible-formatter", bearingFormat, unitsProvider, rad);

    const validTestData = [
      { input: "N45 45 45E", expected:  45.7625, expectedText: "N45°45'45\"E" },
      { input: "N45 45 45e", expected:  45.7625, expectedText: "N45°45'45\"E" },
      { input: "n45 45 45E", expected:  45.7625, expectedText: "N45°45'45\"E" },
      { input: "n45 45 45e", expected:  45.7625, expectedText: "N45°45'45\"E" },
      { input: "n 45 45 45 e", expected: 45.7625, expectedText: "N45°45'45\"E" },
      { input: "n45.4545e", expected:  45.765, expectedText: "N45°45'45\"E" },
      { input: "n 45.4545 e", expected:  45.765, expectedText: "N45°45'45\"E" },
      { input: "n65.4545e",  expected:  65.7625, expectedText: "N65°45'45\"E" },
      { input: "n65 45 45e", expected:  65.7625, expectedText: "N65°45'45\"E" },
      { input: "n35 45 45.101e", expected: 35.762528, expectedText: "N35°45'45\"E" },
      { input: "n85 45 45.9e", expected: 85.76275, expectedText: "N85°45'46\"E" },
      { input: "n85 45 45e", expected: 85.7625, expectedText: "N85°45'45\"E" },
      { input: "n85 60 60e", expected: 86.0167, expectedText: "N86°01'00\"E" },
      { input: "n85 45 65e", expected: 85.76275, expectedText: "N85°46'05\"E" },
      { input: "s65:40:00w", expected: 245.667, expectedText: "S65°40'00\"W" },
      { input: "s45e", expected: 135, expectedText: "S45°00'00\"E" },
      { input: "S45E", expected: 135, expectedText: "S45°00'00\"E" },
      { input: "s45.45e",    expected: 134.25, expectedText: "S45°45'00\"E" },
      { input: "s45 45 00e", expected: 134.25, expectedText: "S45°45'00\"E" },
      { input: "s 45 45 00 e", expected: 134.25, expectedText: "S45°45'00\"E" },
      { input: "s45d45m45se", expected: 134.2375, expectedText: "S45°45'45\"E" },
      { input: "s45d45m45.0se", expected: 134.2375, expectedText: "S45°45'45\"E" },
      { input: "s45d45m45.0e", expected: 134.2375, expectedText: "S45°45'45\"E" },
      { input: "NE", expected: 45.0, expectedText: "N45°00'00\"E" },
      { input: "SE", expected: 135.0, expectedText: "S45°00'00\"E" },
      { input: "SW", expected: 225.0, expectedText: "S45°00'00\"W" },
      { input: "NW", expected: 315.0, expectedText: "N45°00'00\"W" },
      { input: "N45E", expected: 45.0, expectedText: "N45°00'00\"E" },
      { input: "S45W", expected: 225.0, expectedText: "S45°00'00\"W" },
      { input: "N45W", expected: 315.0, expectedText: "N45°00'00\"W" },
      { input: "S45E", expected: 135.0, expectedText: "S45°00'00\"E" },
      { input: "nE", expected: 45.0, expectedText: "N45°00'00\"E" },
      { input: "sW", expected: 225.0, expectedText: "S45°00'00\"W" },
      { input: "nW", expected: 315.0, expectedText: "N45°00'00\"W" },
      { input: "sE", expected: 135.0, expectedText: "S45°00'00\"E" },
      { input: "n45e", expected: 45.0, expectedText: "N45°00'00\"E" },
      { input: "s45w", expected: 225.0, expectedText: "S45°00'00\"W" },
      { input: "n45w", expected: 315.0, expectedText: "N45°00'00\"W" },
      { input: "s45e", expected: 135.0, expectedText: "S45°00'00\"E" },
      { input: "N", expected: 0.0, expectedText: "N00°00'00\"E" },
      { input: "S", expected: 180.0, expectedText: "S00°00'00\"E" },
      { input: "n", expected: 0.0, expectedText: "N00°00'00\"E" },
      { input: "s", expected: 180.0, expectedText: "S00°00'00\"E" },
    ];

    const validateRoundTrip = (input: string, expected: number, expectedText: string, formatSpec: FormatterSpec, parserSpec: ParserSpec) => {
      const result = Parser.parseQuantityString(input, parserSpec);
      if (!Parser.isParsedQuantity(result)) {
        expect.fail(`Expected a parsed quantity for input "${input}"`);
      }
      expect(result.value).to.be.closeTo(expected, 0.01);
      const formatted = Formatter.formatQuantity(result.value, formatSpec);
      expect(formatted).to.equal(expectedText);
    }

    for (const { input, expected, expectedText } of validTestData) {
      validateRoundTrip(input, expected, expectedText, bearingFormatterDeg, bearingParserDeg);

      const radians = expected * (Math.PI / 180);
      const normalizedAngle = radians % (2 * Math.PI);
      validateRoundTrip(input, normalizedAngle, expectedText, bearingFormatterRad, bearingParserRad);

    }
    const unsupportedInputs = [
      "s45+45+45e",
      "s45/45/45e",
      "s45*45*45e",
      "s45-45-45e",
    ];
    for (const input of unsupportedInputs) {
      const result = Parser.parseQuantityString(input, bearingParserDeg);
      expect(Parser.isParsedQuantity(result)).to.be.false;
    }
  });

  it("should correctly parse bearing using RAD units", async () => {
    const bearingRadJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        units: [
          { name: "Units.RAD" },
        ],
      },
    };

    const bearingRad = new Format("BearingRad");
    await bearingRad.fromJSON(unitsProvider, bearingRadJson);
    expect(bearingRad.hasUnits).to.be.true;

    const bearingRadParser = await ParserSpec.create(bearingRad, unitsProvider, rad);

    const testData = [
      { input: "N0.785398E", expected: 0.785398 }, // 45 degrees in radians
      { input: "S0.785398E", expected: 2.35619 }, // 135 degrees in radians
      { input: "S0.785398W", expected: 3.92699 }, // 225 degrees in radians
    ];

    for (const entry of testData) {
      const parseResult = Parser.parseQuantityString(entry.input, bearingRadParser);
      if (!Parser.isParsedQuantity(parseResult)) {
        expect.fail(`Expected a parsed quantity for input ${entry.input}`);
      }
      expect(parseResult.value).to.be.closeTo(entry.expected, 0.01);
    }
  });

  it("should handle special formats for bearing strings", async () => {
    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, degree);
    const bearingDMSParserRadOut = await ParserSpec.create(bearingDMS, unitsProvider, rad);

    const testData = [
      { input: "N", expectedDeg: 0.0, expectedRad: 0.0 },
      { input: "NE", expectedDeg: 45.0, expectedRad: 0.785398 },
      { input: "E", expectedDeg: 90.0, expectedRad: 1.570796 },
      { input: "SE", expectedDeg: 135.0, expectedRad: 2.356194 },
      { input: "S", expectedDeg: 180.0, expectedRad: 3.141592 },
      { input: "SW", expectedDeg: 225.0, expectedRad: 3.926990 },
      { input: "W", expectedDeg: 270.0, expectedRad: 4.712388 },
      { input: "NW", expectedDeg: 315.0, expectedRad: 5.497787 },
    ];

    for (const entry of testData) {
      const parseResultDeg = Parser.parseQuantityString(entry.input, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseResultDeg)) {
        expect.fail(`Expected a parsed quantity for input ${entry.input}`);
      }
      expect(parseResultDeg.value).closeTo(entry.expectedDeg, 0.01);

      const parseResultRad = Parser.parseQuantityString(entry.input, bearingDMSParserRadOut);
      if (!Parser.isParsedQuantity(parseResultRad)) {
        expect.fail(`Expected a parsed quantity for input ${entry.input}`);
      }
      expect(parseResultRad.value).closeTo(entry.expectedRad, 0.01);
    }
  });

  it("should handle value out of bound", async () => {
    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, degree);

    const testData = [
      { input: "N-45:00:00E", expected: 315.0 },
      { input: "S45:99:00E", expected: 133.35 }, // 180 - 45 - 99/60 = 133.35
    ]

    for (const entry of testData) {
      const parseResult = Parser.parseQuantityString(entry.input, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseResult)) {
        expect.fail(`Expected a parsed quantity for input ${entry.input}`);
      }
      expect(parseResult.value).closeTo(entry.expected, 0.01);
    }

  });

  it("should correctly format negative bearing values", async () => {
    const valueList = [
      { value: -45, expected: "N45°00'00\"W" },
      { value: -270, expected: "N90°00'00\"E" },  // -270° → same as 90°
    ];

    const formatProps: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };
    const format = new Format("bearing-format");
    await format.fromJSON(new TestUnitsProvider(), formatProps);

    const inputUnit = {
      name: "Units.ARC_DEG",
      label: "°",
      phenomenon: "Angle",
      system: "si",
      isValid: true,
    };
    const formatterSpec = await FormatterSpec.create("bearing-format", format, new TestUnitsProvider(), inputUnit);
    for (const { value, expected } of valueList) {
      const result = Formatter.formatQuantity(value, formatterSpec);
      expect(result).to.equal(expected);
    }
  });

  it("should correctly parse valid and reject invalid bearing strings", async () => {
    const bearingFormatProps: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };

    const bearingFormat = new Format("bearing-parser");
    await bearingFormat.fromJSON(unitsProvider, bearingFormatProps);
    const bearingParser = await ParserSpec.create(bearingFormat, unitsProvider, degree);
    // Valid inputs
    const validTestData = [
      { input: "N45:00:00E", expected: 45.0 },
      { input: "N-45:00:00E", expected: 315.0 },
      { input: "S90:00:00W", expected: 270.0 },
      { input: "S45:00:00W", expected: 225.0 },
      { input: "N00:00:00E", expected: 0.0 },
      { input: "S00:00:00W", expected: 180.0 },
      { input: "S89:59:59W", expected: 269.9997 },
      { input: "N89:59:59E", expected: 89.9997 },
      { input: "S-45:00:00W", expected: 135.0 },  // edge case
      { input: "N45:00:30E", expected: 45.0083 }, // valid with seconds
      { input: "N0:00:01E", expected: 0.0003 },
      { input: "S0:00:01W", expected: 180.0003 },
      { input: "N-0:00:01E", expected: 359.9997 },
      { input: "S-0:00:01W", expected: 179.9997 },
      { input: "N-89:59:59E", expected: 270.0003 },  // wrapped
      { input: "S-89:59:59W", expected: 89.9997 },   //
    ];

    for (const { input, expected } of validTestData) {
      const result = Parser.parseQuantityString(input, bearingParser);
      if (!Parser.isParsedQuantity(result)) {
        expect.fail(`Expected a parsed quantity for input "${input}"`);
      }
      expect(result.value).to.be.closeTo(expected, 0.01);
    }

    // Invalid inputs
    const invalidTestData = [
      "N200E",       // More than 90° in a quadrant
      "S361:00:00E", // Over 360°
      "N-200E",      // Overbound negative
      "N270:00:00E", // Like azimuth input in quadrant format
      "N90:00:01E",     // exceeds quarter revolution
      "S-90:00:01W",    // exceeds negative quarter revolution
      "N91:00:00E",     // degree overflow
      "S-91:00:00W",    // beyond acceptable negative angle
      "N-91:00:00E",    // beyond acceptable negative angle
      "N45:00:00",      // missing direction
      "E45:00:00W",     // invalid prefix
      "45:00:00E",      // missing prefix
      "N45:00:00EExtra", // unexpected suffix
      "N90:-44:-23E",
      "S-90:-00:-01W",
      "N-70:20:-5E"
    ];

    for (const input of invalidTestData) {
      const result = Parser.parseQuantityString(input, bearingParser);
      expect(Parser.isParsedQuantity(result), `Expected input "${input}" to be invalid`).to.be.false;
    }
  });

  it("should return ParseQuantityError if input string is incomplete", async () => {
    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, rad);

    const bearingDMSWithLabelJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };

    const bearingDecimalJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 6,
      precision: 3,
      type: "Bearing",
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const bearingDMSWithLabel = new Format("BearingDMSWithLabel");
    await bearingDMSWithLabel.fromJSON(unitsProvider, bearingDMSWithLabelJson);
    const bearingDecimal = new Format("BearingDecimal");
    await bearingDecimal.fromJSON(unitsProvider, bearingDecimalJson);
    const bearingDMSWithLabelParser = await ParserSpec.create(bearingDMSWithLabel, unitsProvider, rad);
    const bearingDecimalParser = await ParserSpec.create(bearingDecimal, unitsProvider, rad);

    const testData = [
      { dms: "S4", dmsWithLabel: "S4", decimal: "S4" },
      { dms: "S45", dmsWithLabel: "S45", decimal: "S45" },
      { dms: "S45:", dmsWithLabel: "S45°", decimal: "S45." },
      { dms: "S45:0", dmsWithLabel: "S45°0'", decimal: "S45.0" },
      { dms: "S45:00", dmsWithLabel: "S45°00'", decimal: "S45.00" },
      { dms: "S45:00:", dmsWithLabel: "S45°00'", decimal: "S45.000" },
      { dms: "S45:00:0", dmsWithLabel: "S45°00'0", decimal: "S45.000°" },
      { dms: "S45:00:00", dmsWithLabel: "S45°00'00" },
      { dmsWithLabel: "S45°00'00\"" },

      { dms: "00:00:00E", dmsWithLabel: "00°00'00\"E", decimal: "00.000°E" },
      { dms: "0:00:00E", dmsWithLabel: "0°00'00\"E", decimal: "0.000°E" },
      { dms: ":00:00E", dmsWithLabel: "°00'00\"E", decimal: ".000°E" },
      { dms: "00:00E", dmsWithLabel: "00'00\"E", decimal: "000°E" },
      { dms: "0:00E", dmsWithLabel: "0'00\"E", decimal: "00°E" },
      { dms: ":00E", dmsWithLabel: "'00\"E", decimal: "0°E" },
      { dms: "00E", dmsWithLabel: "00\"E", decimal: "°E" },
      { dms: "0E", dmsWithLabel: "0\"E" },
      { dmsWithLabel: "\"E" },

      { dms: "00:00:00", dmsWithLabel: "00°00'00\"", decimal: "00.000°" },

    ]

    for (const entry of testData) {
      if (entry.dms) {
        const parseResult = Parser.parseQuantityString(entry.dms, bearingDMSParser);
        if (Parser.isParseError(parseResult))
          expect(parseResult.error).to.be.eql(ParseError.BearingPrefixOrSuffixMissing);
      }

      if (entry.dmsWithLabel) {
        const parseResult = Parser.parseQuantityString(entry.dmsWithLabel, bearingDMSWithLabelParser);
        if (Parser.isParseError(parseResult))
          expect(parseResult.error).to.be.eql(ParseError.BearingPrefixOrSuffixMissing);
      }

      if (entry.decimal) {
        const parseResult = Parser.parseQuantityString(entry.decimal, bearingDecimalParser);
        if (Parser.isParseError(parseResult))
          expect(parseResult.error).to.be.eql(ParseError.BearingPrefixOrSuffixMissing);
      }

    }
  });

  it("should return ParseQuantityError if bearing string is invalid", async () => {
    const bearingDMSParser = await ParserSpec.create(bearingDMS, unitsProvider, degree);

    const testData = [
      { input: "NFE", expected: ParseError.NoValueOrUnitFoundInString },
      { input: "S45:00:-99W", expected: ParseError.MathematicOperationFoundButIsNotAllowed }, // only putting negative sign on first number is allowed
    ]

    for (const entry of testData) {
      const parseResult = Parser.parseQuantityString(entry.input, bearingDMSParser);
      if (Parser.isParseError(parseResult)) {
        expect(parseResult.error).to.be.eql(entry.expected);
      } else {
        expect.fail(`Expected a ParseQuantityError for input ${entry.input}`);
      }
    }
  });

});

describe("Azimuth format tests:", () => {

  it("Format radian as azimuth", async () => {
    const unitsProvider = new TestUnitsProvider();

    const azimuthDMSJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Azimuth",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        spacer: ":",
        units: [
          { name: "Units.ARC_DEG" },
          { name: "Units.ARC_MINUTE" },
          { name: "Units.ARC_SECOND" },
        ],
      },
    };

    const azimuthDecimalJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 6,
      precision: 3,
      type: "Azimuth",
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const azimuthDMS = new Format("azimuthDMS");
    await azimuthDMS.fromJSON(unitsProvider, azimuthDMSJson);
    expect(azimuthDMS.hasUnits).to.be.true;

    const azimuthDecimal = new Format("azimuthDecimal");
    await azimuthDecimal.fromJSON(unitsProvider, azimuthDecimalJson);
    expect(azimuthDecimal.hasUnits).to.be.true;

    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    expect(rad.isValid).to.be.true;
    const azimuthDMSFormatter = await FormatterSpec.create("RadToAzimuthDMS", azimuthDMS, unitsProvider, rad);
    const azimuthDecimalFormatter = await FormatterSpec.create("RadToAzimuthDecimal", azimuthDecimal, unitsProvider, rad);

    interface TestData {
      input: number;
      unit: UnitProps;
      dms: string;
      decimal: string;
    }

    const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180);
    const testData: TestData[] = [
      { input: 0.0, unit: rad, dms: "00:00:00", decimal: "00.000°" },
      { input: 5.0, unit: rad, dms: "05:00:00", decimal: "05.000°" },
      { input: 45.0, unit: rad, dms: "45:00:00", decimal: "45.000°" },
      { input: 45.5028, unit: rad, dms: "45:30:10", decimal: "45.503°" },
      { input: 90.0, unit: rad, dms: "90:00:00", decimal: "90.000°" },
      { input: 135.0, unit: rad, dms: "135:00:00", decimal: "135.000°" },
      { input: 180.0, unit: rad, dms: "180:00:00", decimal: "180.000°" },
      { input: 225.0, unit: rad, dms: "225:00:00", decimal: "225.000°" },
      { input: 234.4972, unit: rad, dms: "234:29:50", decimal: "234.497°" },
      { input: 270.0, unit: rad, dms: "270:00:00", decimal: "270.000°" },
      { input: 315.0, unit: rad, dms: "315:00:00", decimal: "315.000°" },
      { input: 0.0, unit: rad, dms: "00:00:00", decimal: "00.000°" },
      { input: 52.0, unit: rad, dms: "52:00:00", decimal: "52.000°" },
      { input: 110.0, unit: rad, dms: "110:00:00", decimal: "110.000°" },
      { input: 580.0, unit: rad, dms: "220:00:00", decimal: "220.000°" },
      { input: 1000.0, unit: rad, dms: "280:00:00", decimal: "280.000°" },
    ];

    for (const entry of testData) {
      const radians = degreesToRadians(entry.input);
      const resultBearingDMS = Formatter.formatQuantity(radians, azimuthDMSFormatter);
      expect(resultBearingDMS).to.be.eql(entry.dms);

      const resultBearingDecimal = Formatter.formatQuantity(radians, azimuthDecimalFormatter);
      expect(resultBearingDecimal).to.be.eql(entry.decimal);
    }
  });

  it("^Roundtrip degrees with various bases", async () => {
    const unitsProvider = new TestUnitsProvider();

    const azimuthDecimalJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 4,
      precision: 1,
      type: "Azimuth",
      azimuthCounterClockwise: false,
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      azimuthBaseUnit: "Units.ARC_DEG",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const createFormatter = async (baseInDegrees: number, counterClockwise: boolean): Promise<FormatterSpec> => {
      const props = {
        ...azimuthDecimalJson,
        azimuthBase: baseInDegrees,
        azimuthCounterClockwise: counterClockwise,
      };

      const format = new Format(`azimuthWith${baseInDegrees}Base`);
      await format.fromJSON(unitsProvider, props);
      expect(format.hasUnits).to.be.true;
      const deg: UnitProps = await unitsProvider.findUnitByName("Units.ARC_DEG");
      expect(deg.isValid).to.be.true;
      return FormatterSpec.create(`DegreeToAzimuthWith${baseInDegrees}Base`, format, unitsProvider, deg);
    };

    const createParser = async (baseInDegrees: number, counterClockwise: boolean): Promise<ParserSpec> => {
      const props = {
        ...azimuthDecimalJson,
        azimuthBase: baseInDegrees,
        azimuthCounterClockwise: counterClockwise,
      };

      const format = new Format(`azimuthWith${baseInDegrees}Base`);
      await format.fromJSON(unitsProvider, props);
      expect(format.hasUnits).to.be.true;
      const deg: UnitProps = await unitsProvider.findUnitByName("Units.ARC_DEG");
      expect(deg.isValid).to.be.true;
      return ParserSpec.create(format, unitsProvider, deg);
    };

    interface TestData {
      input: number;
      base: number;
      counterClockwise: boolean;
      result: string;
    }

    const testData: TestData[] = [
      { input: 0.0, base: 0.0, counterClockwise: false, result: "00.0°" },
      { input: 260.0, base: 180.0, counterClockwise: false, result: "80.0°" },
      { input: 0.0, base: 175.0, counterClockwise: false, result: "185.0°" },
      { input: 0.0, base: 175.0, counterClockwise: true, result: "175.0°" },
      { input: 0.0, base: 185.0, counterClockwise: true, result: "185.0°" },
      { input: 0.0, base: 95.0, counterClockwise: false, result: "265.0°" },
      { input: 0.0, base: 85.0, counterClockwise: false, result: "275.0°" },
      { input: 0.0, base: 270.0, counterClockwise: false, result: "90.0°" },
      { input: 0.0, base: 270.0, counterClockwise: true, result: "270.0°" },
      { input: 90.0, base: 0.0, counterClockwise: false, result: "90.0°" },
      { input: 90.0, base: 180.0, counterClockwise: false, result: "270.0°" },
      { input: 90.0, base: 175.0, counterClockwise: false, result: "275.0°" },
      { input: 80.0, base: 175.0, counterClockwise: false, result: "265.0°" },
      { input: 90.0, base: 185.0, counterClockwise: true, result: "95.0°" },
      { input: 90.0, base: 95.0, counterClockwise: false, result: "355.0°" },
      { input: 90.0, base: 85.0, counterClockwise: false, result: "05.0°" },
      { input: 90.0, base: 270.0, counterClockwise: false, result: "180.0°" },
      { input: 90.0, base: 270.0, counterClockwise: true, result: "180.0°" },
    ];

    for (const entry of testData) {
      const formatter = await createFormatter(entry.base, entry.counterClockwise);
      const result = Formatter.formatQuantity(entry.input, formatter);
      expect(result, formatter.name).to.be.eql(entry.result);

      const parser = await createParser(entry.base, entry.counterClockwise);
      const parseResult = Parser.parseQuantityString(result, parser);
      if (!Parser.isParsedQuantity(parseResult)) {
        expect.fail("Expected a parsed quantity");
      }
      expect(parseResult.value, `Parsed result for ${entry.input} with base ${entry.base} ccw: ${entry.counterClockwise}`).closeTo(entry.input, 0.0001);
    }
  });

  it("Format various units to azimuth", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 4,
      precision: 1,
      type: "Azimuth",
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      azimuthBase: 180.0,
      azimuthBaseUnit: "Units.ARC_DEG",
      azimuthCounterClockwise: false,
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const format = new Format(`azimuth`);
    await format.fromJSON(unitsProvider, formatJson);
    expect(format.hasUnits).to.be.true;
    const minutes: UnitProps = await unitsProvider.findUnitByName("Units.ARC_MINUTE");
    expect(minutes.isValid).to.be.true;
    const formatter = await FormatterSpec.create("Formatter", format, unitsProvider, minutes);
    const result = Formatter.formatQuantity(5100, formatter); // 85 degrees, angle with a South base
    expect(result).to.be.eql("265.0°");
  });

  it("Parse azimuth to quantity", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 4,
      precision: 1,
      type: "Azimuth",
      uomSeparator: "",
      revolutionUnit: "Units.REVOLUTION",
      azimuthBase: 180.0,
      azimuthBaseUnit: "Units.ARC_DEG",
      azimuthCounterClockwise: false,
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const format = new Format(`azimuth`);
    await format.fromJSON(unitsProvider, formatJson);
    expect(format.hasUnits).to.be.true;
    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    expect(rad.isValid).to.be.true;
    const formatter = await FormatterSpec.create("Formatter", format, unitsProvider, rad);
    const parser = await ParserSpec.create(format, unitsProvider, rad, unitsProvider);
    const parseResult = Parser.parseQuantityString("265.0°", parser);
    if (!Parser.isParsedQuantity(parseResult)) {
      expect.fail("Expected a parsed quantity");
    }
    expect(parseResult.value).closeTo(1.4835, 0.0001);
    const formattedValue = Formatter.formatQuantity(parseResult.value, formatter);
    expect(formattedValue).to.be.eql("265.0°");
  });
});

describe("Azimuth and Revolution formatting that throws error:", () => {
  const unitsProvider: UnitsProvider = {
    findUnitByName: async (name: string) => {
      if (name === "invalidUnit") {
        return { isValid: false };
      }
      return { isValid: true };
    },
  } as UnitsProvider;

  const testFormatWithAzimuthType = new Format("testAzimuthFormat");

  it("should throw an error if azimuthBaseUnit is not a string", async () => {
    const jsonObj: FormatProps = {
      azimuthBaseUnit: 123 as unknown as string,
      type: "azimuth",
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("The Format testAzimuthFormat has an invalid 'azimuthBaseUnit' attribute. It should be of type 'string'.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });

  it("should throw an error if azimuthBaseUnit is invalid", async () => {
    const jsonObj: FormatProps = {
      azimuthBaseUnit: "invalidUnit",
      type: "azimuth",
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("Invalid unit name 'invalidUnit' for azimuthBaseUnit in Format 'testAzimuthFormat'.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });

  it("should throw an error if revolutionUnit is not a string", async () => {
    const jsonObj: FormatProps = {
      revolutionUnit: 123 as unknown as string, // Invalid type
      type: "azimuth",
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("The Format testAzimuthFormat has an invalid 'revolutionUnit' attribute. It should be of type 'string'.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });

  it("should throw an error if revolutionUnit is invalid", async () => {
    const jsonObj: FormatProps = {
      revolutionUnit: "invalidUnit",
      type: "azimuth",
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("Invalid unit name 'invalidUnit' for revolutionUnit in Format 'testAzimuthFormat'.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });

  it("should throw an error if revolutionUnit is required but not provided", async () => {
    const jsonObj: FormatProps = {
      type: "azimuth",
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("The Format testAzimuthFormat is 'Azimuth' or 'Bearing' type therefore the attribute 'revolutionUnit' is required.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });

  it("should throw an error if _azimuthBase is defined and _azimuthBaseUnit is undefined when revolutionUnit is defined", async () => {
    const jsonObj = {
      type: "azimuth",
      revolutionUnit: "Units.REVOLUTION",
      azimuthBase: 123,
    };

    try {
      await testFormatWithAzimuthType.fromJSON(unitsProvider, jsonObj);
      expect.fail("Expected error was not thrown");
    } catch (e: any) {
      expect(e.message).toEqual("The Format testAzimuthFormat has an 'azimuthBase' attribute therefore the attribute 'azimuthBaseUnit' is required.");
      expect(e).toBeInstanceOf(QuantityError);
    }
  });
});
