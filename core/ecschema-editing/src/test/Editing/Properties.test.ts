import {
  ECClass, ECClassModifier, EntityClass, Enumeration, EnumerationProperty, KindOfQuantity, PrimitiveArrayProperty,
  PrimitiveProperty, PrimitiveType, PropertyCategory, Schema, SchemaContext, SchemaItemKey, SchemaKey,
  StructClass, UnitSystem
} from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { SchemaContextEditor } from "../../ecschema-editing";
import { ECEditingStatus } from "../../Editing/Exception";
import { EditOptions } from "../../Editing/EditInfoObjects/EditOptions";
import { RenamePropertyEdit } from "../../Editing/EditInfoObjects/RenamePropertyEdit";
import { ISchemaEditInfo } from "../../Editing/EditInfoObjects/SchemaEditInfo";
import { SchemaEditType } from "../../Editing/SchemaEditType";
import { NumberAttributeEdit } from "../../Editing/EditInfoObjects/NumberAttributeEdit";
import { PropertyId } from "../../Editing/SchemaItemIdentifiers";

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
      expect(property.name).to.eql("TestProperty");

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).to.eql("TestProperty1");
    });

    it("cancel edit of property rename, property not renamed", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.name).to.eql("TestProperty");

      const beginEdit = async (changeInfo: ISchemaEditInfo): Promise<boolean> => {
        const renameInfo = changeInfo as RenamePropertyEdit;
        expect(renameInfo.editType).to.eq(SchemaEditType.SetPropertyName);
        expect(renameInfo.modifiedClass.schemaItemKey).to.deep.equal(entity?.key);
        expect(renameInfo.newPropertyName).to.eq("TestProperty1")
        expect(renameInfo.oldPropertyName).to.eq("TestProperty")
        return false;
      }
      const options = EditOptions.default;
      options.beginEditCallback = beginEdit;
      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1", options);

      expect(property.name).to.eql("TestProperty");

      testEditor.currentEditInfo
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

      await testEditor.entities.properties.setName(baseClassKey, "TestPropertyName", "NewPropertyName", EditOptions.includeDerived);

      expect(childProperty.fullName).to.eql("testEntityChild.NewPropertyName");
      expect(grandChildProperty.fullName).to.eql("testEntityGrandChild.NewPropertyName");
    });

    it("try editing a property of where schema cannot be located, rejected with error.", async () => {
      const badKey = new SchemaItemKey("className", new SchemaKey("badSchema", testKey.version));

      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.schemaKey.toString(true)} could not be found in the context.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaNotFound);
      });
    });

    it("try editing a property of a non-existent class, rejected with error.", async () => {
      const badKey = new SchemaItemKey("badName", testKey);

      await expect(testEditor.entities.properties.setName(badKey, "TestProperty", "TestProperty1")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `EntityClass ${badKey.fullName} could not be found in the schema ${testKey.name}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFound);
      });
    });

    it("try editing a non-existent property in the class, rejected with error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty2", "TestProperty3")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `An ECProperty with the name TestProperty2 could not be found in the class ${entityKey.fullName}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.PropertyNotFound);
      });
    });

    it("try renaming property to existing name in class, returns error.", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty2", PrimitiveType.Double);

      await expect(testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty2")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `An ECProperty with the name TestProperty2 already exists in the class ${entityKey.fullName}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.PropertyAlreadyExists);
      });
    });

    it("try renaming property to existing name in base class, override option not set, rejected with error.", async () => {
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

      await expect(testEditor.entities.properties.setName(result, "ChildPropertyName", "BasePropertyName")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `An ECProperty with the name BasePropertyName already exists in the class ${baseClassKey.fullName}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.PropertyAlreadyExists);
      });
    });

    it("try renaming property to existing name in base class, override option set, property override set properly.", async () => {
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

      const testClass = await testEditor.schemaContext.getSchemaItem<EntityClass>(result);
      const testProperty = await testClass!.getProperty("ChildPropertyName") as PrimitiveProperty;

      await testEditor.entities.properties.setName(result, "ChildPropertyName", "BasePropertyName", EditOptions.allowPropertyOverrides);

      expect(testProperty.name).to.eql("BasePropertyName");
    });

    it("try renaming property to existing name in child class, override option not set, rejected with error.", async () => {
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

      await expect(testEditor.entities.properties.setName(baseClassKey, "BasePropertyName", "ChildPropertyName")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `An ECProperty with the name ChildPropertyName already exists in the class ${result.fullName}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.PropertyAlreadyExists);
      });
    });

    it("try renaming property to existing name in child class, override option set, property renamed successfully.", async () => {
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
      const baseClass = await refSchema.getItem<ECClass>(baseClassKey.name);
      const property = await baseClass?.getProperty("BasePropertyName", true) as PrimitiveProperty;

      await testEditor.entities.properties.setName(baseClassKey, "BasePropertyName", "ChildPropertyName", EditOptions.allowPropertyOverrides);

      expect(property.name).to.eql("ChildPropertyName");
    });

    it("should successfully rename class property", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.name).to.eql("TestProperty");

      await testEditor.entities.properties.setName(entityKey, "TestProperty", "TestProperty1");

      expect(property.name).to.eql("TestProperty1");
    });

    it("should successfully set property description", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.description).to.eql(undefined);

      await testEditor.entities.properties.setDescription(entityKey, "TestProperty", "test  description");

      expect(property.description).to.eql("test  description");
    });

    it("should successfully set property label", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.label).to.eql(undefined);

      await testEditor.entities.properties.setLabel(entityKey, "TestProperty", "test  label");

      expect(property.label).to.eql("test  label");
    });

    it("should successfully set property isReadOnly", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.isReadOnly).to.eql(false);

      await testEditor.entities.properties.setIsReadOnly(entityKey, "TestProperty", true);

      expect(property.isReadOnly).to.eql(true);
    });

    it("should successfully set property priority", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.priority).to.eql(0);

      await testEditor.entities.properties.setPriority(entityKey, "TestProperty", 1);

      const changeInfo = testEditor.currentEditInfo[0] as NumberAttributeEdit;

      expect(changeInfo.editType).to.eql(SchemaEditType.SetPriority);
      expect(changeInfo.newValue).to.eql(1);
      expect(changeInfo.oldValue).to.eql(0);
      expect(changeInfo.propertyId).to.deep.equal(PropertyId.fromProperty(property));
      expect(property.priority).to.eql(1);
    });

    it("should successfully add category to property", async () => {
      const catResult = await testEditor.propertyCategories.create(testKey, "testCategory", 2);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);
      await testEditor.entities.properties.setCategory(entityKey, "testProperty", catResult);

      const property = await entity?.getProperty("testProperty") as PrimitiveProperty;
      const category = await testEditor.schemaContext.getSchemaItem(catResult) as PropertyCategory;
      expect(await property.category).to.eql(category);
    });

    it("try setting property category to a different type, throws error", async () => {
      const notACategory = await testEditor.entities.create(testKey, "notACategory", ECClassModifier.None);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setCategory(entityKey, "testProperty", notACategory)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetCategory);
        expect(error).to.have.nested.property("innerError.message", `Expected ${notACategory.fullName} to be of type PropertyCategory.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidSchemaItemType);
      });
    });

    it("try setting property category to an unknown category, throws error", async () => {
      const unknownCategory = new SchemaItemKey("unknownCategory", testKey);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setCategory(entityKey, "testProperty", unknownCategory)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetCategory);

        expect(error).to.have.nested.property("innerError.message", `PropertyCategory ${unknownCategory.fullName} could not be found in the schema ${testKey.name}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFound);
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

      await expect(testEditor.entities.properties.addCustomAttribute(badKey, "testProperty", { className: "testCustomAttribute" })).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.AddCustomAttributeToProperty);
        expect(error).to.have.nested.property("innerError.message", `EntityClass ${badKey.fullName} could not be found in the schema ${testSchema.schemaKey.name}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFound);
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

      await expect(testEditor.entities.properties.addCustomAttribute(testClass?.key as SchemaItemKey, "badPropertyName", { className: "testCustomAttribute" })).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.AddCustomAttributeToProperty);
        expect(error).to.have.nested.property("innerError.message", `An ECProperty with the name badPropertyName could not be found in the class ${testClass?.key.fullName}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.PropertyNotFound);
      });
    });

    it("editing an entities property where the specified SchemaItemKey does return an EntityClass, rejected with error", async () => {
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(structKey, "TestProperty", 1)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetMaxOccurs);
        expect(error).to.have.nested.property("innerError.message", `Expected ${structKey.fullName} to be of type EntityClass.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidSchemaItemType);
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

      await testEditor.entities.createPrimitiveArrayPropertyFromProps(entityKey, "TestProperty", PrimitiveType.Integer, propertyJson);
      const property = await entity?.getProperty("TestProperty") as PrimitiveArrayProperty;
      expect(property.minOccurs).to.eql(42);
      expect(property.maxOccurs).to.eql(55);

      await testEditor.entities.arrayProperties.setMinOccurs(entityKey, "TestProperty", 43);
      await testEditor.entities.arrayProperties.setMaxOccurs(entityKey, "TestProperty", 56);

      expect(property.minOccurs).to.eql(43);
      expect(property.maxOccurs).to.eql(56);
    });

    it("editing a array property attribute not belonging to the proper property type, rejected with error", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      await expect(testEditor.entities.arrayProperties.setMaxOccurs(entityKey, "TestProperty", 1)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetMaxOccurs);
        expect(error).to.have.nested.property("innerError.message", `Expected property TestProperty to be of type ArrayProperty.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidPropertyType);
      });
    });
  });

  describe("Primitive property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.extendedTypeName).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).to.eql("typeName");
    });

    it("should successfully set minLength", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.minLength).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).to.eql(7);
    });

    it("should successfully set maxLength", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.maxLength).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).to.eql(100);
    });

    it("should successfully set minValue", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.minValue).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).to.eql(-1);
    });

    it("should successfully set maxValue", async () => {
      await testEditor.entities.createPrimitiveProperty(entityKey, "TestProperty", PrimitiveType.Double);
      const property = await entity?.getProperty("TestProperty") as PrimitiveProperty;
      expect(property.maxValue).to.eql(undefined);

      await testEditor.entities.primitiveProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).to.eql(1000);
    });

    it("editing a primitive property attribute not belonging to the proper property type, rejected with error", async () => {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.primitiveProperties.setMinValue(entityKey, "TestProperty", 1)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetMinValue);
        expect(error).to.have.nested.property("innerError.message", `Expected property TestProperty to be of type PrimitiveProperty.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidPropertyType);
      });
    });
  });

  describe("Enumeration property editing tests", () => {
    it("should successfully set extendedTypeName", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.extendedTypeName).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setExtendedTypeName(entityKey, "TestProperty", "typeName");

      expect(property.extendedTypeName).to.eql("typeName");
    });

    it("should successfully set minLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.minLength).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMinLength(entityKey, "TestProperty", 7);

      expect(property.minLength).to.eql(7);
    });

    it("should successfully set maxLength", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.maxLength).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMaxLength(entityKey, "TestProperty", 100);

      expect(property.maxLength).to.eql(100);
    });

    it("should successfully set minValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.minValue).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMinValue(entityKey, "TestProperty", -1);

      expect(property.minValue).to.eql(-1);
    });

    it("should successfully set maxValue", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);

      const property = await entity?.getProperty("TestProperty") as EnumerationProperty;
      expect(property.maxValue).to.eql(undefined);

      await testEditor.entities.enumerationProperties.setMaxValue(entityKey, "TestProperty", 1000);

      expect(property.maxValue).to.eql(1000);
    });

    it("editing a enumeration property attribute not belonging to the proper property type, rejected with error", async () => {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.enumerationProperties.setName(entityKey, "TestProperty", "testName")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `Expected property TestProperty to be of type EnumerationProperty.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidPropertyType);
      });
    });
  });

  describe("Navigation property editing tests", () => {
    it("editing a property through navigationProperties that is not a NavigationProperty, rejected with error", async () => {
      const structClass = await testEditor.schemaContext.getSchemaItem<StructClass>(structKey);
      await testEditor.entities.createStructProperty(entityKey, "TestProperty", structClass!);
      await expect(testEditor.entities.navigationProperties.setName(entityKey, "TestProperty", "testName")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `Expected property TestProperty to be of type NavigationProperty.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidPropertyType);
      });
    });
  });

  describe("Struct property editing tests", () => {
    it("editing a property through structProperties that is not a StructProperty, rejected with error", async () => {
      const schema = await testEditor.getSchema(testKey);
      const testEnum = new Enumeration(schema, "TestEnumeration");
      await testEditor.entities.createEnumerationProperty(entityKey, "TestProperty", testEnum);
      await expect(testEditor.entities.structProperties.setName(entityKey, "TestProperty", "testName")).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetPropertyName);
        expect(error).to.have.nested.property("innerError.message", `Expected property TestProperty to be of type StructProperty.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidPropertyType);
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
      expect(await property.kindOfQuantity).to.eql(koq);
    });

    it("try setting property KindOfQuantity to a different type, throws error", async () => {
      const notAKindOfQuantity = await testEditor.entities.create(testKey, "notAKindOfQuantity", ECClassModifier.None);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setKindOfQuantity(entityKey, "testProperty", notAKindOfQuantity)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetKindOfQuantity);
        expect(error).to.have.nested.property("innerError.message", `Expected ${notAKindOfQuantity.fullName} to be of type KindOfQuantity.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidSchemaItemType);
      });
    });

    it("try setting property KindOfQuantity to an unknown KindOfQuantity, throws error", async () => {
      const unknownKOQ = new SchemaItemKey("unknownKindOfQuantity", testKey);
      await testEditor.entities.createPrimitiveProperty(entityKey, "testProperty", PrimitiveType.String);

      await expect(testEditor.entities.properties.setKindOfQuantity(entityKey, "testProperty", unknownKOQ)).to.be.eventually.rejected.then(function (error) {
        expect(error).to.have.property("schemaEditType", SchemaEditType.SetKindOfQuantity);

        expect(error).to.have.nested.property("innerError.message", `KindOfQuantity ${unknownKOQ.fullName} could not be found in the schema ${testKey.name}.`);
        expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNotFound);
      });
    });
  });
});
