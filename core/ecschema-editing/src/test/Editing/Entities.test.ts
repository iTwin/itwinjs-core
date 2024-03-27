/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import {
  ECClassModifier, ECVersion, EntityClass, EntityClassProps, NavigationProperty, NavigationPropertyProps, RelationshipClass, Schema, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

const expect = chai.expect;
chai.use(chaiAsPromised);

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

  it("should create a new entity class with a base class from different schema", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      items: {
        testEntityBase: {
          schemaItemType: "EntityClass",
          label: "ExampleEntity",
          description: "An example entity class.",
        },
      },
    };

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);
    const baseClassKey = new SchemaItemKey("testEntityBase", refSchema.schemaKey);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseClassKey));
    expect(testEntity?.label).to.eql("testLabel");
  });

  it("try creating a new entity class with base class from unknown schema, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey);
    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${badSchemaKey.toString(true)} not found in context`);
  });

  it("try creating a new entity class with a base class that cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey);
    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
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

  it("should create a new navigation property from NavigationPropertyProps", async () => {
    const testEntityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    const testRelRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const navProps: NavigationPropertyProps = {
      name: "testProperty",
      type: "NavigationProperty",
      relationshipName: "testSchema.testRelationship",
      direction: "Forward",
    };

    const entityClass = await testEditor.schemaContext.getSchemaItem(testEntityRes.itemKey!) as EntityClass;
    const relClass = await testEditor.schemaContext.getSchemaItem(testRelRes.itemKey!) as RelationshipClass;

    const result = await testEditor.entities.createNavigationPropertyFromProps(entityClass.key, navProps);
    const navProperty = await entityClass.getProperty(result.propertyName!) as NavigationProperty;
    expect(await navProperty.relationshipClass).to.eql(relClass);
    expect(navProperty.direction).to.eql(StrengthDirection.Forward);
  });

  it("should add base class to entity class with undefined base class.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes.itemKey);
    await testEditor.entities.setBaseClass(result.itemKey!, testEntityBaseRes.itemKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));
  });

  it("should add base class to existing entity class where base class is from a different schema", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      items: {
        testEntityBase: {
          schemaItemType: "EntityClass",
          label: "ExampleEntity",
          description: "An example entity class.",
        },
      },
    };

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);
    const baseClassKey = new SchemaItemKey("testEntityBase", refSchema.schemaKey);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    await testEditor.entities.setBaseClass(result.itemKey!, baseClassKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseClassKey));
  });

  it("should change base class of existing entity class with different base class.", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      items: {
        testEntityBase: {
          schemaItemType: "EntityClass",
          label: "ExampleEntity",
          description: "An example entity class.",
        },
      },
    };

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);
    const firstEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", firstEntityBaseRes.itemKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(firstEntityBaseRes.itemKey!));

    const secondBaseClassKey = new SchemaItemKey("testEntityBase", refSchema.schemaKey);
    await testEditor.entities.setBaseClass(result.itemKey!, secondBaseClassKey);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(secondBaseClassKey));
  });

  it("should remove base class from existing entity class.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes.itemKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
    expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));

    await testEditor.entities.setBaseClass(result.itemKey!, undefined);
    expect(await testEntity?.baseClass).to.eql(undefined);
  });

  it("try adding base class with unknown schema to existing entity class, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    const result = await testEditor.entities.setBaseClass(entityResult.itemKey!, baseClassKey);
    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${badSchemaKey.toString(true)} not found in context`);
  });

  it("try adding base class to an existing entity class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const createResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    const addResult = await testEditor.entities.setBaseClass(createResult.itemKey!, baseClassKey);
    expect(addResult).to.not.be.undefined;
    expect(addResult.errorMessage).to.not.be.undefined;
    expect(addResult.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
  });

  it("try adding base class to entity class with different SchemaItemType, return error", async () => {
    const unitSystemProps = {
      name: "testUnitSystem",
      description: "test description",
      label: "testDec",
    };
    const unitResult = await testEditor.unitSystems.createFromProps(testKey, unitSystemProps);
    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    const result = await testEditor.entities.setBaseClass(entityResult.itemKey!, unitResult.itemKey);

    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`${unitResult.itemKey?.fullName} is not of type Entity Class.`);
  });
});
