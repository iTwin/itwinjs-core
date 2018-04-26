import { SchemaXmlFileLocater, XmlSchemaKey } from "../source/Deserialization/SchemaXmlFileLocater";
import { SchemaKey, SchemaMatchType, ECObjectsError, ECObjectsStatus, ECVersion } from "../source";
import { assert } from "chai";
import * as fs from "fs";
import sinon = require("sinon");

describe("SchemaXmlFileLocater tests:", () => {
  const paths: string[] = [];
  let locator: SchemaXmlFileLocater;

  beforeEach(() => {
    const srcName = __dirname + "\\assets\\";
    paths.push(srcName);
    locator = new SchemaXmlFileLocater();
  });

  it("loadSchema from file succeeds", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";

    // Act
    const stub = await locator.loadSchema(schemaPath);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as XmlSchemaKey;
    assert.equal(key.name, "SchemaA");
    assert.equal(key.version.toString(), "1.1.1");
    assert.equal(key.fileName, schemaPath);
  });

  it("loadSchema called twice, same Schema object", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";

    // Act
    const stub1 = await locator.loadSchema(schemaPath);
    const stub2 = await locator.loadSchema(schemaPath);

    // Assert
    // Should be the same object (not constructed again), meaning
    // it was retrieved from cache.
    assert.equal(stub1, stub2);
  });

  it("loadSchema from file, not found, throws", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\DoesNotExist.ecschema.xml";

    // Act / Assert
    try {
      await locator.loadSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema tag, throws", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaTag.ecschema.xml";

    // Act / Assert
    try {
      await locator.loadSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema name tag, throws", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaNameTag.ecschema.xml";

    // Act / Assert
    try {
      await locator.loadSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema version tag, throws", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaVersionTag.ecschema.xml";

    // Act / Assert
    try {
      await locator.loadSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("get schema from file, bad schema reference tag, throws", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaRef.ecschema.xml";

    // Act / Assert
    try {
      await locator.loadSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);

    // Act
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as XmlSchemaKey;
    assert.equal(key.name, "SchemaA");
    assert.equal(key.version.toString(), "1.1.1");
  });

  it("getSchema, XmlSchemaKey fileName exists", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);

    // Act
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    const key = stub!.schemaKey as XmlSchemaKey;
    assert.isTrue(fs.existsSync(key.fileName));
  });

  it("getSchema, reference does not exist, throws.", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);

    // Act
    try {
      await locator.getSchema(new SchemaKey("RefDoesNotExist", 1, 1, 1), SchemaMatchType.Exact);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    // Assert
    assert.fail();
  });

  it("getSchema, readFileSync returns undefined, 'latest' schema is skipped", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "readFileSync");
    stub.withArgs(sinon.match("SchemaC.04.00.04.ecschema.xml")).returns(undefined);
    stub.callThrough();

    // Act
    const schema = await locator.getSchema(new SchemaKey("SchemaC", 4, 0, 4), SchemaMatchType.Latest);
    stub.restore();

    // Assert
    assert.deepEqual(schema!.schemaKey.version, new ECVersion(3, 3, 3));
  });

  it("getSchema, readFileSync returns undefined, match type exact, schema not found", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "readFileSync");
    stub.withArgs(sinon.match("SchemaC.03.03.01.ecschema.xml")).returns(undefined);
    stub.callThrough();

    // Act
    const schema = await locator.getSchema(new SchemaKey("SchemaC", 3, 3, 1), SchemaMatchType.Exact);
    stub.restore();

    // Assert
    assert.isUndefined(schema);
  });

  it("getSchema, existsSync returns false, schema undefined.", async () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);
    const stub = sinon.stub(fs, "existsSync");
    stub.withArgs(sinon.match("SchemaC.ecschema.xml")).returns(false); // latest schema
    stub.callThrough();

    // Act
    const schema = await locator.getSchema(new SchemaKey("SchemaC", 3, 3, 3), SchemaMatchType.LatestReadCompatible);
    stub.restore();

    // Assert
    // Schema v.3.3.3 is skipped over
    assert.isUndefined(schema);
  });

  it("getSchema, references set", async () => {
    // Act
    locator.addSchemaSearchPaths(paths);
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);
    const schemaB = await locator.getSchema(new SchemaKey("SchemaB", 2, 2, 2), SchemaMatchType.Exact);
    const schemaC = await locator.getSchema(new SchemaKey("SchemaC", 3, 3, 3), SchemaMatchType.Exact);
    const schemaD = await locator.getSchema(new SchemaKey("SchemaD", 4, 4, 4), SchemaMatchType.Exact);

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
    locator.addSchemaSearchPaths(paths);
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 2, 0, 2), SchemaMatchType.Exact);
    const schemaB = await locator.getSchema(new SchemaKey("SchemaB", 3, 0, 3), SchemaMatchType.Exact);
    const schemaC = await locator.getSchema(new SchemaKey("SchemaC", 4, 0, 4), SchemaMatchType.Exact);
    const schemaD = await locator.getSchema(new SchemaKey("SchemaD", 5, 0, 5), SchemaMatchType.Exact);

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
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 2), SchemaMatchType.Exact);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest, succeeds", async () => {
    // Act
    locator.addSchemaSearchPaths(paths);
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "2.0.2");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    // Act
    locator.addSchemaSearchPaths(paths);
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    // Act
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isUndefined(stub);
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    // Act
    locator.addSchemaSearchPaths(paths);
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    // Act
    const stub = await locator.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isUndefined(stub);
  });

  it("get schema reference keys, schemaXml is undefined in XmlSchemaKey, reference still added.", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";
    const key = new XmlSchemaKey(new SchemaKey("SchemaA", 1, 1, 1), schemaPath);

    // Act
    const refs = locator.getSchemaReferenceKeys(key);

    // Assert
    assert.equal(refs.length, 2);
  });

  it("get schema reference keys, bad schema path, throws.", async () => {
    // Arrange
    const schemaPath = __dirname + "\\DoesNotExist";
    const key = new XmlSchemaKey(new SchemaKey("SchemaA", 1, 1, 1), schemaPath);

    // Act / Assert
    try {
      locator.getSchemaReferenceKeys(key);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  /*
  it("get schema reference keys, schema not found, throws", () => {
    // Arrange
    const schema = new CandidateSchema("DoesNotExist", "c:\\temp", new SchemaKey("SchemaA", 1, 1, 1));

    // Act / Assert
    try {
      locator.getSchemaReferenceKeys(schema!);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });
  */
});
