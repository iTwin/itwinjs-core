/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyCategory, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory merge tests", () => {
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
});
