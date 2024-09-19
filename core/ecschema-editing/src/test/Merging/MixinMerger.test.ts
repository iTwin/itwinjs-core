/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Mixin, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
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
    const { schema } = await merger.merge({
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

    await expect(schema.getItem("TestMixin")).to.be.eventually.not.undefined
      .then((mergedItem: Mixin) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.Mixin);
        expect(mergedItem).to.have.a.property("label", "Test Mixin");
        expect(mergedItem).to.have.a.property("description", "Description for TestMixin");
        expect(mergedItem).to.have.a.nested.property("appliesTo.fullName", "TargetSchema.TestEntity");
      });
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
    const { schema } = await merger.merge({
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

    await expect(schema.getItem("TestMixin")).to.be.eventually.not.undefined
      .then((mergedItem: Mixin) => {
        expect(mergedItem).to.have.a.property("schemaItemType", SchemaItemType.Mixin);
        expect(mergedItem).to.have.a.nested.property("baseClass.fullName", "TargetSchema.TestBase");
      });
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

    await expect(merge).to.be.rejectedWith("Changing the mixin 'TestMixin' appliesTo is not supported.");
  });
});
