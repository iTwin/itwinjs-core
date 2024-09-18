/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import {
  ECClassModifier, ECVersion, EntityClass, EntityClassProps, NavigationProperty, NavigationPropertyProps, RelationshipClass, Schema, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

describe("Entities tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a new entity class using a SchemaEditor", async () => {
    await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    expect((await schema?.getItem("testEntity"))?.schemaItemType).toBe(SchemaItemType.EntityClass);
  });

  it("should delete an entity class", async () => {
    await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    let entity = await schema?.getItem("testEntity");
    expect(entity?.schemaItemType).toEqual(SchemaItemType.EntityClass);

    const key = entity?.key as SchemaItemKey;
    await testEditor.entities.delete(key);

    // Should get undefined since class is deleted
    entity = await schema?.getItem("testEntity");
    expect(entity).toBeUndefined();
  });

  it("should not be able to delete entity class if it is not in schema", async () => {
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const className = "testEntity";
    const key = schema?.schemaKey as SchemaKey;
    const classKey = new SchemaItemKey(className, key);
    const entity = await schema?.getItem(className);
    expect(entity).toBeUndefined();

    await testEditor.entities.delete(classKey);
    expect(testEditor.schemaContext.getSchemaItemSync(classKey)).toBeUndefined();
  });

  it("should create a new entity class with a base class", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes));
    expect(testEntity?.label).toEqual("testLabel");
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

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseClassKey));
    expect(testEntity?.label).toEqual("testLabel");
  });

  it("try creating a new entity class with base class from unknown schema, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    await expect(testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Schema Key ${badSchemaKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try creating a new entity class with a base class that cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `EntityClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("should create a new entity class using EntityClassProps", async () => {
    const entityClassProps: EntityClassProps = {
      name: "testEntity",
      modifier: "abstract",
    };

    const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(testEntity?.modifier).toEqual(ECClassModifier.Abstract);
  });

  it("should create a new entity class using EntityClassProps with a base class provided.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const entityClassProps: EntityClassProps = {
      name: "testEntity",
      modifier: "abstract",
      baseClass: testEntityBaseRes.fullName, // Must be full name to reflect the key.
    };

    const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes));
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

    const entityClass = await testEditor.schemaContext.getSchemaItem(testEntityRes) as EntityClass;
    const relClass = await testEditor.schemaContext.getSchemaItem(testRelRes) as RelationshipClass;

    await testEditor.entities.createNavigationPropertyFromProps(entityClass.key, navProps);
    const navProperty = await entityClass.getProperty(navProps.name) as NavigationProperty;
    expect(await navProperty.relationshipClass).toEqual(relClass);
    expect(navProperty.direction).toEqual(StrengthDirection.Forward);
  });

  it("should add base class to entity class with undefined base class.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes);
    await testEditor.entities.setBaseClass(result, testEntityBaseRes);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes));
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
    await testEditor.entities.setBaseClass(result, baseClassKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseClassKey));
  });

  it("should change base class of existing entity class with different base class.", async () => {
    const refSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "RefSchema",
      version: "1.0.0",
      alias: "rs",
      items: {
        testEntityBase1: {
          schemaItemType: "EntityClass",
          label: "ExampleEntity",
          description: "An example entity class.",
        },
        testEntityBase2: {
          schemaItemType: "EntityClass",
          label: "ExampleEntity",
          description: "An example entity class.",
          baseClass: "RefSchema.testEntityBase1",
        },
      },
    };

    const refSchema = await Schema.fromJson(refSchemaJson, context);
    await testEditor.addSchemaReference(testKey, refSchema);
    const firstBaseClassKey = new SchemaItemKey("testEntityBase1", refSchema.schemaKey);
    const testEntityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", firstBaseClassKey);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(testEntityResult);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(firstBaseClassKey));

    const secondBaseClassKey = new SchemaItemKey("testEntityBase2", refSchema.schemaKey);
    await testEditor.entities.setBaseClass(testEntityResult, secondBaseClassKey);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(secondBaseClassKey));
  });

  it("should remove base class from existing entity class.", async () => {
    const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
    const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", testEntityBaseRes);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes));

    await testEditor.entities.setBaseClass(result, undefined);
    expect(await testEntity?.baseClass).toEqual(undefined);
  });

  it("try adding base class with unknown schema to existing entity class, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");

    await expect(testEditor.entities.setBaseClass(entityResult, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Schema Key ${badSchemaKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try adding base class to an existing entity class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const createResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    await expect(testEditor.entities.setBaseClass(createResult, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `EntityClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("try adding base class to entity class with different SchemaItemType, return error", async () => {
    const unitSystemProps = {
      name: "testUnitSystem",
      description: "test description",
      label: "testDec",
    };
    const unitResult = await testEditor.unitSystems.createFromProps(testKey, unitSystemProps);
    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    await expect(testEditor.entities.setBaseClass(entityResult, unitResult)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Expected ${unitResult.fullName} to be of type EntityClass.`,
        errorNumber: ECEditingStatus.InvalidSchemaItemType,
      },
    });
  });

  it("try adding base class to non-existing custom attribute class, returns error", async () => {
    const baseClassRes = await testEditor.entities.create(testKey, "testBaseClass", ECClassModifier.None, "testLabel");
    const entityKey = new SchemaItemKey("testEntityClass", testKey);

    await expect(testEditor.entities.setBaseClass(entityKey, baseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `EntityClass ${entityKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });

  it("try adding base class with unknown schema to existing entity class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const entityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");

    await expect(testEditor.entities.setBaseClass(entityRes, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Schema Key ${schemaKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try changing the entity base class to one that doesn't derive from, returns error", async () => {
    const baseClassRes = await testEditor.entities.create(testKey, "testBaseClass", ECClassModifier.None, "testLabel");
    const entityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassRes);

    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(entityRes);
    expect(await testEntity?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseClassRes));

    const newBaseClassRes = await testEditor.entities.create(testKey, "newBaseClass", ECClassModifier.None, "testLabel");
    await expect(testEditor.entities.setBaseClass(entityRes, newBaseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Base class ${newBaseClassRes.fullName} must derive from ${baseClassRes.fullName}.`,
        errorNumber: ECEditingStatus.InvalidBaseClass,
      },
    });
  });

  it("try creating entity class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.entities.create(badKey, "testEntity", ECClassModifier.None, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Schema Key ${badKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try creating entity class with unknown base class, throws error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel", baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `EntityClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("try creating entity with existing name, throws error", async () => {
    await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel");
    await expect(testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, "testLabel")).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `EntityClass testSchema.testEntity already exists in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNameAlreadyExists,
      },
    });
  });
});
