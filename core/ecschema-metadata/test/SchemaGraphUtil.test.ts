/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { assert } from "chai";

import { SchemaXmlFileLocater } from "./../src/Deserialization/SchemaXmlFileLocater";
import { SchemaMatchType } from "./../src/ECObjects";
import { SchemaContext } from "./../src/Context";
import { SchemaKey } from "./../src/SchemaKey";
import { Schema } from "./../src/Metadata/Schema";
import { SchemaGraphUtil } from "./../src/Deserialization/SchemaGraphUtil";

describe("SchemaGraphUtil tests:", () => {
  const locator = new SchemaXmlFileLocater();
  locator.addSchemaSearchPath(path.join(__dirname, "Assets"));
  const context = new SchemaContext();
  context.addLocater(locator);

  it("buildDependencyOrderedSchemaList succeeds", async () => {
    // Arrange
    const key = new SchemaKey("SchemaA", 1, 1, 1);
    const importSchema = await context.getSchema(key, SchemaMatchType.Exact);

    // ensure refs in wrong order for valid test
    await importSchema!.references[0];
    assert.strictEqual(importSchema!.references[0].name, "SchemaC");
    assert.strictEqual(importSchema!.references[1].name, "SchemaB");

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema!);

    // Assert
    assert.strictEqual(schemaList.length, 4);
    assert.strictEqual(schemaList[0].name, "SchemaD");
    assert.strictEqual(schemaList[1].name, "SchemaC");
    assert.strictEqual(schemaList[2].name, "SchemaB");
    assert.strictEqual(schemaList[3].name, "SchemaA");
  });

  it("buildDependencyOrderedSchemaList with same schema references, contains schema once", () => {
    // Arrange
    const importSchema = new Schema(context, new SchemaKey("SchemaA", 1, 0, 0));
    const refSchema = new Schema(context, new SchemaKey("SchemaB", 1, 0, 0));
    importSchema.references.push(refSchema);
    importSchema.references.push(refSchema);

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.strictEqual(schemaList.length, 2);
  });
});
