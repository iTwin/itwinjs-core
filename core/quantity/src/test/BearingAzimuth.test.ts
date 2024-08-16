/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, Parser, ParserSpec, UnitProps } from "../core-quantity";

describe("Bearing format tests:", () => {
  it.only("Roundtrip persisted radian to and from bearing", async () => {
    const unitsProvider = new TestUnitsProvider();

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

    const bearingDMS = new Format("BearingDMS");
    await bearingDMS.fromJSON(unitsProvider, bearingDMSJson).catch(() => { });
    assert.isTrue(bearingDMS.hasUnits);

    const bearingDMSWithLabel = new Format("BearingDMSWithLabel");
    await bearingDMSWithLabel.fromJSON(unitsProvider, bearingDMSWithLabelJson).catch(() => { });
    assert.isTrue(bearingDMSWithLabel.hasUnits);

    const bearingDecimal = new Format("BearingDecimal");
    await bearingDecimal.fromJSON(unitsProvider, bearingDecimalJson).catch(() => { });
    assert.isTrue(bearingDecimal.hasUnits);

    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    assert.isTrue(rad.isValid);
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
      { input: 90.0,     unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 85.0,     unit: rad, dms: "N05:00:00E", dmsWithLabel: "N05°00'00\"E", decimal: "N05.000°E" },
      { input: 45.0,     unit: rad, dms: "N45:00:00E", dmsWithLabel: "N45°00'00\"E", decimal: "N45.000°E" },
      { input: 44.4972,  unit: rad, dms: "N45:30:10E", dmsWithLabel: "N45°30'10\"E", decimal: "N45.503°E" },
      { input: 0.0,      unit: rad, dms: "N90:00:00E", dmsWithLabel: "N90°00'00\"E", decimal: "N90.000°E" },
      { input: 315.0,    unit: rad, dms: "S45:00:00E", dmsWithLabel: "S45°00'00\"E", decimal: "S45.000°E" },
      { input: 270.0,    unit: rad, dms: "S00:00:00E", dmsWithLabel: "S00°00'00\"E", decimal: "S00.000°E" },
      { input: 225.0,    unit: rad, dms: "S45:00:00W", dmsWithLabel: "S45°00'00\"W", decimal: "S45.000°W" },
      { input: 215.5028, unit: rad, dms: "S54:29:50W", dmsWithLabel: "S54°29'50\"W", decimal: "S54.497°W" },
      { input: 180.0,    unit: rad, dms: "N90:00:00W", dmsWithLabel: "N90°00'00\"W", decimal: "N90.000°W" },
      { input: 135.0,    unit: rad, dms: "N45:00:00W", dmsWithLabel: "N45°00'00\"W", decimal: "N45.000°W" },
      { input: 90.0,     unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 38.0,     unit: rad, dms: "N52:00:00E", dmsWithLabel: "N52°00'00\"E", decimal: "N52.000°E" },
      { input: 340.0,    unit: rad, dms: "S70:00:00E", dmsWithLabel: "S70°00'00\"E", decimal: "S70.000°E" },
      { input: 590.0,    unit: rad, dms: "S40:00:00W", dmsWithLabel: "S40°00'00\"W", decimal: "S40.000°W" },
      { input: 890.0,    unit: rad, dms: "N80:00:00W", dmsWithLabel: "N80°00'00\"W", decimal: "N80.000°W" },
    ];

    for (const entry of testData) {
      const radians = degreesToRadians(entry.input);

      const resultBearingDMS = Formatter.formatQuantity(radians, bearingDMSFormatter);
      expect(resultBearingDMS).to.be.eql(entry.dms);
      const parseBearingDMSResult = Parser.parseQuantityString(resultBearingDMS, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseBearingDMSResult)) {
        assert.fail(`Expected a parsed from bearing DMS input string ${resultBearingDMS}`);
      }
      expect(parseBearingDMSResult.value, `Parsed result for ${entry.input} from formatted ${resultBearingDMS}`).closeTo(radians, 0.0001);

      const resultBearingDMSWithLabel = Formatter.formatQuantity(radians, bearingDMSWithLabelFormatter);
      expect(resultBearingDMSWithLabel).to.be.eql(entry.dmsWithLabel);
      const parseBearingDMSWithLabelResult = Parser.parseQuantityString(resultBearingDMSWithLabel, bearingDMSWithLabelParser);
      if (!Parser.isParsedQuantity(parseBearingDMSWithLabelResult)) {
        assert.fail(`Expected a parsed from bearing DMS with label input string ${resultBearingDMSWithLabel}`);
      }
      expect(parseBearingDMSWithLabelResult.value, `Parsed result for ${entry.input} from formatted ${resultBearingDMSWithLabel}`).closeTo(radians, 0.0001);

      const resultBearingDecimal = Formatter.formatQuantity(radians, bearingDecimalFormatter);
      expect(resultBearingDecimal).to.be.eql(entry.decimal);
      const parseBearingDecimalResult = Parser.parseQuantityString(resultBearingDecimal, bearingDecimalParser);
      if (!Parser.isParsedQuantity(parseBearingDecimalResult)) {
        assert.fail(`Expected a parsed from bearing decimal input string ${resultBearingDecimal}`);
      }
      expect(parseBearingDecimalResult.value, `Parsed result for ${entry.input} from formatted ${resultBearingDecimal}`).closeTo(radians, 0.0001);
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
    await azimuthDMS.fromJSON(unitsProvider, azimuthDMSJson).catch(() => { });
    assert.isTrue(azimuthDMS.hasUnits);

    const azimuthDecimal = new Format("azimuthDecimal");
    await azimuthDecimal.fromJSON(unitsProvider, azimuthDecimalJson).catch(() => { });
    assert.isTrue(azimuthDecimal.hasUnits);

    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    assert.isTrue(rad.isValid);
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
      { input: 90.0,     unit: rad, dms: "00:00:00", decimal: "00.000°"},
      { input: 85.0,     unit: rad, dms: "05:00:00", decimal: "05.000°"},
      { input: 45.0,     unit: rad, dms: "45:00:00", decimal: "45.000°"},
      { input: 44.4972,  unit: rad, dms: "45:30:10", decimal: "45.503°"},
      { input: 0.0,      unit: rad, dms: "90:00:00", decimal: "90.000°"},
      { input: 315.0,    unit: rad, dms: "135:00:00", decimal: "135.000°"},
      { input: 270.0,    unit: rad, dms: "180:00:00", decimal: "180.000°"},
      { input: 225.0,    unit: rad, dms: "225:00:00", decimal: "225.000°"},
      { input: 215.5028, unit: rad, dms: "234:29:50", decimal: "234.497°"},
      { input: 180.0,    unit: rad, dms: "270:00:00", decimal: "270.000°"},
      { input: 135.0,    unit: rad, dms: "315:00:00", decimal: "315.000°"},
      { input: 90.0,     unit: rad, dms: "00:00:00", decimal: "00.000°"},
      { input: 38.0,     unit: rad, dms: "52:00:00", decimal: "52.000°"},
      { input: 340.0,    unit: rad, dms: "110:00:00", decimal: "110.000°"},
      { input: 590.0,    unit: rad, dms: "220:00:00", decimal: "220.000°"},
      { input: 890.0,    unit: rad, dms: "280:00:00", decimal: "280.000°"},
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
      assert.isTrue(format.hasUnits);
      const deg: UnitProps = await unitsProvider.findUnitByName("Units.ARC_DEG");
      assert.isTrue(deg.isValid);
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
      assert.isTrue(format.hasUnits);
      const deg: UnitProps = await unitsProvider.findUnitByName("Units.ARC_DEG");
      assert.isTrue(deg.isValid);
      return ParserSpec.create(format, unitsProvider, deg);
    };

    interface TestData {
      input: number;
      base: number;
      counterClockwise: boolean;
      result: string;
    }

    const testData: TestData[] = [
      { input: 90.0, base: 90.0,   counterClockwise: false, result: "00.0°" },
      { input: 190.0, base: 270.0, counterClockwise: false, result: "80.0°" },
      { input: 90.0, base: 275.0, counterClockwise: false, result: "185.0°" },
      { input: 90.0, base: 275.0, counterClockwise: true, result: "175.0°" },
      { input: 90.0, base: 265.0, counterClockwise: true,  result: "185.0°" },
      { input: 90.0, base: 355.0,  counterClockwise: false, result: "265.0°" },
      { input: 90.0, base: 5.0,  counterClockwise: false, result: "275.0°" },
      { input: 90.0, base: 180.0, counterClockwise: false, result: "90.0°" },
      { input: 90.0, base: 180.0, counterClockwise: true,  result: "270.0°" },
      { input: 0.0,  base: 90.0,   counterClockwise: false, result: "90.0°" },
      { input: 0.0,  base: 270.0, counterClockwise: false, result: "270.0°" },
      { input: 0.0,  base: 275.0, counterClockwise: false, result: "275.0°" },
      { input: 10.0, base: 275.0, counterClockwise: false, result: "265.0°" },
      { input: 0.0,  base: 265.0, counterClockwise: true,  result: "95.0°" },
      { input: 0.0,  base: 355.0,  counterClockwise: false, result: "355.0°" },
      { input: 0.0,  base: 5.0,  counterClockwise: false, result: "05.0°" },
      { input: 0.0,  base: 180.0, counterClockwise: false, result: "180.0°" },
      { input: 0.0,  base: 180.0, counterClockwise: true,  result: "180.0°" },
    ];

    for (const entry of testData) {
      const formatter = await createFormatter(entry.base, entry.counterClockwise);
      const result = Formatter.formatQuantity(entry.input, formatter);
      expect(result, formatter.name).to.be.eql(entry.result);

      const parser = await createParser(entry.base, entry.counterClockwise);
      const parseResult = Parser.parseQuantityString(result, parser);
      if (!Parser.isParsedQuantity(parseResult)) {
        assert.fail("Expected a parsed quantity");
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
      azimuthBase: 270.0,
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
    assert.isTrue(format.hasUnits);
    const minutes: UnitProps = await unitsProvider.findUnitByName("Units.ARC_MINUTE");
    assert.isTrue(minutes.isValid);
    const formatter = await FormatterSpec.create("Formatter", format, unitsProvider, minutes);
    const result = Formatter.formatQuantity(300, formatter); // 85 degrees (5° ccw from east) angle with a South base
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
      azimuthBase: 270.0,
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
    assert.isTrue(format.hasUnits);
    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    assert.isTrue(rad.isValid);
    const formatter = await FormatterSpec.create("Formatter", format, unitsProvider, rad);
    const parser = await ParserSpec.create(format, unitsProvider, rad, unitsProvider);
    const parseResult = Parser.parseQuantityString("265.0°", parser);
    if (!Parser.isParsedQuantity(parseResult)) {
      assert.fail("Expected a parsed quantity");
    }
    expect(parseResult.value).closeTo(0.0872665, 0.0001);
    const formattedValue = Formatter.formatQuantity(parseResult.value, formatter);
    expect(formattedValue).to.be.eql("265.0°");
  });
});
