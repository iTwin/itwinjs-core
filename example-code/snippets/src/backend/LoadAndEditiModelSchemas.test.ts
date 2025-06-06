/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelTestUtils } from "./IModelTestUtils";
import { ECClassModifier, PrimitiveType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaXml } from "@itwin/ecschema-locaters";
import { SchemaContextEditor } from "@itwin/ecschema-editing";
import { StandaloneDb } from "@itwin/core-backend";
import { Guid } from "@itwin/core-bentley";

describe("SchemaLoadAndEdit", () => {
  let iModelDb: StandaloneDb;
  before(async () => {
    await IModelTestUtils.startupIModelHost();
    iModelDb = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("schema-import.bim"), {
      rootSubject: { name: "schema import tests", description: "schema import tests" },
      client: "schema import",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });
  after(() => {
    iModelDb.close();
  });

  it("Load schema from iModel and Edit", async () => {
    // __PUBLISH_EXTRACT_START__ IModelSchemas.loadFromDb
    // To use the schemas already in an iModel we can use the integrated schemaContext.
    const context = iModelDb.schemaContext;
    const editor = new SchemaContextEditor(context);
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ IModelSchemas.editSchemas
    const schemaKey = await editor.createSchema("PipingSchema", "PS", 1, 0, 42);

    const bisSchema = await context.getSchema(new SchemaKey("BisCore"));
    if (bisSchema === undefined) {
      throw new Error("BisCore schema not found");
    }
    await editor.addSchemaReference(schemaKey, bisSchema);

    const elementKey = await editor.entities.createElement(schemaKey, "Pipe", ECClassModifier.None, bisSchema.getSchemaItemKey("BisCore.PhysicalElement"));

    await editor.entities.createProperty(elementKey, "Diameter", PrimitiveType.Double, "cgk");

    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ IModelSchemas.importToIModel
    const pipingSchema = await editor.getSchema(schemaKey);
    if (pipingSchema === undefined) {
      throw new Error(`Schema Key ${schemaKey.toString(true)} not found in context`);
    }
    const schemaXml = await SchemaXml.writeString(pipingSchema);
    await iModelDb.importSchemaStrings([schemaXml]);
    // __PUBLISH_EXTRACT_END__

  });
});
