/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ensureArray, isSchemaEditOperation, keyPairsToMultimap, SchemaEditOperation, tryParseSchemaEditOperation } from "../SchemaEditUtils";

describe("parsing SchemaEditOperations", () => {

  const exampleSchemaEditOperationType: SchemaEditOperation = { pattern: "", schemaName: "", substitution: "" };
  const expectedKeys = Object.keys(exampleSchemaEditOperationType);

  it("should identify bad parse results", async () => {
    assert.isFalse(isSchemaEditOperation(null));
    assert.isFalse(isSchemaEditOperation(undefined));
    assert.isFalse(isSchemaEditOperation(5));
    assert.isFalse(isSchemaEditOperation("hello"));
    assert.isFalse(isSchemaEditOperation({}));
    assert.isFalse(isSchemaEditOperation({schemaName: 5}));
    assert.isFalse(isSchemaEditOperation({schemaName: "hello"}));
    assert.isFalse(isSchemaEditOperation({pattern: "hello"}));
    assert.isFalse(isSchemaEditOperation({schemaName: "hello", pattern: "test"}));
    assert.isFalse(isSchemaEditOperation({schemaName: /test/, pattern: /test/, substitution: "double-test"}));
    assert.isTrue(isSchemaEditOperation({schemaName: "hello", pattern: "test", substitution: "double-test"}));
    assert.isTrue (isSchemaEditOperation({schemaName: "hello", pattern: /test/, substitution: "double-test"}));
  });

  it("should allow escaped slashes in the pattern", async () => {
    assert.hasAllKeys(tryParseSchemaEditOperation("schemaName/<xml\\/>/test/"), expectedKeys);
    assert.isTrue(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/<xml\\/>/test/")));
  });

  it("should allow escaped slashes in the substitution", async () => {
    assert.hasAllKeys(tryParseSchemaEditOperation("schemaName/<xml\\/>/<rip\\/>/"), expectedKeys);
    assert.isTrue(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/<xml\\/>/<rip\\/>/")));
  });

  it("should allow empty substitutions", async () => {
    assert.hasAllKeys(tryParseSchemaEditOperation("schemaName/hello//"), expectedKeys);
    assert.isTrue(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/hello//")));

    assert.hasAllKeys(tryParseSchemaEditOperation("schemaName/he\\/llo//"), expectedKeys);
    assert.isTrue(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/he\\/llo//")));
  });

  it("should reject empty patterns", async () => {
    assert.isUndefined(tryParseSchemaEditOperation("schemaName//world/"));
    assert.isFalse(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName//world")));
  });

  it("should reject empty schema names", async () => {
    assert.isUndefined(tryParseSchemaEditOperation("/test/world/"));
    assert.isFalse(isSchemaEditOperation(tryParseSchemaEditOperation("/test/world")));
  });

  it("should reject inputs that don't end in a slash", async () => {
    assert.hasAllKeys(tryParseSchemaEditOperation("schemaName/hello/world/"), expectedKeys);
    assert.isTrue(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/hello/world/")));

    assert.isUndefined(tryParseSchemaEditOperation("schemaName/hello/world"));
    assert.isFalse(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/hello/world")));

    // check escaped slashes at the end don't count
    assert.isUndefined(tryParseSchemaEditOperation("schemaName/hello/world\\/"));
    assert.isFalse(isSchemaEditOperation(tryParseSchemaEditOperation("schemaName/hello/world\\/")));
  });

  it("keyPairsToMultiMap should preserve iteration order", () => {
    // the map itself may not be in order...
    const actual = keyPairsToMultimap([["x", 5], ["x", 6], ["y", 10], ["x",2]]);
    assert.deepEqual(actual.get("x"), [5, 6, 2]);
    assert.deepEqual(actual.get("y"), [10]);
  });

  it("ensureArray", () => {
    assert.deepEqual(ensureArray(5), [5]);
    assert.deepEqual(ensureArray([5]), [5]);
    assert.deepEqual(ensureArray(undefined), [undefined]);
    assert.deepEqual(ensureArray([]), []);
    assert.deepEqual(ensureArray({}), [{}]);
  });
});
