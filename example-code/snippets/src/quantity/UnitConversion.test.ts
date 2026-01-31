import { Quantity } from "@itwin/core-quantity";
import { SchemaContext, SchemaKey, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { assert } from "chai";
import path from "path";

describe("Unit Conversion examples", () => {
  let schemaContext: SchemaContext;

  before(async () => {
    schemaContext = new SchemaContext();

    // Add Units schema locater
    const unitSchemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "units-schema");
    const locUnits = new SchemaXmlFileLocater();
    locUnits.addSchemaSearchPath(unitSchemaFile);
    schemaContext.addLocater(locUnits);

    // Load the Units schema
    const schemaKey = new SchemaKey("Units");
    await schemaContext.getSchema(schemaKey);
  });

  it("Direct Unit Conversion", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_UnitConversion.Direct_Conversion
    const context = schemaContext; // or from iModelDb.schemaContext or IModelConnection.schemaContext()

    const provider = new SchemaUnitProvider(context);

    const fromUnit = await provider.findUnitByName("Units.M");
    const toUnit = await provider.findUnitByName("Units.FT");
    const conversion = await provider.getConversion(fromUnit, toUnit);

    const quantity = new Quantity(fromUnit, 1.0);
    const converted = quantity.convertTo(toUnit, conversion); // converted.magnitude is 3.28084, that's the conversion factor from meters to feet
    // __PUBLISH_EXTRACT_END__

    // Verify the conversion is correct
    // 1 meter = 3.28084 feet
    assert.isDefined(converted);
    assert.approximately(converted!.magnitude, 3.28084, 0.00001);
  });
});
