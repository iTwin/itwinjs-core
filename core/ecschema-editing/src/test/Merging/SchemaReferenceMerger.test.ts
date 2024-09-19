/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { describe, expect, it } from "vitest";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

describe("Schema reference merging tests", () => {

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

  it("should merge missing schema references", async () => {
    const targetSchemaContext = await BisTestHelper.getNewContext();
    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, targetSchemaContext);

    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.15",
      alias: "ts",
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "add",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "TestSchema",
          version: "01.00.15",
        },
      }],
    });

    expect(mergedSchema.toJSON().references).toEqual([
      { name: "CoreCustomAttributes", version: "01.00.01" },
      { name: "TestSchema", version: "01.00.15" },
    ]);
    const reference = await mergedSchema.getReference("TestSchema");
    expect(reference).toBeDefined();
    expect(reference).toHaveProperty("name", "TestSchema");
    expect(reference).toHaveProperty("readVersion", 1);
    expect(reference).toHaveProperty("writeVersion", 0);
    expect(reference).toHaveProperty("minorVersion", 15);
  });

  it("should not merge if target has more recent schema references", async () => {
    const targetSchemaContext = await BisTestHelper.getNewContext();
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        { name: "BisCore", version: "01.00.01" },
      ],
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "modify",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "BisCore",
          version: "01.00.00",
        },
      }],
    });

    const reference = await mergedSchema.getReference("BisCore");
    await expect(reference).toBeDefined()
    expect(reference).toHaveProperty("name", "BisCore");
    expect(reference).toHaveProperty("readVersion", 1);
    expect(reference).toHaveProperty("writeVersion", 0);
    expect(reference).toHaveProperty("minorVersion", 1);
  });

  it("should fail if schema references are incompatible", async () => {
    const targetSchemaContext = await BisTestHelper.getNewContext();
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        { name: "BisCore", version: "01.00.01" },
      ],
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.00.00",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "modify",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "BisCore",
          version: "01.01.01",
        },
      }],
    });
    await expect(merge).rejects.toThrow("Schemas references of BisCore have incompatible versions: 01.00.01 and 01.01.01");
  });
});
