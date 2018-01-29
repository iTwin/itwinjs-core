/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;

import * as chaiAsPromised from "chai-as-promised"
chai.use(chaiAsPromised);

import ECSchema from "../../source/Metadata/Schema";
import { SchemaKey } from "../../source/ECObjects";
import { SchemaContext, SchemaCache } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";

describe("Schema Context", () => {
  it("should succeed locating added schema", async () => {
    const schema = new ECSchema("TestSchema", 1, 5, 9);

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

    const schema = new ECSchema("TestSchema", 1, 0, 5);
    const schema2 = new ECSchema("TestSchema", 1, 0, 5);

    await context.addSchema(schema);
    await expect(context.addSchema(schema2)).to.be.rejectedWith(ECObjectsError);
  });

  it.skip("successfully finds schema from added locater", async () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new ECSchema("TestSchema", 1, 0, 5);
    await cache.addSchema(schema);

    context.addLocater(cache);

    const foundSchema = await context.getSchema(schema.schemaKey);
    assert.isDefined(foundSchema);
    assert.equal(foundSchema, schema);

    // Check if the schema is found if it is added to the cache after it is added
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new ECSchema("TestSchema", 1, 0, 10);
    await cache2.addSchema(schema2);

    const foundSchema2 = await context.getSchema(schema2.schemaKey);
    assert.isDefined(foundSchema2);
    assert.equal(foundSchema2, schema2);
  });
});
