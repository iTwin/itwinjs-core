/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { Formatter } from "../Formatter/Formatter";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, UnitProps } from "../core-quantity";

describe("Bearing direction tests:", () => {

  it("Format radian", async () => {
    const unitsProvider = new TestUnitsProvider();

    const bearingDMSJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Bearing",
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

    interface TestData {
      input: number;
      unit: UnitProps;
      dms: string;
      dmsWithLabel: string;
      decimal: string;
    }

    const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180);
    const testData: TestData[] = [
      { input: 0.0,      unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 5.0,      unit: rad, dms: "N05:00:00E", dmsWithLabel: "N05°00'00\"E", decimal: "N05.000°E" },
      { input: 45.0,     unit: rad, dms: "N45:00:00E", dmsWithLabel: "N45°00'00\"E", decimal: "N45.000°E" },
      { input: 45.5028,  unit: rad, dms: "N45:30:10E", dmsWithLabel: "N45°30'10\"E", decimal: "N45.503°E" },
      { input: 90.0,     unit: rad, dms: "N90:00:00E", dmsWithLabel: "N90°00'00\"E", decimal: "N90.000°E" },
      { input: 135.0,    unit: rad, dms: "S45:00:00E", dmsWithLabel: "S45°00'00\"E", decimal: "S45.000°E" },
      { input: 180.0,    unit: rad, dms: "S00:00:00E", dmsWithLabel: "S00°00'00\"E", decimal: "S00.000°E" },
      { input: 225.0,    unit: rad, dms: "S45:00:00W", dmsWithLabel: "S45°00'00\"W", decimal: "S45.000°W" },
      { input: 234.4972, unit: rad, dms: "S54:29:50W", dmsWithLabel: "S54°29'50\"W", decimal: "S54.497°W" },
      { input: 270.0,    unit: rad, dms: "S90:00:00W", dmsWithLabel: "S90°00'00\"W", decimal: "S90.000°W" },
      { input: 315.0,    unit: rad, dms: "N45:00:00W", dmsWithLabel: "N45°00'00\"W", decimal: "N45.000°W" },
      { input: 360.0,    unit: rad, dms: "N00:00:00E", dmsWithLabel: "N00°00'00\"E", decimal: "N00.000°E" },
      { input: 412.0,    unit: rad, dms: "N52:00:00E", dmsWithLabel: "N52°00'00\"E", decimal: "N52.000°E" },
      { input: 470.0,    unit: rad, dms: "S70:00:00E", dmsWithLabel: "S70°00'00\"E", decimal: "S70.000°E" },
      { input: 580.0,    unit: rad, dms: "S40:00:00W", dmsWithLabel: "S40°00'00\"W", decimal: "S40.000°W" },
      { input: 640.0,    unit: rad, dms: "N80:00:00W", dmsWithLabel: "N80°00'00\"W", decimal: "N80.000°W" },
    ];

    for (const entry of testData) {
      const radians = degreesToRadians(entry.input);
      const resultBearingDMS = Formatter.formatQuantity(radians, bearingDMSFormatter);
      expect(resultBearingDMS).to.be.eql(entry.dms);

      const resultBearingDMSWithLabel = Formatter.formatQuantity(radians, bearingDMSWithLabelFormatter);
      expect(resultBearingDMSWithLabel).to.be.eql(entry.dmsWithLabel);

      const resultBearingDecimal = Formatter.formatQuantity(radians, bearingDecimalFormatter);
      expect(resultBearingDecimal).to.be.eql(entry.decimal);
    }
  });
});

