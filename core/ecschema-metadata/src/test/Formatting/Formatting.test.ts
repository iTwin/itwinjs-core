/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { SchemaContext } from "../../ecschema-metadata";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { SchemaUnitProvider } from "../../UnitProvider/SchemaUnitProvider";
import { UNIT_EXTRA_DATA } from "../UnitProvider/UnitData";
import { Format, FormatterSpec } from "@itwin/core-quantity";

describe("Formatting tests handling temperature conversions where sign is flipped", () => {
  let context: SchemaContext;
  let provider: SchemaUnitProvider;

  before(() => {
    context = new SchemaContext();

    const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);

    provider = new SchemaUnitProvider(context, UNIT_EXTRA_DATA);
  });

  it("should format Kelvin to Fahrenheit with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(100);
    expect(formatted).to.eql("-279.67 °F");
  });

  it("should format Celsius to Fahrenheit with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel", "TrailZeroes"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.CELSIUS");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-40);
    expect(formatted).to.eql("-40.00 °F");
  });

  it("should format Fahrenheit to Celsius with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.CELSIUS",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.FAHRENHEIT");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(0);
    expect(formatted).to.eql("-17.78 °C");
  });

  it("should format Rankine to Celsius with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.CELSIUS",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.RANKINE");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(200);
    expect(formatted).to.eql("-162.04 °C");
  });

  it("should handle temperature conversion with fractional format", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Fractional",
      formatTraits: ["ShowUnitLabel"],
      precision: 8,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(150);
    expect(formatted).to.eql("-189 5/8 °F");
  });

  it("should handle zero Kelvin (absolute zero) conversion", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(0);
    expect(formatted).to.eql("-459.67 °F");
  });

  it("should handle positive temperature conversion correctly", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel", "TrailZeroes"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(373.15);
    expect(formatted).to.eql("212.00 °F");
  });

  it("should convert negative Celsius to positive Kelvin", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.K",
            label: "K"
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.CELSIUS");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-100);
    expect(formatted).to.eql("173.15 K");
  });

  it("should convert negative Fahrenheit to positive Rankine", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.RANKINE",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.FAHRENHEIT");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-200);
    expect(formatted).to.eql("259.67 °R");
  });
});

