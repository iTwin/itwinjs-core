/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from "vitest";
import { SchemaCache, SchemaContext } from "../../Context";
import { SchemaMatchType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { Schema } from "../../Metadata/Schema";
import { SchemaKey } from "../../SchemaKey";

describe("Schema Context", () => {
  it("should succeed locating added schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isDefined(foundSchema);
    assert.strictEqual(foundSchema, schema);
  });

  it("returns undefined when schema does not exist", async () => {
    const context = new SchemaContext();

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isUndefined(foundSchema);
  });

  it("does not allow duplicate schemas", async () => {
    const context = new SchemaContext();

    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    const schema2 = new Schema(context, "TestSchema", "ts", 1, 0, 5);

    await context.addSchema(schema);
    await expect(context.addSchema(schema2)).rejects.toThrow(ECObjectsError);
  });

  it("schema added, getCachedSchema returns the schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).toEqual(schema);
  });

  it("schema not added, getCachedSchema returns undefined", async () => {
    const context = new SchemaContext();
    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    assert.isUndefined(loadedSchema);
  });

  it("schema added, getCachedSchema called with different schema version and incompatible match type, returns undefined", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey, SchemaMatchType.Exact);

    assert.isUndefined(loadedSchema);
  });

  it("schema added, getCachedSchema called with different schema version with compatible match type, returns true", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey, SchemaMatchType.LatestReadCompatible);

    expect(loadedSchema).toEqual(schema);
  });

  it("schema added, getCachedSchema called with different schema version with compatible match type (default), returns true", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).toEqual(schema);
  });

  it("successfully finds schema from added locater", async () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    await cache.addSchema(schema);

    context.addLocater(cache);
    expect(await context.getSchema(schema.schemaKey)).toEqual(schema);
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).toEqual(schema);

    // Check if the schema is found if it is added to the cache after the cache is added as a locater
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new Schema(context, "TestSchema", "ts", 1, 0, 10);
    await cache2.addSchema(schema2);
    expect(await context.getSchema(schema2.schemaKey, SchemaMatchType.Exact)).toEqual(schema2);

    // We should still get TestSchema 1.0.5 for SchemaMatchType.Latest, since cache was added _before_ cache2
    expect(await context.getSchema(schema2.schemaKey)).toEqual(schema);
  });

  it("getKnownSchemas should return all schemas from schema cache", async () => {
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await context.addSchema(schema1);

    const schema2 = new Schema(context, new SchemaKey("TestSchema2"), "ts");
    await context.addSchema(schema2);

    const schemas = context.getKnownSchemas();
    expect(schemas.length).toEqual(2);
    expect(schemas[0].schemaKey.matches(schema1.schemaKey)).toBe(true);
    expect(schemas[1].schemaKey.matches(schema2.schemaKey)).toBe(true);
  });
});
