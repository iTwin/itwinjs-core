import { assert, expect } from "chai";
import { Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";

import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, ParseError, Parser, ParserSpec, Quantity, QuantityError, UnitProps } from "../core-quantity";

describe("Ratio format tests", () => {
  const vHUnitName = "Units.VERTICAL_PER_HORIZONTAL";
  const hVUnitName = "Units.HORIZONTAL_PER_VERTICAL";

  async function testRatioType(ratioType: string, testData: { input: number, ratio: string, precision?: number}[], presentationUnitStr: string = vHUnitName, persistenceUnitStr: string = vHUnitName) {
    const defaultPrecision = 3;

    const ratioJson: FormatProps = {
      type: "Ratio",
      ratioType,
      precision: defaultPrecision,
      composite: {
        includeZero: true,
        units: [
          { name: presentationUnitStr }, // presentation unit
        ],
      },
    };

    const unitsProvider = new TestUnitsProvider();
    const ratioFormat = new Format("Ratio");
    await ratioFormat.fromJSON(unitsProvider, ratioJson).catch(() => {});
    assert.isTrue(ratioFormat.hasUnits);

    const persistenceUnit: UnitProps = await unitsProvider.findUnitByName(persistenceUnitStr);
    assert.isTrue(persistenceUnit.isValid);

    const ratioFormatterSpec = await FormatterSpec.create(`${ratioType}`, ratioFormat, unitsProvider, persistenceUnit); // persisted unit
    const ratioParser = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit); // persistence unit

    for (const entry of testData) {
      if (null != entry.precision)
        ratioFormatterSpec.format.precision = entry.precision;
      const resultRatio = Formatter.formatQuantity(entry.input, ratioFormatterSpec);
      expect(resultRatio).to.equal(entry.ratio);

      const parserRatioResult = Parser.parseQuantityString(entry.ratio, ratioParser);
      if (!Parser.isParsedQuantity(parserRatioResult)) {
        assert.fail(`Expected a parsed from ratio string ${entry.ratio}`);
      }

      if (null != entry.precision)
        expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.input}`).closeTo(entry.input, 4.999 * (0.1 ** entry.precision));
      else
        expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.input}`).closeTo(entry.input, 4.999 * (0.1 ** defaultPrecision));

    }
  }

  describe("RatioType Tests", () => {
    it("OneToN", async () => {
      const testData: { input: number, ratio: string }[] = [
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

    it("NToOne", async () => {
      const testData: { input: number, ratio: string }[] = [
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

    it("ValueBased", async () => {
      const testData: { input: number, ratio: string }[] = [
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

    it("UseGreatestCommonDivisor", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 1.0, ratio: "1:1" },
        { input: 2.0, ratio: "2:1" },
        { input: 0.5, ratio: "1:2" },
        { input: 0.333, ratio: "333:1000" },
        { input: 0.3333, ratio: "333:1000" },
        { input: 0.2857, ratio: "143:500" },
        { input: 0.25, ratio: "1:4" },
        { input: 0.6667, ratio: "667:1000" },
      ];
      await testRatioType("UseGreatestCommonDivisor", testData);
    });
  });

  describe("RatioType Tests with different precision", () => {
    it("ratioType precision test | One To N", async () => {
      const testData: { input: number, ratio: string, precision: number}[] = [
        // { input: 3, ratio: "1:0", precision: 0 }, commented out since its expected to fail on parsing for now
        { input: 3, ratio: "1:0.3", precision: 1 },
        { input: 3, ratio: "1:0.33", precision: 2 },
        { input: 3, ratio: "1:0.333", precision: 3 },
        { input: 3, ratio: "1:0.3333", precision: 4 },

      ];
      await testRatioType("OneToN", testData);
    });

    it("ratioType precision test | NToOne", async () => {
      const testData: { input: number, ratio: string, precision: number}[] = [
        { input: 3, ratio: "3:1", precision: 0 },
        { input: 3, ratio: "3:1", precision: 1 },
        { input: 3, ratio: "3:1", precision: 2 },
        { input: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("NToOne", testData);
    });

    it("ratioType precision test | valueBased", async () => {
      const testData: { input: number, ratio: string, precision: number}[] = [
        { input: 3, ratio: "3:1", precision: 0 },
        { input: 3, ratio: "3:1", precision: 1 },
        { input: 3, ratio: "3:1", precision: 2 },
        { input: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("ValueBased", testData);
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
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio is 'Ratio' type therefore the attribute 'ratioType' is required.");
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
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");
      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
        expect.fail("Expected error was not thrown");
      } catch (e: any){
        assert.strictEqual(e.message, "The Format Ratio has an invalid 'ratioType' attribute.");
        assert.instanceOf(e, QuantityError);
      }
    });

  });

  describe("RatioType Tests with special values", () => {
    it("zero value", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 0.0, ratio: "0:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("large/small value", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 0.00000001, ratio: "0:1" },
        { input: 100000000, ratio: "100000000:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("negative value", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: -1.0, ratio: "-1:1" },
        { input: -0.5, ratio: "-0.5:1" },
        { input: -2, ratio: "-2:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("irrational number | NToOne", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 1.0 / 7, ratio: "0.143:1" },
        { input: 2.0 / 7, ratio: "0.286:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("irrational number", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 1.0 / 7, ratio: "143:1000" },
        { input: 2.0 / 7, ratio: "143:500" }, // loses precision from 0.28571428571 to 0.286
      ];
      await testRatioType("useGreatestCommonDivisor", testData);
    });
  });

  describe("specific parse ratio string tests", () => {
    async function testRatioParser(
      testData: { output: number, inputRatio: string, precision?: number, parseError?: ParseError }[],
      presentationUnitStr: string = vHUnitName,
      persistenceUnitStr: string = vHUnitName,
    ): Promise<void> {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "NToOne",
        composite: {
          includeZero: true,
          units: [{ name: presentationUnitStr }],
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("Ratio");

      try {
        await ratioFormat.fromJSON(unitsProvider, ratioJson);
      } catch (error) {
        assert.fail("Failed to create ratio format from JSON");
      }

      assert.isTrue(ratioFormat.hasUnits, "Ratio format should have units");

      const persistenceUnit: UnitProps = await unitsProvider.findUnitByName(persistenceUnitStr);
      assert.isTrue(persistenceUnit.isValid, "Persistence unit should be valid");

      const ratioParser = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

      for (const { output, inputRatio, parseError } of testData) {
        const parserRatioResult = Parser.parseQuantityString(inputRatio, ratioParser);

        if (parseError) {
          assert.isTrue(Parser.isParseError(parserRatioResult), `Expected parse error for input ratio string ${inputRatio}`);
          if ("error" in parserRatioResult) {
            expect(parserRatioResult.error).to.equal(parseError);
          } else {
            assert.fail(`Expected parse error for input ratio string ${inputRatio}`);
          }
        } else {
          if (!Parser.isParsedQuantity(parserRatioResult)) {
            assert.fail(`Expected a parsed quantity from ratio string ${inputRatio}`);
          }
          expect(parserRatioResult.value).to.equal(output);
        }
      }
    }

    it("zero value", async () => {
      const testData: { output: number, inputRatio: string, parseError?: ParseError }[] = [
        { output: 0.0, inputRatio: "0:1", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { output: 0.0, inputRatio: "0:999", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { output: 0.0, inputRatio: "0:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { output: 0.0, inputRatio: "0:0.0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
      ];
      await testRatioParser(testData, vHUnitName, hVUnitName);
    });

    it("single number", async () => {
      const testData: { output: number, inputRatio: string }[] = [
        { output: 1.0, inputRatio: "1" },
        { output: 30, inputRatio: "30" },
      ];
      await testRatioParser(testData);
    });

    it("various parse Error expected", async () => {
      const testData: { output: number, inputRatio: string, parseError?: ParseError }[] = [
        { output: 1.0, inputRatio: "1:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { output: 1.0, inputRatio: "10:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },

        { output: 1.0, inputRatio: "", parseError: ParseError.NoValueOrUnitFoundInString },
        { output: 1.0, inputRatio: "1:", parseError: ParseError.NoValueOrUnitFoundInString},
        { output: 1.0, inputRatio: "1:A", parseError: ParseError.NoValueOrUnitFoundInString},

        { output: 1.0, inputRatio: "1:2:3", parseError: ParseError.UnableToConvertParseTokensToQuantity},
      ];
      await testRatioParser(testData);
    });

  });

  describe("inverted unit tests", () => {
    it("zero value", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 0.0, ratio: "1:0" },
      ];
      await testRatioType("NToOne", testData, vHUnitName, hVUnitName);
      await testRatioType("NToOne", testData, hVUnitName, vHUnitName);
    });

    it("inverted unit | NToOne", async () => {
      const testData: { input: number, ratio: string }[] = [
        { input: 1.0, ratio: "1:1" },
        { input: 2.0, ratio: "0.5:1" },
        { input: 0.5, ratio: "2:1" },
        { input: 0.333, ratio: "3.003:1" },
        { input: 0.2857, ratio: "3.5:1" },
        { input: 0.25, ratio: "4:1" },
        { input: 0.6667, ratio: "1.5:1" },
      ];
      await testRatioType("NToOne", testData, vHUnitName, hVUnitName);
    });
  },
  );

});

describe("Roundtrip tests", () => {
  it("2:1 slope ratio", async () => {
    const vphRatioFormatJson: FormatProps = {
      type: "Ratio",
      ratioType: "OneToN",
      precision: 0,
      composite: {
        includeZero: true,
        units: [
          { name: "Units.VERTICAL_PER_HORIZONTAL" },
        ],
      },
    };

    const hpvRatioFormatJson: FormatProps = {
      type: "Ratio",
      ratioType: "NToOne",
      precision: 0,
      composite: {
        includeZero: true,
        units: [
          { name: "Units.HORIZONTAL_PER_VERTICAL" },
        ],
      },
    };

    const unitsProvider = new TestUnitsProvider();
    const vphRatioFormat = new Format("VpH");
    await vphRatioFormat.fromJSON(unitsProvider, vphRatioFormatJson);
    assert.isTrue(vphRatioFormat.hasUnits);

    const hvpRatioFormat = new Format("HpV");
    await hvpRatioFormat.fromJSON(unitsProvider, hpvRatioFormatJson);
    assert.isTrue(hvpRatioFormat.hasUnits);

    const vH: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
    assert.isTrue(vH.isValid);
    const hV: UnitProps = await unitsProvider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
    assert.isTrue(hV.isValid);

    const vphToVphFormatter = await FormatterSpec.create("vph_to_vph_formatter", vphRatioFormat, unitsProvider,vH);
    const hpvToVphFormatter = await FormatterSpec.create("hvp_to_vph_formatter", vphRatioFormat, unitsProvider,hV);
    const vphToHpvFormatter = await FormatterSpec.create("vph_to_hpv_formatter", hvpRatioFormat, unitsProvider,vH);
    const hpvToHpvFormatter = await FormatterSpec.create("hpv_to_hpv_formatter", hvpRatioFormat, unitsProvider,hV);

    const vphToVphParser = await ParserSpec.create(vphRatioFormat, unitsProvider, vH);
    const hpvToVphParser = await ParserSpec.create(vphRatioFormat, unitsProvider, hV);
    const vphToHvpParser = await ParserSpec.create(hvpRatioFormat, unitsProvider, vH);
    const hpvToHvpParser = await ParserSpec.create(hvpRatioFormat, unitsProvider, hV);

    const vphValue = new Quantity(vH, 0.5);
    const hpvValue = new Quantity(hV, 2.0);

    // test conversion between these quantities
    const vHTohV = await unitsProvider.getConversion(vH, hV);
    const hVToVH = await unitsProvider.getConversion(hV, vH);

    const hVConverted = vphValue.convertTo(hV, vHTohV);
    expect(hVConverted?.magnitude).to.equal(2.0);
    expect(hVConverted?.unit.name).to.equal("Units.HORIZONTAL_PER_VERTICAL");

    const vHConverted = hpvValue.convertTo(vH, hVToVH);
    expect(vHConverted?.magnitude).to.equal(0.5);
    expect(vHConverted?.unit.name).to.equal("Units.VERTICAL_PER_HORIZONTAL");

    // Test all formatting scenarios
    const vphValueString = Formatter.formatQuantity(vphValue.magnitude, vphToVphFormatter);
    expect(vphValueString).to.equal("1:2");

    const hpvValueString = Formatter.formatQuantity(hpvValue.magnitude, hpvToHpvFormatter);
    expect(hpvValueString).to.equal("2:1");

    const vphValueStringConverted = Formatter.formatQuantity(hpvValue.magnitude, hpvToVphFormatter);
    expect(vphValueStringConverted).to.equal("1:2");

    const hpvValueStringConverted = Formatter.formatQuantity(vphValue.magnitude, vphToHpvFormatter);
    expect(hpvValueStringConverted).to.equal("2:1");

    // Test all parsing scenarios
    const vphValueParsed = Parser.parseQuantityString("1:2", vphToVphParser);
    if (!Parser.isParsedQuantity(vphValueParsed)) {
      assert.fail();
    }
    expect(vphValueParsed.value).to.equal(0.5);

    const hpvValueParsed = Parser.parseQuantityString("2:1", hpvToHvpParser);
    if (!Parser.isParsedQuantity(hpvValueParsed)) {
      assert.fail();
    }
    expect(hpvValueParsed.value).to.equal(2.0);

    const vphValueParsedConverted = Parser.parseQuantityString("2:1", hpvToVphParser);
    if (!Parser.isParsedQuantity(vphValueParsedConverted)) {
      assert.fail();
    }
    expect(vphValueParsedConverted.value).to.equal(0.5);

    const hpvValueParsedConverted = Parser.parseQuantityString("1:2", vphToHvpParser);
    if (!Parser.isParsedQuantity(hpvValueParsedConverted)) {
      assert.fail();
    }
    expect(hpvValueParsedConverted.value).to.equal(2.0);
  });
});
