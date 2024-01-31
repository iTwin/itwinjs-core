/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelTestUtils } from "./IModelTestUtils";
import { ECClassModifier, PrimitiveType, SchemaLoader } from "@itwin/ecschema-metadata";
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
    // To use the schemas already in an iModel create a SchemaLoader that pulls schemas from the iModel
    // The SchemaLoader can load schemas from another location or you can create an empty context using the
    // SchemaContext constructor
    const loader = new SchemaLoader((name) => iModelDb.getSchemaProps(name));
    const editor = new SchemaContextEditor(loader.context);
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ IModelSchemas.editSchemas
    const createSchemaResult = await editor.createSchema("PipingSchema", "PS", 1,0,42);
    if (createSchemaResult.errorMessage !== undefined) {
      throw new Error("Failed to create schema");
    }

    const bisSchema = loader.getSchema("BisCore");
    const addRefResult = await editor.addSchemaReference(createSchemaResult.schemaKey!, bisSchema);
    if(addRefResult.errorMessage !== undefined) {
      throw new Error(`failed to add reference schema: ${addRefResult.errorMessage}`);
    }

    const createClassResult = await editor.entities.createElement(createSchemaResult.schemaKey!, "Pipe", ECClassModifier.None, bisSchema.getSchemaItemKey("BisCore.PhysicalElement"));
    if (createClassResult.errorMessage !== undefined) {
      throw new Error(`Failed to create class: ${createClassResult.errorMessage}`);
    }

    const createPropResult = await editor.entities.createProperty(createClassResult.itemKey!, "Diameter", PrimitiveType.Double, "cgk");
    if (createPropResult.errorMessage !== undefined) {
      throw new Error(`Failed to create property: ${createPropResult.errorMessage}`);
    }
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ IModelSchemas.importToIModel
    const pipingSchema = await editor.getSchema(createSchemaResult.schemaKey!);
    if (pipingSchema === undefined) {
      throw new Error(`Schema Key ${createSchemaResult.schemaKey!.toString(true)} not found in context`);
    }
    const schemaXml = await SchemaXml.writeString(pipingSchema);
    await iModelDb.importSchemaStrings([schemaXml]);
    // __PUBLISH_EXTRACT_END__

  });
});
