/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;

import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import Schema from "../../src/Metadata/Schema";
import { SchemaKey, SchemaMatchType } from "../../src/ECObjects";
import { SchemaContext, SchemaCache } from "../../src/Context";
import { ECObjectsError } from "../../src/Exception";

describe("Schema Context", () => {
  it("should succeed locating added schema", async () => {
    const schema = new Schema("TestSchema", 1, 5, 9);

    const context = new SchemaContext();
    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isDefined(foundSchema);
    assert.equal(foundSchema, schema);
  });

  it("returns undefined when schema does not exist", async () => {
    const context = new SchemaContext();

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isUndefined(foundSchema);
  });

  it("does not allow duplicate schemas", async () => {
    const context = new SchemaContext();

    const schema = new Schema("TestSchema", 1, 0, 5);
    const schema2 = new Schema("TestSchema", 1, 0, 5);

    await context.addSchema(schema);
    await expect(context.addSchema(schema2)).to.be.rejectedWith(ECObjectsError);
  });

  it("successfully finds schema from added locater", async () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new Schema("TestSchema", 1, 0, 5);
    await cache.addSchema(schema);

    context.addLocater(cache);
    expect(await context.getSchema(schema.schemaKey)).to.equal(schema);
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);

    // Check if the schema is found if it is added to the cache after the cache is added as a locater
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new Schema("TestSchema", 1, 0, 10);
    await cache2.addSchema(schema2);
    expect(await context.getSchema(schema2.schemaKey, SchemaMatchType.Exact)).to.equal(schema2);

    // We should still get TestSchema 1.0.5 for SchemaMatchType.Latest, since cache was added _before_ cache2
    expect(await context.getSchema(schema2.schemaKey)).to.equal(schema);
  });
});
