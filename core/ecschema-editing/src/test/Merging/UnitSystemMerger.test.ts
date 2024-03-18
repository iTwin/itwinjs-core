/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaItemTypeName } from "../../Differencing/SchemaDifference";
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
        schemaType: SchemaItemTypeName.UnitSystem,
        itemName: "testUnitSystem",
        difference: {
          schemaItemType: "UnitSystem",
          label: "Imperial",
        },
      }],
    });

    const mergedUnitSystem = await mergedSchema.getItem("testUnitSystem") as UnitSystem;
    expect(mergedUnitSystem).is.not.undefined;
    expect(mergedUnitSystem.label).equals("Imperial");
  });
});
