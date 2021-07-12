/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { LoadSchema, SchemaCache, SchemaContext } from "../../Context";
import { ECObjectsError } from "../../Exception";
import { Schema } from "../../Metadata/Schema";
import { SchemaKey } from "../../SchemaKey";

const assert = chai.assert;
const expect = chai.expect;

chai.use(chaiAsPromised);

describe("Schema Cache", () => {
  it("adding should succeed", async () => {
    const cache = new SchemaCache();
    const schema = new Schema(new SchemaContext(), new SchemaKey("TestSchema"), "ts");
    await cache.addSchema(schema);

    assert.strictEqual(cache.count, 1);
  });

  it("should not be able to add multiple schemas that match using SchemaMatchType Latest", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await cache.addSchema(schema1);

    const schema2 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await expect(cache.addSchema(schema2)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.00.00.00, already exists within this cache.");

    const schema3 = new Schema(context, new SchemaKey("TestSchema", 1), "ts");
    await expect(cache.addSchema(schema3)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema4 = new Schema(context, new SchemaKey("TestSchema", 1, 0), "ts");
    await expect(cache.addSchema(schema4)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema5 = new Schema(context, "TestSchema", "ts", 1, 0, 0);
    await expect(cache.addSchema(schema5)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");
  });

  it("should successfully addSchema (passing LoadSchema)", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    const schema2 = new Schema(context, new SchemaKey("TestSchema2"), "ts2");
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      return schema;
    }

    await cache.addSchema(schema1, new LoadSchema(async () => mockFunc(schema1)));
    assert.strictEqual(cache.loadingSchemasCount, 1);

    await cache.getSchema(new SchemaKey("TestSchema"));
    assert.strictEqual(cache.loadingSchemasCount, 0);
    assert.strictEqual(cache.loadedSchemasCount, 1);

    await cache.addSchema(schema2, new LoadSchema(async () => mockFunc(schema2)));
    assert.strictEqual(cache.loadingSchemasCount, 1);
    assert.strictEqual(cache.loadedSchemasCount, 1);

    // Should not have any impact here since it is getting TestSchema
    await cache.getSchema(new SchemaKey("TestSchema"));
    assert.strictEqual(cache.loadingSchemasCount, 1);
    assert.strictEqual(cache.loadedSchemasCount, 1);

    await cache.getSchema(new SchemaKey("TestSchema2"));
    assert.strictEqual(cache.loadingSchemasCount, 0);
    assert.strictEqual(cache.loadedSchemasCount, 2);
  });


  it("should not be able to add multiple schemas that match using SchemaMatchType Latest (passing LoadSchema)", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const mockFunc = async (schema: Schema): Promise<Schema> => {
      return schema;
    }

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await cache.addSchema(schema1, new LoadSchema(async () => mockFunc(schema1)));

    const schema2 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await expect(cache.addSchema(schema2, new LoadSchema(async () => mockFunc(schema2)))).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.00.00.00, already exists within this cache.");

    const schema3 = new Schema(context, new SchemaKey("TestSchema", 1), "ts");
    await expect(cache.addSchema(schema3, new LoadSchema(async () => mockFunc(schema3)))).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema4 = new Schema(context, new SchemaKey("TestSchema", 1, 0), "ts");
    await expect(cache.addSchema(schema4, new LoadSchema(async () => mockFunc(schema4)))).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema5 = new Schema(context, "TestSchema", "ts", 1, 0, 0);
    await expect(cache.addSchema(schema5, new LoadSchema(async () => mockFunc(schema5)))).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    await cache.getSchema(new SchemaKey("TestSchema"));
    assert.strictEqual(cache.loadingSchemasCount, 0);
    assert.strictEqual(cache.loadedSchemasCount, 1);

    // Should still be unable to add schema even after loading first schema
    await expect(cache.addSchema(schema2, new LoadSchema(async () => mockFunc(schema2)))).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.00.00.00, already exists within this cache.");
  });

  it("getLoadingSchema returns the loading schema in cache and getLoadedSchema returns the loaded schema in cache", async () => {
    const context = new SchemaContext();
    const cache = new SchemaCache();

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }
    const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await cache.addSchema(schema, new LoadSchema(async () => mockFunc(schema)));

    // Should find loading schema in cache
    expect(await cache.getLoadingSchema(schema.schemaKey)).to.equal(schema);
    assert.strictEqual(cache.loadingSchemasCount, 1);
    assert.strictEqual(cache.loadedSchemasCount, 0);
    // Did not await mockFunc's promise in getLoadingSchema, so counter should be 0
    assert.strictEqual(counter, 0);

    await cache.getSchema(new SchemaKey("TestSchema"));

    // Should find loaded schema in cache
    expect(await cache.getLoadedSchema(schema.schemaKey)).to.equal(schema);
    assert.strictEqual(cache.loadingSchemasCount, 0);
    assert.strictEqual(cache.loadedSchemasCount, 1);
    // Awaited mockFunc's promise in getLoadingSchema, so counter should be 1
    assert.strictEqual(counter, 1);

    // Should not find loading schema now that it is loaded
    expect(await cache.getLoadingSchema(schema.schemaKey)).to.be.undefined;
  });

  it("should run LoadSchema promises only once", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");

    let counter = 0;
    const mockFunc = async (schema: Schema): Promise<Schema> => {
      counter++;
      return schema;
    }

    await cache.addSchema(schema1, new LoadSchema(async () => mockFunc(schema1)));

    const getSchemaPromises = [];
    for (let i = 0; i < 5; i++) {
      getSchemaPromises.push(cache.getSchema(new SchemaKey("TestSchema")));
    }

    await Promise.all(getSchemaPromises);
    assert.strictEqual(counter, 1);
  });
});
