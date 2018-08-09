/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import { SchemaXmlFileLocater } from "../../source/Deserialization/SchemaXmlFileLocater";
import { FileSchemaKey } from "../../source/Deserialization/SchemaFileLocater";
import { SchemaKey, SchemaMatchType, ECObjectsError, ECObjectsStatus, SchemaContext } from "../../source";

describe("SchemaXmlFileLocater tests:", () => {
  let locater: SchemaXmlFileLocater;
  let context: SchemaContext;

  beforeEach(() => {
    locater = new SchemaXmlFileLocater();
    locater.addSchemaSearchPath(__dirname + "\\..\\assets\\");
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("locate valid schema with multiple references", async () => {
    // Arrange
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);

    // Act
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    // Assert
    assert.isDefined(schema);
    assert.equal(schema!.schemaKey.name, "SchemaA");
    assert.equal(schema!.schemaKey.version.toString(), "1.1.1");
  });

  it("locate valid schema with multiple references synchronously", () => {
    // Arrange
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);

    // Act
    const schema = context.getSchemaSync(schemaKey, SchemaMatchType.Exact);

    // Assert
    assert.isDefined(schema);
    assert.equal(schema!.schemaKey.name, "SchemaA");
    assert.equal(schema!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema called multiple times for same schema", async () => {
    // Arrange
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);

    // Act
    const locater1 = await locater.getSchema(schemaKey, SchemaMatchType.Exact);
    const locater2 = await locater.getSchema(schemaKey, SchemaMatchType.Exact);
    const context1 = await context.getSchema(schemaKey, SchemaMatchType.Exact);
    const context2 = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    // Assert
    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.equal(context1, context2);
  });

  it("getSchema which does not exist, returns undefined", async () => {
    // Arrange
    const schemaKey = new SchemaKey("DoesNotExist");

    // Act
    const result = await locater.getSchema(schemaKey, SchemaMatchType.Exact);

    assert.isUndefined(result);
  });

  it("loadSchema from file, bad schema tag, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("BadSchemaTag");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest, context);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema name tag, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("BadSchemaNameTag");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest, context);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema tag, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("BadSchemaVersionTag");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest, context);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    // Arrange

    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact, context);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as FileSchemaKey;
    assert.equal(key.name, "SchemaA");
    assert.equal(key.version.toString(), "1.1.1");
  });

  it("getSchema, reference does not exist, throws.", async () => {
    // Arrange

    // Act
    try {
      await locater.getSchema(new SchemaKey("RefDoesNotExist", 1, 1, 1), SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    // Assert
    assert.fail();
  });

  it("getSchema, references set", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);
    const schemaB = await context.getSchema(new SchemaKey("SchemaB", 2, 2, 2), SchemaMatchType.Exact);
    const schemaC = await context.getSchema(new SchemaKey("SchemaC", 3, 3, 3), SchemaMatchType.Exact);
    const schemaD = await context.getSchema(new SchemaKey("SchemaD", 4, 4, 4), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.references.length, 2);
    assert.deepEqual(stub!.references[0], schemaC);
    assert.deepEqual(stub!.references[1], schemaB);
    assert.deepEqual(stub!.references[0].references[0], schemaD);
    assert.deepEqual(stub!.references[1].references[0], schemaC);
    assert.deepEqual(stub!.references[1].references[1], schemaD);
  });

  it("getSchema, 2 digit references, references set", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 2, 0, 2), SchemaMatchType.Exact);
    const schemaB = await context.getSchema(new SchemaKey("SchemaB", 3, 0, 3), SchemaMatchType.Exact);
    const schemaC = await context.getSchema(new SchemaKey("SchemaC", 4, 0, 4), SchemaMatchType.Exact);
    const schemaD = await context.getSchema(new SchemaKey("SchemaD", 5, 0, 5), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.references.length, 2);
    assert.deepEqual(stub!.references[0], schemaC);
    assert.deepEqual(stub!.references[1], schemaB);
    assert.deepEqual(stub!.references[0].references[0], schemaD);
    assert.deepEqual(stub!.references[1].references[0], schemaC);
    assert.deepEqual(stub!.references[1].references[1], schemaD);
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 1, 2), SchemaMatchType.Exact);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest, succeeds", async () => {
    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest, context);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "2.0.2");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    // Act
    const stub = await context.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isUndefined(stub);
  });
});
