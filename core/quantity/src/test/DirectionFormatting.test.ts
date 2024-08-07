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

  it.only("Format radian angle as bearing", async () => {
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
      // eslint-disable-next-line no-console
      // console.log(testEntry.magnitude.toString() + " " + testEntry.unit.label + " => " + formattedValue);
    }
  });
});
