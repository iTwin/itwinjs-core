import { ECClassModifier, EntityClass, Enumeration, EnumerationProperty, KindOfQuantity, PrimitiveArrayProperty, PrimitiveProperty, PrimitiveType, PropertyCategory, Schema, SchemaContext, SchemaItemKey, SchemaKey, StructClass, UnitSystem } from "@itwin/ecschema-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContextEditor } from "../../ecschema-editing";
import { ECEditingStatus } from "../../Editing/Exception";

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
    testKey = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
    entityKey = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    entity = await testEditor.schemaContext.getSchemaItem(entityKey);
    structKey = await testEditor.structs.create(testKey, "testStruct");
  });

  describe("Base property editing tests", () => {
    it("should successfully rename class property", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.name).toEqual("TestProperty");

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).toEqual("TestProperty1");
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
      const grandChildResult = await testEditor.entities.create(testKey, "testEntityGrandChild", ECClassModifier.None, "testLabel", childResult);

      await testEditor.entities.createPrimitiveProperty(baseClassKey, "TestPropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(childResult, "TestPropertyName", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(grandChildResult, "TestPropertyName", PrimitiveType.Double);

      const childEntity = await (await testEditor.getSchema(testKey)).getItem<EntityClass>("testEntityChild");
      const grandChildEntity = await (await testEditor.getSchema(testKey)).getItem<EntityClass>("testEntityGrandChild");

      const childProperty = await childEntity?.getProperty("TestPropertyName") as PrimitiveProperty;
      const grandChildProperty = await grandChildEntity?.getProperty("TestPropertyName") as PrimitiveProperty;

      await testEditor.entities.properties.setName(baseClassKey, "TestPropertyName", "NewPropertyName");

      expect(childProperty.fullName).toEqual("testEntityChild.NewPropertyName");
      expect(grandChildProperty.fullName).toEqual("testEntityGrandChild.NewPropertyName");
    });

    it("try editing a property of where schema cannot be located, rejected with error.", async () => {
      const badKey = new SchemaItemKey("className", new SchemaKey("badSchema", testKey.version));

      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `Schema Key ${badKey.schemaKey.toString(true)} could not be found in the context.`,
          errorNumber: ECEditingStatus.SchemaNotFound,
        },
      });
    });

    it("try editing a property of a non-existent class, rejected with error.", async () => {
      const badKey = new SchemaItemKey("badName", testKey);

      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `EntityClass ${badKey.fullName} could not be found in the schema ${testKey.name}.`,
          errorNumber: ECEditingStatus.SchemaItemNotFound,
        },
      });
    });

    it("try editing a non-existent property in the class, rejected with error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty2", "TestProperty3")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `An ECProperty with the name TestProperty2 could not be found in the class ${entityKey.fullName}.`,
          errorNumber: ECEditingStatus.PropertyNotFound,
        },
      });
    });

    it("try renaming property to existing name in class, returns error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty2", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty2")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `An ECProperty with the name TestProperty2 already exists in the class ${entityKey.fullName}.`,
          errorNumber: ECEditingStatus.PropertyAlreadyExists,
        },
      });
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
      await testEditor.entities.createPrimitiveProperty(result, "ChildPropertyName", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(result, "ChildPropertyName", "BasePropertyName")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `An ECProperty with the name BasePropertyName already exists in the class ${baseClassKey.fullName}.`,
          errorNumber: ECEditingStatus.PropertyAlreadyExists,
        },
      });
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
      await testEditor.entities.createPrimitiveProperty(result, "ChildPropertyName", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(baseClassKey, "BasePropertyName", "ChildPropertyName")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `An ECProperty with the name ChildPropertyName already exists in the class ${result.fullName}.`,
          errorNumber: ECEditingStatus.PropertyAlreadyExists,
        },
      });
    });

    it("should successfully rename class property", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.name).toEqual("TestProperty");

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).toEqual("TestProperty1");
    });

    it("should successfully set property description", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.description).toEqual(undefined);

      await testEditor.entities.properties.setDescription(entityKey, "TestProperty", "test  description");

      expect(property.description).toEqual("test  description");
    });

    it("should successfully set property label", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.label).toEqual(undefined);

      await testEditor.entities.properties.setLabel(entityKey, "TestProperty", "test  label");

      expect(property.label).toEqual("test  label");
    });

    it("should successfully set property isReadOnly", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.isReadOnly).toEqual(false);

      await testEditor.entities.properties.setIsReadOnly(entityKey, "TestProperty", true);

      expect(property.isReadOnly).toEqual(true);
    });

    it("should successfully set property priority", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.priority).toEqual(0);

      await testEditor.entities.properties.setPriority(entityKey, "TestProperty", 1);

      expect(property.priority).toEqual(1);
    });

    it("should successfully add category to property", async () => {
      const catResult = await testEditor.propertyCategories.create(testKey, "testCategory", 2);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);
      await testEditor.entities.properties.setCategory(entityKey, "testProperty", catResult);

      const property = await entity?.getProperty("testProperty") as PrimitiveProperty;
      const category = await testEditor.schemaContext.getSchemaItem(catResult) as PropertyCategory;
      expect(await property.category).toEqual(category);
    });

    it("try setting property category to a different type, throws error", async () => {
      const notACategory = await testEditor.entities.create(testKey, "notACategory", ECClassModifier.None);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setCategory(entityKey, "testProperty", notACategory)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetCategory,
        innerError: {
          message: `Expected ${notACategory.fullName} to be of type PropertyCategory.`,
          errorNumber: ECEditingStatus.InvalidSchemaItemType,
        },
      });
    });

    it("try setting property category to an unknown category, throws error", async () => {
      const unknownCategory = new SchemaItemKey("unknownCategory", testKey);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setCategory(entityKey, "testProperty", unknownCategory)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetCategory,
        innerError: {
          message: `PropertyCategory ${unknownCategory.fullName} could not be found in the schema ${testKey.name}.`,
          errorNumber: ECEditingStatus.SchemaItemNotFound,
        },
      });
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

      expect(property!.customAttributes && property!.customAttributes.has("testCustomAttribute")).toBe(true);
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

      expect(property!.customAttributes && property!.customAttributes.has("SchemaB.testCustomAttribute")).toBe(true);
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

      await expect(testEditor.entities.properties.addCustomAttribute(badKey, "testProperty", { className: "testCustomAttribute" })).rejects.toMatchObject({
        errorNumber: ECEditingStatus.AddCustomAttributeToProperty,
        innerError: {
          message: `EntityClass ${badKey.fullName} could not be found in the schema ${testSchema.schemaKey.name}.`,
          errorNumber: ECEditingStatus.SchemaItemNotFound,
        },
      });
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

      await expect(testEditor.entities.properties.addCustomAttribute(testClass?.key as SchemaItemKey, "badPropertyName", { className: "testCustomAttribute" })).rejects.toMatchObject({
        errorNumber: ECEditingStatus.AddCustomAttributeToProperty,
        innerError: {
          message: `An ECProperty with the name badPropertyName could not be found in the class ${testClass?.key.fullName}.`,
          errorNumber: ECEditingStatus.PropertyNotFound,
        },
      });
    });

    it("editing an entities property where the specified SchemaItemKey does not return an EntityClass, rejected with error", async () => {
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(structKey, "TestProperty", 1)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetMaxOccurs,
        innerError: {
          message: `Expected ${structKey.fullName} to be of type EntityClass.`,
          errorNumber: ECEditingStatus.InvalidSchemaItemType,
        },
      });
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

      await testEditor.entities.createPrimitiveArrayPropertyFromProps(entityKey, "TestProperty", PrimitiveType.Integer,propertyJson);
      const property = await entity?.getProperty("TestProperty") as PrimitiveArrayProperty;
      expect(property.minOccurs).toEqual(42);
      expect(property.maxOccurs).toEqual(55);

      await testEditor.entities.arrayProperties.setMinOccurs(entityKey, "TestProperty", 43);
      await testEditor.entities.arrayProperties.setMaxOccurs(entityKey, "TestProperty", 56);

      expect(property.minOccurs).toEqual(43);
      expect(property.maxOccurs).toEqual(56);
    });

    it("editing an array property attribute not belonging to the proper property type, rejected with error", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(entityKey, "TestProperty", 1)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetMaxOccurs,
        innerError: {
          message: `Expected property TestProperty to be of type ArrayProperty.`,
          errorNumber: ECEditingStatus.InvalidPropertyType,
        },
      });
    });
  });

  describe("Primitive property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.extendedTypeName).toEqual(undefined);

      await testEditor.entities.primitiveProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).toEqual("typeName");
    });

    it("should successfully set minLength", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.minLength).toEqual(undefined);

      await testEditor.entities.primitiveProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).toEqual(7);
    });

    it("should successfully set maxLength", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.maxLength).toEqual(undefined);

      await testEditor.entities.primitiveProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).toEqual(100);
    });

    it("should successfully set minValue", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.minValue).toEqual(undefined);

      await testEditor.entities.primitiveProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).toEqual(-1);
    });

    it("should successfully set maxValue", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.maxValue).toEqual(undefined);

      await testEditor.entities.primitiveProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).toEqual(1000);
    });

    it("editing a primitive property attribute not belonging to the proper property type, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.primitiveProperties.setMinValue(entityKey, "TestProperty", 1)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetMinValue,
        innerError: {
          message: `Expected property TestProperty to be of type PrimitiveProperty.`,
          errorNumber: ECEditingStatus.InvalidPropertyType,
        },
      });
    });
  });

  describe("Enumeration property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.extendedTypeName).toEqual(undefined);

      await testEditor.entities.enumerationProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).toEqual("typeName");
    });

    it("should successfully set minLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.minLength).toEqual(undefined);

      await testEditor.entities.enumerationProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).toEqual(7);
    });

    it("should successfully set maxLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.maxLength).toEqual(undefined);

      await testEditor.entities.enumerationProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).toEqual(100);
    });

    it("should successfully set minValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.minValue).toEqual(undefined);

      await testEditor.entities.enumerationProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).toEqual(-1);
    });

    it("should successfully set maxValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.maxValue).toEqual(undefined);

      await testEditor.entities.enumerationProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).toEqual(1000);
    });

    it("editing a enumeration property attribute not belonging to the proper property type, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.enumerationProperties.setName(entityKey, "TestProperty", "testName")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `Expected property TestProperty to be of type EnumerationProperty.`,
          errorNumber: ECEditingStatus.InvalidPropertyType,
        },
      });
    });
  });

  describe("Navigation property editing tests", () => {
    it("editing a property through navigationProperties that is not a NavigationProperty, rejected with error", async () =>  {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.navigationProperties.setName(entityKey, "TestProperty", "testName")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `Expected property TestProperty to be of type NavigationProperty.`,
          errorNumber: ECEditingStatus.InvalidPropertyType,
        },
      });
    });
  });

  describe("Struct property editing tests", () => {
    it("editing a property through structProperties that is not a StructProperty, rejected with error", async () =>  {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);
      await expect(testEditor.entities.structProperties.setName(entityKey, "TestProperty", "testName")).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetPropertyName,
        innerError: {
          message: `Expected property TestProperty to be of type StructProperty.`,
          errorNumber: ECEditingStatus.InvalidPropertyType,
        },
      });
    });
  });

  describe("Set KindOfQuantity tests", () => {
    let unitKey: SchemaItemKey;

    beforeEach(async () => {
      const phenomenonKey = await testEditor.phenomenons.create(testKey, "testPhenomenon", "Units.LENGTH(2)");
      const unitSystemKey = await testEditor.unitSystems.create(testKey, "testUnitSystem");
      unitKey = await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey);
    });

    it("should successfully add KindOfQuantity to property", async () => {
      const koqResult = await testEditor.kindOfQuantities.create(testKey, "testKindOfQuantity", unitKey);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);
      await testEditor.entities.properties.setKindOfQuantity(entityKey, "testProperty", koqResult);

      const property = await entity?.getProperty("testProperty") as PrimitiveProperty;
      const koq = await testEditor.schemaContext.getSchemaItem(koqResult) as KindOfQuantity;
      expect(await property.kindOfQuantity).toEqual(koq);
    });

    it("try setting property KindOfQuantity to a different type, throws error", async () => {
      const notAKindOfQuantity = await testEditor.entities.create(testKey, "notAKindOfQuantity", ECClassModifier.None);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setKindOfQuantity(entityKey, "testProperty", notAKindOfQuantity)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetKindOfQuantity,
        innerError: {
          message: `Expected ${notAKindOfQuantity.fullName} to be of type KindOfQuantity.`,
          errorNumber: ECEditingStatus.InvalidSchemaItemType,
        },
      });
    });

    it("try setting property KindOfQuantity to an unknown KindOfQuantity, throws error", async () => {
      const unknownKOQ = new SchemaItemKey("unknownKindOfQuantity", testKey);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setKindOfQuantity(entityKey, "testProperty", unknownKOQ)).rejects.toMatchObject({
        errorNumber: ECEditingStatus.SetKindOfQuantity,
        innerError: {
          message: `KindOfQuantity ${unknownKOQ.fullName} could not be found in the schema ${testKey.name}.`,
          errorNumber: ECEditingStatus.SchemaItemNotFound,
        },
      });
    });
  });
});
