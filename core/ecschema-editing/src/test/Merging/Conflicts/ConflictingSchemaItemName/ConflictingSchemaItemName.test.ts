/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Schema, StructClass } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../../ecschema-editing.js";
import { BisTestHelper } from "../../../TestUtils/BisTestHelper.js";
import schemas from "./Data/index.js";

describe("Schema Item Name conflict iterative resolutions", () => {
  it("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson(schemas[0], await BisTestHelper.getNewContext());
    let sourceSchema = await Schema.fromJson(schemas[1], await BisTestHelper.getNewContext());

    let differences = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(differences.differences).has.lengthOf(1, "Unexpected length of differences");
    expect(differences.conflicts).has.lengthOf(1, "Unexpected length of conflicts");
    const [conflict] = differences.conflicts!;
    expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code");

    const schemaEdits = new SchemaEdits();
    const pipeItem = await sourceSchema.getItem("PIPE");
    schemaEdits.items.rename(pipeItem!, "MERGED_PIPE");

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge(differences, schemaEdits);

    for (let i = 2; i < schemas.length; i++) {
      sourceSchema = await Schema.fromJson(schemas[i], await BisTestHelper.getNewContext());
      differences = await getSchemaDifferences(mergedSchema, sourceSchema);
      // mergedSchema = await merger.merge(differences, schemaEdits);
    };

    expect(await mergedSchema.getItem("PIPE")).to.be.instanceOf(StructClass);
    await expect(targetSchema.getItem("MERGED_PIPE")).to.be.eventually.fulfilled.then(async (ecClass: EntityClass) => {
      expect(ecClass).instanceOf(EntityClass);
      await expect(ecClass.getProperty("LENGTH")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Failed to find WEIGHT property").to.be.not.undefined;
      });
      await expect(ecClass.getProperty("ROUNDNESS")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Failed to find ROUNDNESS property").to.be.not.undefined;;
      });
      await expect(ecClass.getProperty("WEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Failed to find WEIGHT property").to.be.not.undefined;
      });
    });
  });
});
