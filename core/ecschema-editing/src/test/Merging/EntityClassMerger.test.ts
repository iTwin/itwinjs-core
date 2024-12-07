/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClassModifier, EntityClass, Schema, SchemaContext, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { ECEditingStatus } from "../../Editing/Exception";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("EntityClass merger tests", () => {
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

  it("should merge missing entity class with baseClass", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestBase",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
      .then((mergedItem: EntityClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.EntityClass);
        expect(mergedItem).to.have.a.property("label", "Test Entity");
        expect(mergedItem).to.have.a.property("description", "Description for TestEntity");
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TargetSchema.TestBase");
      });
  });

  it("should merge missing entity class with referenced baseClass", async () => {
    const referencedSchema = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.15",
      alias: "test",
      items: {
        TestBase: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
      },
    };

    const targetSchema = await Schema.fromJson(targetJson, await BisTestHelper.getNewContext());
    await Schema.fromJson(referencedSchema, targetSchema.context);
    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "TestSchema.TestBase",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
      .then((mergedItem: EntityClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.EntityClass);
        expect(mergedItem).to.have.a.property("label", "Test Entity");
        expect(mergedItem).to.have.a.property("description", "Description for TestEntity");
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TestSchema.TestBase");
      });
  });

  it("should merge missing entity class with referenced mixin", async () => {
    const referencedSchema = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.15",
      alias: "test",
      items: {
        BaseClass: {
          schemaItemType: "EntityClass",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.BaseClass",
        },
      },
    };

    const targetSchema = await Schema.fromJson(targetJson, await BisTestHelper.getNewContext());
    await Schema.fromJson(referencedSchema, targetSchema.context);
    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "TestSchema.BaseClass",
            mixins: [
              "TestSchema.TestMixin",
            ],
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
      .then((mergedItem: EntityClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.EntityClass);
        expect(mergedItem).to.have.a.property("label", "Test Entity");
        expect(mergedItem).to.have.a.property("description", "Description for TestEntity");
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TestSchema.BaseClass");
        expect(mergedItem).to.have.a.property("mixins").that.satisfies((mixins: SchemaItemKey[]) => {
          return mixins.find((mixin) => mixin.fullName === "TestSchema.TestMixin") !== undefined;
        });
      });
  });

  it("should merge class modifier changed from Sealed to None", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
          modifier: "Sealed",
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
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            modifier: "None",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
      .then((mergedItem: EntityClass) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.EntityClass);
        expect(mergedItem).to.have.a.property("modifier", ECClassModifier.None);
      });
  });

  it("should merge entity base class derived from the existing base class", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        BaseEntity: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TargetSchema.BaseEntity",
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseEntity",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.not.undefined
      .then((mergedItem: EntityClass) => {
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TargetSchema.TestBase");
      });
  });

  it("should throw an error when merging classes with different schema item types", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestClass: {
          schemaItemType: "StructClass",
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.StructClass,
          itemName: "TestClass",
          difference: {
            schemaItemType: "EntityClass",
          } as any, // difference needs to be any-fied to be able to set the schemaItemType property.
        },
      ],
    });
    await expect(merge).to.be.rejectedWith("Changing the type of item 'TestClass' not supported.");
  });

  it("should throw an error when merging class modifier changed from Abstract to Sealed", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            modifier: "Sealed",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' modifier is not supported.");
  });

  it("should throw an error when merging entity base class changed from existing one to undefined", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseEntity: {
          schemaItemType: "EntityClass",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TargetSchema.BaseEntity",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            baseClass: undefined,
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
  });

  it("should throw an error when merging entity base class changed from undefined to existing one", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
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
          schemaType: SchemaItemType.EntityClass,
          itemName: "BaseEntity",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            baseClass: "SourceSchema.BaseEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
  });

  it("should throw an error when merging entity base class to one that doesn't derive from", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TargetBase: {
          schemaItemType: "EntityClass",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TargetSchema.TargetBase",
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
          schemaType: SchemaItemType.EntityClass,
          itemName: "SourceBase",
          difference: {
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.SourceBase",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
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

  it("should throw an error when merging entity class with a unknown mixins", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
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
          schemaType: SchemaOtherTypes.EntityClassMixin,
          itemName: "TestEntity",
          difference: [
            "SourceSchema.NotExistingMixin",
          ],
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddMixin);
      expect(error).to.have.nested.property("innerError.message", `Mixin TargetSchema.NotExistingMixin could not be found in the schema context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFoundInContext);
    });
  });

  it("should throw an error when merging mixin base class to one that doesn't derive from", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
        },
        BaseMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TargetSchema.TestEntity",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          baseClass: "TargetSchema.BaseMixin",
          appliesTo: "TargetSchema.TestEntity",
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestBase",
          difference: {
            appliesTo: "SourceSchema.TestEntity",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Base class TargetSchema.TestBase must derive from TargetSchema.BaseMixin.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidBaseClass);
    });
  });

  describe("iterative tests", () => {
    it("should add a re-mapped entity class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseItem: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseItem",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "Phenomenon");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.property("schemaItemType").equals(SchemaItemType.EntityClass);
        expect(ecClass).to.have.a.nested.property("baseClass.name").equals("baseItem");
      });
    });

    it("should merge changes to re-mapped entity class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
            modifier: "None",
            label: "Changed BuildingElement",
            description: "Changed BuildingElement Class",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedEntity: {
            schemaItemType: "EntityClass",
            modifier: "Sealed",
            label: "BuildingElement",
            description: "BuildingElement Class",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedEntity")).to.be.eventually.not.undefined
        .then((ecClass: EntityClass) => {
          expect(ecClass).to.have.a.property("label").to.equal("Changed BuildingElement");
          expect(ecClass).to.have.a.property("description").to.equal("Changed BuildingElement Class");
          expect(ecClass).to.have.a.property("modifier").to.equal(ECClassModifier.None);
        });
    });

    it("should merge re-mapped entity base class derived from the existing base class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          baseClass: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseItem",
          },
          baseItem: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseClass: {
            schemaItemType: "StructClass",
          },
          baseItem: {
            schemaItemType: "EntityClass",
          },
          mergedEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.baseItem",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const sourceEntity = await sourceSchema.getItem("baseClass") as EntityClass;
      schemaEdits.items.rename(sourceEntity, "mergedBaseEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedBaseEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.EntityClass);
      });
      await expect(mergedSchema.getItem("mergedEntity")).to.be.eventually.not.undefined
        .then((ecClass: EntityClass) => {
          expect(ecClass).to.have.a.nested.property("baseClass.name", "mergedBaseEntity");
        });
    });

    it("should merge a re-mapped mixin that derives from constraint", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testMixin: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.baseItem",
          },
          baseItem: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseItem",
            mixins: [
              "SourceSchema.testMixin",
            ],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testMixin: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          baseItem: {
            schemaItemType: "EntityClass",
          },
          mergedEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.baseItem",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Mixin");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        return true;
      });

      const testMixin = await sourceSchema.getItem("testMixin") as EntityClass;
      schemaEdits.items.rename(testMixin, "mergedMixin");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.Mixin);
      });
      await expect(mergedSchema.getItem("mergedEntity")).to.be.eventually.not.undefined
        .then((ecClass: EntityClass) => {
          expect(ecClass).to.have.a.nested.property("mixins[0].name", "mergedMixin");
        });
    });

    it("should return a conflict when merging re-mapped entity base class changed from existing one to undefined", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseItem: {
            schemaItemType: "EntityClass",
          },
          mergedEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.baseItem",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.RemovingBaseClass);
        expect(conflict).to.have.a.property("source", null);
        expect(conflict).to.have.a.property("target", "TargetSchema.baseItem");
        expect(conflict).to.have.a.property("description", "BaseClass cannot be removed, if there has been a baseClass before.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "EntityClass");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });

    it("should return a conflict when merging re-mapped entity mixin that doesn't derive from constraint", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          sourceEntity: {
            schemaItemType: "EntityClass",
          },
          sourceMixin: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.sourceEntity",
          },
          baseItem: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseItem",
            mixins: [
              "SourceSchema.sourceMixin",
            ],
          },
        },
      }, await BisTestHelper.getNewContext());
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseItem: {
            schemaItemType: "EntityClass",
          },
          mergedEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.baseItem",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedEntity");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.MixinAppliedMustDeriveFromConstraint);
        expect(conflict).to.have.a.property("source", "SourceSchema.sourceMixin");
        expect(conflict).to.have.a.property("target", undefined);
        expect(conflict).to.have.a.property("description", "Mixin cannot applied to this class.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "EntityClassMixin");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });

    it("should return a conflict when merging a re-mapped entity with a name that already esists in the target schema", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, await BisTestHelper.getNewContext());
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedItem: {
            schemaItemType: "StructClass",
          },
          testItem: {
            schemaItemType: "Phenomenon",
            definition: "testItem",
          },
        },
      }, targetContext);

      let result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "Phenomenon");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as EntityClass;
      schemaEdits.items.rename(testItem, "mergedItem");

      result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });
  });
});
