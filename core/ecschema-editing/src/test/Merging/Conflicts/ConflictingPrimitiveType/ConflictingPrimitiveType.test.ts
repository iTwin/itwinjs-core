/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import schemas from "./Data/index";
import { PrimitiveType, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../../ecschema-editing";
import { expect } from "chai";
import { BisTestHelper } from "../../../TestUtils/BisTestHelper";

describe("Primitive Type conflict iterative resolutions", () => {
  it.only("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson(schemas[0], await BisTestHelper.getNewContext());

    // First iteration: A property is added to the entity class with the same name as the
    // existing property but with a different type. The source property will be renamed.
    let sourceSchema = await Schema.fromJson(schemas[1], await BisTestHelper.getNewContext());
    let result = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(result.differences).has.lengthOf(5, "Unexpected length of differences");
    expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
      expect(conflict).to.exist;
      expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
      expect(conflict).to.have.a.property("source", "double");
      expect(conflict).to.have.a.property("target", "string");
      return true;
    });

    const schemaEdits = new SchemaEdits();
    schemaEdits.properties.rename(sourceSchema.name, "ARCWALL", "OVERAL_HEIGHT", "MERGED_OVERAL_HEIGHT");

    let merger = new SchemaMerger(targetSchema.context);
    let mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.String);
      });
      await expect(ecClass.getProperty("MERGED_OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.Double);
      });
    });

    // Second iteration: Changed isReadOnly and label values for merged property.
    sourceSchema = await Schema.fromJson(schemas[2], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits.toJSON());
    expect(result.differences).has.lengthOf(3, "Unexpected length of differences");

    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);
    
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("MERGED_OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("isReadOnly").equals(true);
        expect(property).has.property("label").equals("Overall Height");
      });
    });
    
    // Third iteration: A PropertyCategory is added with the name of existing UnitSystem. Source item
    // will be renamed and used as category for merged property. 
    sourceSchema = await Schema.fromJson(schemas[3], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits.toJSON());
    expect(result.differences).has.lengthOf(5, "Unexpected length of differences");
    expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
      expect(conflict).to.exist;
      expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
      expect(conflict).to.have.a.property("source", "PropertyCategory");
      expect(conflict).to.have.a.property("target", "UnitSystem");
      return true;
    });

    schemaEdits.items.rename(sourceSchema.name, "CONSTRAINTS", "MERGED_CONSTRAINTS");
    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("CONSTRAINTS")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.UnitSystem);
    });
    await expect(mergedSchema.getItem("MERGED_CONSTRAINTS")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.PropertyCategory);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      // add category
      await expect(ecClass.getProperty("WALL_WIDTH_TYPE")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.a.nested.property("category.name").equals("MERGED_CONSTRAINTS");
      });
      // modify category
      await expect(ecClass.getProperty("OVERAL_LENGTH")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.a.nested.property("category.name").equals("MERGED_CONSTRAINTS");
      });
      await expect(ecClass.getProperty("MERGED_OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.a.nested.property("category.name").equals("MERGED_CONSTRAINTS");
      });
    });

    // Fourth iteration: custom attributes are added to renamed property, renamed property category
    // added as category for entity class properties
    sourceSchema = await Schema.fromJson(schemas[4], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits.toJSON());
    expect(result.differences).has.lengthOf(6, "Unexpected length of differences");
    expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
      expect(conflict).to.exist;
      expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
      expect(conflict).to.have.a.property("source", "CustomAttributeClass");
      expect(conflict).to.have.a.property("target", "PropertyCategory");
      return true;
    });

    schemaEdits.items.rename(sourceSchema.name, "MEASUREINFO", "MERGED_MEASUREINFO");
    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("MEASUREINFO")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.PropertyCategory);
    });
    await expect(mergedSchema.getItem("MERGED_MEASUREINFO")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("OVERAL_LENGTH")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).to.have.a.property("customAttributes").is.not.undefined;
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPrimitiveType.MERGED_MEASUREINFO");
        });
      });
      // custom attribute of merged property
      await expect(ecClass.getProperty("MERGED_OVERAL_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("label").equals("Overall Wall Height");
        expect(property).to.have.a.property("customAttributes").is.not.undefined;
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPrimitiveType.MERGED_MEASUREINFO");
        });        
      });
    });
  });
});
