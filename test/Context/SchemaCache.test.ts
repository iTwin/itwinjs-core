/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;

import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import { SchemaCache } from "../../source/Context";
import ECSchema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";

describe("Schema Cache", () => {
  it("adding should succeed", async () => {
    const cache = new SchemaCache();

    const schema = new ECSchema("TestSchema");
    await cache.addSchema(schema);

    assert.equal(cache.count, 1);
  });

  it("should not be able to add multiple schemas that match using SchemaMatchType Latest", async () => {
    const cache = new SchemaCache();

    const schema1 = new ECSchema("TestSchema");
    await cache.addSchema(schema1);

    const schema2 = new ECSchema("TestSchema");
    await expect(cache.addSchema(schema2)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.0.0.0, already exists within this cache.");

    const schema3 = new ECSchema("TestSchema", 1);
    await expect(cache.addSchema(schema3)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema4 = new ECSchema("TestSchema", 1, 0);
    await expect(cache.addSchema(schema4)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema5 = new ECSchema("TestSchema", 1, 0, 0);
    await expect(cache.addSchema(schema5)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");
  });
});
