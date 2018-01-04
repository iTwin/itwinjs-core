/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { SchemaKey } from "../../source/ECObjects";
import { SchemaContext, SchemaCache } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";

describe("Schema Context", () => {
  it("should succeed locating added schema", () => {
    const schema = new ECSchema("TestSchema", 1, 5, 9);

    const context = new SchemaContext();
    context.addSchemaSync(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = context.locateSchemaSync(testKey);

    assert.isDefined(foundSchema);
    assert.equal(foundSchema, schema);
  });

  it("returns undefined when schema does not exist", () => {
    const context = new SchemaContext();

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = context.locateSchemaSync(testKey);

    assert.isUndefined(foundSchema);
  });

  it("does not allow duplicate schemas", () => {
    const context = new SchemaContext();

    const schema = new ECSchema("TestSchema", 1, 0, 5);
    const schema2 = new ECSchema("TestSchema", 1, 0, 5);

    context.addSchemaSync(schema);
    expect(() => { context.addSchemaSync(schema2); }).to.throw(ECObjectsError);
  });

  it("successfully finds schema from added locater", () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new ECSchema("TestSchema", 1, 0, 5);
    cache.addSchemaSync(schema);

    context.addLocater(cache);

    const foundSchema = context.locateSchemaSync(schema.schemaKey);
    assert.isDefined(foundSchema);
    assert.equal(foundSchema, schema);

    // Check if the schema is found if it is added to the cache after it is added
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new ECSchema("TestSchema", 1, 0, 10);
    cache2.addSchemaSync(schema2);

    const foundSchema2 = context.locateSchemaSync(schema2.schemaKey);
    assert.isDefined(foundSchema2);
    assert.equal(foundSchema2, schema2);
  });
});
