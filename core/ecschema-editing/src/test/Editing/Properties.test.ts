import { ECClassModifier, EntityClass, Enumeration, EnumerationProperty, PrimitiveArrayProperty, PrimitiveProperty, PrimitiveType, PropertyCategory, Schema, SchemaContext, SchemaItemKey, SchemaKey, StructClass, UnitSystem } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { SchemaContextEditor } from "../../ecschema-editing";

describe("Properties editing tests", () => {
  // Uses an entity class to create properties.
  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let entityKey: SchemaItemKey;
  let structKey: SchemaItemKey;
  let entity: EntityClass | undefined;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
    const entityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entityKey = entityRes.itemKey!;
    entity = await testEditor.schemaContext.getSchemaItem(entityKey);
    const structRes = await testEditor.structs.create(testKey, "testStruct");
    structKey = structRes.itemKey!;
  });

  describe("Base property editing tests", () => {
    it("should successfully rename class property", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.name).to.eql(createResult.propertyName);

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

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

      await testEditor.entities.properties.setName(baseClassKey, "TestPropertyName", "NewPropertyName");

      expect(childProperty.fullName).to.eql("testEntityChild.NewPropertyName");
      expect(grandChildProperty.fullName).to.eql("testEntityGrandChild.NewPropertyName");
    });

    it("try editing a property of where schema cannot be located, rejected with error.", async () => {
      const badKey = new SchemaItemKey("className", new SchemaKey("badSchema", testKey.version));
      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).to.be.rejectedWith(
        Error, `Schema Key badSchema.01.00.00 not found in context`);
    });

    it("try editing a property of a non-existent class, rejected with error.", async () => {
      const badKey = new SchemaItemKey("badName", testKey);
      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).to.be.rejectedWith(
        Error, `Class badName was not found in schema ${testKey.toString(true)}`);
    });

    it("try editing a non-existent property in the class, rejected with error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty2", "TestProperty3")).to.be.rejectedWith(
        Error, `An ECProperty with the name TestProperty2 could not be found in the class ${entityKey.fullName}.`);
    });

    it("try renaming property to existing name in class, returns error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty2", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty2")).to.be.rejectedWith(
        Error, `An ECProperty with the name TestProperty2 already exists in the class ${entityKey.name}.`);
    });

    it("try renaming property to existing name in base class, rejected with error.", async () => {
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

      await expect(testEditor.entities.properties.setName(result.itemKey!, "ChildPropertyName", "BasePropertyName")).to.be.rejectedWith(
        Error, `An ECProperty with the name BasePropertyName already exists in the class ${baseClassKey.name}.`);
    });

    it("try renaming property to existing name in child class, rejected with error.", async () => {
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

      await expect(testEditor.entities.properties.setName(baseClassKey, "BasePropertyName", "ChildPropertyName")).to.be.rejectedWith(
        Error, `An ECProperty with the name ChildPropertyName already exists in the class ${result.itemKey!.fullName}.`);
    });

    it("should successfully rename class property", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.name).to.eql(createResult.propertyName);

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).to.eql("TestProperty1");
    });

    it("should successfully set property description", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.description).to.eql(undefined);

      await testEditor.entities.properties.setDescription(entityKey, "TestProperty", "test  description");

      expect(property.description).to.eql("test  description");
    });

    it("should successfully set property label", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.label).to.eql(undefined);

      await testEditor.entities.properties.setLabel(entityKey, "TestProperty", "test  label");

      expect(property.label).to.eql("test  label");
    });

    it("should successfully set property isReadOnly", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.isReadOnly).to.eql(false);

      await testEditor.entities.properties.setIsReadOnly(entityKey, "TestProperty", true);

      expect(property.isReadOnly).to.eql(true);
    });

    it("should successfully set property priority", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.priority).to.eql(0);

      await testEditor.entities.properties.setPriority(entityKey, "TestProperty", 1);

      expect(property.priority).to.eql(1);
    });

    it("should successfully add category to property", async () => {
      const catResult = await testEditor.propertyCategories.create(testKey, "testCategory", 2);
      const propResult = await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);
      await testEditor.entities.properties.setCategory(entityKey, propResult.propertyName!, catResult.itemKey!);

      const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
      const category = await testEditor.schemaContext.getSchemaItem(catResult.itemKey!) as PropertyCategory;
      expect(await property.category).to.eql(category);
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

      await testEditor.entities.properties.addCustomAttribute(testClass?.key as SchemaItemKey, "testProperty", { className: "testCustomAttribute" });

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

      await testEditor.entities.properties.addCustomAttribute(testClass?.key as SchemaItemKey, "testProperty", { className: "SchemaB.testCustomAttribute" });

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

      await expect(testEditor.entities.properties.addCustomAttribute(badKey, "testProperty", { className: "testCustomAttribute" })).to.be.rejectedWith(
        Error, `Class ${badKey.name} was not found in schema ${testSchema.schemaKey.toString(true)}`);
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

      await expect(testEditor.entities.properties.addCustomAttribute(testClass?.key as SchemaItemKey, "badPropertyName", { className: "testCustomAttribute" })).to.be.rejectedWith(
        Error, `Property with the name badPropertyName could not be found in the class ${testClass?.key.fullName}.`);
    });

    it("editing an entities property where the specified SchemaItemKey does return an EntityClass, rejected with error", async () =>  {
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(structKey, "TestProperty", 1)).to.be.rejectedWith(Error, `The class ${structKey.fullName} is not an EntityClass.`);
    });
  });

  describe("Array property editing tests", () => {
    it("should successfully set array minOccurs/maxOccurs", async () => {
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

      await testEditor.entities.arrayProperties.setMinOccurs(entityKey, "TestProperty", 43);
      await testEditor.entities.arrayProperties.setMaxOccurs(entityKey, "TestProperty", 56);

      expect(property.minOccurs).to.eql(43);
      expect(property.maxOccurs).to.eql(56);
    });

    it("editing a array property attribute not belonging to the proper property type, rejected with error", async () =>  {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(entityKey, createResult.propertyName!, 1)).to.be.rejectedWith(Error, "The property TestProperty is not an ArrayProperty");
    });
  });

  describe("Primitive property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.extendedTypeName).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).to.eql("typeName");
    });

    it("should successfully set minLength", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.minLength).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).to.eql(7);
    });

    it("should successfully set maxLength", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.maxLength).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).to.eql(100);
    });

    it("should successfully set minValue", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.minValue).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).to.eql(-1);
    });

    it("should successfully set maxValue", async () => {
      const createResult = await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty(createResult.propertyName!) as PrimitiveProperty;
      expect(property.maxValue).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).to.eql(1000);
    });

    it("editing a primitive property attribute not belonging to the proper property type, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      const createResult = await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.primitiveProperties.setMinValue(entityKey, createResult.propertyName!, 1)).to.be.rejectedWith(Error, "The property TestProperty is not an PrimitiveProperty");
    });
  });

  describe("Enumeration property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property.extendedTypeName).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).to.eql("typeName");
    });

    it("should successfully set minLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property.minLength).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).to.eql(7);
    });

    it("should successfully set maxLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property.maxLength).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).to.eql(100);
    });

    it("should successfully set minValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property.minValue).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).to.eql(-1);
    });

    it("should successfully set maxValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty(createResult.propertyName!) as EnumerationProperty;
      expect(property.maxValue).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).to.eql(1000);
    });

    it("editing a enumeration property attribute not belonging to the proper property type, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      const createResult = await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.enumerationProperties.setMinValue(entityKey, createResult.propertyName!, 1)).to.be.rejectedWith(Error, "The property TestProperty is not an EnumerationProperty");
    });
  });

  describe("Navigation property editing tests", () => {
    it("editing a property through navigationProperties that is not a NavigationProperty, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      const createResult = await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.navigationProperties.setName(entityKey, createResult.propertyName!, "testName")).to.be.rejectedWith(Error, "The property TestProperty is not a NavigationProperty");
    });
  });

  describe("Struct property editing tests", () => {
    it("editing a property through structProperties that is not a StructProperty, rejected with error", async () =>  {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema!, "TestEnumeration");
      const createResult = await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);
      await expect(testEditor.entities.structProperties.setName(entityKey, createResult.propertyName!, "testName")).to.be.rejectedWith(Error, "The property TestProperty is not a StructProperty");
    });
  });
});
