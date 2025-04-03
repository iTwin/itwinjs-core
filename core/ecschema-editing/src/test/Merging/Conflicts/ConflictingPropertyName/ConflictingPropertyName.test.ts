/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Enumeration, KindOfQuantity, PrimitiveType, PropertyCategory, PropertyType, RelationshipClass, Schema, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../../ecschema-editing.js";
import { BisTestHelper } from "../../../TestUtils/BisTestHelper.js";
import schemas from "./Data/index.js";

describe("Property Name conflict iterative resolutions", () => {
  it("shall re-apply stored conflict resolutions", async () => {
    const targetSchema = await Schema.fromJson(schemas[0], await BisTestHelper.getNewContext());

    // First iteration: added a primitive property with the same name as existing property but different type.
    // Source property will be renamed.
    let sourceSchema = await Schema.fromJson(schemas[1], await BisTestHelper.getNewContext());
    let result = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(result.differences).has.lengthOf(1, "Unexpected length of differences");
    expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
      expect(conflict).to.exist;
      expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
      expect(conflict).to.have.a.property("source", "double");
      expect(conflict).to.have.a.property("target", "string");
      return true;
    });

    const schemaEdits = new SchemaEdits();
    const arcWallItem = await targetSchema.getItem("ARCWALL") as EntityClass;
    schemaEdits.properties.rename(arcWallItem, "HEIGHT", "MERGED_HEIGHT");

    let merger = new SchemaMerger(targetSchema.context);
    let mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.String);
      });
      await expect(ecClass.getProperty("MERGED_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.Double);
      });
    });

    // Second iteration: added an enumeration array property with the same name as existing property.
    // Modified values of renamed primitive property.
    sourceSchema = await Schema.fromJson(schemas[2], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits);
    expect(result.differences).has.lengthOf(4, "Unexpected length of differences");
    expect(result.conflicts).has.lengthOf(2, "Unexpected length of conflicts");

    schemaEdits.properties.rename(arcWallItem, "TYPE", "MERGED_TYPE");
    const wallTypeItem = await targetSchema.getItem("WALL_TYPE") as Enumeration;
    schemaEdits.items.rename(wallTypeItem, "MERGED_WALL_TYPE");

    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("MERGED_WALL_TYPE")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Enumeration);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      // added renamed enumeration array property
      await expect(ecClass.getProperty("MERGED_TYPE")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("propertyType").equals(PropertyType.Integer_Enumeration_Array);
        expect(property).has.a.nested.property("enumeration.name").equals("MERGED_WALL_TYPE");
        expect(property).has.a.nested.property("category.name").equals("CONSTRAINTS");
      });
      // modified renamed primitive property
      await expect(ecClass.getProperty("MERGED_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("label").equals("Wall Height");
        expect(property).has.property("minValue").equals(1.0);
        expect(property).has.a.nested.property("category.name").equals("CONSTRAINTS");
      });
    });

    // Third iteration: added a struct property with the same name as existing property.
    // Modified values of renamed enumeration property.
    sourceSchema = await Schema.fromJson(schemas[3], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits);
    expect(result.differences).has.lengthOf(6, "Unexpected length of differences");
    expect(result.conflicts).has.lengthOf(3, "Unexpected length of conflicts");

    const categoryWallCommonItem = await targetSchema.getItem("CATEGORY_WALL_COMMON") as PropertyCategory;
    const definitionArcwallitem = await targetSchema.getItem("DEFINITION_ARCWALL") as StructClass;
    schemaEdits.items.rename(categoryWallCommonItem, "MERGED_CATEGORY_WALL_COMMON");
    schemaEdits.items.rename(definitionArcwallitem, "MERGED_DEFINITION_ARCWALL");
    schemaEdits.properties.rename(arcWallItem, "DEFINITION", "MERGED_DEFINITION");

    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("MERGED_CATEGORY_WALL_COMMON")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.PropertyCategory);
    });
    await expect(mergedSchema.getItem("MERGED_DEFINITION_ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.StructClass);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      // added renamed struct property
      await expect(ecClass.getProperty("MERGED_DEFINITION")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("propertyType").equals(PropertyType.Struct);
        expect(property).has.a.nested.property("structClass.name").equals("MERGED_DEFINITION_ARCWALL");
        expect(property).has.a.nested.property("category.name").equals("MERGED_CATEGORY_WALL_COMMON");
      });
      // modified renamed enumeration array property
      await expect(ecClass.getProperty("MERGED_TYPE")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("description").equals("Wall Type");
        expect(property).has.property("minOccurs").equals(1);
        expect(property).has.property("maxOccurs").equals(11);
        expect(property).has.a.nested.property("category.name").equals("MERGED_CATEGORY_WALL_COMMON");
      });
      // modified renamed primitive property
      await expect(ecClass.getProperty("MERGED_HEIGHT")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPropertyName.MEASUREINFO");
        });
      });
    });

    // Fourth iteration: added a navigation property with the same name as existing property.
    // Modified values of renamed struct property.
    sourceSchema = await Schema.fromJson(schemas[4], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits);
    expect(result.differences).has.lengthOf(7, "Unexpected length of differences");
    expect(result.conflicts).has.lengthOf(3, "Unexpected length of conflicts");

    const wallHasLayerItem = await targetSchema.getItem("WALL_HAS_LAYER") as RelationshipClass;
    const constructionStatusItem = await targetSchema.getItem("CONSTRUCTION_STATUS") as CustomAttributeClass;
    schemaEdits.items.rename(wallHasLayerItem, "MERGED_WALL_HAS_LAYER");
    schemaEdits.items.rename(constructionStatusItem, "MERGED_CONSTRUCTION_STATUS");
    schemaEdits.properties.rename(arcWallItem, "LAYER", "MERGED_LAYER");

    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("MERGED_CONSTRUCTION_STATUS")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
    });
    await expect(mergedSchema.getItem("MERGED_WALL_HAS_LAYER")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.RelationshipClass);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      // added renamed navigation property
      await expect(ecClass.getProperty("MERGED_LAYER")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("propertyType").equals(PropertyType.Navigation);
        expect(property).has.a.nested.property("relationshipClass.name").equals("MERGED_WALL_HAS_LAYER");
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPropertyName.MERGED_CONSTRUCTION_STATUS");
        });
      });
      // modified renamed struct property
      await expect(ecClass.getProperty("MERGED_DEFINITION")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("isReadOnly").equals(true);
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPropertyName.MERGED_CONSTRUCTION_STATUS");
        });
      });
    });

    // FIfth iteration: added a koq with the same name as different type schema item.
    // Modified values of renamed navigation property.
    sourceSchema = await Schema.fromJson(schemas[5], await BisTestHelper.getNewContext());
    result = await getSchemaDifferences(mergedSchema, sourceSchema, schemaEdits);
    expect(result.differences).has.lengthOf(6, "Unexpected length of differences");
    expect(result.conflicts).has.lengthOf(2, "Unexpected length of conflicts");

    const areaItem = await targetSchema.getItem("AREA") as KindOfQuantity;
    schemaEdits.items.rename(areaItem, "MERGED_AREA");
    schemaEdits.properties.rename(arcWallItem, "AREA", "MERGED_AREA");

    merger = new SchemaMerger(mergedSchema.context);
    mergedSchema = await merger.merge(result, schemaEdits);

    await expect(mergedSchema.getItem("MERGED_AREA")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.KindOfQuantity);
    });
    await expect(mergedSchema.getItem("ARCWALL")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      // added renamed string array property
      await expect(ecClass.getProperty("MERGED_AREA")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("propertyType").equals(PropertyType.String_Array);
        expect(property).has.a.nested.property("kindOfQuantity.name").equals("MERGED_AREA");
      });
      // modified renamed navigation property
      await expect(ecClass.getProperty("MERGED_LAYER")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("priority").equals(102);
        expect(property).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
          return customAttributes.has("ConflictingPropertyName.MEASUREINFO");
        });
      });
    });
  });
});
