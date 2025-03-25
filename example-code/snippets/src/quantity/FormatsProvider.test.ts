import { Format, FormatterSpec, ParsedQuantity, ParserSpec } from "@itwin/core-quantity";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { SchemaContext, SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { assert } from "chai";
import path from "path";

describe("FormatsProvider examples", () => {
  let schemaContext: SchemaContext;

  before(() => {
    schemaContext = new SchemaContext();
    const unitSchemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "units-schema");
    const locUnits = new SchemaXmlFileLocater();
    locUnits.addSchemaSearchPath(unitSchemaFile)
    schemaContext.addLocater(locUnits);

    const schemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "formats-schema");
    const locFormats = new SchemaXmlFileLocater();
    locFormats.addSchemaSearchPath(schemaFile)
    schemaContext.addLocater(locFormats);

    const aecSchemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "aec-units-schema");
    const locAec = new SchemaXmlFileLocater();
    locAec.addSchemaSearchPath(aecSchemaFile)
    schemaContext.addLocater(locAec);
  });

  it("BasicFormatsProvider Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting
    const formatsProvider = new SchemaFormatsProvider(schemaContext);
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50); // The persistence unit is meters, so this input value is 50 m.
    // result in formatted value of 0.05 km
    // __PUBLISH_EXTRACT_END__

    assert.equal(result, "0.05 km");
  });

  it("SchemaFormatsProvider Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing
    const formatsProvider = new SchemaFormatsProvider(schemaContext);
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");


    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);
    const result = parserSpec.parseToQuantityValue("50 km");
    // result.value 50000  (value in meters)
    // __PUBLISH_EXTRACT_END__

    assert.equal((result as ParsedQuantity).value, 50000);
  });
});
