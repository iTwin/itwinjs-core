/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SchemaCache, SchemaContext } from "../../Context";
import { ECSchemaError } from "../../Exception";
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
    await expect(cache.addSchema(schema2)).to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.00.00.00, already exists within this cache.");

    const schema3 = new Schema(context, new SchemaKey("TestSchema", 1), "ts");
    await expect(cache.addSchema(schema3)).to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema4 = new Schema(context, new SchemaKey("TestSchema", 1, 0), "ts");
    await expect(cache.addSchema(schema4)).to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.01.00.00, already exists within this cache.");

    const schema5 = new Schema(context, "TestSchema", "ts", 1, 0, 0);
    await expect(cache.addSchema(schema5)).to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.01.00.00, already exists within this cache.");
  });

  it("getAllSchemas should return added schemas", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await cache.addSchema(schema1);

    const schema2 = new Schema(context, new SchemaKey("TestSchema2"), "ts");
    await cache.addSchema(schema2);

    const schemas = Array.from(cache.getAllSchemas());
    expect(schemas.length).to.equal(2);
    expect(schemas[0].schemaKey.matches(schema1.schemaKey)).to.be.true;
    expect(schemas[1].schemaKey.matches(schema2.schemaKey)).to.be.true;
  });

  describe("addSchemaPromise", () => {
    it("should add schema promise and remove it when promise resolves", async () => {
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      let resolvePromise: () => void;
      const schemaPromise = new Promise<Schema>((resolve) => {
        resolvePromise = () => resolve(schema);
      });

      await cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise);

      expect(cache.schemaExists(schema.schemaKey)).to.be.true;

      // Resolve the promise
      resolvePromise!();
      await schemaPromise;

      // Wait for the cleanup to happen
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still be able to get the schema (promise removed but schema remains)
      const retrievedSchema = await cache.getSchema(schema.schemaKey);
      expect(retrievedSchema).to.equal(schema);
    });

    it("should handle promise rejection and keep schema in cache for later handling", async () => {
      // This ensures that an error is propagated, and the empty .catch() doesn't swallow the error
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      const error = new Error("Schema load failed");
      const schemaPromise = Promise.reject<Schema>(error);

      await cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise);

      expect(cache.schemaExists(schema.schemaKey)).to.be.true;

      // Wait for promise to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      // When getSchema is called, it should throw the error and remove the entry
      await expect(cache.getSchema(schema.schemaKey)).to.be.rejectedWith("Schema load failed");

      // After error handling, schema should be removed from cache
      expect(cache.schemaExists(schema.schemaKey)).to.be.false;
    });

    it("should not allow duplicate schemas when adding promise of already loaded schema", async () => {
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      await cache.addSchema(schema);

      const schemaPromise = Promise.resolve(schema);
      await expect(cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise))
        .to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.00.00.00, already exists within this cache.");
    });

    it("should not allow duplicate promises", async () => {
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      const schemaPromise1 = Promise.resolve(schema);
      await cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise1);

      const schemaPromise2 = Promise.resolve(schema);
      await expect(cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise2))
        .to.be.rejectedWith(ECSchemaError, "The schema, TestSchema.00.00.00, already exists within this cache.");
    });
  });

  describe("getSchema with promises", () => {
    it("should await a partially loaded schema and return it when ready", async () => {
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      let resolvePromise: (value: Schema) => void;
      const schemaPromise = new Promise<Schema>((resolve) => {
        resolvePromise = resolve;
      });

      await cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise);

      // Start getting the schema (should wait for promise)
      const getSchemaPromise = cache.getSchema(schema.schemaKey);

      // Resolve the schema promise after a delay
      setTimeout(() => resolvePromise!(schema), 10);

      const retrievedSchema = await getSchemaPromise;
      expect(retrievedSchema).to.equal(schema);
    });

    it("should handle concurrent getSchema calls waiting on same promise", async () => {
      const cache = new SchemaCache();
      const context = new SchemaContext();
      const schema = new Schema(context, new SchemaKey("TestSchema"), "ts");

      let resolvePromise: (value: Schema) => void;
      const schemaPromise = new Promise<Schema>((resolve) => {
        resolvePromise = resolve;
      });

      await cache.addSchemaPromise({ schemaKey: schema.schemaKey, alias: schema.alias, references: [] }, schema, schemaPromise);

      // Multiple concurrent getSchema calls
      const getPromise1 = cache.getSchema(schema.schemaKey);
      const getPromise2 = cache.getSchema(schema.schemaKey);
      const getPromise3 = cache.getSchema(schema.schemaKey);

      // Resolve the schema promise
      setTimeout(() => resolvePromise!(schema), 10);

      const [result1, result2, result3] = await Promise.all([getPromise1, getPromise2, getPromise3]);
      expect(result1).to.equal(schema);
      expect(result2).to.equal(schema);
      expect(result3).to.equal(schema);
    });
  });
});
