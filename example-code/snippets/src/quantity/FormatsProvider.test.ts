import { BeUiEvent } from "@itwin/core-bentley";
import { Format, FormatterSpec, ParsedQuantity, ParserSpec } from "@itwin/core-quantity";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { MutableFormatsProvider, SchemaContext, SchemaFormatsProvider, SchemaItemFormatProps, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { assert } from "chai";
import path from "path";

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Mutable_Formats_Provider
/**
 * Implements a formats provider with a cache, to allow adding/removing formats at runtime.
 */
class ExampleFormatProvider implements MutableFormatsProvider {
  private _cache: Map<string, SchemaItemFormatProps> = new Map();
  public onFormatsChanged = new BeUiEvent<string[]>();

  public async getFormat(name: string): Promise<SchemaItemFormatProps | undefined> {
    return this._cache.get(name);
  }

  public async addFormat(name: string, format: SchemaItemFormatProps): Promise<void> {
    this._cache.set(name, format);
    this.onFormatsChanged.raiseEvent([name]);
  }
  public async removeFormat(name: string): Promise<void> {
    this._cache.delete(name);
    this.onFormatsChanged.raiseEvent([name]);
  }
}
// __PUBLISH_EXTRACT_END__

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

  it("SchemaFormatsProvider Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    // No unit system was provided, and no format was found in the cache so the method will return the first presentation format for the KoQ, which uses KM.
    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50); // The persistence unit is meters, so this input value is 50 m.
    // result in formatted value of 50 m
    // __PUBLISH_EXTRACT_END__

    assert.equal(result, "50.0 m");
  });

  it("SchemaFormatsProvider Formatting with Unit System provided", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting_With_Unit_System
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    formatsProvider.unitSystem = "imperial"; // This will cause the method to return the first presentation format for the KoQ that uses imperial units.
    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50); // The persistence unit is meters, so this input value is 50 m.
    // result in formatted value of 164'0 1/2"
    // __PUBLISH_EXTRACT_END__

    assert.equal(result, "164'0 1/2\"");
  });

  it("SchemaFormatsProvider Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
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

  it("adding a format", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Mutable_Formats_Provider_Adding_A_Format
    const formatsProvider = new ExampleFormatProvider();
    const format: SchemaItemFormatProps = {
      label: "NewFormat",
      type: "Fractional",
      precision: 8,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      uomSeparator: "",
    };
    await formatsProvider.addFormat("AecUnits.LENGTH", format); // Add a format with the name "AecUnits.LENGTH". The name could be anything as long as it is unique.
    const retrievedFormat = await formatsProvider.getFormat("AecUnits.LENGTH");
    // retrievedFormat is the format we just added.
    // __PUBLISH_EXTRACT_END__

    assert.equal(retrievedFormat, format);
  });
});
