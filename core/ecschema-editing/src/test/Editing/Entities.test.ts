/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier, EntityClass, EntityClassProps, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Entities tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a new entity class using a SchemaEditor", async () => {
    await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    expect((await schema?.getItem("testEntity"))?.schemaItemType).to.eql(SchemaItemType.EntityClass);
  });

  it("should delete an entity class", async () => {
    await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    let entity = await schema?.getItem("testEntity");
    expect(entity?.schemaItemType).to.eql(SchemaItemType.EntityClass);

    const key = entity?.key as SchemaItemKey;
    const delRes = await testEditor.entities.delete(key);
    expect(delRes.itemKey).to.eql(entity?.key);

    // Should get undefined since class is deleted
    entity = await schema?.getItem("testEntity");
    expect(entity).to.be.undefined;
  });

  it("should not be able to delete entity class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testEntity";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const entity = await schema?.getItem(className);
    expect(entity).to.be.undefined;

    const delRes = await testEditor.entities.delete(classKey);
    expect(delRes).to.eql({});
  });

  it("should create a new entity class with a base class", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes.itemKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));
    expect(testEntity?.label).to.eql("testLabel");
  });

  it("should create a new entity class using EntityClassProps", async () => {
    const entityClassProps: EntityClassProps = {
      name: "testEntity",
      modifier: "abstract",
    };

    const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(testEntity?.modifier).to.eql(ECClassModifier.Abstract);
  });

  it("should create a new entity class using EntityClassProps with a base class provided.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const entityClassProps: EntityClassProps = {
      name: "testEntity",
      modifier: "abstract",
      baseClass: testEntityBaseRes.itemKey?.fullName, // Must be full name to reflect the key.
    };

    const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));
  });
});
