/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, ECVersion, Schema, SchemaContext, SchemaItemKey, SchemaKey, StructClass } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Structs tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a new struct Class", async () => {
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    expect(testEditor.schemaContext.getSchemaItemSync(structResult.itemKey!)?.name).to.eql("testStruct");
  });

  it("should delete a struct class", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const structResult = await testEditor.structs.create(testKey, "testStruct");
    const struct = await schema?.getItem("testStruct");

    const key = struct?.key as SchemaItemKey;
    const delRes = await testEditor.structs.delete(key);
    expect(delRes.itemKey).to.eql(structResult.itemKey);

    expect(testEditor.schemaContext.getSchemaItemSync(structResult.itemKey!)).to.be.undefined;
  });

  it("should not be able to delete a struct class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testStruct";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const struct = await schema?.getItem(className);
    expect(struct).to.be.undefined;

    const delRes = await testEditor.structs.delete(classKey);
    expect(delRes).to.eql({});
  });

  it("should add a base class to struct class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");

    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, baseClassRes.itemKey);
    expect(result.errorMessage).to.be.undefined;

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes.itemKey!);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes.itemKey!));
  });

  it("should change struct base class with class from superset of base class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes.itemKey);
    const newBaseClassRes = await testEditor.structs.create(testKey, "newBaseClass", "newLabel", baseClassRes.itemKey);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes.itemKey!);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes.itemKey!));

    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.undefined;
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(newBaseClassRes.itemKey!));
  });

  it("should change struct base class with different base class from a different schema", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      references: [
        {
          name: "testSchema",
          version: "01.00.00",
        },
      ],
      items: {
        testBaseClass: {
          schemaItemType: "StructClass",
          baseClass: "testSchema.testBaseClass",
        },
      },
    };

    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes.itemKey);

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes.itemKey!);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes.itemKey!));

    const newBaseClassKey = new SchemaItemKey("testBaseClass", refSchema.schemaKey);
    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, newBaseClassKey);
    expect(result.errorMessage).to.be.undefined;
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(newBaseClassKey));
  });

  it("should remove a base class from struct class", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes.itemKey);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes.itemKey!);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes.itemKey!));

    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, undefined);
    expect(result.errorMessage).to.be.undefined;
    expect(await testStruct?.baseClass).to.eql(undefined);
  });

  it("try adding base class to struct class with different SchemaItemType, returns error", async () => {
    const baseClassRes = await testEditor.entities.create(testKey, "testBaseClass", ECClassModifier.None);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");
    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, baseClassRes.itemKey);

    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`${baseClassRes.itemKey?.fullName} is not of type Struct Class.`);
  });

  it("try adding base class to a struct class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");
    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, baseClassKey);

    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
  });

  it("try adding base class to non-existing struct class, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structKey =  new SchemaItemKey("testStruct", testKey);

    const result = await testEditor.structs.setBaseClass(structKey, baseClassRes.itemKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Struct Class ${structKey.fullName} not found in schema context.`);
  });

  it("try adding base class with unknown schema to existing struct class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel");

    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, baseClassKey);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${schemaKey.toString(true)} not found in context`);
  });

  it("try changing the base class of struct with one that is not in the existing base class superset, returns error", async () => {
    const baseClassRes = await testEditor.structs.create(testKey, "testBaseClass");
    const structRes = await testEditor.structs.create(testKey, "testStruct", "testLabel", baseClassRes.itemKey);

    const testStruct = await testEditor.schemaContext.getSchemaItem<StructClass>(structRes.itemKey!);
    expect(await testStruct?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem<StructClass>(baseClassRes.itemKey!));

    const newBaseClassRes = await testEditor.structs.create(testKey, "newBaseClass");
    const result = await testEditor.structs.setBaseClass(structRes.itemKey!, newBaseClassRes.itemKey);
    expect(result.errorMessage).to.be.not.undefined;
    expect(result.errorMessage).to.equal(`${newBaseClassRes.itemKey!.fullName} is not from the middle of a class hierarchy.`);
  });
});
