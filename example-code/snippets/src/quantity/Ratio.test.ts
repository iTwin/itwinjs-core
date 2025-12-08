import { Format, Formatter, FormatterSpec, ParsedQuantity, ParserSpec } from "@itwin/core-quantity";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { SchemaContext, SchemaFormatsProvider, SchemaKey, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { assert } from "chai";
import path from "path";

describe("Ratio formatting examples", () => {
	let schemaContext: SchemaContext;

	before(async () => {
		schemaContext = new SchemaContext();

		// Add Units schema locater
		const unitSchemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "units-schema");
		const locUnits = new SchemaXmlFileLocater();
		locUnits.addSchemaSearchPath(unitSchemaFile);
		schemaContext.addLocater(locUnits);

		// Add RatioUnits schema locater from local assets
		const ratioUnitsPath = path.join(__dirname, "..", "..", "assets");
		const locRatioUnits = new SchemaXmlFileLocater();
		locRatioUnits.addSchemaSearchPath(ratioUnitsPath);
		schemaContext.addLocater(locRatioUnits);

		// Load the RatioUnits schema
		const schemaKey = new SchemaKey("RatioUnits");
		await schemaContext.getSchema(schemaKey);
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
				includeZero: true,
				units: [
					{
						name: "RatioUnits.M_PER_M_LENGTH_RATIO",
					},
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

		assert.equal(formattedScale1, "1:100.0");
		assert.equal(formattedScale2, "1:50.0");
		assert.equal(formattedScale3, "1:500.0");
	});

	it("Imperial Scale Ratio Formatting", async () => {
		// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Imperial_Scale
		const unitsProvider = new SchemaUnitProvider(schemaContext);

		const formatData = {
			type: "Ratio",
			ratioType: "NToOne",
			ratioSeparator: "=",
			ratioFormatType: "Fractional",
			precision: 16,
			formatTraits: ["showUnitLabel"],
			ratioUnits: [{ name: "Units.IN", label: '"' }, { name: "Units.FT", label: "'" }],
		};

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
		const formattedScale1 = spec.applyFormatting(scaleQuarterInch);
		const formattedScale2 = spec.applyFormatting(scaleThreeQuarterInch);
		const formattedScale3 = spec.applyFormatting(scaleOneAndHalfInch);
		const formattedScale4 = spec.applyFormatting(scaleThreeInch);
		// results: "1/4"=1'", "3/4"=1'", "1 1/2"=1'", "3"=1'"
		// __PUBLISH_EXTRACT_END__

		assert.equal(formattedScale1, "1/4\"=1'");
		assert.equal(formattedScale2, "3/4\"=1'");
		assert.equal(formattedScale3, "1 1/2\"=1'");
		assert.equal(formattedScale4, "3\"=1'");
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
				includeZero: true,
				units: [
					{
						name: "RatioUnits.M_PER_M_LENGTH_RATIO",
					},
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

		assert.equal((parsed1To100 as ParsedQuantity).value, 0.01);
		assert.equal((parsed1To50 as ParsedQuantity).value, 0.02);
		assert.equal((parsed1To500 as ParsedQuantity).value, 0.002);
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
			ratioUnits: [{ name: "Units.IN" }, { name: "Units.FT" }],
		};

		// generate a Format from FormatProps for parsing imperial architectural scales
		const format = new Format("ImperialScale");
		await format.fromJSON(unitsProvider, formatData);

		// define persistence unit - for scale factors, use a decimal length ratio unit
		const persistenceUnit = await unitsProvider.findUnitByName("RatioUnits.M_PER_M_LENGTH_RATIO");

		// create the parser spec
		const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);

		// parse various imperial scale notations with fractional values
		const parsedQuarterInch = parserSpec.parseToQuantityValue("1/4\"=1'");
		const parsedThreeQuarterInch = parserSpec.parseToQuantityValue("3/4\"=1'");
		const parsedOneAndHalfInch = parserSpec.parseToQuantityValue("1 1/2\"=1'");
		const parsedThreeInch = parserSpec.parseToQuantityValue("3\"=1'");
		// results: 0.020833... (1/48), 0.0625 (1/16), 0.125 (1/8), 0.25 (in decimal length ratio)
		// __PUBLISH_EXTRACT_END__

		assert.approximately((parsedQuarterInch as ParsedQuantity).value, 1 / 48, 0.0001);
		assert.approximately((parsedThreeQuarterInch as ParsedQuantity).value, 1 / 16, 0.0001);
		assert.approximately((parsedOneAndHalfInch as ParsedQuantity).value, 1 / 8, 0.0001);
		assert.approximately((parsedThreeInch as ParsedQuantity).value, 0.25, 0.0001);
	});

	// TODO: This test requires @itwin/ecschema-metadata to support parsing ratioUnits from XML.
	// The ratioUnits attribute in XML (e.g., ratioUnits="u:IN;u:FT") is not currently parsed,
	// so the format loaded from schema doesn't include ratioUnits configuration.
	it.skip("Ratio Formatting with KindOfQuantity", async () => {
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
		assert.equal(Formatter.formatQuantity(0.01, specMetric), "1:100.0");
		// 2. Test Imperial System (USCustom)
		// Initialize provider with "imperial" system
		const formatsProviderImperial = new SchemaFormatsProvider(schemaContext, "imperial");

		// Get the format for the SCALE_FACTOR KindOfQuantity
		// Should pick the format associated with USCUSTOM unit (IN_PER_FT_LENGTH_RATIO)
		const formatPropsImperial = await formatsProviderImperial.getFormat("RatioUnits.SCALE_FACTOR");

		// Create the format object
		const formatImperial = await Format.createFromJSON("ImperialScale", unitsProvider, formatPropsImperial!);

		// Test formatting
		const specImperial = await FormatterSpec.create("ImperialScale", formatImperial, unitsProvider, persistenceUnit);
		assert.equal(Formatter.formatQuantity(1.0, specImperial), "12\"=1'");

		// __PUBLISH_EXTRACT_END__
	});
});
