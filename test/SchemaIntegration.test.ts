/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaJsonFileLocater } from "../source/Deserialization/SchemaJsonFileLocater";
import { SchemaContext } from "../source/Context";
import { assert } from "chai";
import { SchemaKey, SchemaMatchType } from "../source";

describe("SchemaJsonFileLocater tests: ", () => {
  let locater: SchemaJsonFileLocater;
  let context: SchemaContext;

  beforeEach(() => {
    locater = new SchemaJsonFileLocater();
    locater.addSchemaSearchPath(__dirname + "\\assets\\realWorld\\");
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("locate LinearReferencing schema @integration", async () => {
    // Arrange
    const schemaKey = new SchemaKey("LinearReferencing", 1, 0, 0);

    // Act
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    // Assert
    assert.isDefined(schema);
    assert.equal(schema!.schemaKey.name, "LinearReferencing");
    assert.equal(schema!.schemaKey.version.toString(), "1.0.0");
  });

  it("locate LinearReferencing schema synchronously @integration", () => {
    // Arrange
    const schemaKey = new SchemaKey("LinearReferencing", 1, 0, 0);

    // Act
    const schema = context.getSchemaSync(schemaKey, SchemaMatchType.Exact);

    // Assert
    assert.isDefined(schema);
    assert.equal(schema!.schemaKey.name, "LinearReferencing");
    assert.equal(schema!.schemaKey.version.toString(), "1.0.0");
  });

});
