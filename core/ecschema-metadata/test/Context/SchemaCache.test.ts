/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;
const expect = chai.expect;

import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);

import { SchemaCache, SchemaContext } from "./../../src/Context";
import { Schema } from "./../../src/Metadata/Schema";
import { ECObjectsError } from "./../../src/Exception";
import { SchemaKey } from "./../../src/SchemaKey";

describe("Schema Cache", () => {
  it("adding should succeed", async () => {
    const cache = new SchemaCache();
    const schema = new Schema(new SchemaContext(), new SchemaKey("TestSchema"));
    await cache.addSchema(schema);

    assert.equal(cache.count, 1);
  });

  it("should not be able to add multiple schemas that match using SchemaMatchType Latest", async () => {
    const cache = new SchemaCache();
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"));
    await cache.addSchema(schema1);

    const schema2 = new Schema(context, new SchemaKey("TestSchema"));
    await expect(cache.addSchema(schema2)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.0.0.0, already exists within this cache.");

    const schema3 = new Schema(context, new SchemaKey("TestSchema", 1));
    await expect(cache.addSchema(schema3)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema4 = new Schema(context, new SchemaKey("TestSchema", 1, 0));
    await expect(cache.addSchema(schema4)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");

    const schema5 = new Schema(context, "TestSchema", 1, 0, 0);
    await expect(cache.addSchema(schema5)).to.be.rejectedWith(ECObjectsError, "The schema, TestSchema.1.0.0, already exists within this cache.");
  });
});