describe("Azimuth direction tests:", () => {

  it("Format radian", async () => {
    const unitsProvider = new TestUnitsProvider();

    const azimuthDMSJson: FormatProps = {
      minWidth: 2,
      precision: 0,
      type: "Azimuth",
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
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
        ],
      },
    };

    const azimuthDMS = new Format("BearingDMS");
    await azimuthDMS.fromJSON(unitsProvider, azimuthDMSJson).catch(() => { });
    assert.isTrue(azimuthDMS.hasUnits);

    const azimuthDecimal = new Format("BearingDecimal");
    await azimuthDecimal.fromJSON(unitsProvider, azimuthDecimalJson).catch(() => { });
    assert.isTrue(azimuthDecimal.hasUnits);

    const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
    assert.isTrue(rad.isValid);
    const azimuthDMSFormatter = await FormatterSpec.create("RadToBearingDMS", azimuthDMS, unitsProvider, rad);
    const azimuthDecimalFormatter = await FormatterSpec.create("RadToBearingDecimal", azimuthDecimal, unitsProvider, rad);

    interface TestData {
      input: number;
      unit: UnitProps;
      dms: string;
      decimal: string;
    }

    const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180);
    const testData: TestData[] = [
      { input: 0.0,      unit: rad, dms: "00:00:00", decimal: "00.000°"},
      { input: 5.0,      unit: rad, dms: "05:00:00", decimal: "05.000°"},
      { input: 45.0,     unit: rad, dms: "45:00:00", decimal: "45.000°"},
      { input: 45.5028,  unit: rad, dms: "45:30:10", decimal: "45.503°"},
      { input: 90.0,     unit: rad, dms: "90:00:00", decimal: "90.000°"},
      { input: 135.0,    unit: rad, dms: "135:00:00", decimal: "135.000°"},
      { input: 180.0,    unit: rad, dms: "180:00:00", decimal: "180.000°"},
      { input: 225.0,    unit: rad, dms: "225:00:00", decimal: "225.000°"},
      { input: 234.4972, unit: rad, dms: "234:29:50", decimal: "234.497°"},
      { input: 270.0,    unit: rad, dms: "270:00:00", decimal: "270.000°"},
      { input: 315.0,    unit: rad, dms: "315:00:00", decimal: "315.000°"},
      { input: 360.0,    unit: rad, dms: "00:00:00", decimal: "00.000°"},
      { input: 412.0,    unit: rad, dms: "52:00:00", decimal: "52.000°"},
      { input: 470.0,    unit: rad, dms: "110:00:00", decimal: "110.000°"},
      { input: 580.0,    unit: rad, dms: "220:00:00", decimal: "220.000°"},
      { input: 640.0,    unit: rad, dms: "280:00:00", decimal: "280.000°"},
    ];

    for (const entry of testData) {
      const radians = degreesToRadians(entry.input);
      const resultBearingDMS = Formatter.formatQuantity(radians, azimuthDMSFormatter);
      expect(resultBearingDMS).to.be.eql(entry.dms);

      const resultBearingDecimal = Formatter.formatQuantity(radians, azimuthDecimalFormatter);
      expect(resultBearingDecimal).to.be.eql(entry.decimal);
    }
  });

  it("Format degrees with various bases", async () => {
    const unitsProvider = new TestUnitsProvider();

    const azimuthDecimalJson: FormatProps = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 4,
      precision: 1,
      type: "Azimuth",
      uomSeparator: "",
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
        formatTraits: Array.isArray(azimuthDecimalJson.formatTraits) ? [...azimuthDecimalJson.formatTraits] : [], // Deep copy with type guard
      };

      if(counterClockwise && Array.isArray(props.formatTraits)) {
        props.formatTraits.push("counterClockwiseAngle");
      }

      const format = new Format(`azimuthWith${baseInDegrees}Base`);
      await format.fromJSON(unitsProvider, props);
      assert.isTrue(format.hasUnits);
      return FormatterSpec.create(`DegreeToAzimuthWith${baseInDegrees}Base`, format, unitsProvider);
    };

    const unit: UnitProps = await unitsProvider.findUnitByName("Units.ARC_DEG");
    assert.isTrue(unit.isValid);

    interface TestData {
      input: number;
      base: number;
      counterClockwise: boolean;
      result: string;
    }

    const testData: TestData[] = [
      { input: 0.0,   base: 0.0,   counterClockwise: false, result: "00.0°" },
      { input: 0.0,   base: 180.0, counterClockwise: false, result: "180.0°" },
      { input: 0.0,   base: 185.0, counterClockwise: false, result: "175.0°" },
      { input: 0.0,   base: 185.0, counterClockwise: true,  result: "185.0°" },
      { input: 0.0,   base: 95.0,  counterClockwise: false, result: "265.0°" },
      { input: 0.0,   base: 85.0,  counterClockwise: false, result: "275.0°" },
      { input: 0.0,   base: 270.0, counterClockwise: false, result: "90.0°" },
      { input: 0.0,   base: 270.0, counterClockwise: true,  result: "270.0°" },
      { input: 90.0,  base: 0.0,   counterClockwise: false, result: "90.0°" },
      { input: 90.0,  base: 180.0, counterClockwise: false, result: "270.0°" },
      { input: 90.0,  base: 185.0, counterClockwise: false, result: "265.0°" },
      { input: 90.0,  base: 185.0, counterClockwise: true,  result: "95.0°" },
      { input: 90.0,  base: 95.0,  counterClockwise: false, result: "355.0°" },
      { input: 90.0,  base: 85.0,  counterClockwise: false, result: "05.0°" },
      { input: 90.0,  base: 270.0, counterClockwise: false, result: "180.0°" },
      { input: 90.0,  base: 270.0, counterClockwise: true,  result: "180.0°" },
    ];

    for (const entry of testData) {
      const formatter = await createFormatter(entry.base, entry.counterClockwise);
      const result = Formatter.formatQuantity(entry.input, formatter);
      expect(result, formatter.name).to.be.eql(entry.result);
    }
  });
});
