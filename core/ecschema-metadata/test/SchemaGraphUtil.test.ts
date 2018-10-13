/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import SchemaXmlFileLocater from "./../src/Deserialization/SchemaXmlFileLocater";
import { SchemaMatchType } from "./../src/ECObjects";
import SchemaContext from "./../src/Context";
import SchemaKey from "./../src/SchemaKey";
import Schema from "./../src/Metadata/Schema";
import SchemaGraphUtil from "./../src/Deserialization/SchemaGraphUtil";

describe("SchemaGraphUtil tests:", () => {
  const path = __dirname + "\\assets";
  const locator = new SchemaXmlFileLocater();
  locator.addSchemaSearchPath(path);
  const context = new SchemaContext();
  context.addLocater(locator);

  it("buildDependencyOrderedSchemaList succeeds", async () => {
    // Arrange
    const key = new SchemaKey("SchemaA", 1, 1, 1);
    const importSchema = await context.getSchema(key, SchemaMatchType.Exact);

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
