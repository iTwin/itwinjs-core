/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Mixin, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { describe, beforeEach, expect, it } from "vitest";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Mixin merger tests", () => {
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

  it("should merge missing mixin", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TestEntity",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            label: "Test Mixin",
            description: "Description for TestMixin",
            appliesTo: "SourceSchema.TestEntity",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem("TestMixin") as Mixin;
    expect(mergedItem).toBeDefined();
    expect(mergedItem.schemaItemType).toBe(SchemaItemType.Mixin);
    expect(mergedItem.label).toBe("Test Mixin");
    expect(mergedItem.description).toBe("Description for TestMixin");
    expect(mergedItem.appliesTo?.fullName).toBe("TargetSchema.TestEntity");
  });

  it("should merge mixin base class derived from the current base class", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        BaseEntity: {
          schemaItemType: SchemaItemType.EntityClass,
          modifier: "Abstract",
        },
        TestEntity: {
          schemaItemType: SchemaItemType.EntityClass,
          baseClass: "TargetSchema.BaseEntity",
        },
        BaseMixin: {
          schemaItemType: "Mixin",
          appliesTo: "TargetSchema.BaseEntity",
        },
        TestMixin: {
          schemaItemType: "Mixin",
          baseClass: "TargetSchema.BaseMixin",
          appliesTo: "TargetSchema.TestEntity",
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
          schemaType: SchemaItemType.Mixin,
          itemName: "TestBase",
          difference: {
            baseClass: "SourceSchema.BaseMixin",
            appliesTo: "SourceSchema.BaseEntity",
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

    const mergedItem = await mergedSchema.getItem("TestMixin") as Mixin;
    expect(mergedItem).toBeDefined();
    expect(mergedItem.schemaItemType).toBe(SchemaItemType.Mixin);
    expect(mergedItem.baseClass?.fullName).toBe("TargetSchema.TestBase");
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
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "SourceEntity",
          difference: {
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.Mixin,
          itemName: "TestMixin",
          difference: {
            appliesTo: "SourceSchema.SourceEntity",
          },
        },
      ],
    });

    await expect(merge).rejects.toThrow("Changing the mixin 'TestMixin' appliesTo is not supported.");
  });
});
