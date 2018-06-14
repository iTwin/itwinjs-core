/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaJsonFileLocater } from "../source/Deserialization/SchemaJsonFileLocater";
import { FileSchemaKey } from "../source/Deserialization/SchemaFileLocater";
import { SchemaContext } from "../source/Context";
import { assert } from "chai";
import { ECObjectsError, ECObjectsStatus, SchemaKey, SchemaMatchType, ECVersion } from "../source";
import * as fs from "fs";
import * as sinon from "sinon";

describe("SchemaJsonFileLocater tests: ", () => {
  const paths: string[] = [];
  let locater: SchemaJsonFileLocater;
  let context: SchemaContext;

  beforeEach(() => {
    const srcName = __dirname + "\\assets\\";
    paths.push(srcName);
    locater = new SchemaJsonFileLocater();
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("loadSchema from file succeeds", async () => {
    // Arrange
    const schemaKey = new SchemaKey("SchemaA");

    // Act
    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Latest);

    // Assert
    assert.isDefined(schema);
    assert.equal(schema!.schemaKey.name, "SchemaA");
    assert.equal(schema!.schemaKey.version.toString(), "1.1.1");
  });

  it("loadSchema called twice, same Schema object", async () => {
    // Arrange
    const schemaKey = new SchemaKey("SchemaA");

    // Act
    const locater1 = await locater.getSchema(schemaKey, SchemaMatchType.Latest);
    const locater2 = await locater.getSchema(schemaKey, SchemaMatchType.Latest);
    const context1 = await context.getSchema(schemaKey, SchemaMatchType.Latest);
    const context2 = await context.getSchema(schemaKey, SchemaMatchType.Latest);

    // Assert
    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.equal(context1, context2);
  });

  it("loadSchema from file, not found, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("DoesNotExist");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema name, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("BadSchemaName");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema version, throws", async () => {
    // Arrange
    const schemaKey = new SchemaKey("BadSchemaVersion");

    // Act / Assert
    try {
      await locater.getSchema(schemaKey, SchemaMatchType.Latest);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    // Arrange
    locater.addSchemaSearchPaths(paths);

    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as FileSchemaKey;
    assert.equal(key.name, "SchemaA");
    assert.equal(key.version.toString(), "1.1.1");
  });

  it("getSchema, JsonSchemaKey fileName exists", async () => {
    // Arrange
    locater.addSchemaSearchPaths(paths);

    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as FileSchemaKey;
    assert.isTrue(fs.existsSync(key.fileName));
  });

  it("getSchema, readFileSync returns undefined, 'latest' schema is skipped", async () => {
    // Arrange
    locater.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "readFileSync");
    stub.withArgs(sinon.match("SchemaC.04.00.04.ecschema.json")).returns(undefined);
    stub.callThrough();

    // Act
    const schema = await locater.getSchema(new SchemaKey("SchemaC", 4, 0, 4), SchemaMatchType.Latest);
    stub.restore();

    // Assert
    assert.deepEqual(schema!.schemaKey.version, new ECVersion(3, 3, 3));
  });

  it("getSchema, readFileSync returns undefined, match type exact, schema not found", async () => {
    // Arrange
    locater.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "readFileSync");
    stub.withArgs(sinon.match("SchemaC.03.03.01.ecschema.json")).returns(undefined);
    stub.callThrough();

    // Act
    const schema = await locater.getSchema(new SchemaKey("SchemaC", 3, 3, 1), SchemaMatchType.Exact);
    stub.restore();

    // Assert
    assert.isUndefined(schema);
  });

  it("getSchema, existsSync returns false, schema undefined.", async () => {
    // Arrange
    locater.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "existsSync");
    stub.withArgs(sinon.match("SchemaC.ecschema.json")).returns(false); // latest schema
    stub.callThrough();

    // Act
    const schema = await locater.getSchema(new SchemaKey("SchemaC", 3, 3, 3), SchemaMatchType.LatestReadCompatible);
    stub.restore();

    // Assert
    // Schema v.3.3.3 is skipped over
    assert.isUndefined(schema);
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 2), SchemaMatchType.Exact);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest, succeeds", async () => {
    // Act
    locater.addSchemaSearchPaths(paths);
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "2.0.2");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    // Act
    locater.addSchemaSearchPaths(paths);
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    // Act
    locater.addSchemaSearchPaths(paths);
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    // Act
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isUndefined(stub);
  });
});
