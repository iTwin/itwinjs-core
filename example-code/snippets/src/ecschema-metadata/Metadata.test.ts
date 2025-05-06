/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BisCoreSchema, SnapshotDb } from "@itwin/core-backend";
import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { EntityClass } from "@itwin/ecschema-metadata";
import { IModelTestUtils } from "../backend/IModelTestUtils";

/** Common usage of ecschema-metadata */
describe("Metadata examples", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = IModelTestUtils.openSnapshotFromSeed("test.bim", { copyFilename: "metadata.bim" });
  });

  after(() => {
    iModel.close();
  });

  it("iterate entities on IModelDb", async () => {
    // __PUBLISH_EXTRACT_START__ Metadata.entitiesFromIModelDb
    // For the sake of this example, we will assume an open IModelDb is provided. See backend docs for details on how to work with imodels.
    // Get the schema context from the IModelDb
    const schemaContext = iModel.schemaContext;

    const bisCore = await schemaContext.getSchema(BisCoreSchema.schemaKey);
    if (bisCore === undefined) {
      throw new IModelError(IModelStatus.NotFound, "BisCore schema not found");
    }

    for (const entity of bisCore.getItems(EntityClass)) {
      // console.log(`Entity: ${entity.name}`);

      // Get the properties of the entity
      const properties = await entity.getProperties();
      // Iterate through each property
      for (const property of properties) {
        // Check if the property is a primitive type
        if (property.isPrimitive()) {
          // Do something with the primitive property
          //console.log(`    Property: ${property.name}, Primitive Type: ${property.primitiveType}`);
        }
      }
    }
    // __PUBLISH_EXTRACT_END__
  });
});




/* eslint-disable @typescript-eslint/naming-convention */