describe.only("Ratio format tests", () => {
  let context: SchemaContext;
  let provider: SchemaUnitProvider;

  before(() => {
    context = new SchemaContext();

    const unitsSchemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const unitsSchemaXml = fs.readFileSync(unitsSchemaFile, "utf-8");
    deserializeXmlSync(unitsSchemaXml, context);

    const ratioSchemaFile = path.join(__dirname, "..",  "assets", "RatioUnits.ecschema.xml");
    const ratioSchemaXml = fs.readFileSync(ratioSchemaFile, "utf-8");
    deserializeXmlSync(ratioSchemaXml, context);

    provider = new SchemaUnitProvider(context, UNIT_EXTRA_DATA);
  });

  interface TestData {
    magnitude: number;
    ratio: string;
    precision?: number;
  }

  async function testRatioType(
    ratioType: string,
    testData: TestData[],
    presentationUnitStr: string = "RatioUnits.M_PER_M_LENGTH_RATIO",
    persistenceUnitStr: string = "RatioUnits.DECIMAL_LENGTH_RATIO",
  ) {
    const defaultPrecision = 3;

    const format = await Format.createFromJSON("TestRatio", provider, {
      type: "Ratio",
      ratioType,
      precision: defaultPrecision,
      composite: {
        includeZero: true,
        units: [
          { name: presentationUnitStr },
        ],
      },
    });

    const persistenceUnit = await provider.findUnitByName(persistenceUnitStr);
    expect(persistenceUnit).to.not.be.undefined;

    const formatterSpec = await FormatterSpec.create(`${ratioType}`, format, provider, persistenceUnit);

    for (const entry of testData) {
      if (entry.precision !== undefined) {
        formatterSpec.format.precision = entry.precision;
      }
      const resultRatio = formatterSpec.applyFormatting(entry.magnitude);
      expect(resultRatio, `Formatting magnitude ${entry.magnitude}`).to.eql(entry.ratio);
    }
  }

  describe("RatioType formatting tests", () => {
    it("should format OneToN ratio type", async () => {
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

    it("should format NToOne ratio type", async () => {
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

    it("should format ValueBased ratio type", async () => {
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

    it("should format UseGreatestCommonDivisor ratio type", async () => {
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

  describe("RatioType tests with different precision", () => {
    it("should format OneToN with varying precision", async () => {
      const testData: TestData[] = [
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

    it("should format NToOne with varying precision", async () => {
      const testData: TestData[] = [
        { magnitude: 3, ratio: "3:1", precision: 0 },
        { magnitude: 3, ratio: "3:1", precision: 1 },
        { magnitude: 3, ratio: "3:1", precision: 2 },
        { magnitude: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("NToOne", testData);
    });

    it("should format ValueBased with varying precision", async () => {
      const testData: TestData[] = [
        { magnitude: 3, ratio: "3:1", precision: 0 },
        { magnitude: 3, ratio: "3:1", precision: 1 },
        { magnitude: 3, ratio: "3:1", precision: 2 },
        { magnitude: 3, ratio: "3:1", precision: 3 },
      ];
      await testRatioType("ValueBased", testData);
    });

    it("should format UseGreatestCommonDivisor with irrational numbers", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0 / 7, ratio: "143:1000" },
        { magnitude: 2.0 / 7, ratio: "143:500" },
        { magnitude: 1.0 / 7, ratio: "1429:10000", precision: 4 },
        { magnitude: 2.0 / 7, ratio: "2857:10000", precision: 4 },
      ];
      await testRatioType("UseGreatestCommonDivisor", testData);
    });
  });

  describe("RatioType tests with special values", () => {
    it("should handle zero value", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0, ratio: "0:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("should handle large and small values", async () => {
      const testData: TestData[] = [
        { magnitude: 0.0004, ratio: "0:1" },
        { magnitude: 0.0005, ratio: "0.001:1" },
        { magnitude: 0.00000001, ratio: "0:1" },
        { magnitude: 100000000, ratio: "100000000:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("should handle negative values", async () => {
      const testData: TestData[] = [
        { magnitude: -1.0, ratio: "-1:1" },
        { magnitude: -0.5, ratio: "-0.5:1" },
        { magnitude: -2, ratio: "-2:1" },
      ];
      await testRatioType("NToOne", testData);
    });

    it("should handle irrational numbers with NToOne", async () => {
      const testData: TestData[] = [
        { magnitude: 1.0 / 7, ratio: "0.143:1" },
        { magnitude: 2.0 / 7, ratio: "0.286:1" },
      ];
      await testRatioType("NToOne", testData);
    });
  });

  describe("Ratio formatting with different unit types", () => {
    it("should format dimensionless ratios", async () => {
      const format = await Format.createFromJSON("TestRatio", provider, {
        type: "Ratio",
        ratioType: "OneToN",
        precision: 2,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.M_PER_M_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("Dimensionless", format, provider, persistenceUnit);

      expect(formatterSpec.applyFormatting(0.5)).to.eql("1:2");
      expect(formatterSpec.applyFormatting(2.0)).to.eql("1:0.5");
      expect(formatterSpec.applyFormatting(1.0)).to.eql("1:1");
    });

    it("should format length ratios (slope)", async () => {
      const format = await Format.createFromJSON("TestSlope", provider, {
        type: "Ratio",
        ratioType: "ValueBased",
        precision: 1,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.M_PER_M_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("Slope", format, provider, persistenceUnit);

      expect(formatterSpec.applyFormatting(0.25)).to.eql("1:4");
      expect(formatterSpec.applyFormatting(4.0)).to.eql("4:1");
      expect(formatterSpec.applyFormatting(0.5)).to.eql("1:2");
    });

    it("should format metric scale factors", async () => {
      const format = await Format.createFromJSON("TestMetricScale", provider, {
        type: "Ratio",
        ratioType: "OneToN",
        precision: 1,
        formatTraits: ["TrailZeroes"],
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.M_PER_M_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("MetricScale", format, provider, persistenceUnit);

      // Common metric map scale factors
      expect(formatterSpec.applyFormatting(1.0)).to.eql("1:1.0");
      expect(formatterSpec.applyFormatting(0.5)).to.eql("1:2.0");
      expect(formatterSpec.applyFormatting(0.4)).to.eql("1:2.5");
      expect(formatterSpec.applyFormatting(0.2)).to.eql("1:5.0");
      expect(formatterSpec.applyFormatting(0.1)).to.eql("1:10.0");
      expect(formatterSpec.applyFormatting(0.05)).to.eql("1:20.0");
      expect(formatterSpec.applyFormatting(0.04)).to.eql("1:25.0");
      expect(formatterSpec.applyFormatting(0.02)).to.eql("1:50.0");
      expect(formatterSpec.applyFormatting(0.01)).to.eql("1:100.0");
      expect(formatterSpec.applyFormatting(0.005)).to.eql("1:200.0");
      expect(formatterSpec.applyFormatting(0.004)).to.eql("1:250.0");
      expect(formatterSpec.applyFormatting(0.0025)).to.eql("1:400.0");
      expect(formatterSpec.applyFormatting(0.002)).to.eql("1:500.0");
      expect(formatterSpec.applyFormatting(0.001)).to.eql("1:1000.0");
      expect(formatterSpec.applyFormatting(0.0002)).to.eql("1:5000.0");
      expect(formatterSpec.applyFormatting(0.0001)).to.eql("1:10000.0");
      expect(formatterSpec.applyFormatting(0.00004)).to.eql("1:25000.0");
      expect(formatterSpec.applyFormatting(0.00002)).to.eql("1:50000.0");
      expect(formatterSpec.applyFormatting(0.00001)).to.eql("1:100000.0");
      expect(formatterSpec.applyFormatting(0.000004)).to.eql("1:250000.0");
    });

    it("should format imperial scale factors", async () => {
      const format = await Format.createFromJSON("TestImperialScale", provider, {
        type: "Ratio",
        ratioType: "NToOne",
        precision: 4,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.IN_PER_FT_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("ImperialScale", format, provider, persistenceUnit);

      // Common imperial architectural and engineering scales
      // Architectural scales (based on inches to feet)
      expect(formatterSpec.applyFormatting(1.0)).to.eql("12\"=1'"); // Full size (12" = 1'-0")
      expect(formatterSpec.applyFormatting(0.5)).to.eql("6\"=1'"); // Half size (6" = 1'-0")
      expect(formatterSpec.applyFormatting(1/3)).to.eql("4\"=1'"); // 4" = 1'-0"
      expect(formatterSpec.applyFormatting(0.25)).to.eql("3\"=1'"); // 3" = 1'-0"
      expect(formatterSpec.applyFormatting(1/6)).to.eql("2\"=1'"); // 2" = 1'-0"
      expect(formatterSpec.applyFormatting(1/8)).to.eql("1.5\"=1'"); // 1-1/2" = 1'-0"
      expect(formatterSpec.applyFormatting(1/12)).to.eql("1\"=1'"); // 1" = 1'-0"
      expect(formatterSpec.applyFormatting(1/16)).to.eql("0.75\"=1'"); // 3/4" = 1'-0"
      expect(formatterSpec.applyFormatting(1/24)).to.eql("0.5\"=1'"); // 1/2" = 1'-0"
      expect(formatterSpec.applyFormatting(1/32)).to.eql("0.375\"=1'"); // 3/8" = 1'-0"
      expect(formatterSpec.applyFormatting(1/48)).to.eql("0.25\"=1'"); // 1/4" = 1'-0"
      expect(formatterSpec.applyFormatting(1/96)).to.eql("0.125\"=1'"); // 1/8" = 1'-0"

      // Engineering scales (decimal based)
      expect(formatterSpec.applyFormatting(1/10)).to.eql("1.2\"=1'"); // 1" = 10'
      expect(formatterSpec.applyFormatting(1/20)).to.eql("0.6\"=1'"); // 1" = 20'
      expect(formatterSpec.applyFormatting(1/30)).to.eql("0.4\"=1'"); // 1" = 30'
      expect(formatterSpec.applyFormatting(1/40)).to.eql("0.3\"=1'"); // 1" = 40'
      expect(formatterSpec.applyFormatting(1/50)).to.eql("0.24\"=1'"); // 1" = 50'
      expect(formatterSpec.applyFormatting(1/60)).to.eql("0.2\"=1'"); // 1" = 60'
      expect(formatterSpec.applyFormatting(1/100)).to.eql("0.12\"=1'"); // 1" = 100'

      // Civil/site scales
      expect(formatterSpec.applyFormatting(1/120)).to.eql("0.1\"=1'"); // 1" = 10'
      expect(formatterSpec.applyFormatting(1/240)).to.eql("0.05\"=1'"); // 1" = 20'
      expect(formatterSpec.applyFormatting(1/480)).to.eql("0.025\"=1'"); // 1" = 40'
      expect(formatterSpec.applyFormatting(1/600)).to.eql("0.02\"=1'"); // 1" = 50'
      expect(formatterSpec.applyFormatting(1/1200)).to.eql("0.01\"=1'"); // 1" = 100'
    });
  });

  describe("Ratio formatting edge cases", () => {
    it("should handle very small numbers approaching zero", async () => {
      const format = await Format.createFromJSON("TestRatio", provider, {
        type: "Ratio",
        ratioType: "NToOne",
        precision: 3,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.IN_PER_FT_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("EdgeCase", format, provider, persistenceUnit);

      expect(formatterSpec.applyFormatting(0.0001)).to.eql("0:1");
      expect(formatterSpec.applyFormatting(0.0009)).to.eql("0.001:1");
    });

    it("should format ratio with high precision", async () => {
      const format = await Format.createFromJSON("TestRatio", provider, {
        type: "Ratio",
        ratioType: "OneToN",
        formatTraits: ["TrailZeroes"],
        precision: 6,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.IN_PER_FT_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("HighPrecision", format, provider, persistenceUnit);

      expect(formatterSpec.applyFormatting(Math.PI)).to.eql("1:0.318310");
      expect(formatterSpec.applyFormatting(1 / Math.PI)).to.eql("1:3.141593");
    });

    it("should format ratio with UseGreatestCommonDivisor and simple fractions", async () => {
      const format = await Format.createFromJSON("TestRatio", provider, {
        type: "Ratio",
        ratioType: "UseGreatestCommonDivisor",
        precision: 3,
        composite: {
          includeZero: true,
          units: [
            { name: "RatioUnits.DECIMAL_LENGTH_RATIO" },
          ],
        },
      });

      const persistenceUnit = await provider.findUnitByName("RatioUnits.DECIMAL_LENGTH_RATIO");
      const formatterSpec = await FormatterSpec.create("GCD", format, provider, persistenceUnit);

      expect(formatterSpec.applyFormatting(0.5)).to.eql("1:2");
      expect(formatterSpec.applyFormatting(0.75)).to.eql("3:4");
      expect(formatterSpec.applyFormatting(0.6)).to.eql("3:5");
      expect(formatterSpec.applyFormatting(0.125)).to.eql("1:8");
    });
  });
});
