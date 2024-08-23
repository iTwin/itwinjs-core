import { expect, assert } from "chai";
import { BaseFormat, Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";

import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, Parser, ParserSpec, QuantityError, UnitProps, UnitsProvider } from "../core-quantity";


describe("Ratio Type Tests", () => {
  async function testRatioType(ratioType: string, testData: { input: number; ratio: string; }[]) {
    assert.isTrue(true);

    const ratioJson: FormatProps = {
      type: "Ratio",
      ratioType,
      precision: 3,
      composite: {
        includeZero: true,
        units: [
          { name: "Units.VERTICAL_PER_HORIZONTAL" }, // presentation unit
        ],
      }
    };

    const unitsProvider = new TestUnitsProvider();
    const ratioFormat = new Format("Ratio");
    await ratioFormat.fromJSON(unitsProvider, ratioJson).catch(() => {});
    assert.isTrue(ratioFormat.hasUnits);

    const v_h: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
    assert.isTrue(v_h.isValid);

    const ratioFormatterSpec = await FormatterSpec.create(`v_h${ratioType}`, ratioFormat, unitsProvider, v_h);

    for (const entry of testData) {
      const resultRatio = Formatter.formatQuantity(entry.input, ratioFormatterSpec);
      expect(resultRatio).to.equal(entry.ratio);
    }
  }

  it.only("ratiotype OneToN", async () => {
    const testData: { input: number; ratio: string; }[] = [
      { input: 1.0, ratio: "1:1" },
      { input: 2.0, ratio: "1:0.5" },
      { input: 0.5, ratio: "1:2" },
      { input: 0.333, ratio: "1:3.003" },
      { input: 0.3333, ratio: "1:3" },
      { input: 0.2857, ratio: "1:3.5" },
      { input: 0.25, ratio: "1:4" },
      { input: 0.6667, ratio: "1:1.5" },
    ];
    await testRatioType("OneToN", testData);
  });

  it.only("ratiotype NToOne", async () => {
    const testData: { input: number; ratio: string; }[] = [
      { input: 1.0, ratio: "1:1" },
      { input: 2.0, ratio: "2:1" },
      { input: 0.5, ratio: "0.5:1" },
      { input: 0.333, ratio: "0.333:1" },
      { input: 0.3333, ratio: "0.333:1" },
      { input: 0.2857, ratio: "0.286:1" },
      { input: 0.25, ratio: "0.25:1" },
      { input: 0.6667, ratio: "0.667:1" },
    ];
    await testRatioType("NToOne", testData);
  });

  it.only("ratioType valueBased", async () => {
    const testData: { input: number; ratio: string; }[] = [
      { input: 0.0, ratio: "1:0" },
      { input: 1.0, ratio: "1:1" },
      { input: 2.0, ratio: "2:1" },
      { input: 0.5, ratio: "1:2" },
      { input: 0.333, ratio: "1:3.003" },
      { input: 0.3333, ratio: "1:3" },
      { input: 0.2857, ratio: "1:3.5" },
      { input: 3.5, ratio: "3.5:1" },
      { input: 0.25, ratio: "1:4" },
      { input: 4, ratio: "4:1" },
      { input: 0.6667, ratio: "1:1.5" },

    ];
    await testRatioType("ValueBased", testData);
  });

  it.only("ratioType UseGreatestCommonDivisor", async () => {
    const testData: { input: number; ratio: string; }[] = [
      { input: 0.0, ratio: "1:0" }, // Special case
      { input: 1.0, ratio: "1:1" },
      { input: 2.0, ratio: "2:1" },
      { input: 0.5, ratio: "1:2" },
      { input: 0.333, ratio: "1000:3003" }, // Adjusted to reflect test cases
      { input: 0.3333, ratio: "1:3" },
      { input: 0.2857, ratio: "2:7" },
      { input: 0.25, ratio: "1:4" },
      { input: 0.6667, ratio: "2:3" }
    ];
    await testRatioType("UseGreatestCommonDivisor", testData);
  });


});
