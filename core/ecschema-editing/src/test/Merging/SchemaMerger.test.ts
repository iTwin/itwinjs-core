/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import "chai-as-promised";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema merge tests", () => {
  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };

  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("Merge two simple schemas", async () => {
    const schemaContext = new SchemaContext();
    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      items: {
        TestClass: {
          schemaItemType: "EntityClass",
          description: "Description for TestClass",
          label: "Test Entity",
          properties: [
            {
              name: "TestProp",
              type: "PrimitiveProperty",
              typeName: "double",
            },
          ],
        },
      },
    }, schemaContext);

    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, schemaContext);

    const merger = new SchemaMerger();
    const mergedContext = new SchemaContext();
    const mergedSchema = await merger.merge(targetSchema, sourceSchema, mergedContext);

    expect(mergedSchema).is.not.equal(targetSchema, "Unexpected reference to same schema");
    expect(mergedSchema.context).is.equal(mergedContext, "Unexpected reference to same context");
    expect(mergedSchema.name).equals(targetJson.name, "Unexpected name");
    expect(mergedSchema.schemaKey.version.toString(false)).equals(targetJson.version, "Unexpected version");
    expect(mergedSchema.context).equals(mergedContext, "Merged schema is not in the merging schema context");
    expect([...mergedSchema.getItems()]).has.lengthOf(1);
  });

});
