/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Format, FormatterSpec, Parser, ParseResult, ParserSpec, UnitConversionSpec, UnitProps } from "@bentley/imodeljs-quantity";
import { FormatterParserSpecsProvider, QuantityFormatter, QuantityType, QuantityTypeArg, UnitSystemKey } from "../QuantityFormatter";

function withinTolerance(x: number, y: number, tolerance?: number): boolean {
  const tol: number = undefined !== tolerance ? tolerance : 0.1e-6;
  const z = x - y;
  return z >= -tol && z <= tol;
}

describe("Quantity formatter", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
  });

  it("Length", async () => {
    await quantityFormatter.onInitialized();
    const expected = `405'-0 1/2"`;
    const newFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);

    const actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    assert.equal(actual, expected);
  });

  it("Set and use length override format", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "cm", name: "Units.CM" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "in", name: "Units.IN" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    const metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const metricFormattedValue = quantityFormatter.formatQuantity(1.5, metricFormatSpec);
    assert.equal(metricFormattedValue, "1.5 m");

    const imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const imperialFormattedValue = quantityFormatter.formatQuantity(1.5, imperialFormatSpec);
    assert.equal(imperialFormattedValue, `4'-11"`);

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    const overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const overrideMetricFormattedValue = quantityFormatter.formatQuantity(1.5, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "150 cm");

    const overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const overrideImperialFormattedValue = quantityFormatter.formatQuantity(1.5, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "59.0551 in");

    const overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length, true);
    const overrideValueInMeters1 = quantityFormatter.parseToQuantityValue(`48"`, overrideImperialParserSpec);
    const overrideValueInMeters2 = quantityFormatter.parseToQuantityValue(`48 in`, overrideImperialParserSpec);
    const overrideValueInMeters3 = quantityFormatter.parseToQuantityValue(`4 ft`, overrideImperialParserSpec);
    assert(withinTolerance(overrideValueInMeters1.value!, 1.2192));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));
    assert(withinTolerance(overrideValueInMeters3.value!, overrideValueInMeters2.value!));
  });

  it("Set and use coordinate and length overrides format (Survey Feet) - deprecate way", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m", name: "Units.M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    // deprecated way of passing in useImperial
    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m");

    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "328083.99 ft");

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    await quantityFormatter.setOverrideFormats(QuantityType.Coordinate, overrideLengthAndCoordinateEntry);

    let overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    let overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "100000 m");

    overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "100000 m");

    let overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    let overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "328083.3333 ft (US Survey)");

    overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "328083.3333 ft (US Survey)");

    let overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length, true);
    let overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    let overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    assert(withinTolerance(overrideValueInMeters1.value!, 100000));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));

    overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Coordinate, true);
    overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    assert(withinTolerance(overrideValueInMeters1.value!, 100000));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));

    await quantityFormatter.clearAllOverrideFormats();
    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m");

    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "328083.99 ft");
  });

  it("Set and use coordinate and length overrides format (Survey Feet)", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m", name: "Units.M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    await quantityFormatter.setActiveUnitSystem("metric");
    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m");

    await quantityFormatter.setActiveUnitSystem("imperial");
    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "328083.99 ft");

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    await quantityFormatter.setOverrideFormats(QuantityType.Coordinate, overrideLengthAndCoordinateEntry);

    await quantityFormatter.setActiveUnitSystem("metric");
    let overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    let overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "100000 m");

    overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "100000 m");

    await quantityFormatter.setActiveUnitSystem("imperial");
    let overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    let overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "328083.3333 ft (US Survey)");

    overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "328083.3333 ft (US Survey)");

    let overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length);
    let overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    let overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    assert(withinTolerance(overrideValueInMeters1.value!, 100000));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));

    overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Coordinate);
    overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    assert(withinTolerance(overrideValueInMeters1.value!, 100000));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));

    await quantityFormatter.clearAllOverrideFormats();
    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "328083.99 ft");

    await quantityFormatter.setActiveUnitSystem("metric");
    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m");
  });

  it("Set and use area overrides format (Survey Feet)", async () => {
    const overrideEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m²", name: "Units.SQ_M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft² (US Survey)", name: "Units.SQ_US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m²");

    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "1076391.0417 ft²");

    await quantityFormatter.setOverrideFormats(QuantityType.Area, overrideEntry);

    const overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    const overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    assert.equal(overrideMetricFormattedValue, "100000 m²");

    const overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    const overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    assert.equal(overrideImperialFormattedValue, "1076386.7361 ft² (US Survey)");

    const overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Area, true);
    const overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("1076386.7361", overrideImperialParserSpec);
    const overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("1076386.7361 sussf", overrideImperialParserSpec);
    // eslint-disable-next-line no-console
    // console.log(`overrideValueInMeters1=${JSON.stringify(overrideValueInMeters1)}`);
    assert(withinTolerance(overrideValueInMeters1.value!, 100000, 1.0e-5));
    assert(withinTolerance(overrideValueInMeters1.value!, overrideValueInMeters2.value!));

    await quantityFormatter.clearOverrideFormats(QuantityType.Area);

    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    assert.equal(metricFormattedValue, "100000 m²");

    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    assert.equal(imperialFormattedValue, "1076391.0417 ft²");
  });

  describe("Mimic Native unit conversions", async () => {
    async function testUnitConversion(magnitude: number, fromUnitName: string, expectedValue: number, toUnitName: string, tolerance?: number) {
      const fromUnit = await quantityFormatter.findUnitByName(fromUnitName);
      const toUnit = await quantityFormatter.findUnitByName(toUnitName);
      const unitConversion = await quantityFormatter.getConversion(fromUnit, toUnit);
      const convertedValue = (magnitude * unitConversion.factor) + unitConversion.offset;
      assert(withinTolerance(convertedValue, expectedValue, tolerance));
    }

    it("UnitConversionTests, USCustomaryLengths", async () => {
      // Conversion tests where expected value is taken directly out of  http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8
      // Directly from exact values in tables
      await testUnitConversion(1.0, "Units.MILE", 63360, "Units.IN");
      await testUnitConversion(1.0, "Units.MILE", 5280, "Units.FT");
      await testUnitConversion(1.0, "Units.MILE", 1760, "Units.YRD");
      await testUnitConversion(1.0, "Units.MILE", 80, "Units.CHAIN");
      await testUnitConversion(1.0, "Units.IN", 2.54, "Units.CM");
      await testUnitConversion(1.0, "Units.FT", 30.48, "Units.CM");
      await testUnitConversion(1.0, "Units.YRD", 91.44, "Units.CM");
      await testUnitConversion(1.0, "Units.CHAIN", 66.0 * 30.48, "Units.CM");
      await testUnitConversion(1.0, "Units.MILE", 160934.4, "Units.CM");
    });

    it("UnitConversionTests, UsSurveyLengths", async () => {
      // Conversion tests where expected value is taken directly out of  http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8
      // Exact values from document used for these conversions
      await testUnitConversion(1.0, "Units.FT", 0.999998, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.FT", 0.0254 * 39.37, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1.0 / 0.999998, "Units.FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1200.0 / 3937.0, "Units.M");
      await testUnitConversion(1.0, "Units.M", 3937.0 / 1200.0, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 5280.0 * 1200.0 / 3937.0, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1.0 / 0.999998, "Units.MILE");
      await testUnitConversion(1.0, "Units.MILE", 0.999998, "Units.US_SURVEY_MILE");
      await testUnitConversion(1.0, "Units.M", 3937.0 / 1200.0 / 5280.0, "Units.US_SURVEY_MILE");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1.0 / 66.0, "Units.US_SURVEY_CHAIN");
      await testUnitConversion(1.0, "Units.M", 39.37, "Units.US_SURVEY_IN");
      await testUnitConversion(12.0, "Units.US_SURVEY_IN", 1200.0 / 3937.0, "Units.M");

      // Directly from exact values in tables
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 63360, "Units.US_SURVEY_IN");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 5280, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1760, "Units.US_SURVEY_YRD");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 80, "Units.US_SURVEY_CHAIN", 1.0e-6);

      // Exact values do not exist in document
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 0.3048006, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_CHAIN", 20.11684, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_YRD", 3.0 * 0.3048006, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1609.347, "Units.M", 1.0e-3);
    });
  });
});

