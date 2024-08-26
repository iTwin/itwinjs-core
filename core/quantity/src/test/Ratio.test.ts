import { expect, assert } from "chai";
import { BaseFormat, Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";

import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, Parser, ParserSpec, QuantityError, UnitProps, UnitsProvider } from "../core-quantity";


describe("Ratio Type Tests", () => {
  async function testRatioType(ratioType: string, testData: { input: number; ratio: string; precision?:number}[]) {
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

    const ratioFormatterSpec = await FormatterSpec.create(`${ratioType}`, ratioFormat, unitsProvider, v_h); //persisted unit

    for (const entry of testData) {
      if (null != entry.precision)
        ratioFormatterSpec.format.precision = entry.precision;
      const resultRatio = Formatter.formatQuantity(entry.input, ratioFormatterSpec);
      expect(resultRatio).to.equal(entry.ratio);
    }
  }

  describe("RatioType Tests", () => {
    it("ratiotype OneToN", async () => {
      const testData: { input: number; ratio: string; }[] = [
        { input: 0.0, ratio: "1:0" },
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

    it("ratiotype NToOne", async () => {
      const testData: { input: number; ratio: string; }[] = [
        { input: 0.0, ratio: "0:1" },
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

    it("ratioType valueBased", async () => {
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

    it("ratioType UseGreatestCommonDivisor", async () => {
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

  describe("RatioType Tests with different precision", () => {
    it("ratioType precision test | One To N", async () => {
      const testData: { input: number; ratio: string; precision: number}[] = [
        { input: 3, ratio: "1:0", precision: 0 },
        { input: 3, ratio: "1:0.3", precision: 1 },
        { input: 3, ratio: "1:0.33", precision: 2 },
        { input: 3, ratio: "1:0.333", precision: 3 },
        { input: 3, ratio: "1:0.3333", precision: 4 },

      ];
      await testRatioType("OneToN", testData);
    });

    it("ratioType precision test | NToOne", async () => {
      const testData: { input: number; ratio: string; precision: number}[] = [
        { input: 3, ratio: "3:1", precision: 0 },
        { input: 3, ratio: "3:1", precision: 1 },
        { input: 3, ratio: "3:1", precision: 2 },
        { input: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("NToOne", testData);
    });

    it("ratioType precision test | valueBased", async () => {
      const testData: { input: number; ratio: string; precision: number}[] = [
        { input: 3, ratio: "3:1", precision: 0 },
        { input: 3, ratio: "3:1", precision: 1 },
        { input: 3, ratio: "3:1", precision: 2 },
        { input: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("ValueBased", testData);
    });

    it("ratioType precision test | UseGreatestCommonDivisor", async () => {
      const testData: { input: number; ratio: string; precision: number}[] = [
        { input: 3, ratio: "1:0", precision: 0 },
        { input: 3, ratio: "10:3", precision: 1 },
        { input: 3, ratio: "100:33", precision: 2 },
        { input: 3, ratio: "1000:333", precision: 3 },
        { input: 3, ratio: "10000:3333", precision: 4 },

      ];
      await testRatioType("UseGreatestCommonDivisor", testData);
    });
  });

  describe("ratio formatting that should throw an error", () => {
    it("should throw an error if ratioType is not provided", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        composite: {
          includeZero: true,
          units: [
            { name: "Units.VERTICAL_PER_HORIZONTAL" }, // presentation unit
          ],
        }
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio is 'Ratio' type therefore the attribute 'ratioType' is required.")
        assert.instanceOf(e, QuantityError);
      }
    });

    it("should throw an error if ratioType is invalid", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "someInvalidType",
        composite: {
          includeZero: true,
          units: [
            { name: "Units.VERTICAL_PER_HORIZONTAL" }, // presentation unit
          ],
        }
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio has an invalid 'ratioType' attribute.")
        assert.instanceOf(e, QuantityError);
      }
    });

    it("should throw an error if presentation unit is invalid", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "OneToN",
        composite: {
          includeZero: true,
          units: [
            { name: "Units.M" }, // presentation unit
          ],
        }
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        const v_h: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
        const ratioFormatterSpec = await FormatterSpec.create(`InvalidPresentationUnit`, ratioFormat, unitsProvider, v_h);
        Formatter.formatQuantity(2.0, ratioFormatterSpec);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio has an invalid presentation unit.")
        assert.instanceOf(e, QuantityError);
      }
    });

    it("should throw an error if persistence unit is invalid", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "OneToN",
        composite: {
          includeZero: true,
          units: [
            { name: "Units.VERTICAL_PER_HORIZONTAL" }, // presentation unit
          ],
        }
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        const v_h: UnitProps = await unitsProvider.findUnitByName("Units.M");
        const ratioFormatterSpec = await FormatterSpec.create(`InvalidPersistentUnit`, ratioFormat, unitsProvider, v_h);
        Formatter.formatQuantity(2.0, ratioFormatterSpec);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio has an invalid persistence unit.")
        assert.instanceOf(e, QuantityError);
      }
    });


  });

});
