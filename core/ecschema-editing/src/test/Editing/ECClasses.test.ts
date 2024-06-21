/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier, EntityClass, Enumeration, EnumerationArrayProperty, EnumerationProperty, NavigationProperty,
  PrimitiveArrayProperty, PrimitiveProperty, PrimitiveType, RelationshipClass, RelationshipClassProps,
  RelationshipConstraintProps, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection,
  StructArrayProperty, StructClass, StructProperty, UnitSystem,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

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
    testKey = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
    entityKey = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entity = await testEditor.schemaContext.getSchemaItem(entityKey);
  });

  it("should change name of class using SchemaEditor", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    let testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result1);
    await testEditor.entities.setName(result1, "testEntity2");
    const newItemKey = new SchemaItemKey("testEntity2", testKey);
    testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(newItemKey);
    expect(testEntity, "renamed EntityClass could not be found in schema").to.not.be.undefined;
    expect(testEntity?.name).to.eql("testEntity2");
  });

  it("try changing class name to invalid name, throws error", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    await expect(testEditor.entities.setName(result1, "123")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetClassName);
      expect(error).to.have.nested.property("innerError.message", `Could not rename class ${result1.fullName} because the specified name is not a valid ECName.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidECName);
    });
  });

  it("try changing class name to existing name in the schema, returns error", async () => {
    const result1 = await testEditor.entities.create(testKey, "testEntity1", ECClassModifier.None);
    await testEditor.entities.create(testKey, "testEntity2", ECClassModifier.None);
    await expect(testEditor.entities.setName(result1, "testEntity2")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetClassName);
      expect(error).to.have.nested.property("innerError.message", `EntityClass TestSchema.testEntity2 already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
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
      await testEditor.entities.createPrimitivePropertyFromProps(entityKey, "TestProperty", PrimitiveType.Double, propertyJson);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.extendedTypeName).to.eql("SomeExtendedType");
      expect(property.minValue).to.eql(6);
      expect(property.maxValue).to.eql(8);
      expect(property.propertyType).to.eql(PrimitiveType.Double);
    });

    it("should successfully delete a PrimitiveProperty from class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.name).to.eql("TestProperty");

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      // Should get undefined since property has been deleted
      property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
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
      const enumeration = await testEditor.schemaContext.getSchemaItem(enumResult) as Enumeration;
      await testEditor.entities.createEnumerationPropertyFromProps(entityKey, "TestProperty", enumeration,propertyJson);
      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(await property.enumeration).to.eql(enumeration);
    });

    it("should successfully delete an EnumerationProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);
      let property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(await property.enumeration).to.eql(testEnum);

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as EnumerationProperty;
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
      const enumeration = await testEditor.schemaContext.getSchemaItem(enumResults) as Enumeration;
      await testEditor.entities.createEnumerationArrayPropertyFromProps(entityKey, "TestProperty", enumeration, propertyJson);
      const property = await entity?.getProperty("TestProperty") as EnumerationArrayProperty;
      expect(await property.enumeration).to.eql(enumeration);
      expect(property.minOccurs).to.eql(10);
      expect(property.maxOccurs).to.eql(101);
    });

    it("should successfully delete EnumerationArrayProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const enumeration = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationArrayProperty(entityKey, "TestProperty", enumeration);
      let property = await entity?.getProperty("TestProperty") as EnumerationArrayProperty;
      expect(await property.enumeration).to.eql(enumeration);

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as EnumerationArrayProperty;
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
      const relationship = await testEditor.schemaContext.getSchemaItem(relationshipResult) as RelationshipClass;
      await testEditor.relationships.createNavigationProperty(relationship.key, "TestProperty", relationship,"Forward");
      const navProperty = await relationship.getProperty("TestProperty") as NavigationProperty;
      expect(navProperty.direction).to.eql(StrengthDirection.Forward);
      expect(await navProperty.relationshipClass).to.eql(relationship);
    });

    it("should successfully delete a NavigationProperty from class", async () => {
      const schema = await testEditor.getSchema(testKey);
      const relationship = new RelationshipClass(schema, "TestRelationship");
      await testEditor.entities.createNavigationProperty(entityKey, "TestProperty", relationship, StrengthDirection.Forward);
      let property = await entity?.getProperty("TestProperty") as NavigationProperty;
      expect(await property.relationshipClass).to.eql(relationship);

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as NavigationProperty;
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

      await testEditor.entities.createPrimitiveArrayPropertyFromProps(entityKey, "TestProperty", PrimitiveType.Integer,propertyJson);
      const property = await entity?.getProperty("TestProperty") as PrimitiveArrayProperty;
      expect(property.minOccurs).to.eql(42);
      expect(property.maxOccurs).to.eql(55);
    });

    it("should successfully delete a PrimitiveArrayProperty from class", async () => {
      await testEditor.entities.createPrimitiveArrayProperty(entityKey, "TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty("TestProperty") as PrimitiveArrayProperty;

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as PrimitiveArrayProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully create a StructProperty from a JSON prop", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      const classResult = await testEditor.structs.create(testKey, "TestStruct");
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult) as StructClass;
      await testEditor.entities.createStructPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
      const property = await entity?.getProperty("TestProperty") as StructProperty;
      expect(property.structClass).to.eql(structClass);
    });

    it("should successfully delete a StructProperty from class", async () => {
      const classResult = await testEditor.structs.create(testKey, "TestStruct");
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult) as StructClass;
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass);
      let property = await entity?.getProperty("TestProperty") as StructProperty;
      expect(property.structClass).to.eql(structClass);

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as StructProperty;
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
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult) as StructClass;
      await testEditor.entities.createStructArrayPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
      const property = await entity?.getProperty("TestProperty") as StructArrayProperty;
      expect(property.structClass).to.eql(structClass);
      expect(property.minOccurs).to.eql(20);
      expect(property.maxOccurs).to.eql(32);
    });

    it("should successfully delete a StructArrayProperty from class", async () => {
      const classResult = await testEditor.structs.create(testKey, "TestStruct");
      const structClass = await testEditor.schemaContext.getSchemaItem(classResult) as StructClass;
      await testEditor.entities.createStructArrayProperty(entityKey, "TestProperty", structClass);
      let property = await entity?.getProperty("TestProperty") as StructArrayProperty;
      expect(property.structClass).to.eql(structClass);

      await testEditor.entities.deleteProperty(entityKey, "TestProperty");

      property = await entity?.getProperty("TestProperty") as StructArrayProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type double to class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Double);
    });

    it("should successfully delete property type double from class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Double);
      let property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Double);

      await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");

      property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type string to class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.String);
      const property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.String);
    });

    it("should successfully delete property type string from class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.String);
      let property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.String);

      await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");

      property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type date time to class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.DateTime);
      const property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.DateTime);
    });

    it("should successfully delete property type date time from class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.DateTime);
      let property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.DateTime);

      await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");

      property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property).to.be.undefined;
    });

    it("should successfully add property type integer to class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Integer);
      const property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.name).to.eql("prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Integer);
    });

    it("should successfully delete property type integer from class", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "prefix_TestProperty", PrimitiveType.Integer);
      let property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property.fullName).to.eql("testEntity.prefix_TestProperty");
      expect(property.propertyType).to.eql(PrimitiveType.Integer);

      await testEditor.entities.deleteProperty(entityKey, "prefix_TestProperty");

      property = await entity?.getProperty("prefix_TestProperty") as PrimitiveProperty;
      expect(property).to.be.undefined;
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

      await testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "testCustomAttribute" });
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

      await testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "SchemaB.testCustomAttribute" });
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

      await expect(testEditor.entities.addCustomAttribute(badKey, { className: "testCustomAttribute" })).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("errorNumber", ECEditingStatus.AddCustomAttributeToClass);
        expect(error).to.have.nested.property("innerError.message", `EntityClass ValidSchema.BadClass could not be found in the schema ValidSchema.`);
        expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFound);
      });
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

      await expect(testEditor.entities.addCustomAttribute(testClass?.key as SchemaItemKey, { className: "testCustomAttribute" })).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("errorNumber", ECEditingStatus.AddCustomAttributeToClass);
        expect(error).to.have.nested.property("innerError.message", `Expected ${testClass?.fullName} to be of type EntityClass.`);
        expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidSchemaItemType);
      });
    });
  });
});