// ==========================================================================================================
class DummyFormatterSpec extends FormatterSpec {
  constructor(name: string, format: Format, conversions?: UnitConversionSpec[]) {
    super(name, format, conversions);
  }

  public applyFormatting(magnitude: number): string {
    return magnitude.toFixed(6);
  }

  public static async createSpec(unitSystem: UnitSystemKey): Promise<DummyFormatterSpec> {
    if (unitSystem === "imperial")
      return new DummyFormatterSpec("dummy-imperial", new Format("formatName"));
    else if (unitSystem === "usCustomary")
      return new DummyFormatterSpec("dummy-usCustomary", new Format("formatName"));
    else if (unitSystem === "usSurvey")
      return new DummyFormatterSpec("dummy-usSurvey", new Format("formatName"));
    else
      return new DummyFormatterSpec("dummy-metric", new Format("formatName"));
  }
}

// ==========================================================================================================
// Register and test FormatterParserSpecsProvider
// ==========================================================================================================
class DummyParserSpec extends ParserSpec {
  constructor(outUnit: UnitProps, format: Format, conversions?: UnitConversionSpec[]) {
    super(outUnit, format, conversions ?? []);
  }

  public parseToQuantityValue(inString: string): ParseResult {
    return Parser.parseToQuantityValue(inString, this.format, this.unitConversions);
  }

