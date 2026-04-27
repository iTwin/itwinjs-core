import { Format, Formatter, FormatterSpec, ParsedQuantity, ParserSpec } from "@itwin/core-quantity";
import { SchemaContext } from "../../Context";
import { SchemaFormatsProvider } from "../../Formatting/SchemaFormatsProvider";
import { SchemaUnitProvider } from "../../UnitProvider/SchemaUnitProvider";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import * as path from "path";
import * as fs from "fs";
import { beforeAll, describe, expect, it } from "vitest";

describe("Ratio formatting examples", () => {
  let schemaContext: SchemaContext;

  beforeAll(() => {
    schemaContext = new SchemaContext();

    // Load Units schema
    const unitSchemaPackageJson = require.resolve("@bentley/units-schema/package.json");
    const unitSchemaDir = path.dirname(unitSchemaPackageJson);
    const unitSchemaFile = path.join(unitSchemaDir, "Units.ecschema.xml");
    const unitsXml = fs.readFileSync(unitSchemaFile, "utf-8");
    deserializeXmlSync(unitsXml, schemaContext);

    // Load RatioUnits schema from local assets
    const ratioUnitsFile = path.join(__dirname, "..", "assets", "RatioUnits.ecschema.xml");
    const ratioUnitsXml = fs.readFileSync(ratioUnitsFile, "utf-8");
    deserializeXmlSync(ratioUnitsXml, schemaContext);
  });

  it("Metric Scale Ratio Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Metric_Scale
    const unitsProvider = new SchemaUnitProvider(schemaContext);

    const formatData = {
      type: "Ratio",
      ratioType: "OneToN",
      precision: 1,
      formatTraits: ["trailZeroes"],
      composite: {
        units: [
          { name: "Units.M" },
          { name: "Units.M" },
        ],
      },
    };

    // generate a Format from FormatProps to display metric scale ratios
    const format = new Format("MetricScale");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input unit - for scale factors, use a length ratio unit
    const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.M_PER_M_LENGTH_RATIO");

    // Common metric map scales
    const scale1To100 = 0.01; // 1:100 scale
    const scale1To50 = 0.02; // 1:50 scale
    const scale1To500 = 0.002; // 1:500 scale

    // create the formatter spec
    const spec = await FormatterSpec.create("MetricScale", format, unitsProvider, persistenceUnit);

    // apply the formatting held in FormatterSpec
    const formattedScale1 = spec.applyFormatting(scale1To100);
    const formattedScale2 = spec.applyFormatting(scale1To50);
    const formattedScale3 = spec.applyFormatting(scale1To500);
    // results: "1:100.0", "1:50.0", "1:500.0"
    // __PUBLISH_EXTRACT_END__

    expect(formattedScale1).toBe("1:100.0");
    expect(formattedScale2).toBe("1:50.0");
    expect(formattedScale3).toBe("1:500.0");
  });

  it("Imperial Scale Ratio Formatting", async () => {
    const unitsProvider = new SchemaUnitProvider(schemaContext);

    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Imperial_Scale_FormatProps
    const formatData = {
      type: "Ratio",
      ratioType: "NToOne",
      ratioSeparator: "=",
      ratioFormatType: "Fractional",
      precision: 16,
      formatTraits: ["showUnitLabel"],
      composite: {
        units: [{ name: "Units.IN", label: '"' }, { name: "Units.FT", label: "'" }],
      },
    };
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Imperial_Scale
    // generate a Format from FormatProps to display imperial architectural scales
    const format = new Format("ImperialScale");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input unit - for scale factors, use a length ratio unit
    const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.M_PER_M_LENGTH_RATIO");

    // Common imperial architectural scales (inches to feet)
    const scaleQuarterInch = 1 / 48; // 1/4" = 1'-0"
    const scaleThreeQuarterInch = 1 / 16; // 3/4" = 1'-0"
    const scaleOneAndHalfInch = 1 / 8; // 1-1/2" = 1'-0"
    const scaleThreeInch = 0.25; // 3" = 1'-0"

    // create the formatter spec
    const spec = await FormatterSpec.create("ImperialScale", format, unitsProvider, persistenceUnit);

    // apply the formatting held in FormatterSpec
    const formattedScale1 = spec.applyFormatting(scaleQuarterInch); // "1/4"=1'"
    const formattedScale2 = spec.applyFormatting(scaleThreeQuarterInch); // "3/4"=1'"
    const formattedScale3 = spec.applyFormatting(scaleOneAndHalfInch); // "1 1/2"=1'"
    const formattedScale4 = spec.applyFormatting(scaleThreeInch); // "3"=1'"
    // __PUBLISH_EXTRACT_END__

    expect(formattedScale1).toBe("1/4\"=1'");
    expect(formattedScale2).toBe("3/4\"=1'");
    expect(formattedScale3).toBe("1 1/2\"=1'");
    expect(formattedScale4).toBe("3\"=1'");
  });

  it("Metric Scale Ratio Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Metric_Scale_Parsing
    const unitsProvider = new SchemaUnitProvider(schemaContext);

    const formatData = {
      type: "Ratio",
      ratioType: "OneToN",
      precision: 1,
      formatTraits: ["trailZeroes"],
      composite: {
        units: [
          { name: "Units.M" },
          { name: "Units.M" },
        ],
      },
    };

    // generate a Format from FormatProps for parsing metric scale ratios
    const format = new Format("MetricScale");
    await format.fromJSON(unitsProvider, formatData);

    // define persistence unit - for scale factors, use a length ratio unit
    const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.M_PER_M_LENGTH_RATIO");

    // create the parser spec
    const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);

    // parse various metric scale notations
    const parsed1To100 = parserSpec.parseToQuantityValue("1:100");
    const parsed1To50 = parserSpec.parseToQuantityValue("1:50");
    const parsed1To500 = parserSpec.parseToQuantityValue("1:500");
    // results: 0.01, 0.02, 0.002 (in decimal length ratio)
    // __PUBLISH_EXTRACT_END__

    expect((parsed1To100 as ParsedQuantity).value).toBe(0.01);
    expect((parsed1To50 as ParsedQuantity).value).toBe(0.02);
    expect((parsed1To500 as ParsedQuantity).value).toBe(0.002);
  });

  it("Imperial Scale Ratio Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Imperial_Scale_Parsing
    const unitsProvider = new SchemaUnitProvider(schemaContext);

    const formatData = {
      type: "Ratio",
      ratioType: "NToOne",
      ratioSeparator: "=",
      ratioFormatType: "Fractional",
      precision: 16,
      formatTraits: ["showUnitLabel"],
      composite: {
        units: [{ name: "Units.IN" }, { name: "Units.FT" }],
      },
    };

    // generate a Format from FormatProps for parsing imperial architectural scales
    const format = new Format("ImperialScale");
    await format.fromJSON(unitsProvider, formatData);

    // define persistence unit - for scale factors, use a decimal length ratio unit
    const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.IN_PER_FT_LENGTH_RATIO");

    // create the parser spec
    const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);

    // parse various imperial scale notations with fractional values
    const parsedQuarterInch = parserSpec.parseToQuantityValue("1/4\"=1'");
    const parsedThreeQuarterInch = parserSpec.parseToQuantityValue("3/4\"=1'");
    const parsedOneAndHalfInch = parserSpec.parseToQuantityValue("1 1/2\"=1'");
    const parsedThreeInch = parserSpec.parseToQuantityValue("3\"=1'");
    // results: 0.25, 0.75, 1.5, 3.0 (in inches per foot ratio)
    // __PUBLISH_EXTRACT_END__

    expect((parsedQuarterInch as ParsedQuantity).value).toBeCloseTo(0.25, 4);
    expect((parsedThreeQuarterInch as ParsedQuantity).value).toBeCloseTo(0.75, 4);
    expect((parsedOneAndHalfInch as ParsedQuantity).value).toBeCloseTo(1.5, 4);
    expect((parsedThreeInch as ParsedQuantity).value).toBeCloseTo(3.0, 4);
  });

  it("Ratio Formatting with KindOfQuantity", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Ratio_KOQ
    const unitsProvider = new SchemaUnitProvider(schemaContext);

    // 1. Test Metric System (SI)
    // Initialize provider with "metric" system
    const formatsProviderMetric = new SchemaFormatsProvider(schemaContext, "metric");

    // Get the format for the SCALE_FACTOR KindOfQuantity
    // Should pick the format associated with SI unit (M_PER_M_LENGTH_RATIO)
    const formatPropsMetric = await formatsProviderMetric.getFormat("RatioUnits.SCALE_FACTOR");
    // Create the format object
    const formatMetric = await Format.createFromJSON("MetricScale", unitsProvider, formatPropsMetric!);

    // Test formatting
    const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.M_PER_M_LENGTH_RATIO");
    const specMetric = await FormatterSpec.create("MetricScale", formatMetric, unitsProvider, persistenceUnit);
    expect(Formatter.formatQuantity(0.01, specMetric)).toBe("1:100.0");
    // 2. Test Imperial System (USCustom)
    // Initialize provider with "imperial" system
    const formatsProviderImperial = new SchemaFormatsProvider(schemaContext, "imperial");

    // Get the format for the SCALE_FACTOR KindOfQuantity
    // Should pick the format associated with USCUSTOM unit (IN_PER_FT_LENGTH_RATIO)
    const formatPropsImperial = await formatsProviderImperial.getFormat("RatioUnits.SCALE_FACTOR");

    // Create the format object
    const formatImperial = await Format.createFromJSON("ImperialScale", unitsProvider, formatPropsImperial!);

    // Test formatting - value 12.0 in/ft means full scale (12 inches = 1 foot)
    const persistenceUnitImperial = await unitsProvider.findUnitByName("RatioUnits.IN_PER_FT_LENGTH_RATIO");
    const specImperial = await FormatterSpec.create("ImperialScale", formatImperial, unitsProvider, persistenceUnitImperial);
    expect(Formatter.formatQuantity(12.0, specImperial)).toBe("12\"=1'");

    // __PUBLISH_EXTRACT_END__
  });
});
