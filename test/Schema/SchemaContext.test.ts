/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { SchemaKey } from "../../source/ECObjects";
import { SchemaContext } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";

describe("Schema Context", () => {
  it("should succeed locating added schema", () => {
    const schema = new ECSchema("TestSchema", 1, 5, 9);

    const context = new SchemaContext();
    context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = context.locateSchema(testKey);

    assert.isDefined(foundSchema);
    assert.equal(foundSchema, schema);
  });

  it("returns undefined when schema does not exist", () => {
    const context = new SchemaContext();

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = context.locateSchema(testKey);

    assert.isUndefined(foundSchema);
  });

  it("does not allow duplicate schemas", () => {
    const context = new SchemaContext();

    const schema = new ECSchema("TestSchema", 1, 0, 5);
    const schema2 = new ECSchema("TestSchema", 1, 0, 5);

    context.addSchema(schema);
    expect(() => { context.addSchema(schema2); }).to.throw(ECObjectsError);
  });
});
