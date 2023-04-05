/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { SchemaLoader } from "../../SchemaLoader";
import { ECObjectsError } from "../../Exception";

describe("SchemaLoader", () => {

  const getSchemaProps = (schemaName: string) => {
    if (schemaName === "SchemaD") {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        alias: "d",
        description: "This is a test Schema.",
        label: "SchemaD",
        name: "SchemaD",
        version: "04.04.04",
      };
    } else {
      return undefined;
    }
  };

  it("should load a known EC Schema by name", () => {
    const schemaLoader = new SchemaLoader(getSchemaProps);
    const schema = schemaLoader.getSchema("SchemaD");
    assert.isDefined(schema);
    assert.equal(schema.name, "SchemaD");
  });

  it("load unknown EC Schema by name should throw NotFound ECObjectsError", () => {
    const schemaLoader = new SchemaLoader(getSchemaProps);
    assert.throws(() => schemaLoader.getSchema("DoesNotExist"), ECObjectsError);
  });

  it("try load unknown EC Schema by name should return undefined", () => {
    const schemaLoader = new SchemaLoader(getSchemaProps);
    const schema = schemaLoader.tryGetSchema("DoesNotExist");
    assert.isUndefined(schema);
  });
});
