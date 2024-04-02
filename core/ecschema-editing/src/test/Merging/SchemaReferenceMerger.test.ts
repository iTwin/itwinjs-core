/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";

describe("Schema reference merging tests", () => {

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };

  it("should merge missing schema references", async () => {
    const targetSchemaContext = new SchemaContext();
    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, targetSchemaContext);

    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.15",
      alias: "bis",
    }, targetSchemaContext);
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "CoreCustomAttributes",
      version: "01.00.03",
      alias: "ca",
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [{
        changeType: "add",
        schemaType: SchemaOtherTypes.SchemaReference,
        path: "$references",
        difference: {
          name: "BisCore",
          version: "01.00.15",
        },
      }, {
        changeType: "add",
        schemaType: SchemaOtherTypes.SchemaReference,
        path: "$references",
        difference: {
          name: "CoreCustomAttributes",
          version: "01.00.03",
        },
      }],
    });

    expect(mergedSchema.toJSON().references).deep.equals([
      { name: "BisCore", version: "01.00.15" },
      { name: "CoreCustomAttributes", version: "01.00.03" },
    ]);
  });

  it.skip("should merge compatible schema references", async () => {
    const sourceSchemaContext = new SchemaContext();
    const targetSchemaContext = new SchemaContext();

    // For this test case we need schema mocks we reference.
    // they can be empty, it's just there to get resolved by the schema context.
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.16",
      alias: "bis",
    }, sourceSchemaContext);
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.15",
      alias: "bis",
    }, targetSchemaContext);

    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      references: [
        {
          name: "BisCore",
          version: "01.00.16",
        },
      ],
    }, sourceSchemaContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "BisCore",
          version: "01.00.15",
        },
      ],
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge(targetSchema, sourceSchema);
    const bisCoreReference = await mergedSchema.getReference("BisCore");
    expect(bisCoreReference?.schemaKey.toString()).equals("BisCore.01.00.16");
  });

  it("should not merge if target has more recent schema references", async () => {
    const sourceSchemaContext = new SchemaContext();
    const targetSchemaContext = new SchemaContext();

    // For this test case we need schema mocks we reference.
    // they can be empty, it's just there to get resolved by the schema context.
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.15",
      alias: "bis",
    }, sourceSchemaContext);
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.16",
      alias: "bis",
    }, targetSchemaContext);

    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      references: [
        {
          name: "BisCore",
          version: "01.00.15",
        },
      ],
    }, sourceSchemaContext);

    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "BisCore",
          version: "01.00.16",
        },
      ],
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge(targetSchema, sourceSchema);
    const bisCoreReference = await mergedSchema.getReference("BisCore");
    expect(bisCoreReference?.schemaKey.toString()).equals("BisCore.01.00.16");
  });

  it.skip("should fail if schema references are incompatible", async () => {
    const sourceSchemaContext = new SchemaContext();
    const targetSchemaContext = new SchemaContext();

    // For this test case we need schema mocks we reference.
    // they can be empty, it's just there to get resolved by the schema context.
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.01.01",
      alias: "bis",
    }, sourceSchemaContext);
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "BisCore",
      version: "01.00.15",
      alias: "bis",
    }, targetSchemaContext);

    const sourceSchema = await Schema.fromJson({
      ...sourceJson,
      references: [
        {
          name: "BisCore",
          version: "01.01.01",
        },
      ],
    }, sourceSchemaContext);

    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "BisCore",
          version: "01.00.15",
        },
      ],
    }, targetSchemaContext);

    const merger = new SchemaMerger(targetSchema.context);
    await expect(merger.merge(targetSchema, sourceSchema)).to.eventually.rejectedWith("Schemas references of BisCore have incompatible versions: 01.00.15 and 01.01.01");
  });
});
