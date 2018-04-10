import { SchemaXmlFileLocater } from "../source/Deserialization/SchemaXmlFileLocater";
import { SchemaKey } from "../source";
import Schema from "../source/Metadata/Schema";
import { assert } from "chai";
import { SchemaGraphUtil } from "../source/Deserialization/SchemaGraphUtil";

describe("SchemaGraphUtil tests:", () => {
  const paths: string[] = [];
  const locator = new SchemaXmlFileLocater();

  beforeEach(() => {
    const srcName = __dirname + "\\assets\\";
    paths.push(srcName);
  });

  it("buildDependencyOrderedSchemaList succeeds", async () => {
    // Arrange
    const schemaPath = __dirname + "\\assets\\SchemaA.ecschema.xml";
    locator.addSchemaSearchPaths(paths);
    const importSchema = await locator.loadSchema(schemaPath);

    // ensure refs in wrong order for valid test
    await importSchema!.references[0];
    assert.equal(importSchema!.references[0].name, "SchemaC");
    assert.equal(importSchema!.references[1].name, "SchemaB");

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema!);

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
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.equal(schemaList.length, 2);
  });
});
