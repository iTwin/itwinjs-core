/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaItemType, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

describe("Unit system merger tests", () => {
  it("should merge missing unit system", async () => {
    const targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson({
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
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const { schema } = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "add",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "Imperial",
          description: "Imperial Unit System",
        },
      }],
    });

    await expect(schema.getItem("testUnitSystem")).to.be.eventually.not.undefined
      .then((mergedUnitSystem: UnitSystem) => {
        expect(mergedUnitSystem).to.have.a.property("label", "Imperial");
        expect(mergedUnitSystem).to.have.a.property("description", "Imperial Unit System");
      });
  });

  it("should merge unit system with new label and description", async () => {
    const targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson({
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
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const { schema } = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "modify",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "New Imperial",
          description: "New Imperial Unit System",
        },
      }],
    });

    await expect(schema.getItem("testUnitSystem")).to.be.eventually.not.undefined
      .then((mergedUnitSystem: UnitSystem) => {
        expect(mergedUnitSystem).to.have.a.property("label", "New Imperial");
        expect(mergedUnitSystem).to.have.a.property("description", "New Imperial Unit System");
      });
  });
});
