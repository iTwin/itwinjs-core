/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, CustomAttributeContainerType, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { ECEditingStatus } from "../../Editing/Exception";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

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
});
