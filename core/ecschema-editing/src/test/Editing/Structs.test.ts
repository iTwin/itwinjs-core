/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, ECVersion, Schema, SchemaContext, SchemaItemKey, SchemaKey, StructClass } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingError } from "../../Editing/Exception";

describe("Structs tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a new struct Class", async () => {
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    expect(testEditor.schemaContext.getSchemaItemSync(structResult)?.name).to.eql("testStruct");
  });

  it("should delete a struct class", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    const struct = await schema?.getItem("testStruct");

    const key = struct?.key as SchemaItemKey;
    await testEditor.structs.delete(key);

    expect(testEditor.schemaContext.getSchemaItemSync(structResult)).to.be.undefined;
  });

  it("should not be able to delete a struct class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testStruct";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const struct = await schema?.getItem(className);
    expect(struct).to.be.undefined;

    await testEditor.structs.delete(classKey);
    expect(testEditor.schemaContext.getSchemaItemSync(classKey)).to.be.undefined;
  });

  it("should add a base class to struct class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");

    await testEditor.structs.setBaseClass(structRes, baseClassRes);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes));
  });

  it("should change struct base class with class from superset of base class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes);
    const newBaseClassRes = await testEditor.structs.create(testKey, "newBaseClass", "newLabel", baseClassRes);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes));

    await testEditor.structs.setBaseClass(structRes, newBaseClassRes);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(newBaseClassRes));
  });

  it("should change struct base class with different base class from a different schema", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      items: {
        testStructBase1: {
          schemaItemType: "StructClass",
          label: "ExampleEntity",
          description: "An example entity class.",
        },
        testStructBase2: {
          schemaItemType: "StructClass",
          label: "ExampleStruct",
          description: "An example struct class.",
          baseClass: "RefSchema.testStructBase1",
        },
      },
    };

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);
    const firstBaseClassKey = new SchemaItemKey("testStructBase1", refSchema.schemaKey);
    const structResult = await testEditor.structs.create(testKey, "testStruct", "testLabel", firstBaseClassKey);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structResult);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(firstBaseClassKey));

    const newBaseClassKey = new SchemaItemKey("testStructBase2", refSchema.schemaKey);
    await testEditor.structs.setBaseClass(structResult, newBaseClassKey);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(newBaseClassKey));
  });

  it("should remove a base class from struct class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes));

    await testEditor.structs.setBaseClass(structRes, undefined);
    expect(await testStruct?.baseClass).to.eql(undefined);
  });

  it("try adding base class to struct class with different SchemaItemType, returns error", async () => {
    const baseClassRes = await testEditor.entities.create(testKey, "testBaseClass", ECClassModifier.None);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");
    await expect(testEditor.structs.setBaseClass(structRes, baseClassRes)).to.be.rejectedWith(ECEditingError, `${baseClassRes.fullName} is not of type StructClass.`);
  });

  it("try adding base class to a struct class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");
    await expect(testEditor.structs.setBaseClass(structRes, baseClassKey)).to.be.rejectedWith(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
  });

  it("try adding base class to non-existing struct class, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structKey =  new SchemaItemKey("testStruct", testKey);

    await expect(testEditor.structs.setBaseClass(structKey, baseClassRes)).to.be.rejectedWith(ECEditingError, `Class ${structKey.fullName} not found in schema context.`);
  });

  it("try adding base class with unknown schema to existing struct class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");

    await expect(testEditor.structs.setBaseClass(structRes, baseClassKey)).to.be.rejectedWith(ECEditingError, `Schema Key ${schemaKey.toString(true)} not found in context`);
  });

  it("try changing the struct base class to one that doesn't derive from, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes));

    const newBaseClassRes = await testEditor.structs.create(testKey, "newBaseClass");
    await expect(testEditor.structs.setBaseClass(structRes, newBaseClassRes)).to.be.rejectedWith(ECEditingError, `Base class ${newBaseClassRes.fullName} must derive from ${baseClassRes.fullName}.`);
  });

  it("try creating Struct class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.structs.create(badKey, "testStruct", "testLabel")).to.be.rejectedWith(Error, `Schema Key ${badKey.toString(true)} not found in context`);;
  });

  it("try creating Struct class with unknown base class, throws error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassKey)).to.be.rejectedWith(Error, `Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);;
  });

  it("try creating Struct with existing name, throws error", async () => {
    await testEditor.structs.create(testKey, "testStruct", "testLabel");
    await expect(testEditor.structs.create(testKey, "testStruct", "testLabel")).to.be.rejectedWith(Error, `Class testStruct already exists in the schema ${testKey.name}.`);
  });
});
