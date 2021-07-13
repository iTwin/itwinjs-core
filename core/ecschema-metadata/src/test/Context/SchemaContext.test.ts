/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { LoadSchema, SchemaCache, SchemaContext } from "../../Context";
import { SchemaMatchType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { Schema } from "../../Metadata/Schema";
import { SchemaKey } from "../../SchemaKey";

const assert = chai.assert;
const expect = chai.expect;

chai.use(chaiAsPromised);

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
    await expect(context.addSchema(schema2)).to.be.rejectedWith(ECObjectsError);

    const schema3 = new Schema(context, "TestSchema2", "ts2", 1, 0, 5);
    const schema4 = new Schema(context, "TestSchema2", "ts2", 1, 0, 5);
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      return schema;
    }

    await context.addSchema(schema3, new LoadSchema(async () => mockFunc(schema3)));
    await expect(context.addSchema(schema4, new LoadSchema(async () => mockFunc(schema4)))).to.be.rejectedWith(ECObjectsError);
  });

  it("schema added, getCachedSchema returns the schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).to.equal(schema);
  });

  it("loading schema added, getCachedSchema returns the loaded schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }
    await context.addSchema(schema, new LoadSchema(async () => mockFunc(schema)));

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).to.equal(schema);
    // Awaited getCachedSchema mockFunc's promise, so counter should be 1
    assert.strictEqual(counter, 1);
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

    expect(loadedSchema).to.equal(schema);
  });

  it("schema added, getCachedSchema called with different schema version with compatible match type (default), returns true", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).to.equal(schema);
  });

  it("loading schema added, getCachedLoadedOrLoadingSchema returns the loading schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }
    await context.addSchema(schema, new LoadSchema(async () => mockFunc(schema)));

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadingSchema = await context.getCachedLoadedOrLoadingSchema(testKey);

    expect(loadingSchema).to.equal(schema);
    // Did not await mockFunc's promise, so counter should be 0
    assert.strictEqual(counter, 0);
  });

  it("loading schema added and is loaded, getCachedLoadedOrLoadingSchema returns the loaded schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }
    await context.addSchema(schema, new LoadSchema(async () => mockFunc(schema)));

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    await context.getCachedSchema(testKey);
    const loadedSchema = await context.getCachedLoadedOrLoadingSchema(testKey);

    expect(loadedSchema).to.equal(schema);
    // Awaited mockFunc's promise in getCachedSchema, so counter should be 1
    assert.strictEqual(counter, 1);
  });

  it("successfully finds schema from added locater", async () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    await cache.addSchema(schema);

    context.addLocater(cache);
    expect(await context.getSchema(schema.schemaKey)).to.equal(schema);
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);

    // Check if the schema is found if it is added to the cache after the cache is added as a locater
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new Schema(context, "TestSchema", "ts", 1, 0, 10);
    await cache2.addSchema(schema2);
    expect(await context.getSchema(schema2.schemaKey, SchemaMatchType.Exact)).to.equal(schema2);

    // We should still get TestSchema 1.0.5 for SchemaMatchType.Latest, since cache was added _before_ cache2
    expect(await context.getSchema(schema2.schemaKey)).to.equal(schema);
  });

  it("adds schema to locater, getLoadingSchema returns the loading schema and getSchema returns the loaded schema", async () => {
    const context = new SchemaContext();
    const cache = new SchemaCache();
    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    context.addLocater(cache);

    const cache2 = new SchemaCache();
    context.addLocater(cache2);

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }
    await cache2.addSchema(schema, new LoadSchema(async () => mockFunc(schema)));

    // Should find loading schema in cache2
    expect(await context.getLoadingSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);
    assert.strictEqual(cache2.loadingSchemasCount, 1);
    assert.strictEqual(cache2.loadedSchemasCount, 0);
    // Did not await mockFunc's promise in getLoadingSchema, so counter should be 0
    assert.strictEqual(counter, 0);

    // There shouldn't be anything in context's cache unless locater's getLoadingSchema adds it to cache
    expect(await context.getCachedLoadedOrLoadingSchema(schema.schemaKey, SchemaMatchType.Exact)).to.be.undefined;

    // Calling getLoadingSchema again should not have any effect
    expect(await context.getLoadingSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);
    assert.strictEqual(cache2.loadingSchemasCount, 1);
    assert.strictEqual(cache2.loadedSchemasCount, 0);
    assert.strictEqual(counter, 0);

    // Should load the schema in cache2
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);
    assert.strictEqual(cache2.loadingSchemasCount, 0);
    assert.strictEqual(cache2.loadedSchemasCount, 1);
    // Awaited mockFunc's promise in getLoadingSchema, so counter should be 1
    assert.strictEqual(counter, 1);

    // Schema is loaded, so shouldn't find it as loading schema anymore
    expect(await context.getLoadingSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(undefined);

    // LoadSchema promise is already resolved, so counter should still be 1
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);
    assert.strictEqual(counter, 1);
  });
});
