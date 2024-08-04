/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import schemas from "./Data/index";
import { EntityClass, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../../ecschema-editing";
import { expect } from "chai";

describe("Schema Item Name conflict iterative resolutions", () => {
  it("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson(schemas[0], new SchemaContext());
    let sourceSchema = await Schema.fromJson(schemas[1], new SchemaContext());

    let differences = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(differences.differences).has.lengthOf(0, "Unexpected length of differences");
    expect(differences.conflicts).has.lengthOf(1, "Unexpected length of conflicts");
    const [conflict] = differences.conflicts!;
    expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code");

    const schemaEdits = new SchemaEdits();
    schemaEdits.items.rename(conflict.itemName!, "MERGED_PIPE");

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge(differences, schemaEdits);

    for (let i = 2; i < schemas.length; i++) {
      sourceSchema = await Schema.fromJson(schemas[i], new SchemaContext());
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
