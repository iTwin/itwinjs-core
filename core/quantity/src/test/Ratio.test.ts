import { expect, assert } from "chai";
import { BaseFormat, Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";

import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, Parser, ParserSpec, QuantityError, UnitProps, UnitsProvider } from "../core-quantity";


describe("Ratio tests", () => {
  it.only ("ratio init fromJSON", async () => {
    assert.isTrue(true);

    const ratioJson: FormatProps ={
      type: "Ratio",
      ratioType: "OneToN",
      precision: 4,
      composite: {
        includeZero: true,
        units: [
          { name: "Units.VERTICAL_PER_HORIZONTAL"}, // presentation unit
        ],
      }
    }

    const unitsProvider = new TestUnitsProvider();
    const ratioFormat = new Format("Ratio"); // I already specified the type in JSON though
    await ratioFormat.fromJSON(unitsProvider, ratioJson).catch(() => {});
    assert.isTrue(ratioFormat.hasUnits);

    const v_h: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
    assert.isTrue(v_h.isValid);
    const ratioFormatter = await FormatterSpec.create("v_hOneToN", ratioFormat, unitsProvider, v_h); // v_h is persistent unit
    // const ratioParser = await ParserSpec.create(ratio, unitsProvider, v_h);

    interface TestData {
      input: number;
      unit: UnitProps;
      ratio: string;
    }

    // does input accept negative values?
    const testData: TestData[] = [
      { input: 1.0, unit: v_h, ratio: "1:1" },
      { input: 2.0, unit: v_h, ratio: "2:1" },
      { input: 0.5, unit: v_h, ratio: "1:2" },
    ];

    for (const entry of testData){
      const resultRatio = Formatter.formatQuantity(entry.input, ratioFormatter);
      expect(resultRatio).to.equal(entry.ratio);
    }

  })
})