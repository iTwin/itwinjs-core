/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { BisCoreSchema, ClassRegistry, IModelDb, IModelHost, Schema, Schemas, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelStatus } from "@itwin/core-bentley";
import { ColorByName, IModelError, SubCategoryAppearance } from "@itwin/core-common";
import { EntityClass } from "@itwin/ecschema-metadata";

/* eslint-disable @typescript-eslint/naming-convention */

// __PUBLISH_EXTRACT_START__ Metadata.entitiesFromIModelDb
// For the sake of this example, we will assume an open IModelDb is provided. See backend docs for details on how to work with imodels.
async function iterateEntitiesOnBisCore(imodel: IModelDb): Promise<void> {
  // Get the schema context from the IModelDb
  const schemaContext = imodel.schemaContext;

  const bisCore = await schemaContext.getSchema(BisCoreSchema.schemaKey);
  if (bisCore === undefined) {
    throw new IModelError(IModelStatus.NotFound, "BisCore schema not found");
  }

  for (const entity of bisCore.getItems(EntityClass)) {
    console.log(`Entity: ${entity.name}`);
    // Get the properties of the entity
    const properties = await entity.getProperties();
    // Iterate through each property
    for (const property of properties) {
      console.log(`  Property: ${property.name}`);
      // Check if the property is a primitive type
      if (property.isPrimitive()) {
        console.log(`    Primitive Type: ${property.primitiveType}`);
      }

      console.log(`    Label: ${property.label}`);
    }
  }
  // Get all schemas in the iModel


  // Iterate through each schema
  for (const schema of schemas) {
    // Check if the schema is a custom schema
    if (schema.isCustomSchema()) {
      console.log(`Schema: ${schema.name}`);

      // Get all classes in the schema
      const classes = schema.getClasses();

      // Iterate through each class
      for (const cls of classes) {
        console.log(`Class: ${cls.name}`);
      }
    }
  }
}
// We work on an iModelDb, for the sake of this example, we just use an empty one. See backend docs for details on how to work with imodels.
let imodel: IModelDb = SnapshotDb.createEmpty("test.bim", { rootSubject: { name: "Test" } });



// __PUBLISH_EXTRACT_END__
