/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaCache } from "../../source/Context";
import { ECSchema } from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";

describe("Schema Cache", () => {
  it("adding should succeed", () => {
    const cache = new SchemaCache();

    const schema = new ECSchema("TestSchema");
    cache.addSchemaSync(schema);

    assert.equal(cache.count, 1);
  });

  it("should not be able to add multiple schemas that match using SchemaMatchType Latest", () => {
    const cache = new SchemaCache();

    const schema1 = new ECSchema("TestSchema");
    cache.addSchemaSync(schema1);

    const schema2 = new ECSchema("TestSchema");
    expect(() => { cache.addSchemaSync(schema2); }).to.throw(ECObjectsError, "The schema, TestSchema.0.0.0, already exists within this cache.");

    const schema3 = new ECSchema("TestSchema", 1);
    expect(() => { cache.addSchemaSync(schema3); }).to.throw(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema4 = new ECSchema("TestSchema", 1, 0);
    expect(() => { cache.addSchemaSync(schema4); }).to.throw(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema5 = new ECSchema("TestSchema", 1, 0, 0);
    expect(() => { cache.addSchemaSync(schema5); }).to.throw(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");
  });
});
