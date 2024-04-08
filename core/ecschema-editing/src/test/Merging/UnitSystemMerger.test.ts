/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

describe("Unit system merger tests", () => {
  it("should merge missing unit system", async () => {
    const targetContext = new SchemaContext();
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [{
        changeType: "add",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "Imperial",
          description: "Imperial Unit System",
        },
      }],
    });

    const mergedUnitSystem = await mergedSchema.getItem("testUnitSystem") as UnitSystem;
    expect(mergedUnitSystem).is.not.undefined;
    expect(mergedUnitSystem.label).equals("Imperial");
    expect(mergedUnitSystem.description).equals("Imperial Unit System");
  });

  it("should merge unit system with new label and description", async () => {
    const targetContext = new SchemaContext();
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
      items: {
        testUnitSystem: {
          schemaItemType: "UnitSystem",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [{
        changeType: "modify",
        schemaType: SchemaItemType.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          label: "New Imperial",
          description: "New Imperial Unit System",
        },
      }],
    });

    const mergedUnitSystem = await mergedSchema.getItem("testUnitSystem") as UnitSystem;
    expect(mergedUnitSystem).is.not.undefined;
    expect(mergedUnitSystem.label).equals("New Imperial");
    expect(mergedUnitSystem.description).equals("New Imperial Unit System");
  });
});
