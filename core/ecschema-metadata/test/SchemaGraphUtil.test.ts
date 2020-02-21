/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { SchemaContext } from "./../src/Context";
import { SchemaKey } from "./../src/SchemaKey";
import { Schema, MutableSchema } from "./../src/Metadata/Schema";
import { SchemaGraphUtil } from "./../src/Deserialization/SchemaGraphUtil";

describe("SchemaGraphUtil tests:", () => {
  const context = new SchemaContext();

  it("buildDependencyOrderedSchemaList succeeds", async () => {
    // Arrange
    const schemaA = new Schema(context, new SchemaKey("SchemaA", 1, 0, 0), "A");
    const schemaB = new Schema(context, new SchemaKey("SchemaB", 2, 0, 0), "B");
    const schemaC = new Schema(context, new SchemaKey("SchemaC", 3, 0, 0), "C");
    const schemaD = new Schema(context, new SchemaKey("SchemaD", 4, 0, 0), "D");
    (schemaA as MutableSchema).addReferenceSync(schemaC);
    (schemaA as MutableSchema).addReferenceSync(schemaB);
    (schemaB as MutableSchema).addReferenceSync(schemaD);
    (schemaB as MutableSchema).addReferenceSync(schemaC);
    (schemaC as MutableSchema).addReferenceSync(schemaD);

    // ensure refs in wrong order for valid test
    assert.strictEqual(schemaA!.references[0].name, "SchemaC");
    assert.strictEqual(schemaA!.references[1].name, "SchemaB");
    assert.strictEqual(schemaB!.references[0].name, "SchemaD");
    assert.strictEqual(schemaB!.references[1].name, "SchemaC");

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(schemaA);

    // Assert
    assert.strictEqual(schemaList.length, 4);
    assert.strictEqual(schemaList[0].name, "SchemaD");
    assert.strictEqual(schemaList[1].name, "SchemaC");
    assert.strictEqual(schemaList[2].name, "SchemaB");
    assert.strictEqual(schemaList[3].name, "SchemaA");
  });

  it("buildDependencyOrderedSchemaList with same schema references, contains schema once", () => {
    // Arrange
    const importSchema = new Schema(context, new SchemaKey("SchemaA", 1, 0, 0), "A");
    const refSchema = new Schema(context, new SchemaKey("SchemaB", 1, 0, 0), "B");
    importSchema.references.push(refSchema);
    importSchema.references.push(refSchema);

    // Act
    const schemaList = SchemaGraphUtil.buildDependencyOrderedSchemaList(importSchema);

    // Assert
    assert.strictEqual(schemaList.length, 2);
  });
});
