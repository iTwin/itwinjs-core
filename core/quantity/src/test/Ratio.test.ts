import { assert, describe, expect, it } from "vitest";
import { Format } from "../Formatter/Format";
import { FormatType } from "../Formatter/FormatEnums";
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

	async function createFormatAndSpecs(formatName: string, formatProps: FormatProps, persistenceUnitName: string = "Units.DECIMAL_LENGTH_RATIO") {
		const unitsProvider = new TestUnitsProvider();
		const format = new Format(formatName);
		await format.fromJSON(unitsProvider, formatProps);
		const persistenceUnit = await unitsProvider.findUnitByName(persistenceUnitName);
		const formatterSpec = await FormatterSpec.create(formatName, format, unitsProvider, persistenceUnit);
		const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);
		return { format, formatterSpec, parserSpec, persistenceUnit, unitsProvider };
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
			if (null != entry.precision) ratioFormatterSpec.format.precision = entry.precision;
			const resultRatio = Formatter.formatQuantity(entry.magnitude, ratioFormatterSpec);
			expect(resultRatio).to.equal(entry.ratio);

			const parserRatioResult = Parser.parseQuantityString(entry.ratio, ratioParser);
			if (!Parser.isParsedQuantity(parserRatioResult)) {
				assert.fail(`Expected a parsed from ratio string ${entry.ratio}`);
			}

			if (null != entry.precision) expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.magnitude}`).closeTo(entry.magnitude, 4.999 * 0.1 ** entry.precision);
			else expect(parserRatioResult.value, `Parsed result for ${entry.ratio} from formatted ${entry.magnitude}`).closeTo(entry.magnitude, 4.999 * 0.1 ** defaultPrecision);
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

		it("ratioType precision test | NToOne and ValueBased", async () => {
			const testData: TestData[] = [
				{ magnitude: 3, ratio: "3:1", precision: 0 },
				{ magnitude: 3, ratio: "3:1", precision: 1 },
				{ magnitude: 3, ratio: "3:1", precision: 2 },
				{ magnitude: 3, ratio: "3:1", precision: 3 },
			];
			// Both NToOne and ValueBased produce the same results for magnitude > 1
			await testRatioType("NToOne", testData);
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
			const testData: TestData[] = [{ magnitude: 0.0, ratio: "0:1" }];
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
		async function testImperialScales(testCases: Array<{ magnitude: number; expected: string }>, formatProps: FormatProps) {
			const { formatterSpec } = await createFormatAndSpecs("ImperialScale", formatProps);
			for (const { magnitude, expected } of testCases) {
				expect(Formatter.formatQuantity(magnitude, formatterSpec)).to.equal(expected);
			}
		}

		it("should format imperial scale factors as decimal", async () => {
			const formatProps: FormatProps = {
				type: "Ratio",
				ratioType: "NToOne",
				ratioSeparator: "=",
				precision: 4,
				formatTraits: ["showUnitLabel"],
				composite: {
					includeZero: true,
					units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
				},
			};

			const testCases = [
				// Architectural scales
				{ magnitude: 1.0, expected: "12\"=1'" },
				{ magnitude: 0.5, expected: "6\"=1'" },
				{ magnitude: 1 / 3, expected: "4\"=1'" },
				{ magnitude: 0.25, expected: "3\"=1'" },
				{ magnitude: 1 / 6, expected: "2\"=1'" },
				{ magnitude: 1 / 8, expected: "1.5\"=1'" },
				{ magnitude: 1 / 12, expected: "1\"=1'" },
				{ magnitude: 1 / 16, expected: "0.75\"=1'" },
				{ magnitude: 1 / 24, expected: "0.5\"=1'" },
				{ magnitude: 1 / 32, expected: "0.375\"=1'" },
				{ magnitude: 1 / 48, expected: "0.25\"=1'" },
				{ magnitude: 1 / 96, expected: "0.125\"=1'" },
				// Engineering scales
				{ magnitude: 1 / 10, expected: "1.2\"=1'" },
				{ magnitude: 1 / 20, expected: "0.6\"=1'" },
				{ magnitude: 1 / 30, expected: "0.4\"=1'" },
				{ magnitude: 1 / 40, expected: "0.3\"=1'" },
				{ magnitude: 1 / 50, expected: "0.24\"=1'" },
				{ magnitude: 1 / 60, expected: "0.2\"=1'" },
				{ magnitude: 1 / 100, expected: "0.12\"=1'" },
				// Civil/site scales
				{ magnitude: 1 / 120, expected: "0.1\"=1'" },
				{ magnitude: 1 / 240, expected: "0.05\"=1'" },
				{ magnitude: 1 / 480, expected: "0.025\"=1'" },
				{ magnitude: 1 / 600, expected: "0.02\"=1'" },
				{ magnitude: 1 / 1200, expected: "0.01\"=1'" },
			];

			await testImperialScales(testCases, formatProps);
		});

		it("should format imperial scale factors as fractional", async () => {
			const formatProps: FormatProps = {
				type: "Ratio",
				ratioType: "NToOne",
				ratioSeparator: "=",
				ratioFormatType: "Fractional",
				precision: 16,
				formatTraits: ["showUnitLabel"],
				composite: {
					includeZero: true,
					units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
				},
			};

			const testCases = [
				{ magnitude: 1.0, expected: "12\"=1'" },
				{ magnitude: 0.5, expected: "6\"=1'" },
				{ magnitude: 1 / 3, expected: "4\"=1'" },
				{ magnitude: 0.25, expected: "3\"=1'" },
				{ magnitude: 1 / 6, expected: "2\"=1'" },
				{ magnitude: 1 / 8, expected: "1 1/2\"=1'" },
				{ magnitude: 1 / 12, expected: "1\"=1'" },
				{ magnitude: 1 / 16, expected: "3/4\"=1'" },
				{ magnitude: 1 / 24, expected: "1/2\"=1'" },
				{ magnitude: 1 / 32, expected: "3/8\"=1'" },
				{ magnitude: 1 / 48, expected: "1/4\"=1'" },
				{ magnitude: 1 / 96, expected: "1/8\"=1'" },
				{ magnitude: 1 / 192, expected: "1/16\"=1'" },
				{ magnitude: 1 / 10, expected: "1 3/16\"=1'" },
			];

			await testImperialScales(testCases, formatProps);
		});

		it("should format metric scale factors as decimal", async () => {
			const ratioJson: FormatProps = {
				type: "Ratio",
				ratioType: "OneToN",
				precision: 1,
				formatTraits: ["trailZeroes"],
				composite: {
					includeZero: true,
					units: [{ name: "Units.M_PER_M_LENGTH_RATIO" }],
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
				formatTraits: ["showUnitLabel"],
				composite: {
					includeZero: true,
					units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
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
			const formatted = Formatter.formatQuantity(1 / 12, formatterSpec);
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
				expect(parseResult3.value).to.be.closeTo(1 / 12, 0.0001);
			}

			// Test that default separator doesn't work with custom separator format
			const parseResult4 = Parser.parseQuantityString("1:1", parserSpec);
			expect(Parser.isParseError(parseResult4)).to.be.true;
			if (Parser.isParseError(parseResult4)) {
				// Since the separator is "=", "1:1" uses the wrong separator and should fail
				expect(parseResult4.error).to.equal(ParseError.UnableToConvertParseTokensToQuantity);
			}
		});
	});

	describe("specific parse ratio string tests", () => {
		async function testRatioParser(testData: TestData[], presentationUnitStr: string = vHUnitName, persistenceUnitStr: string = vHUnitName) {
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

				if (entry.parseError) {
					// if it is expecting an error
					expect(Parser.isParseError(parserRatioResult)).to.be.true;
					// Check if parserRatioResult has the err property, which signifies a ParseQuantityError
					if ("error" in parserRatioResult) expect(parserRatioResult.error).to.equal(entry.parseError);
					else assert.fail(`Expected parse error for input ratio string ${entry.ratio}`);
				} else {
					if (!Parser.isParsedQuantity(parserRatioResult)) assert.fail(`Expected a parsed from ratio string ${entry.ratio}`);

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
			const testData: TestData[] = [{ magnitude: 0.0, ratio: "1:0" }];
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
					units: [{ name: "Units.VERTICAL_PER_HORIZONTAL" }],
				},
			};

			const hpvRatioFormatJson: FormatProps = {
				type: "Ratio",
				ratioType: "NToOne",
				precision: 0,
				composite: {
					includeZero: true,
					units: [{ name: "Units.HORIZONTAL_PER_VERTICAL" }],
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

	describe("Parsing ratios with unit labels", () => {
		describe("Imperial ratio parsing with unit labels", () => {
			it("should parse decimal imperial scale ratios with unit labels", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: "=",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("ImperialScaleDecimal");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing common architectural scales with unit labels
				const testCases = [
					{ input: "12\"=1'", expected: 1.0 },
					{ input: "6\"=1'", expected: 0.5 },
					{ input: "3\"=1'", expected: 0.25 },
					{ input: "1.5\"=1'", expected: 0.125 },
					{ input: "1\"=1'", expected: 1 / 12 },
					{ input: "0.5\"=1'", expected: 1 / 24 },
					{ input: "0.25\"=1'", expected: 1 / 48 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.0001);
				}
			});

			it("should parse fractional imperial scale ratios with unit labels", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: "=",
					ratioFormatType: "Fractional",
					precision: 16,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("ImperialScaleFractional");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing common architectural scales with fractional notation
				const testCases = [
					{ input: "12\"=1'", expected: 1.0 },
					{ input: "6\"=1'", expected: 0.5 },
					{ input: "4\"=1'", expected: 1 / 3 },
					{ input: "3\"=1'", expected: 0.25 },
					{ input: "2\"=1'", expected: 1 / 6 },
					{ input: "1 1/2\"=1'", expected: 1 / 8 },
					{ input: "1\"=1'", expected: 1 / 12 },
					{ input: "3/4\"=1'", expected: 1 / 16 },
					{ input: "1/2\"=1'", expected: 1 / 24 },
					{ input: "3/8\"=1'", expected: 1 / 32 },
					{ input: "1/4\"=1'", expected: 1 / 48 },
					{ input: "1/8\"=1'", expected: 1 / 96 },
					{ input: "1/16\"=1'", expected: 1 / 192 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.0001);
				}
			});

			it("should parse engineering scale ratios with unit labels", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: "=",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("EngineeringScale");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing common engineering scales
				const testCases = [
					{ input: "1.2\"=1'", expected: 1 / 10 },
					{ input: "1\"=1'", expected: 1 / 12 },
					{ input: "0.6\"=1'", expected: 1 / 20 },
					{ input: "0.4\"=1'", expected: 1 / 30 },
					{ input: "0.3\"=1'", expected: 1 / 40 },
					{ input: "0.24\"=1'", expected: 1 / 50 },
					{ input: "0.2\"=1'", expected: 1 / 60 },
					{ input: "0.12\"=1'", expected: 1 / 100 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.0001);
				}
			});

			it("should parse ratios with custom unit label (in/ft)", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: ":",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO", label: "in/ft" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("CustomLabelRatio");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);
				const formatterSpec = await FormatterSpec.create("CustomLabelRatio", ratioFormat, unitsProvider, persistenceUnit);

				// Test formatting with custom label - the "/" in "in/ft" causes it to split into "in" and "ft"
				expect(Formatter.formatQuantity(1.0, formatterSpec)).to.equal("12in:1ft");
				expect(Formatter.formatQuantity(1 / 12, formatterSpec)).to.equal("1in:1ft");
				expect(Formatter.formatQuantity(0.5, formatterSpec)).to.equal("6in:1ft");

				// Test parsing with the split labels
				const testCases = [
					{ input: "12in:1ft", expected: 1.0 },
					{ input: "6in:1ft", expected: 0.5 },
					{ input: "1in:1ft", expected: 1 / 12 },
					{ input: "0.5in:1ft", expected: 1 / 24 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.0001);
				}
			});
		});

		describe("Metric ratio parsing with unit labels", () => {
			it("should parse metric scale ratios without unit labels", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "OneToN",
					precision: 1,
					formatTraits: ["trailZeroes"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.M_PER_M_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("MetricScale");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing common metric map scales
				const testCases = [
					{ input: "1:1.0", expected: 1.0 },
					{ input: "1:2.0", expected: 0.5 },
					{ input: "1:2.5", expected: 0.4 },
					{ input: "1:5.0", expected: 0.2 },
					{ input: "1:10.0", expected: 0.1 },
					{ input: "1:20.0", expected: 0.05 },
					{ input: "1:25.0", expected: 0.04 },
					{ input: "1:50.0", expected: 0.02 },
					{ input: "1:100.0", expected: 0.01 },
					{ input: "1:200.0", expected: 0.005 },
					{ input: "1:250.0", expected: 0.004 },
					{ input: "1:500.0", expected: 0.002 },
					{ input: "1:1000.0", expected: 0.001 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.00001);
				}
			});

			it("should parse NToOne metric ratios", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					precision: 2,
					composite: {
						includeZero: true,
						units: [{ name: "Units.M_PER_M_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("MetricScaleNToOne");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing ratios in NToOne format
				const testCases = [
					{ input: "1:1", expected: 1.0 },
					{ input: "2:1", expected: 2.0 },
					{ input: "0.5:1", expected: 0.5 },
					{ input: "0.1:1", expected: 0.1 },
					{ input: "0.01:1", expected: 0.01 },
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.00001);
				}
			});

			it("should parse slope ratios (rise:run)", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					precision: 1,
					composite: {
						includeZero: true,
						units: [{ name: "Units.VERTICAL_PER_HORIZONTAL" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("SlopeRatio");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test parsing common slope ratios (rise:run)
				const testCases = [
					{ input: "1:1", expected: 1.0 }, // 45° slope, 100% grade
					{ input: "1:2", expected: 0.5 }, // 26.6° slope, 50% grade
					{ input: "1:3", expected: 1 / 3 }, // 18.4° slope, 33.3% grade
					{ input: "1:4", expected: 0.25 }, // 14° slope, 25% grade
					{ input: "1:10", expected: 0.1 }, // 5.7° slope, 10% grade
					{ input: "1:20", expected: 0.05 }, // 2.9° slope, 5% grade
					{ input: "2:1", expected: 2.0 }, // 63.4° slope, 200% grade
				];

				for (const testCase of testCases) {
					const result = Parser.parseQuantityString(testCase.input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse ${testCase.input}`);
					}
					expect(result.value, `Parsing ${testCase.input}`).to.be.closeTo(testCase.expected, 0.0001);
				}
			});
		});

		describe("Edge cases and error handling", () => {
			it("should handle ratios with mixed unit labels", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: "=",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("MixedUnits");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// These should parse correctly
				const result1 = Parser.parseQuantityString("1\"=1'", parserSpec);
				if (!Parser.isParsedQuantity(result1)) {
					assert.fail("Failed to parse 1\"=1'");
				}
				expect(result1.value).to.be.closeTo(1 / 12, 0.0001);
			});

			it("should handle ratios without unit labels when format has showUnitLabel", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "OneToN",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.M_PER_M_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("UnitlessInput");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Should still parse ratios without unit labels
				const result = Parser.parseQuantityString("1:100", parserSpec);
				if (!Parser.isParsedQuantity(result)) {
					assert.fail("Failed to parse 1:100");
				}
				expect(result.value).to.be.closeTo(0.01, 0.00001);
			});

			it("should handle whitespace in ratio strings", async () => {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "NToOne",
					ratioSeparator: "=",
					precision: 2,
					formatTraits: ["showUnitLabel"],
					composite: {
						includeZero: true,
						units: [{ name: "Units.IN_PER_FT_LENGTH_RATIO" }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("WhitespaceTest");
				await ratioFormat.fromJSON(unitsProvider, ratioJson);

				const persistenceUnit: UnitProps = await unitsProvider.findUnitByName("Units.DECIMAL_LENGTH_RATIO");
				const parserSpec = await ParserSpec.create(ratioFormat, unitsProvider, persistenceUnit);

				// Test with various whitespace configurations
				const testCases = ["1\"=1'", " 1\" = 1' ", "1 \" = 1 '"];

				for (const input of testCases) {
					const result = Parser.parseQuantityString(input, parserSpec);
					if (!Parser.isParsedQuantity(result)) {
						assert.fail(`Failed to parse "${input}"`);
					}
					expect(result.value, `Parsing "${input}"`).to.be.closeTo(1 / 12, 0.0001);
				}
			});
		});

		describe("Ratio format unit label validation", () => {
			async function testInvalidLabel(label: string, expectedErrorFragment: string) {
				const ratioJson: FormatProps = {
					type: "Ratio",
					ratioType: "OneToN",
					precision: 2,
					composite: {
						includeZero: true,
						units: [{ name: "Units.M_PER_M_LENGTH_RATIO", label }],
					},
				};

				const unitsProvider = new TestUnitsProvider();
				const ratioFormat = new Format("InvalidRatioLabel");

				try {
					await ratioFormat.fromJSON(unitsProvider, ratioJson);
					assert.fail(`Should have thrown an error for label: ${label}`);
				} catch (err: any) {
					expect(err.message).to.include("must follow the 'numerator/denominator' standard");
					expect(err.message).to.include(expectedErrorFragment);
				}
			}

			it("should reject invalid ratio format labels", async () => {
				await testInvalidLabel("invalidlabel", "missing the '/' separator");
				await testInvalidLabel("/m", "is invalid");
				await testInvalidLabel("m/", "is invalid");
				await testInvalidLabel("m/m/m", "is invalid");
				await testInvalidLabel("m/s/h", "is invalid");
			});

			it("should accept valid ratio format labels", async () => {
				const validLabels = [
					"m/m", // Simple valid label
					undefined, // No custom label
					"", // Empty label
					"m²/m³", // Special characters
					"kg·m/s²", // Complex but single '/'
				];

				for (const label of validLabels) {
					const ratioJson: FormatProps = {
						type: "Ratio",
						ratioType: "OneToN",
						precision: 2,
						composite: {
							includeZero: true,
							units: [{ name: "Units.M_PER_M_LENGTH_RATIO", ...(label !== undefined && { label }) }],
						},
					};

					const unitsProvider = new TestUnitsProvider();
					const ratioFormat = new Format("ValidRatioLabel");
					await ratioFormat.fromJSON(unitsProvider, ratioJson);
					expect(ratioFormat.type).to.equal(FormatType.Ratio);
				}
			});
		});
	});
});