  public static async createParserSpec(unitSystem: UnitSystemKey): Promise<DummyParserSpec> {
    const quantityFormatter = new QuantityFormatter();
    const formatterSpec = await DummyFormatterSpec.createSpec(unitSystem);
    if (unitSystem === "imperial" || unitSystem === "usCustomary" || unitSystem === "usSurvey") {
      const outUnit = await quantityFormatter.findUnitByName("Units.FT");
      const conversions = await Parser.createUnitConversionSpecsForUnit(quantityFormatter, outUnit);
      return new DummyParserSpec(outUnit, formatterSpec.format, conversions);
    } else {
      const outUnit = await quantityFormatter.findUnitByName("Units.M");
      const conversions = await Parser.createUnitConversionSpecsForUnit(quantityFormatter, outUnit);
      return new DummyParserSpec(outUnit, formatterSpec.format, conversions);
    }
  }
}

describe("Custom FormatterSpecs", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
  });

  it("QuantityFormatter should register properly", async () => {
    assert.isTrue(quantityFormatter.useImperialFormats); // eslint-disable-line deprecation/deprecation
    assert.isTrue(quantityFormatter.activeUnitSystem === "imperial");

    const customFormatterParserSpecsProvider: FormatterParserSpecsProvider = {
      quantityType: "DummyQuantity",
      createFormatterSpec: DummyFormatterSpec.createSpec,
      createParserSpec: DummyParserSpec.createParserSpec,
    };

    let foundFormatterSpec: FormatterSpec | undefined;
    foundFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType("DummyQuantity");
    assert.isUndefined(foundFormatterSpec);

    assert.isTrue(await quantityFormatter.registerFormatterParserSpecsProviders(customFormatterParserSpecsProvider));
    assert.isFalse(await quantityFormatter.registerFormatterParserSpecsProviders(customFormatterParserSpecsProvider), "Can't register a provider twice");

    foundFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType("DummyQuantity")!;
    assert.instanceOf(foundFormatterSpec, DummyFormatterSpec);

    const formattedValue = quantityFormatter.formatQuantity(1.234567891234, foundFormatterSpec);
    assert.strictEqual(formattedValue, "1.234568");

    const parserSpec = await quantityFormatter.getParserSpecByQuantityType("DummyQuantity")!;
    assert.instanceOf(parserSpec, DummyParserSpec);

    // results should be in feet because we are set to imperial
    if (parserSpec) {
      const meterToImperialResult = parserSpec.parseToQuantityValue("12.192 m");
      const feetToImperialResult = parserSpec.parseToQuantityValue("40 ft");
      assert(withinTolerance(40.0, feetToImperialResult.value!));
      assert(withinTolerance(meterToImperialResult.value!, feetToImperialResult.value!));
    }
  });

});

describe("Custom FormatterSpecs", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
  });

  async function testFormatting(type: QuantityTypeArg, magnitude: number, expectedValue: string) {
    const formatterSpec = await quantityFormatter.getFormatterSpecByQuantityType(type);
    const formattedValue = quantityFormatter.formatQuantity(magnitude, formatterSpec);
    // console.log(`Type=${type} formatted value=${formattedValue}`); // eslint-disable-line no-console
    assert.equal(formattedValue, expectedValue);
  }

  it("QuantityFormatter should handle unit system changes properly", async () => {
    assert.isTrue(quantityFormatter.activeUnitSystem === "imperial");
    await testFormatting(QuantityType.Length, 1000.0, `3280'-10 1/8"`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.9104 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0.0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.8399 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft (US Survey)");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.84");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.6662 ft³");

    await quantityFormatter.setActiveUnitSystem("metric");
    await testFormatting(QuantityType.Length, 1000.0, `1000 m`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°`);
    await testFormatting(QuantityType.Area, 1000.0, "1000 m²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "1000 m");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0.0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "1000 m");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "1000 m");
    await testFormatting(QuantityType.Stationing, 1000.0, "1+000.00");
    await testFormatting(QuantityType.Volume, 1000.0, "1000 m³");

    await quantityFormatter.setActiveUnitSystem("usCustomary");
    await testFormatting(QuantityType.Length, 1000.0, `3280'-10 1/8"`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.9104 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0.0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.8399 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.84");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.6662 ft³");

    await quantityFormatter.setActiveUnitSystem("usSurvey");
    await testFormatting(QuantityType.Length, 1000.0, `3280.8333 ft`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.8674 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.83 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0.0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.8333 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.83");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.4548 ft³");
  });
});
