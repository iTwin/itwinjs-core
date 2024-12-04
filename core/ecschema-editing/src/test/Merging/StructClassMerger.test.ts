/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClassModifier, EntityClass, PropertyType, Schema, SchemaContext, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("StructClass merger tests", () => {
  let targetContext: SchemaContext;
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

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
  });

  it("should merge missing struct class", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestStruct",
          difference: {
            label: "Test Structure",
            description: "Description for Test Structure",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestStruct")).to.be.eventually.not.undefined
      .then((mergedItem: StructClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.StructClass);
        expect(mergedItem).to.have.a.property("label", "Test Structure");
        expect(mergedItem).to.have.a.property("description", "Description for Test Structure");
      });
  });

  it("should merge struct class changes", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestStruct: {
          schemaItemType: "StructClass",
          label: "Struct",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestStruct",
          difference: {
            description: "Description for Test Structure",
            label: "Test Structure",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestStruct")).to.be.eventually.not.undefined
      .then((mergedItem: StructClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.StructClass);
        expect(mergedItem).to.have.a.property("label", "Test Structure");
        expect(mergedItem).to.have.a.property("description", "Description for Test Structure");
      });
  });

  it("should merge struct base class derived from the existing base class", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseStruct: {
          schemaItemType: "StructClass",
        },
        TestStruct: {
          schemaItemType: "StructClass",
          baseClass: "TargetSchema.BaseStruct",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseStruct",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestStruct",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestStruct")).to.be.eventually.not.undefined
      .then((mergedItem: StructClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.StructClass);
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TargetSchema.TestBase");
      });
  });

  it("should throw an error when merging struct base class changed from undefined to existing one", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestStruct: {
          schemaItemType: "StructClass",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.StructClass,
          itemName: "BaseStruct",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestStruct",
          difference: {
            baseClass: "SourceSchema.BaseStruct",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestStruct' baseClass is not supported.");
  });

  describe("iterative tests", () => {
    it("should add a re-mapped struct class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseItem: {
            schemaItemType: "StructClass",
          },        
          testItem: {
            schemaItemType: "StructClass",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "StructClass");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as StructClass;
      schemaEdits.items.rename(testItem, "mergedStruct");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.StructClass);
        expect(ecClass).has.a.nested.property("baseClass.name").equals("baseItem");
      });
    })

    it("should merge changes to re-mapped struct class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "StructClass",
            modifier: "None",
            label: "Changed Assembly Group",
            description: "Changed Assembly Group Class",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedStruct: {
            schemaItemType: "StructClass",
            modifier: "Sealed",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as StructClass;
      schemaEdits.items.rename(testItem, "mergedStruct");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedStruct")).to.be.eventually.not.undefined
        .then((ecClass: StructClass) => {
          expect(ecClass).to.have.a.property("label").to.equal("Changed Assembly Group");
          expect(ecClass).to.have.a.property("description").to.equal("Changed Assembly Group Class");
          expect(ecClass).to.have.a.property("modifier").to.equal(ECClassModifier.None);
        });
    });

    it("should merge re-mapped struct base class derived from the existing base class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseStruct: {
            schemaItemType: "StructClass",
          },
          baseItem: {
            schemaItemType: "StructClass",
            baseClass: "SourceSchema.baseStruct",
          },
          testItem: {
            schemaItemType: "StructClass",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseItem: {
            schemaItemType: "EntityClass",
          },
          baseStruct: {
            schemaItemType: "StructClass",
          },
          mergedStruct: {
            schemaItemType: "StructClass",
            baseClass: "TargetSchema.baseStruct",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as StructClass;
      schemaEdits.items.rename(testItem, "mergedStruct");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "StructClass");
        expect(conflict).to.have.a.property("target", "EntityClass");
        return true;
      });
  
      const baseItem = await sourceSchema.getItem("baseItem") as StructClass;
      schemaEdits.items.rename(baseItem, "mergedBaseStruct");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedBaseStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.StructClass);
      });
      await expect(mergedSchema.getItem("mergedStruct")).to.be.eventually.not.undefined
        .then((ecClass: StructClass) => {
          expect(ecClass).to.have.a.nested.property("baseClass.name", "mergedBaseStruct");
        });
    });

    it("should add re-mapped struct property", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {          
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "structProp",
              type: "StructProperty",
              typeName: "SourceSchema.testItem",
            },
            {
              name: "structArrayProp",
              type: "StructArrayProperty",
              typeName: "SourceSchema.testItem",
            }],
          },
          testItem: {
            schemaItemType: "StructClass",
          },         
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",            
          },
          mergedStruct: {
            schemaItemType: "StructClass",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as StructClass;
      schemaEdits.items.rename(testItem, "mergedStruct");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
 
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
        .then(async(ecClass: EntityClass) => {
          await expect(ecClass.getProperty("structProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.property("propertyType").equals(PropertyType.Struct);
            expect(property).has.a.nested.property("structClass.name").equals("mergedStruct");
          });
          await expect(ecClass.getProperty("structArrayProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.property("propertyType").equals(PropertyType.Struct_Array);
            expect(property).has.a.nested.property("structClass.name").equals("mergedStruct");
          });          
      });
    });

    it("should return a conflict when a new base class does not derive from the current target baseclass", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseItem: {
            schemaItemType: "StructClass",
          },        
          testItem: {
            schemaItemType: "StructClass",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseStruct: {
            schemaItemType: "StructClass",
          },
          mergedStruct: {
            schemaItemType: "StructClass",
            baseClass: "TargetSchema.baseStruct",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as StructClass;
      schemaEdits.items.rename(testItem, "mergedStruct");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingBaseClass);
        expect(conflict).to.have.a.property("source", "SourceSchema.baseItem");
        expect(conflict).to.have.a.property("target", "TargetSchema.baseStruct");
        expect(conflict).to.have.a.property("description", "BaseClass is not valid, source class must derive from target.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "StructClass");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });
  });
});
