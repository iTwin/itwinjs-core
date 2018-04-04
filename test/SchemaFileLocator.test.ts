import { SchemaXmlFileLocator, CandidateSchema } from "../source/Deserialization/SchemaXmlFileLocater";
import { SchemaKey, SchemaMatchType, ECObjectsError, ECObjectsStatus } from "../source";
import Schema from "../source/Metadata/Schema";
import { assert } from "chai";
import * as path from "path";

describe("SchemaXmlFileLocator tests:", () => {
  const paths: string[] = [];
  const locator = new SchemaXmlFileLocator();

  beforeEach(() => {
    const srcName = __dirname + "\\assets\\";
    paths.push(srcName);
  });

  it("get schema from file succeeds", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";

    // Act
    const stub = locator.getSchema(schemaPath);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub.schemaKey.name, "SchemaA");
    assert.equal(stub.schemaKey.version.toString(), "1.1.1");
  });

  it("get schema from file, not found, throws", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\DoesNotExist.ecschema.xml";

    // Act / Assert
    try {
      locator.getSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("get schema from file, bad schema tag, throws", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaTag.ecschema.xml";

    // Act / Assert
    try {
      locator.getSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("get schema from file, bad schema name tag, throws", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaNameTag.ecschema.xml";

    // Act / Assert
    try {
      locator.getSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("get schema from file, bad schema version tag, throws", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaVersionTag.ecschema.xml";

    // Act / Assert
    try {
      locator.getSchema(schemaPath);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("get schema from file, bad schema reference tag, throws", () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\BadSchemaRef.ecschema.xml";
    const dir = path.dirname(schemaPath);
    const schema = new CandidateSchema(schemaPath, dir, new SchemaKey("BadSchemaRef", 1, 0, 0));

    // Act / Assert
    try {
      locator.getSchemaReferenceKeys(schema);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.equal(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("locate schema, full version, succeeds", () => {
    // Act
    locator.addSchemaSearchPaths(paths);
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("locate schema, exact version, wrong minor, fails", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 1, 2), SchemaMatchType.Exact);

    // Assert
    assert.isUndefined(stub);
  });

  it("locate schema, latest, succeeds", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("locate schema, latest write compatible, succeeds", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("locate schema, latest write compatible, write version wrong, fails", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible);

    // Assert
    assert.isUndefined(stub);
  });

  it("locate schema, latest read compatible, succeeds", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isDefined(stub);
    assert.equal(stub!.schemaKey.name, "SchemaA");
    assert.equal(stub!.schemaKey.version.toString(), "1.1.1");
  });

  it("locate schema, latest read compatible, read version wrong, fails", () => {
    // Act
    const stub = locator.locateSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible);

    // Assert
    assert.isUndefined(stub);
  });

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

  it("buildDependencyOrderedSchemaList succeeds", () => {
    // Arrange
    locator.addSchemaSearchPaths(paths);
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";
    const importSchema = getSchemaList(schemaPath);
    // ensure refs in wrong order for valid test
    assert.equal(importSchema.references[0].name, "SchemaC");
    assert.equal(importSchema.references[1].name, "SchemaB");
    assert.equal(importSchema.references[2].name, "SchemaD");

    // Act
    const schemaList = locator.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.equal(schemaList.length, 4);
    assert.equal(schemaList[0].name, "SchemaD");
    assert.equal(schemaList[1].name, "SchemaC");
    assert.equal(schemaList[2].name, "SchemaB");
    assert.equal(schemaList[3].name, "SchemaA");
  });

  it("buildDependencyOrderedSchemaList with same schema references, contains schema once", () => {
    // Arrange
    const importSchema = new Schema(new SchemaKey("SchemaA", 1, 0, 0));
    const refSchema = new Schema(new SchemaKey("SchemaB", 1, 0, 0));
    importSchema.references.push(refSchema);
    importSchema.references.push(refSchema);

    // Act
    const schemaList = locator.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.equal(schemaList.length, 2);
  });

  function getSchemaList(schemaPath: string): Schema {
    const schema = locator.getSchema(schemaPath);
    createSchemaGraph(schema!);
    return schema;
  }

  function createSchemaGraph(schema: CandidateSchema) {
    const keys = locator.getSchemaReferenceKeys(schema);
    for (const key of keys) {
      const refSchema = locator.locateSchema(key, SchemaMatchType.LatestWriteCompatible);
      /// find it...
      schema.references.push(refSchema!);
      createSchemaGraph(refSchema!);
    }
  }
});
