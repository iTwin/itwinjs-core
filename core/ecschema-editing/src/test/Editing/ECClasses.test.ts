/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier, ECObjectsError, EntityClass, Enumeration, EnumerationArrayProperty, EnumerationProperty, NavigationProperty,
  PrimitiveArrayProperty, PrimitiveProperty, PrimitiveType, RelationshipClass, RelationshipClassProps,
  RelationshipConstraintProps, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection,
  StructArrayProperty, StructClass, StructProperty, UnitSystem,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("ECClass tests", () => {
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

  it("should change name of class using SchemaEditor", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result1.itemKey!);
    const result2 = await testEditor.entities.setName(result1.itemKey!, "testEntity2");
    expect(result2).to.eql({});
    expect(testEntity?.name).to.eql("testEntity2");
  });

  it("try changing class name to invalid name, throws error", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    await expect(testEditor.entities.setName(result1.itemKey!, "123")).to.be.rejectedWith(ECObjectsError);
  });

  it("try changing class name to existing name in the schema, returns error", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    await testEditor.entities.create(testKey, "testEntity2", ECClassModifier.None);
    const result2 = await testEditor.entities.setName(result1.itemKey!, "testEntity2");
    expect(result2.errorMessage).to.eql(`An EC Class with the name testEntity2 already exists within the schema ${testKey.name}`);
  });

  describe("Property creation tests", () => {
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

    it("should successfully delete a PrimitiveProperty from class", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.class.key).to.eql(createResult.itemKey);
      expect(property.name).to.eql(createResult.propertyName);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      // Should get undefined since property has been deleted
      property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property).to.be.undefined;
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

    it("should successfully delete an EnumerationProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);
      let property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(await property.enumeration).to.eql(testEnum);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully create EnumerationArrayProperty from JSON prop", async () => {
      const enumJson = {
        name: "TestEnumeration",
        type: "string",
        isStrict: false,
        enumerators: [
          { name: "One", value: "first" },
          { name: "Two", value: "second" },
        ],
      };
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveArrayProperty",
        typeName: "TestSchema.TestEnumeration",
        minOccurs: 10,
        maxOccurs: 101,
      };
      const enumResults = await testEditor.enumerations.createFromProps(testKey, enumJson);
      const enumeration = await testEditor.schemaContext.getSchemaItem(enumResults.itemKey!) as Enumeration;
      const propResults = await testEditor.entities.createEnumerationArrayPropertyFromProps(entityKey, "TestProperty", enumeration, propertyJson);
      const property = await entity?.getProperty(propResults.propertyName!) as EnumerationArrayProperty;
      expect(await property.enumeration).to.eql(enumeration);
      expect(property.minOccurs).to.eql(10);
      expect(property.maxOccurs).to.eql(101);
    });

    it("should successfully delete EnumerationArrayProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const enumeration = new Enumeration(schema!, "TestEnumeration");
      const createResults = await testEditor.entities.createEnumerationArrayProperty(entityKey, "TestProperty", enumeration);
      let property = await entity?.getProperty(createResults.propertyName!) as EnumerationArrayProperty;
      expect(await property.enumeration).to.eql(enumeration);

      const delResults = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResults.itemKey).to.eql(entityKey);
      expect(delResults.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResults.propertyName!) as EnumerationArrayProperty;
      expect(property).to.be.undefined;
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

    it("should successfully delete a NavigationProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const relationship = new RelationshipClass(schema!, "TestRelationship");
      const createResult = await testEditor.entities.createNavigationProperty(entityKey, "TestProperty", relationship, StrengthDirection.Forward);
      let property = await entity?.getProperty(createResult.propertyName!) as NavigationProperty;
      expect(await property.relationshipClass).to.eql(relationship);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResult.propertyName!) as NavigationProperty;
      expect(property).to.be.undefined;
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

    it("should successfully delete a PrimitiveArrayProperty from class", async () => {
      const createResult = await testEditor.entities.createPrimitiveArrayProperty(entityKey, "TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty(createResult.propertyName!) as PrimitiveArrayProperty;
      expect(property.class.key).to.eql(createResult.itemKey);
      expect(property.name).to.eql(createResult.propertyName);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResult.propertyName!) as PrimitiveArrayProperty;
      expect(property).to.be.undefined;
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

    it("should successfully delete a StructProperty from class", async () => {
      const classResult = await testEditor.structs.create(testKey, "TestStruct");
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;
      const createResult = await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass);
      let property = await entity?.getProperty(createResult.propertyName!) as StructProperty;
      expect(property.structClass).to.eql(structClass);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResult.propertyName!) as StructProperty;
      expect(property).to.be.undefined;
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

    it("should successfully delete a StructArrayProperty from class", async () => {
      const classResult = await testEditor.structs.create(testKey, "TestStruct");
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;
      const createResult = await testEditor.entities.createStructArrayProperty(entityKey, "TestProperty", structClass);
      let property = await entity?.getProperty(createResult.propertyName!) as StructArrayProperty;
      expect(property.structClass).to.eql(structClass);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("TestProperty");

      property = await entity?.getProperty(createResult.propertyName!) as StructArrayProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type double to class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Double);
    });

    it("should successfully delete property type double from class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Double);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("prefix_TestProperty");

      property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type string to class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.String);
      const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.String);
    });

    it("should successfully delete property type string from class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.String);
      let property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.String);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("prefix_TestProperty");

      property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type date time to class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.DateTime);
      const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.DateTime);
    });

    it("should successfully delete property type date time from class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.DateTime);
      let property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.DateTime);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("prefix_TestProperty");

      property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type integer to class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Integer);
      const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Integer);
    });

    it("should successfully delete property type integer from class", async () => {
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Integer);
      let property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Integer);

      const delResult = await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");
      expect(delResult.itemKey).to.eql(entityKey);
      expect(delResult.propertyName).to.eql("prefix_TestProperty");

      property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully rename Entity property", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.name).to.eql(createResult.propertyName);

      await testEditor.entities.setPropertyName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).to.eql("TestProperty1");
    });

    it("should successfully rename property and all property overrides", async () => {
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
      const childResult = await testEditor.entities.create(testKey, "testEntityChild", ECClassModifier.None, "testLabel", baseClassKey);
      const grandChildResult = await testEditor.entities.create(testKey, "testEntityGrandChild", ECClassModifier.None, "testLabel", childResult.itemKey);

      await testEditor.entities.createPrimitiveProperty(baseClassKey, "TestPropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(childResult.itemKey!, "TestPropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(grandChildResult.itemKey!, "TestPropertyName", PrimitiveType.Double);

      const childEntity = await (await testEditor.getSchema(testKey))!.getItem<EntityClass>("testEntityChild");
      const grandChildEntity = await (await testEditor.getSchema(testKey))!.getItem<EntityClass>("testEntityGrandChild");

      const childProperty = await childEntity?.getProperty("TestPropertyName") as PrimitiveProperty;
      const grandChildProperty = await grandChildEntity?.getProperty("TestPropertyName") as PrimitiveProperty;

      const result = await testEditor.entities.setPropertyName(baseClassKey, "TestPropertyName", "NewPropertyName");

      expect(result).to.eql({ itemKey: baseClassKey, propertyName: "NewPropertyName" });
      expect(childProperty.fullName).to.eql("testEntityChild.NewPropertyName");
      expect(grandChildProperty.fullName).to.eql("testEntityGrandChild.NewPropertyName");
    });

    it("try renaming a non-existent property in the class, returns error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);

      const result = await testEditor.entities.setPropertyName(entityKey, "TestProperty2", "TestProperty3");

      expect(result.errorMessage).to.eql(`An ECProperty with the name TestProperty2 could not be found in the class ${entityKey.fullName}.`);
    });

    it("try renaming property to existing name in class, returns error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty2", PrimitiveType.Double);

      const result = await testEditor.entities.setPropertyName(entityKey, "TestProperty", "TestProperty2");

      expect(result.errorMessage).to.eql(`An ECProperty with the name TestProperty2 already exists in the class ${entityKey.name}.`);
    });

    it("try renaming property to existing name in base class, returns error.", async () => {
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
      const result = await testEditor.entities.create(testKey, "testEntityChild", ECClassModifier.None, "testLabel", baseClassKey);

      await testEditor.entities.createPrimitiveProperty(baseClassKey, "BasePropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(result.itemKey!, "ChildPropertyName", PrimitiveType.Double);

      const result2 = await testEditor.entities.setPropertyName(result.itemKey!, "ChildPropertyName", "BasePropertyName");

      expect(result2.errorMessage).to.eql(`An ECProperty with the name BasePropertyName already exists in the class ${baseClassKey.name}.`);
    });

    it("try renaming property to existing name in child class, returns error.", async () => {
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
      const result = await testEditor.entities.create(testKey, "testEntityChild", ECClassModifier.None, "testLabel", baseClassKey);

      await testEditor.entities.createPrimitiveProperty(baseClassKey, "BasePropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(result.itemKey!, "ChildPropertyName", PrimitiveType.Double);

      const result2 = await testEditor.entities.setPropertyName(baseClassKey, "BasePropertyName", "ChildPropertyName");

      expect(result2.errorMessage).to.eql(`An ECProperty with the name ChildPropertyName already exists in the class ${result.itemKey!.fullName}.`);
    });

    it("CustomAttribute defined in same schema, instance added to class successfully.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await testSchema.getItem<EntityClass>("testEntity");

      const result = await testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "testCustomAttribute" });

      expect(result).to.eql({});
      expect(testClass!.customAttributes && testClass!.customAttributes.has("testCustomAttribute")).to.be.true;
    });

    it("CustomAttribute defined in different schema, instance added to class successfully.", async () => {
      const schemaAJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SchemaA",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
        },
        references: [
          {
            name: "SchemaB",
            version: "1.2.3",
          },
        ],
      };

      const schemaBJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SchemaB",
        version: "1.2.3",
        alias: "vs",
        items: {
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      await Schema.fromJson(schemaBJson, context);
      const schemaA = await Schema.fromJson(schemaAJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await schemaA.getItem<EntityClass>("testEntity");

      const result = await testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "SchemaB.testCustomAttribute" });

      expect(result).to.eql({});
      expect(testClass!.customAttributes && testClass!.customAttributes.has("SchemaB.testCustomAttribute")).to.be.true;
    });

    it("Adding CustomAttribute to a class that does not exist fails as expected.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const badKey = new SchemaItemKey("BadClass", testSchema.schemaKey);

      const result = await testEditor.entities.addCustomAttribute(badKey, { className: "testCustomAttribute" });
      expect(result.errorMessage).to.eql(`Class ${badKey.name} was not found in schema ${testSchema.schemaKey.toString(true)}`);
    });

    it("CustomAttribute defined in same schema, instance added to property successfully.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testProperty",
              },
            ],
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await testSchema.getItem<EntityClass>("testEntity");
      const property = await testClass?.getProperty("testProperty");

      const result = await testEditor.entities.addCustomAttributeToProperty(testClass?.key as SchemaItemKey, "testProperty", { className: "testCustomAttribute" });

      expect(result).to.eql({});
      expect(property!.customAttributes && property!.customAttributes.has("testCustomAttribute")).to.be.true;
    });

    it("CustomAttribute defined in different schema, instance added property successfully.", async () => {
      const schemaAJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SchemaA",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testProperty",
              },
            ],
          },
        },
        references: [
          {
            name: "SchemaB",
            version: "1.2.3",
          },
        ],
      };

      const schemaBJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SchemaB",
        version: "1.2.3",
        alias: "vs",
        items: {
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      await Schema.fromJson(schemaBJson, context);
      const schemaA = await Schema.fromJson(schemaAJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await schemaA.getItem<EntityClass>("testEntity");
      const property = await testClass?.getProperty("testProperty");

      const result = await testEditor.entities.addCustomAttributeToProperty(testClass?.key as SchemaItemKey, "testProperty", { className: "SchemaB.testCustomAttribute" });

      expect(result).to.eql({});
      expect(property!.customAttributes && property!.customAttributes.has("SchemaB.testCustomAttribute")).to.be.true;
    });

    it("Adding a CustomAttribute to a property with bad SchemaItemKey fails as expected.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testProperty",
              },
            ],
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const badKey = new SchemaItemKey("BadClass", testSchema.schemaKey);

      const result = await testEditor.entities.addCustomAttributeToProperty(badKey, "testProperty", { className: "testCustomAttribute" });
      expect(result.errorMessage).to.eql(`Class ${badKey.name} was not found in schema ${testSchema.schemaKey.toString(true)}`);
    });

    it("Adding a CustomAttribute to a non-existent property fails as expected.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testProperty",
              },
            ],
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await testSchema.getItem<UnitSystem>("testEntity");

      const result = await testEditor.entities.addCustomAttributeToProperty(testClass?.key as SchemaItemKey, "badPropertyName", { className: "testCustomAttribute" });
      expect(result.errorMessage).to.eql(`Property with the name badPropertyName could not be found in the class ${testClass?.key.fullName}.`);
    });

    it("Adding a CustomAttribute to a class with an unsupported SchemaItemType fails as expected.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        items: {
          testUnitSystem: {
            schemaItemType: "UnitSystem",
          },
          testCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
        },
      };

      context = new SchemaContext();
      testSchema = await Schema.fromJson(schemaJson, context);
      testEditor = new SchemaContextEditor(context);
      const testClass = await testSchema.getItem<UnitSystem>("testUnitSystem");

      const result = await testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "testCustomAttribute" });
      expect(result.errorMessage).to.eql("Schema item type not supported");
    });
  });
});
