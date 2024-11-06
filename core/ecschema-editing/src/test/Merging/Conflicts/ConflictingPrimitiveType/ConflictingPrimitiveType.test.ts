/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import schemas from "./Data/index";
import { EntityClass, PrimitiveProperty, PrimitiveType, Schema } from "@itwin/ecschema-metadata";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../../ecschema-editing";
import { expect } from "chai";
import { BisTestHelper } from "../../../TestUtils/BisTestHelper";

describe.only("Primitive Type conflict iterative resolutions", () => {
  it("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson(schemas[0], await BisTestHelper.getNewContext());
    let sourceSchema = await Schema.fromJson(schemas[1], await BisTestHelper.getNewContext());

    let differences = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(differences.differences).has.lengthOf(5, "Unexpected length of differences");
    expect(differences.conflicts).has.lengthOf(1, "Unexpected length of conflicts");
    const [conflict] = differences.conflicts!;
    expect(conflict.code).equals(ConflictCode.ConflictingPropertyName, "Unexpected conflict code");
    const schemaEdits = new SchemaEdits();
    schemaEdits.properties.rename(sourceSchema.name, "ARCWALL", "OVERAL_HEIGHT", "MERGED_OVERAL_HEIGHT");

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge(differences, schemaEdits);

    for (let i = 2; i < schemas.length; i++) {
      sourceSchema = await Schema.fromJson(schemas[i], await BisTestHelper.getNewContext());
      differences = await getSchemaDifferences(mergedSchema, sourceSchema);
      // mergedSchema = await merger.merge(differences, schemaEdits);
    };

    await expect(targetSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass: EntityClass) => {
      expect(ecClass).instanceOf(EntityClass);
      await expect(ecClass.getProperty("OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property, "Failed to find OVERAL_HEIGHT property").to.be.not.undefined;
        expect(property).instanceOf(PrimitiveProperty);
        expect(property).has.property("primitiveType").equals(PrimitiveType.String);
      });
      await expect(ecClass.getProperty("MERGED_OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property)=> {
        expect(property, "Failed to find MERGED_OVERAL_HEIGHT property").to.be.not.undefined;
        expect(property).instanceOf(PrimitiveProperty);
        expect(property).has.property("primitiveType").equals(PrimitiveType.Double);
      });
    });
  });
});
