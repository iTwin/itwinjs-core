/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SchemaCache, SchemaContext } from "../../Context";
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
});
