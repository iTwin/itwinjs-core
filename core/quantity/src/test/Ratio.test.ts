import { assert, describe, expect, it } from "vitest";
import { Format } from "../Formatter/Format";
import { Formatter } from "../Formatter/Formatter";

import { FormatterSpec } from "../Formatter/FormatterSpec";
import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { FormatProps, ParseError, Parser, ParserSpec, Quantity, QuantityError, UnitProps } from "../core-quantity";

describe("Ratio format tests", () => {
  const vHUnitName = "Units.VERTICAL_PER_HORIZONTAL";
  const hVUnitName = "Units.HORIZONTAL_PER_VERTICAL";

  interface TestData {
    magnitude: number;
    ratio: string;
    precision?: number;
    parseError?: ParseError;
  }

  async function testRatioType(ratioType: string, testData: TestData[], presentationUnitStr: string = vHUnitName, persistenceUnitStr: string = vHUnitName) {
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
    await ratioFormat.fromJSON(unitsProvider, ratioJson);
    expect(ratioFormat.hasUnits).to.be.true;

    const persistenceUnit: UnitProps = await unitsProvider.findUnitByName(persistenceUnitStr);
    expect(persistenceUnit.isValid).to.be.true;

    const ratioFormatterSpec = await FormatterSpec.create(`${ratioType}`, ratioFormat, unitsProvider, persistenceUnit); // persisted unit
    const ratioParser = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit); // persistence unit

    for (const entry of testData) {
      if (null != entry.precision)
        ratioFormatterSpec.format.precision = entry.precision;
      const resultRatio = Formatter.formatQuantity(entry.magnitude, ratioFormatterSpec);
      expect(resultRatio).to.equal(entry.ratio);

      const parserRatioResult = Parser.parseQuantityString(entry.ratio, ratioParser);
      if (!Parser.isParsedQuantity(parserRatioResult)) {
        assert.fail(`Expected a parsed from ratio string ${entry.ratio}`);
      }

      if (null != entry.precision)
        expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.magnitude}`).closeTo(entry.magnitude, 4.999 * (0.1 ** entry.precision));
      else
        expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.magnitude}`).closeTo(entry.magnitude, 4.999 * (0.1 ** defaultPrecision));
    }
  }

  describe("RatioType Tests", () => {
    it("OneToN", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:1" },
        { magnitude: 2.0, ratio: "1:0.5" },
        { magnitude: 0.5, ratio: "1:2" },
        { magnitude: 0.333, ratio: "1:3.003" },
        { magnitude: 0.3333, ratio: "1:3" },
        { magnitude: 0.2857, ratio: "1:3.5" },
        { magnitude: 0.25, ratio: "1:4" },
        { magnitude: 0.6667, ratio: "1:1.5" },
      ];
      await testRatioType("OneToN", testData);
    });

    it("NToOne", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:1" },
        { magnitude: 2.0, ratio: "2:1" },
        { magnitude: 0.5, ratio: "0.5:1" },
        { magnitude: 0.333, ratio: "0.333:1" },
        { magnitude: 0.3333, ratio: "0.333:1" },
        { magnitude: 0.2857, ratio: "0.286:1" },
        { magnitude: 0.25, ratio: "0.25:1" },
        { magnitude: 0.6667, ratio: "0.667:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("ValueBased", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:1" },
        { magnitude: 2.0, ratio: "2:1" },
        { magnitude: 0.5, ratio: "1:2" },
        { magnitude: 0.333, ratio: "1:3.003" },
        { magnitude: 0.3333, ratio: "1:3" },
        { magnitude: 0.2857, ratio: "1:3.5" },
        { magnitude: 3.5, ratio: "3.5:1" },
        { magnitude: 0.25, ratio: "1:4" },
        { magnitude: 4, ratio: "4:1" },
        { magnitude: 0.6667, ratio: "1:1.5" },
      ];
      await testRatioType("ValueBased", testData);
    });

    it("UseGreatestCommonDivisor", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:1" },
        { magnitude: 2.0, ratio: "2:1" },
        { magnitude: 0.5, ratio: "1:2" },
        { magnitude: 0.333, ratio: "333:1000" },
        { magnitude: 0.3333, ratio: "333:1000" },
        { magnitude: 0.2857, ratio: "143:500" },
        { magnitude: 0.25, ratio: "1:4" },
        { magnitude: 0.6667, ratio: "667:1000" },

      ];
      await testRatioType("UseGreatestCommonDivisor", testData);
    });
  });

  describe("RatioType Tests with different precision", () => {
    it("ratioType precision test | One To N", async () => {
      const testData: TestData[] = [
        // { magnitude: 3, ratio: "1:0", precision: 0 }, commented out since its expected to fail on parsing.
        // magnitude 3 when formatted to ratio will be "0:1", "0:1" parsed back to quantity will be 0 which does not equal magnitude 3
        { magnitude: 3, ratio: "1:0.3", precision: 1 },
        { magnitude: 3, ratio: "1:0.33", precision: 2 },
        { magnitude: 3, ratio: "1:0.333", precision: 3 },
        { magnitude: 3, ratio: "1:0.3333", precision: 4 },

        { magnitude: 0.667, ratio: "1:1.49925", precision: 5 },
        { magnitude: 0.667, ratio: "1:1.4993", precision: 4 },
        { magnitude: 0.667, ratio: "1:1.499", precision: 3 },
        { magnitude: 0.667, ratio: "1:1.5", precision: 2 },
        { magnitude: 0.667, ratio: "1:1.5", precision: 1 },
      ];
      await testRatioType("OneToN", testData);
    });

    it("ratioType precision test | NToOne", async () => {
      const testData: TestData[] = [
        { magnitude: 3, ratio: "3:1", precision: 0 },
        { magnitude: 3, ratio: "3:1", precision: 1 },
        { magnitude: 3, ratio: "3:1", precision: 2 },
        { magnitude: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("NToOne", testData);
    });

    it("ratioType precision test | valueBased", async () => {
      const testData: TestData[] = [
        { magnitude: 3, ratio: "3:1", precision: 0 },
        { magnitude: 3, ratio: "3:1", precision: 1 },
        { magnitude: 3, ratio: "3:1", precision: 2 },
        { magnitude: 3, ratio: "3:1", precision: 3 },
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
      } catch (e: any) {
        expect(e.message).toEqual("The Format Ratio is 'Ratio' type therefore the attribute 'ratioType' is required.");
        expect(e).toBeInstanceOf(QuantityError);
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
      } catch (e: any) {
        expect(e.message).toEqual("The Format Ratio has an invalid 'ratioType' attribute.");
        expect(e).toBeInstanceOf(QuantityError);
      }
    });

  });

  describe("RatioType Tests with special values", () => {
    it("zero value", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0, ratio: "0:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("large/small value", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0004, ratio: "0:1" },
        { magnitude: 0.0005, ratio: "0.001:1" }, // threshold due to precision3
        { magnitude: 0.00000001, ratio: "0:1" },
        { magnitude: 100000000, ratio: "100000000:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("negative value", async () => {
      const testData: TestData[] = [
        { magnitude: -1.0, ratio: "-1:1" },
        { magnitude: -0.5, ratio: "-0.5:1" },
        { magnitude: -2, ratio: "-2:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("irrational number | NToOne", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0 / 7, ratio: "0.143:1" },
        { magnitude: 2.0 / 7, ratio: "0.286:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("irrational number", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0 / 7, ratio: "143:1000" },
        { magnitude: 2.0 / 7, ratio: "143:500" }, // comes down from 286:1000
        { magnitude: 1.0 / 7, ratio: "1429:10000", precision: 4 },
        { magnitude: 2.0 / 7, ratio: "2857:10000", precision: 4 },
      ];
      await testRatioType("useGreatestCommonDivisor", testData);
    });
  });

  describe("Scale factor formatting tests", () => {
    it("should format imperial scale factors", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "NToOne",
        ratioSeparator: "=",
        precision: 4,
        composite: {
          includeZero: true,
          units: [
            { name: "Units.IN_PER_FT_LENGTH_RATIO" },
          ],
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("ImperialScale");
      await ratioFormat.fromJSON(unitsProvider, ratioJson);
      expect(ratioFormat.hasUnits).to.be.true;

      const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
      expect(persistenceUnit.isValid).to.be.true;

      const formatterSpec = await FormatterSpec.create("ImperialScale", ratioFormat, unitsProvider, persistenceUnit);

      // Common imperial architectural and engineering scales
      // Architectural scales (based on inches to feet)
      expect(Formatter.formatQuantity(1.0, formatterSpec)).to.equal("12\"=1'"); // Full size (12" = 1'-0")
      expect(Formatter.formatQuantity(0.5, formatterSpec)).to.equal("6\"=1'"); // Half size (6" = 1'-0")
      expect(Formatter.formatQuantity(1/3, formatterSpec)).to.equal("4\"=1'"); // 4" = 1'-0"
      expect(Formatter.formatQuantity(0.25, formatterSpec)).to.equal("3\"=1'"); // 3" = 1'-0"
      expect(Formatter.formatQuantity(1/6, formatterSpec)).to.equal("2\"=1'"); // 2" = 1'-0"
      expect(Formatter.formatQuantity(1/8, formatterSpec)).to.equal("1.5\"=1'"); // 1-1/2" = 1'-0"
      expect(Formatter.formatQuantity(1/12, formatterSpec)).to.equal("1\"=1'"); // 1" = 1'-0"
      expect(Formatter.formatQuantity(1/16, formatterSpec)).to.equal("0.75\"=1'"); // 3/4" = 1'-0"
      expect(Formatter.formatQuantity(1/24, formatterSpec)).to.equal("0.5\"=1'"); // 1/2" = 1'-0"
      expect(Formatter.formatQuantity(1/32, formatterSpec)).to.equal("0.375\"=1'"); // 3/8" = 1'-0"
      expect(Formatter.formatQuantity(1/48, formatterSpec)).to.equal("0.25\"=1'"); // 1/4" = 1'-0"
      expect(Formatter.formatQuantity(1/96, formatterSpec)).to.equal("0.125\"=1'"); // 1/8" = 1'-0"

      // Engineering scales (decimal based)
      expect(Formatter.formatQuantity(1/10, formatterSpec)).to.equal("1.2\"=1'"); // 1" = 10'
      expect(Formatter.formatQuantity(1/20, formatterSpec)).to.equal("0.6\"=1'"); // 1" = 20'
      expect(Formatter.formatQuantity(1/30, formatterSpec)).to.equal("0.4\"=1'"); // 1" = 30'
      expect(Formatter.formatQuantity(1/40, formatterSpec)).to.equal("0.3\"=1'"); // 1" = 40'
      expect(Formatter.formatQuantity(1/50, formatterSpec)).to.equal("0.24\"=1'"); // 1" = 50'
      expect(Formatter.formatQuantity(1/60, formatterSpec)).to.equal("0.2\"=1'"); // 1" = 60'
      expect(Formatter.formatQuantity(1/100, formatterSpec)).to.equal("0.12\"=1'"); // 1" = 100'

      // Civil/site scales
      expect(Formatter.formatQuantity(1/120, formatterSpec)).to.equal("0.1\"=1'"); // 1" = 10'
      expect(Formatter.formatQuantity(1/240, formatterSpec)).to.equal("0.05\"=1'"); // 1" = 20'
      expect(Formatter.formatQuantity(1/480, formatterSpec)).to.equal("0.025\"=1'"); // 1" = 40'
      expect(Formatter.formatQuantity(1/600, formatterSpec)).to.equal("0.02\"=1'"); // 1" = 50'
      expect(Formatter.formatQuantity(1/1200, formatterSpec)).to.equal("0.01\"=1'"); // 1" = 100'
    });

    it("should format metric scale factors", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "OneToN",
        precision: 1,
        formatTraits: ["trailZeroes"],
        composite: {
          includeZero: true,
          units: [
            { name: "Units.M_PER_M_LENGTH_RATIO" },
          ],
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("MetricScale");
      await ratioFormat.fromJSON(unitsProvider, ratioJson);
      expect(ratioFormat.hasUnits).to.be.true;

      const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
      expect(persistenceUnit.isValid).to.be.true;

      const formatterSpec = await FormatterSpec.create("MetricScale", ratioFormat, unitsProvider, persistenceUnit);

      // Common metric map scale factors
      expect(Formatter.formatQuantity(1.0, formatterSpec)).to.equal("1:1.0");
      expect(Formatter.formatQuantity(0.5, formatterSpec)).to.equal("1:2.0");
      expect(Formatter.formatQuantity(0.4, formatterSpec)).to.equal("1:2.5");
      expect(Formatter.formatQuantity(0.2, formatterSpec)).to.equal("1:5.0");
      expect(Formatter.formatQuantity(0.1, formatterSpec)).to.equal("1:10.0");
      expect(Formatter.formatQuantity(0.05, formatterSpec)).to.equal("1:20.0");
      expect(Formatter.formatQuantity(0.04, formatterSpec)).to.equal("1:25.0");
      expect(Formatter.formatQuantity(0.02, formatterSpec)).to.equal("1:50.0");
      expect(Formatter.formatQuantity(0.01, formatterSpec)).to.equal("1:100.0");
      expect(Formatter.formatQuantity(0.005, formatterSpec)).to.equal("1:200.0");
      expect(Formatter.formatQuantity(0.004, formatterSpec)).to.equal("1:250.0");
      expect(Formatter.formatQuantity(0.0025, formatterSpec)).to.equal("1:400.0");
      expect(Formatter.formatQuantity(0.002, formatterSpec)).to.equal("1:500.0");
      expect(Formatter.formatQuantity(0.001, formatterSpec)).to.equal("1:1000.0");
      expect(Formatter.formatQuantity(0.0002, formatterSpec)).to.equal("1:5000.0");
      expect(Formatter.formatQuantity(0.0001, formatterSpec)).to.equal("1:10000.0");
      expect(Formatter.formatQuantity(0.00004, formatterSpec)).to.equal("1:25000.0");
      expect(Formatter.formatQuantity(0.00002, formatterSpec)).to.equal("1:50000.0");
      expect(Formatter.formatQuantity(0.00001, formatterSpec)).to.equal("1:100000.0");
      expect(Formatter.formatQuantity(0.000004, formatterSpec)).to.equal("1:250000.0");
    });

    it("should parse ratios with custom separator", async () => {
      const ratioJson: FormatProps = {
        type: "Ratio",
        ratioType: "NToOne",
        ratioSeparator: "=",
        precision: 4,
        composite: {
          includeZero: true,
          units: [
            { name: "Units.IN_PER_FT_LENGTH_RATIO" },
          ],
        },
      };

      const unitsProvider = new TestUnitsProvider();
      const ratioFormat = new Format("ImperialScaleParse");
      await ratioFormat.fromJSON(unitsProvider, ratioJson);
      expect(ratioFormat.hasUnits).to.be.true;
      expect(ratioFormat.ratioSeparator).to.equal("=");

      const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
      expect(persistenceUnit.isValid).to.be.true;

      const formatterSpec = await FormatterSpec.create("ImperialScaleParse", ratioFormat, unitsProvider, persistenceUnit);
      const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

      // Test formatting with custom separator
      const formatted = Formatter.formatQuantity(1/12, formatterSpec);
      expect(formatted).to.equal("1\"=1'");

      // Test parsing with custom separator
      const parseResult1 = Parser.parseQuantityString("12\"=1'", parserSpec);
      expect(Parser.isParsedQuantity(parseResult1)).to.be.true;
      if (Parser.isParsedQuantity(parseResult1)) {
        expect(parseResult1.value).to.be.closeTo(1.0, 0.0001);
      }

      const parseResult2 = Parser.parseQuantityString("6\"=1'", parserSpec);
      expect(Parser.isParsedQuantity(parseResult2)).to.be.true;
      if (Parser.isParsedQuantity(parseResult2)) {
        expect(parseResult2.value).to.be.closeTo(0.5, 0.0001);
      }

      const parseResult3 = Parser.parseQuantityString("1\"=1'", parserSpec);
      expect(Parser.isParsedQuantity(parseResult3)).to.be.true;
      if (Parser.isParsedQuantity(parseResult3)) {
        expect(parseResult3.value).to.be.closeTo(1/12, 0.0001);
      }

      // Test that default separator doesn't work with custom separator format
      const parseResult4 = Parser.parseQuantityString("1:1", parserSpec);
      expect(Parser.isParsedQuantity(parseResult4)).to.be.true;
      if (Parser.isParsedQuantity(parseResult4)) {
        // Since the separator is "=", "1:1" won't be split and will be parsed as just "1"
        expect(parseResult4.value).to.be.closeTo(1.0, 0.0001);
      }
    });
  });

  describe("specific parse ratio string tests", () => {
    async function testRatioParser(
      testData: TestData[], presentationUnitStr: string = vHUnitName, persistenceUnitStr: string = vHUnitName,
    ) {

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
      } catch {
        assert.fail("Failed to create ratio format from JSON");
      }

      expect(ratioFormat.hasUnits).to.be.true;

      const persistenceUnit: UnitProps = await unitsProvider.findUnitByName(persistenceUnitStr);
      expect(persistenceUnit.isValid).to.be.true;

      const ratioParser = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);
      for (const entry of testData) {
        const parserRatioResult = Parser.parseQuantityString(entry.ratio, ratioParser);

        if (entry.parseError) { // if it is expecting an error
          expect(Parser.isParseError(parserRatioResult)).to.be.true;
          // Check if parserRatioResult has the err property, which signifies a ParseQuantityError
          if ("error" in parserRatioResult)
            expect(parserRatioResult.error).to.equal(entry.parseError);
          else
            assert.fail(`Expected parse error for input ratio string ${entry.ratio}`);

        } else {
          if (!Parser.isParsedQuantity(parserRatioResult))
            assert.fail(`Expected a parsed from ratio string ${entry.ratio}`);

          expect(parserRatioResult.value).to.equal(entry.magnitude);
        }
      }
    }

    it("zero value", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0, ratio: "0:1", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { magnitude: 0.0, ratio: "0:999", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { magnitude: 0.0, ratio: "0:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { magnitude: 0.0, ratio: "0:0.0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
      ];
      await testRatioParser(testData, vHUnitName, hVUnitName);
    });

    it("single number", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1" },
        { magnitude: 30, ratio: "30" },
      ];
      await testRatioParser(testData);
    });

    it("various parse Error expected", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },
        { magnitude: 1.0, ratio: "10:0", parseError: ParseError.MathematicOperationFoundButIsNotAllowed },

        { magnitude: 1.0, ratio: "", parseError: ParseError.NoValueOrUnitFoundInString },
        { magnitude: 1.0, ratio: "1:", parseError: ParseError.NoValueOrUnitFoundInString },
        { magnitude: 1.0, ratio: "1:A", parseError: ParseError.NoValueOrUnitFoundInString },

        { magnitude: 1.0, ratio: "1:2:3", parseError: ParseError.UnableToConvertParseTokensToQuantity },
      ];
      await testRatioParser(testData);
    });

  });

  describe("inverted unit tests", () => {
    it("zero value", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0, ratio: "1:0" },
      ];
      await testRatioType("NToOne", testData, vHUnitName, hVUnitName);
      await testRatioType("NToOne", testData, hVUnitName, vHUnitName);
    });

    it("inverted unit | NToOne", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0, ratio: "1:1" },
        { magnitude: 2.0, ratio: "0.5:1" },
        { magnitude: 0.5, ratio: "2:1" },
        { magnitude: 0.333, ratio: "3.003:1" },
        { magnitude: 0.2857, ratio: "3.5:1" },
        { magnitude: 0.25, ratio: "4:1" },
        { magnitude: 0.6667, ratio: "1.5:1" },
      ];
      await testRatioType("NToOne", testData, vHUnitName, hVUnitName);
    });
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
      expect(vphRatioFormat.hasUnits).to.be.true;

      const hvpRatioFormat = new Format("HpV");
      await hvpRatioFormat.fromJSON(unitsProvider, hpvRatioFormatJson);
      expect(hvpRatioFormat.hasUnits).to.be.true;

      const vH: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
      expect(vH.isValid).to.be.true;
      const hV: UnitProps = await unitsProvider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
      expect(hV.isValid).to.be.true;

      const vphToVphFormatter = await FormatterSpec.create("vph_to_vph_formatter", vphRatioFormat, unitsProvider, vH);
      const hpvToVphFormatter = await FormatterSpec.create("hvp_to_vph_formatter", vphRatioFormat, unitsProvider, hV);
      const vphToHpvFormatter = await FormatterSpec.create("vph_to_hpv_formatter", hvpRatioFormat, unitsProvider, vH);
      const hpvToHpvFormatter = await FormatterSpec.create("hpv_to_hpv_formatter", hvpRatioFormat, unitsProvider, hV);

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
});
