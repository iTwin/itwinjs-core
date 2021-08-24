/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier, EntityClass, Enumeration, EnumerationProperty, NavigationProperty,
  PrimitiveArrayProperty, PrimitiveProperty, PrimitiveType, RelationshipClass, RelationshipClassProps,
  RelationshipConstraintProps, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection,
  StructArrayProperty, StructClass, StructProperty,
} from "@bentley/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Property creation tests", () => {
  // Uses an entity class to create properties.
  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let entityKey: SchemaItemKey;
  let entity: EntityClass | undefined;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
    const entityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entityKey = entityRes.itemKey!;
    entity = await testEditor.schemaContext.getSchemaItem(entityKey);
  });

  it("should successfully create a PrimitiveProperty from a JSON prop", async () => {
    const propertyJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      typeName: "double",
      minLength: 2,
      maxLength: 4,
      minValue: 6,
      maxValue: 8,
      extendedTypeName: "SomeExtendedType",
    };
    const propResult = await testEditor.entities.createPrimitivePropertyFromProps(entityKey, "TestProperty", PrimitiveType.Double, propertyJson);
    const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
    expect(property.extendedTypeName).to.eql("SomeExtendedType");
    expect(property.minValue).to.eql(6);
    expect(property.maxValue).to.eql(8);
    expect(property.propertyType).to.eql(PrimitiveType.Double);
  });

  it("should successfully create an EnumerationProperty from a JSON prop", async () => {
    const enumJson = {
      name: "TestEnum",
      type: "int",
      isStrict: false,
      label: "SomeDisplayLabel",
      description: "A really long description...",
      enumerators: [
        { name: "SixValue", value: 6 },
        { name: "EightValue", value: 8, label: "An enumerator label" },
      ],
    };
    const propertyJson = {
      name: "TestProperty",
      type: "PrimitiveProperty",
      typeName: "TestSchema.TestEnum",
      minLength: 2,
      maxLength: 4,
      minValue: 6,
      maxValue: 8,
      extendedTypeName: "SomeExtendedType",
    };
    const enumResult = await testEditor.enumerations.createFromProps(testKey, enumJson);
    const enumeration = await testEditor.schemaContext.getSchemaItem(enumResult.itemKey!) as Enumeration;
    const propResult = await testEditor.entities.createEnumerationPropertyFromProps(entityKey, "TestProperty", enumeration,propertyJson);
    const property = await entity?.getProperty(propResult.propertyName!) as EnumerationProperty;
    expect(await property.enumeration).to.eql(enumeration);
  });

  it("should create a NavigationProperty", async () => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        SourceBaseEntity: {
          schemaItemType: "EntityClass",
        },
        TargetBaseEntity: {
          schemaItemType: "EntityClass",
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.SourceBaseEntity",
        },
        TestTargetEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.TargetBaseEntity",
        },
      },
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const sourceJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Source RoleLabel",
      abstractConstraint: "TestSchema.SourceBaseEntity",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
    };
    const targetJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Target RoleLabel",
      abstractConstraint: "TestSchema.TargetBaseEntity",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: sourceJson,
      target: targetJson,
    };
    context = new SchemaContext();
    testSchema = await Schema.fromJson(schemaJson, context);
    testEditor = new SchemaContextEditor(context);
    testKey = testSchema.schemaKey;
    const relationshipResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relationship = await testEditor.schemaContext.getSchemaItem(relationshipResult.itemKey!) as RelationshipClass;
    const propResult = await testEditor.relationships.createNavigationProperty(relationship.key, "TestProperty", relationship,"Forward");
    const navProperty = await relationship.getProperty(propResult.propertyName!) as NavigationProperty;
    expect(navProperty.direction).to.eql(StrengthDirection.Forward);
    expect(await navProperty.relationshipClass).to.eql(relationship);
  });

  it("should successfully create a PrimitiveArrayProperty from a JSON prop", async () => {
    const propertyJson = {
      name: "TestProperty",
      type: "PrimitiveArrayProperty",
      typeName: "int",
      minOccurs: 42,
      maxOccurs: 55,
    };

    const propResult = await testEditor.entities.createPrimitiveArrayPropertyFromProps(entityKey, "TestProperty", PrimitiveType.Integer,propertyJson);
    const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveArrayProperty;
    expect(property.minOccurs).to.eql(42);
    expect(property.maxOccurs).to.eql(55);
  });

  it("should successfully create a StructProperty from a JSON prop", async () => {
    const propertyJson = {
      name: "TestProperty",
      type: "StructProperty",
      typeName: "TestSchema.TestStruct",
    };
    const classResult = await testEditor.structs.create(testKey, "TestStruct");
    const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;
    const propResult = await testEditor.entities.createStructPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
    const property = await entity?.getProperty(propResult.propertyName!) as StructProperty;
    expect(property.structClass).to.eql(structClass);
  });

  it("should successfully create a StructArrayProperty from a JSON prop", async () => {
    const propertyJson = {
      name: "TestProperty",
      type: "StructArrayProperty",
      typeName: "TestSchema.TestStruct",
      minOccurs: 20,
      maxOccurs: 32,
    };
    const classResult = await testEditor.structs.create(testKey, "TestStruct");
    const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;
    const propResult = await testEditor.entities.createStructArrayPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
    const property = await entity?.getProperty(propResult.propertyName!) as StructArrayProperty;
    expect(property.structClass).to.eql(structClass);
    expect(property.minOccurs).to.eql(20);
    expect(property.maxOccurs).to.eql(32);
  });
});
