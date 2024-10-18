/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClassModifier, EntityClass, Schema, SchemaContext, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { ECEditingStatus } from "../../Editing/Exception";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

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

    await Schema.fromJson(referencedSchema, targetContext);
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
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

    await Schema.fromJson(referencedSchema, targetContext);
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
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
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
          modifier: "Sealed",
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
    await Schema.fromJson({
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
    }, targetContext);

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
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestClass: {
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
    await Schema.fromJson({
      ...targetJson,
      items: {
        TestEntity: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
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
    await Schema.fromJson({
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
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
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
});
