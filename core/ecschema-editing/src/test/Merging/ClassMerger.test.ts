/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Mixin, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Class merger tests", () => {
  let targetContext: SchemaContext;
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  beforeEach(() => {
    targetContext = new SchemaContext();
  });

  it("should merge missing struct class", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "StructClass",
          itemName: "TestStruct",
          difference: {
            label: "Test Structure",
            description: "Description for Test Structure",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "StructClass",
      label: "Test Structure",
      description: "Description for Test Structure",
    });
  });

  it("should merge missing custom attribute class", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "CustomAttributeClass",
          itemName: "TestCAClass",
          difference: {
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCAClass");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "CustomAttributeClass",
      label: "Test Custom Attribute Class",
      appliesTo: "AnyClass",
    });
  });

  it("should merge missing entity class with baseClass", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestBase",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      label: "Test Entity",
      description: "Description for TestEntity",
      baseClass: "TargetSchema.TestBase",
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
      changes: [
        {
          changeType: "add",
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            label: "Test Entity",
            description: "Description for TestEntity",
            baseClass: "TestSchema.TestBase",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      label: "Test Entity",
      description: "Description for TestEntity",
      baseClass: "TestSchema.TestBase",
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
      changes: [
        {
          changeType: "add",
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "EntityClass",
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

    const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      label: "Test Entity",
      description: "Description for TestEntity",
      baseClass: "TestSchema.BaseClass",
      mixins: [
        "TestSchema.TestMixin",
      ],
    });
  });

  it("should merge missing mixin", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: "Mixin",
          itemName: "TestMixin",
          difference: {
            label: "Test Mixin",
            description: "Description for TestMixin",
            appliesTo: "SourceSchema.TestEntity",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<Mixin>("TestMixin");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "Mixin",
      label: "Test Mixin",
      description: "Description for TestMixin",
      appliesTo: "TargetSchema.TestEntity",
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
      changes: [
        {
          changeType: "modify",
          schemaType: "StructClass",
          itemName: "TestStruct",
          difference: {
            description: "Description for Test Structure",
            label: "Test Structure",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem<StructClass>("TestStruct");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "StructClass",
      description: "Description for Test Structure",
      label: "Test Structure",
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
      changes: [
        {
          changeType: "modify",
          schemaType: "CustomAttributeClass",
          itemName: "TestCAClass",
          difference: {
            label: "Test Custom Attribute Class",
            appliesTo: "AnyClass",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem<CustomAttributeClass>("TestCAClass");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "CustomAttributeClass",
      label: "Test Custom Attribute Class",
      appliesTo: "AnyClass, AnyProperty",
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
      changes: [
        {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            modifier: "None",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
    expect(mergedItem!.toJSON()).deep.eq({
      schemaItemType: "EntityClass",
      // If modifier is set to None, it won't appear in the JSON
    });
  });

  it("should merge class baseclass from the middle of a class hierarchy", async () => {
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
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseEntity",
          },
        },
        {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            baseClass: "SourceSchema.TestBase",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<EntityClass>("TestEntity");
    expect(mergedItem!.toJSON().baseClass).deep.eq("TargetSchema.TestBase");
  });

  it.skip("should throw an error when merging classes with different schema item types", async () => {
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
      changes: [
        {
          changeType: "modify",
          schemaType: "StructClass",
          itemName: "TestClass",
          difference: {
            schemaItemType: "EntityClass",
          } as any, // difference needs to be any-fied to be able to set the schemaItemType property.
        },
      ],
    });
    await expect(merge).to.be.rejectedWith("Changing the class 'TestClass' type is not supported.");
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
      changes: [
        {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            modifier: "Sealed",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' modifier is not supported.");
  });

  // it.skip("should throw an error when merging base class not in the middle of a class hierarchy", async () => {
  //   const sourceSchema = await Schema.fromJson({
  //     ...sourceJson,
  //     items: {
  //       SourceBase: {
  //         schemaItemType: "EntityClass",
  //       },
  //       TestEntity: {
  //         schemaItemType: "EntityClass",
  //         baseClass: "SourceSchema.SourceBase",
  //       },
  //     },
  //   }, sourceContext);

  //   const targetSchema = await Schema.fromJson({
  //     ...targetJson,
  //     items: {
  //       TargetBase: {
  //         schemaItemType: "EntityClass",
  //       },
  //       TestEntity: {
  //         schemaItemType: "EntityClass",
  //         baseClass: "TargetSchema.TargetBase",
  //       },
  //     },
  //   }, targetContext);

  //   const merger = new SchemaMerger(targetContext);
  //   await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
  // });

  it.skip("should throw an error when merging base class changed from existing one to undefined", async () => {
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
      changes: [
        {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            baseClass: undefined,
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
  });

  it("should throw an error when merging base class changed from undefined to existing one", async () => {
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
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "BaseEntity",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          difference: {
            baseClass: "SourceSchema.BaseEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'TestEntity' baseClass is not supported.");
  });

  it("should throw an error when merging mixins with different appliesTo values", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        TargetEntity: {
          schemaItemType: "EntityClass",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TargetSchema.TargetEntity",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "SourceEntity",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: "Mixin",
          itemName: "TestMixin",
          difference: {
            appliesTo: "SourceSchema.SourceEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the mixin 'TestMixin' appliesTo is not supported.");
  });

  it("should throw an error when merging entity classes with different mixins", async () => {
    const jsonObj = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.15",
      alias: "test",
      items: {
        TestBase: {
          schemaItemType: "EntityClass",
          modifier: "Abstract",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.TestBase",
        },
      },
    };

    await Schema.fromJson(jsonObj, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        TargetMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TestSchema.TestBase",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.TestBase",
          mixins: [
            "TargetSchema.TargetMixin",
          ],
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "EntityClass",
          itemName: "TestEntity",
          path: "$mixins",
          difference: [
            "TestSchema.TestMixin",
          ],
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the entity class 'TestEntity' mixins is not supported.");
  });
});
