import { Quantity } from "@itwin/core-quantity";
import { SchemaContext } from "../../Context";
import { SchemaUnitProvider } from "../../UnitProvider/SchemaUnitProvider";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import * as path from "path";
import * as fs from "fs";
import { beforeAll, describe, expect, it } from "vitest";

describe("Unit Conversion examples", () => {
  let schemaContext: SchemaContext;

  beforeAll(() => {
    schemaContext = new SchemaContext();

    // Load Units schema
    const unitSchemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const unitsXml = fs.readFileSync(unitSchemaFile, "utf-8");
    deserializeXmlSync(unitsXml, schemaContext);
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
    expect(converted).toBeDefined();
    expect(converted.magnitude).toBeCloseTo(3.28084, 5);
  });
});
