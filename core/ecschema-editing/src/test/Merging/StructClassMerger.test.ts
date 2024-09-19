/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType, StructClass } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

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

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
  });

  it("should merge missing struct class", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const { schema } = await merger.merge({
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

    await expect(schema.getItem("TestStruct")).to.be.eventually.not.undefined
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
    const { schema } = await merger.merge({
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

    await expect(schema.getItem("TestStruct")).to.be.eventually.not.undefined
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
    const { schema } = await merger.merge({
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

    await expect(schema.getItem("TestStruct")).to.be.eventually.not.undefined
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
});
