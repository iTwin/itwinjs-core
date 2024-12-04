/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, PropertyCategory, PropertyType, Schema, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory merge tests", () => {
  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.0.0",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],    
  };

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  it("should merge missing PropertyCategory", async () => {
    const targetSchema = await Schema.fromJson(targetJson, await BisTestHelper.getNewContext());
    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.PropertyCategory,
          itemName: "TestPropertyCategory",
          difference: {
            label: "ValueTrack Metadata",
            priority: 100000,
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestPropertyCategory")).to.be.eventually.not.undefined
      .then((propertyCategory: PropertyCategory) => {
        expect(propertyCategory).to.have.a.property("schemaItemType", SchemaItemType.PropertyCategory);
        expect(propertyCategory).to.have.a.property("label", "ValueTrack Metadata");
        expect(propertyCategory).to.have.a.property("priority", 100000);
      });
  });

  it("should override PropertyCategory", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          label: "ValueTrack Metadata",
          priority: 100000,
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.PropertyCategory,
          itemName: "TestPropertyCategory",
          difference: {
            priority: 99,
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestPropertyCategory")).to.be.eventually.not.undefined
      .then((propertyCategory: PropertyCategory) => {
        expect(propertyCategory).to.have.a.property("schemaItemType", SchemaItemType.PropertyCategory);
        expect(propertyCategory).to.have.a.property("label", "ValueTrack Metadata");
        expect(propertyCategory).to.have.a.property("priority", 99);
      });
  });

  describe("iterative tests", () => {
    it("should add a re-mapped property category class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 101,
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "PropertyCategory");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as PropertyCategory;      
      schemaEdits.items.rename(testItem, "mergedCategory");
  
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCategory")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.PropertyCategory);
      });
    });

    it("should merge changes to re-mapped property category class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "PropertyCategory",
            label: "Changed Phasing",
            description: "Changed Phasing Category",
            priority: 102,
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCategory: {
            schemaItemType: "PropertyCategory",
            label: "Phasing",
            description: "Phasing Category",
            priority: 101,
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as PropertyCategory;      
      schemaEdits.items.rename(testItem, "mergedCategory");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedCategory")).to.be.eventually.not.undefined
        .then((propertyCategory: PropertyCategory) => {
          expect(propertyCategory).to.have.a.property("label").to.equal("Changed Phasing");
          expect(propertyCategory).to.have.a.property("description").to.equal("Changed Phasing Category");
          expect(propertyCategory).to.have.a.property("priority").to.equal(102);
        });
    });

    it("should merge property with re-mapped category", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 101,
          },
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "boolProp",
              type: "PrimitiveProperty",
              typeName: "boolean",
              category: "SourceSchema.testItem",
            },{
              name: "intArrayProp",
              type: "PrimitiveArrayProperty",
              typeName: "int",
              category: "SourceSchema.testItem",
            }],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "boolProp",
              type: "PrimitiveProperty",
              typeName: "boolean",
            }],
          },
          mergedCategory: {
            schemaItemType: "PropertyCategory",
            priority: 101,
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as PropertyCategory;      
      schemaEdits.items.rename(testItem, "mergedCategory");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.not.undefined
        .then(async(ecClass: EntityClass) => {
          await expect(ecClass.getProperty("boolProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.property("propertyType").equals(PropertyType.Boolean);
            expect(property).has.a.nested.property("category.name").equals("mergedCategory");
          });
          await expect(ecClass.getProperty("intArrayProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.property("propertyType").equals(PropertyType.Integer_Array);
            expect(property).has.a.nested.property("category.name").equals("mergedCategory");
          });
      });
    });

    it("should merge missing class with re-mapped category property", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 101,
          },
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "stringProp",
              type: "PrimitiveProperty",
              typeName: "string",
              category: "SourceSchema.testItem",
            }],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCategory: {
            schemaItemType: "PropertyCategory",
            priority: 101,
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as PropertyCategory;      
      schemaEdits.items.rename(testItem, "mergedCategory");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);
      
      await expect(mergedSchema.getItem("testStruct")).to.be.eventually.not.undefined
        .then(async(ecClass: StructClass) => {
          await expect(ecClass.getProperty("stringProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.property("propertyType").equals(PropertyType.String);
            expect(property).has.a.nested.property("category.name").equals("mergedCategory");
          });         
      });
    });
  });
});
