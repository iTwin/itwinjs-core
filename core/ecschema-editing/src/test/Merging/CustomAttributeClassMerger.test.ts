/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, CustomAttributeContainerType, ECClassModifier, parseCustomAttributeContainerType, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { ECEditingStatus } from "../../Editing/Exception";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("CustomAttributeClass merger tests", () => {
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

  it("should merge missing custom attribute class", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestCAClass",
          difference: {
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestCAClass")).to.be.eventually.not.undefined
      .then((mergedItem: CustomAttributeClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.CustomAttributeClass);
        expect(mergedItem).to.have.a.property("label", "Test Custom Attribute Class");
        expect(mergedItem).to.have.a.property("appliesTo", CustomAttributeContainerType.AnyClass);
      });
  });

  it("should merge custom attribute class changes", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          label: "TestCustomAttributeClass",
          appliesTo: "AnyProperty",
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
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestCAClass",
          difference: {
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestCAClass")).to.be.eventually.not.undefined
      .then((mergedItem: CustomAttributeClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.CustomAttributeClass);
        expect(mergedItem).to.have.a.property("label", "Test Custom Attribute Class");
        expect(mergedItem).to.have.a.property("appliesTo", CustomAttributeContainerType.AnyClass | CustomAttributeContainerType.AnyProperty);
      });
  });

  it("should merge custom attribute base class derived from the current base class", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseCAClass: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyProperty",
        },
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyProperty",
          baseClass: "TargetSchema.BaseCAClass",
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
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseCAClass",
            appliesTo: "AnyProperty",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestCAClass",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCAClass");
    expect(mergedItem!.toJSON().baseClass).deep.eq("TargetSchema.TestBase");
  });

  it("should throw an error when merging custom attribute base class changed from undefined to existing one", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        testCAClass: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyClass",
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
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "BaseCAClass",
          difference: {
            appliesTo: "AnyClass",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "testCAClass",
          difference: {
            baseClass: "SourceSchema.BaseCAClass",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'testCAClass' baseClass is not supported.");
  });

  it("should throw an error when merging custom attribute base class to one that doesn't derive from", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TargetBase: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "AnyProperty",
        },
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          baseClass: "TargetSchema.TargetBase",
          appliesTo: "AnyProperty",
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
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "SourceBase",
          difference: {
            appliesTo: "AnyProperty",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.SourceBase",
            appliesTo: "AnyProperty",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.CustomAttributeClass,
          itemName: "TestCAClass",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Base class TargetSchema.TestBase must derive from TargetSchema.TargetBase.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidBaseClass);
    });
  });

  describe("iterative tests", () => {
    it("should add a re-mapped custom attribute class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
            baseClass: "SourceSchema.baseItem",            
          },
        },
      }, await BisTestHelper.getNewContext());
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);
  
      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "CustomAttributeClass");
        expect(conflict).to.have.a.property("target", "EntityClass");
        return true;
      });
  
      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(sourceItem, "mergedCustomAttribute");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
        expect(ecClass).has.a.nested.property("baseClass.name").equals("baseItem");
      });
    });

    it("should merge changes to re-mapped custom attribute class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {          
          testItem: {
            schemaItemType: "CustomAttributeClass",
            modifier: "None",
            label: "Changed Measure Info",
            description: "Changed Measure Info CA Class",
            appliesTo: "AnyProperty",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            modifier: "Abstract",
            label: "Measure Info",
            description: "Measure Info CA Class",
            appliesTo: "AnyClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(sourceItem, "mergedCustomAttribute");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.not.undefined
        .then((ecClass: CustomAttributeClass) => {
          expect(ecClass).to.have.a.property("label").to.equal("Changed Measure Info");
          expect(ecClass).to.have.a.property("description").to.equal("Changed Measure Info CA Class");
          expect(ecClass).to.have.a.property("modifier").to.equal(ECClassModifier.None);
          expect(ecClass).to.have.a.property("appliesTo").to.equal(parseCustomAttributeContainerType("AnyClass, AnyProperty"));
        });
    });

    it("should merge missing custom attribute class with re-mapped base class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testClass: {
            schemaItemType: "CustomAttributeClass",
            baseClass: "SourceSchema.testItem",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(sourceItem, "mergedCustomAttribute");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testClass")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType", SchemaItemType.CustomAttributeClass);
        expect(ecClass).to.have.a.nested.property("baseClass.name").to.equal("mergedCustomAttribute");
      });
    });

    it("should merge re-mapped custom attribute base class derived from the existing base class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          baseItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            baseClass: "SourceSchema.baseCustomAttribute",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseItem: {
            schemaItemType: "StructClass",
          },
          baseCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            baseClass: "TargetSchema.baseCustomAttribute",
          },
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(sourceItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "CustomAttributeClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });
  
      const baseItem = await sourceSchema.getItem("baseItem") as CustomAttributeClass;
      schemaEdits.items.rename(baseItem, "mergedBaseCustomAttribute");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedBaseCustomAttribute")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      await expect(mergedSchema.getItem("mergedCustomAttribute")).to.be.eventually.not.undefined
        .then((ecClass: CustomAttributeClass) => {
          expect(ecClass).to.have.a.nested.property("baseClass.name", "mergedBaseCustomAttribute");
        });
    });

    it("should return a conflict when merging re-mapped custom attribute sealed base class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseItem: {
            schemaItemType: "CustomAttributeClass",
            modifier: "Sealed",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(sourceItem, "mergedCustomAttribute");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.SealedBaseClass);
        expect(conflict).to.have.a.property("source", "SourceSchema.baseItem");
        expect(conflict).to.have.a.property("target", null);
        expect(conflict).to.have.a.property("description", "BaseClass is sealed.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "CustomAttributeClass");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });

    it("should return a conflict when merging a re-mapped custom attribute class with a different modifier", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "CustomAttributeClass",
            modifier: "Sealed", 
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {          
          mergedItem: {
            schemaItemType: "CustomAttributeClass",
            modifier: "Abstract", 
            appliesTo: "Any",
          },
          testItem: {
            schemaItemType: "PropertyCategory",
            priority: 102,
          },
        },
      }, targetContext);

      let result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "CustomAttributeClass");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as CustomAttributeClass;
      schemaEdits.items.rename(testItem, "mergedItem");

      result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingClassModifier);
        expect(conflict).to.have.a.property("source", "Sealed");
        expect(conflict).to.have.a.property("target", "Abstract");
        expect(conflict).to.have.a.property("description", "Class has conflicting modifiers.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });
  });
});
