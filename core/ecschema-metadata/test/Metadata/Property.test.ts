/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { Schema, MutableSchema } from "../../src/Metadata/Schema";
import { EntityClass } from "../../src/Metadata/EntityClass";
import { ECObjectsError } from "../../src/Exception";
import {
  Property, PrimitiveProperty, PrimitiveArrayProperty, EnumerationProperty, StructProperty,
  StructArrayProperty, EnumerationArrayProperty, NavigationProperty,
} from "../../src/Metadata/Property";
import { PropertyType } from "../../src/PropertyTypes";
import { Enumeration } from "../../src/Metadata/Enumeration";
import { ECClass, StructClass, MutableClass } from "../../src/Metadata/Class";
import { PropertyCategory } from "../../src/Metadata/PropertyCategory";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { RelationshipClass } from "../../src/Metadata/RelationshipClass";
import { DelayedPromiseWithProps } from "../../src/DelayedPromise";
import { PrimitiveType } from "../../src/ECObjects";
import { JsonParser } from "../../src/Deserialization/JsonParser";

describe("Property", () => {
  let parser = new JsonParser();
  let testClass: EntityClass;
  let testCategory: PropertyCategory;
  let testKindOfQuantity: KindOfQuantity;
  let testEnumeration: Enumeration;
  let testStruct: StructClass;
  let testRelationship: RelationshipClass;

  class MockProperty extends Property {
    constructor(name: string, type: PropertyType = PropertyType.String) {
      super(testClass, name, type);
    }
  }

  beforeEach(async () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    const mutable = schema as MutableSchema;
    testClass = await mutable.createEntityClass("TestClass");
    testCategory = await mutable.createPropertyCategory("TestCategory");
    testKindOfQuantity = await mutable.createKindOfQuantity("TestKoQ");
    testEnumeration = await mutable.createEnumeration("TestEnumeration");
    testStruct = await mutable.createStructClass("TestStruct");
    testRelationship = await mutable.createRelationshipClass("TestRelationship");
  });

  describe("type guards", () => {
    let primitiveProperty: PrimitiveProperty;
    let enumProperty: EnumerationProperty;
    let structProperty: StructProperty;
    let navProperty: NavigationProperty;
    let primitiveArrayProperty: PrimitiveArrayProperty;
    let enumArrayProperty: EnumerationArrayProperty;
    let structArrayProperty: StructArrayProperty;

    beforeEach(() => {
      primitiveProperty = new PrimitiveProperty(testClass, "A");
      enumProperty = new EnumerationProperty(testClass, "B", new DelayedPromiseWithProps(testEnumeration.key, async () => testEnumeration));
      structProperty = new StructProperty(testClass, "C", testStruct);
      navProperty = new NavigationProperty(testClass, "D", new DelayedPromiseWithProps(testRelationship.key, async () => testRelationship));
      primitiveArrayProperty = new PrimitiveArrayProperty(testClass, "E");
      enumArrayProperty = new EnumerationArrayProperty(testClass, "F", new DelayedPromiseWithProps(testEnumeration.key, async () => testEnumeration));
      structArrayProperty = new StructArrayProperty(testClass, "G", testStruct);
    });

    it("should correctly determine when a property is an ArrayProperty", async () => {
      expect(primitiveProperty.isArray()).to.eql(false);
      expect(enumProperty.isArray()).to.eql(false);
      expect(structProperty.isArray()).to.eql(false);
      expect(navProperty.isArray()).to.eql(false);
      expect(primitiveArrayProperty.isArray()).to.eql(true);
      expect(enumArrayProperty.isArray()).to.eql(true);
      expect(structArrayProperty.isArray()).to.eql(true);
    });

    it("should correctly determine when a property is a PrimitiveProperty", async () => {
      expect(primitiveProperty.isPrimitive()).to.eql(true);
      expect(enumProperty.isPrimitive()).to.eql(true);
      expect(structProperty.isPrimitive()).to.eql(false);
      expect(navProperty.isPrimitive()).to.eql(false);
      expect(primitiveArrayProperty.isPrimitive()).to.eql(true);
      expect(enumArrayProperty.isPrimitive()).to.eql(true);
      expect(structArrayProperty.isPrimitive()).to.eql(false);
    });

    it("should correctly determine when a property is a StructProperty", async () => {
      expect(primitiveProperty.isStruct()).to.eql(false);
      expect(enumProperty.isStruct()).to.eql(false);
      expect(structProperty.isStruct()).to.eql(true);
      expect(navProperty.isStruct()).to.eql(false);
      expect(primitiveArrayProperty.isStruct()).to.eql(false);
      expect(enumArrayProperty.isStruct()).to.eql(false);
      expect(structArrayProperty.isStruct()).to.eql(true);
    });

    it("should correctly determine when a property is an EnumerationProperty", async () => {
      expect(primitiveProperty.isEnumeration()).to.eql(false);
      expect(enumProperty.isEnumeration()).to.eql(true);
      expect(structProperty.isEnumeration()).to.eql(false);
      expect(navProperty.isEnumeration()).to.eql(false);
      expect(primitiveArrayProperty.isEnumeration()).to.eql(false);
      expect(enumArrayProperty.isEnumeration()).to.eql(true);
      expect(structArrayProperty.isEnumeration()).to.eql(false);
    });

    it("should correctly determine when a property is a NavigationProperty", async () => {
      expect(primitiveProperty.isNavigation()).to.eql(false);
      expect(enumProperty.isNavigation()).to.eql(false);
      expect(structProperty.isNavigation()).to.eql(false);
      expect(navProperty.isNavigation()).to.eql(true);
      expect(primitiveArrayProperty.isNavigation()).to.eql(false);
      expect(enumArrayProperty.isNavigation()).to.eql(false);
      expect(structArrayProperty.isNavigation()).to.eql(false);
    });
  });

  describe("fromJson", () => {
    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProp",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        type: "PrimitiveProperty",
        priority: 1000,
        isReadOnly: false,
        category: "TestSchema.TestCategory",
        kindOfQuantity: "TestSchema.TestKoQ",
      };
      const testProp = new MockProperty("TestProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.label).to.eql("SomeDisplayLabel");
      expect(testProp.description).to.eql("A really long description...");
      expect(testProp.priority).to.eql(1000);
      expect(testProp.isReadOnly).to.eql(false);
      expect(await testProp.category).to.eql(testCategory);
      expect(await testProp.kindOfQuantity).to.eql(testKindOfQuantity);
    });
    const oneCustomAttributeJson = {
      name: "TestProp",
      type: "PrimitiveProperty",
      customAttributes: [
        {
          className: "CoreCustomAttributes.HiddenSchema",
          ExampleAttribute: 1234,
        },
      ],
    };
    it("async - Deserialize One Custom Attribute", async () => {

      const testProp = new MockProperty("TestProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(oneCustomAttributeJson, testClass.name, testProp.name));
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"].ExampleAttribute === 1234);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      const testProp = new MockProperty("TestProp");
      expect(testProp).to.exist;
      testProp.deserializeSync(parser.parsePropertyProps(oneCustomAttributeJson, testClass.name, testProp.name));
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"].ExampleAttribute === 1234);
    });
    const twoCustomAttributesJson = {
      name: "TestProp",
      type: "PrimitiveProperty",
      customAttributes: [
        {
          className: "CoreCustomAttributes.HiddenSchema",
        },
        {
          className: "ExampleCustomAttributes.ExampleSchema",
        },
      ],
    };
    it("async - Deserialize Two Custom Attributes", async () => {

      const testProp = new MockProperty("TestProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(twoCustomAttributesJson, testClass.name, testProp.name));
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testProp.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      const testProp = new MockProperty("TestProp");
      expect(testProp).to.exist;
      testProp.deserializeSync(parser.parsePropertyProps(twoCustomAttributesJson, testClass.name, testProp.name));
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testProp.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    const mustBeArrayJson = {
      name: "BadProp",
      label: "SomeDisplayLabel",
      type: "PrimitiveArrayProperty",
      description: "A really long description...",
      customAttributes: "CoreCustomAttributes.HiddenSchema",
    };
    it("async - Custom Attributes must be an array", async () => {
      const testProp = new MockProperty("BadProp");
      expect(testProp).to.exist;
      assert.throws(() => parser.parsePropertyProps(mustBeArrayJson, testClass.schema.name, testClass.name), ECObjectsError, "The ECProperty TestSchema.TestClass.BadProp has an invalid 'customAttributes' attribute. It should be of type 'array'.");
    });
    it("sync - Custom Attributes must be an array", async () => {
      const testProp = new MockProperty("BadProp");
      expect(testProp).to.exist;
      assert.throws(() => parser.parsePropertyProps(mustBeArrayJson, testClass.schema.name, testClass.name), ECObjectsError, "The ECProperty TestSchema.TestClass.BadProp has an invalid 'customAttributes' attribute. It should be of type 'array'.");
    });
    it("sync - Deserialize Multiple Custom Attributes with additional properties", () => {
      const propertyJson = {
        name: "Prop",
        type: "PrimitiveProperty",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: 1.2,
          },
          {
            className: "ExampleCustomAttributes.ExampleSchema",
            ExampleAttribute: true,
          },
          {
            className: "AnotherCustomAttributes.ExampleSchema1",
            Example2Attribute: "example",
          },
        ],
      };
      const testProp = new MockProperty("Prop");
      expect(testProp).to.exist;
      testProp.deserializeSync(parser.parsePropertyProps(propertyJson, testClass.schema.name, testClass.name));
      assert(testProp.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === 1.2);
      assert(testProp.customAttributes!["ExampleCustomAttributes.ExampleSchema"].ExampleAttribute === true);
      assert(testProp.customAttributes!["AnotherCustomAttributes.ExampleSchema1"].Example2Attribute === "example");
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        name: "TestProp",
        type: "PrimitiveProperty",
        label: "Some display label",
        description: "Some really long description...",
        priority: 0,
        isReadOnly: true,
        category: "TestCategory",
        kindOfQuantity: "TestKindOfQuantity",
        inherited: false,
        customAttributes: [],
        [attributeName]: value, // overwrites previously defined objects
      }
      let err = (typeof (json.name) !== "string") ? `An ECProperty in TestSchema.TestClass ` : `The ECProperty TestSchema.TestClass.TestProp `;
      err += `has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`;
      assert.throws(() => parser.parsePropertyProps(json, testClass.schema.name, testClass.name), ECObjectsError, err);
    }

    it("should throw for invalid name", () => { testInvalidAttribute("name", "string", false); });
    it("should throw for invalid type", () => { testInvalidAttribute("type", "string", false); });
    it("should throw for invalid label", () => { testInvalidAttribute("label", "string", false); });
    it("should throw for invalid description", () => { testInvalidAttribute("description", "string", false); });
    it("should throw for invalid priority", () => { testInvalidAttribute("priority", "number", false); });
    it("should throw for invalid isReadOnly", () => { testInvalidAttribute("isReadOnly", "boolean", 1.234); });
    it("should throw for invalid category", () => { testInvalidAttribute("category", "string", false); });
    it("should throw for invalid kindOfQuantity", () => { testInvalidAttribute("kindOfQuantity", "string", false); });
    it("should throw for invalid inherited", () => { testInvalidAttribute("inherited", "boolean", 1.234); });
    it("should throw for invalid customAttributes", () => { testInvalidAttribute("category", "string", false); });

    it("should throw for non-existent category", async () => {
      const testProp = new MockProperty("BadProp");
      // Also test for a PropertyCategory that doesn't exist
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        category: "TestSchema.NonExistentPropertyCategory"
      };
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      await expect(testProp.category).to.be.rejectedWith(ECObjectsError, `The Property BadProp has a 'category' ("TestSchema.NonExistentPropertyCategory") that cannot be found.`);

    });

    it("should throw for non-existent kindOfQuantity", async () => {
      const testProp = new MockProperty("BadProp");
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.NonExistentKindOfQuantity"
      };
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      await expect(testProp.kindOfQuantity).to.be.rejectedWith(ECObjectsError, `The Property BadProp has a 'kindOfQuantity' ("TestSchema.NonExistentKindOfQuantity") that cannot be found.`);
    });
  });
  describe("toJson", () => {
    it("Simple serialization", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        description: "A really long description...",
        label: "SomeDisplayLabel",
        type: "PrimitiveProperty",
        isReadOnly: true,
        priority: 100,
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      const serialized = testProp.toJson();
      assert(serialized.name, "ValidProp");
      assert(serialized.description, "A really long description...");
      assert(serialized.label, "SomeDisplayLabel");
      assert(serialized.type, "PrimitiveProperty");
      assert(serialized.isReadOnly === true);
      assert(serialized.priority === 100);
    });
    it("Serialization with one custom attribute- only class name", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
          },
        ],
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
    });
    it("Serialization with one custom attribute- additional properties", () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: true,
          },
        ],
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      testProp.deserializeSync(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
      assert(serialized.customAttributes[0].ShowClasses === true);
    });
    it("Serialization with multiple custom attributes- only class name", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
          },
          {
            className: "CoreAttributes.HiddenSchema",
          },
          {
            className: "CoreCustom.HiddenSchema",
          },
        ],
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
      assert(serialized.customAttributes[1].className === "CoreAttributes.HiddenSchema");
      assert(serialized.customAttributes[2].className === "CoreCustom.HiddenSchema");
    });
    it("Serialization with multiple custom attributes- additional properties", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: true,
          },
          {
            className: "CoreAttributes.HiddenSchema",
            FloatValue: 1.2,
          },
          {
            className: "CoreCustom.HiddenSchema",
            IntegerValue: 5,
          },
        ],
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(parser.parsePropertyProps(propertyJson, testClass.name, testProp.name));
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].ShowClasses === true);
      assert(serialized.customAttributes[1].FloatValue === 1.2);
      assert(serialized.customAttributes[2].IntegerValue === 5);
    });
  });
});

describe("PrimitiveProperty", () => {
  let parser = new JsonParser();
  describe("fromJson", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty", PrimitiveType.Double);
    });

    it("should successfully deserialize valid JSON", async () => {
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
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));

      expect(testProperty.minLength).to.eql(2);
      expect(testProperty.maxLength).to.eql(4);
      expect(testProperty.minValue).to.eql(6);
      expect(testProperty.maxValue).to.eql(8);
      expect(testProperty.extendedTypeName).to.eql("SomeExtendedType");
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "string"
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name))).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid typeName", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        typeName: 0,
      };
      assert.throws(() => parser.parsePrimitivePropertyProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid minLength", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        minLength: "0",
      };
      assert.throws(() => parser.parsePrimitiveOrEnumPropertyBaseProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid maxLength", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        maxLength: "0",
      };
      assert.throws(() => parser.parsePrimitiveOrEnumPropertyBaseProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid minValue", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        minValue: "0",
      };
      assert.throws(() => parser.parsePrimitiveOrEnumPropertyBaseProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid maxValue", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        maxValue: "0",
      };
      assert.throws(() => parser.parsePrimitiveOrEnumPropertyBaseProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid extendedTypeName", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        extendedTypeName: 0,
      };
      assert.throws(() => parser.parsePrimitiveOrEnumPropertyBaseProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
  });

  describe("KindOfQuantity in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    let parser = new JsonParser();
    beforeEach(() => {
      const referencedSchema = new Schema("Reference", 1, 0, 0) as MutableSchema;
      referencedSchema.createKindOfQuantitySync("MyKindOfQuantity");

      const schema = new Schema("TestSchema", 1, 0, 0) as MutableSchema;
      schema.addReferenceSync(referencedSchema);

      const testClass = schema.createEntityClassSync("TestClass") as ECClass as MutableClass;
      testProperty = testClass.createPrimitivePropertySync("Primitive", PrimitiveType.Double);
    });

    const propertyJson = {
      kindOfQuantity: "Reference.MyKindOfQuantity",
      name: "Primitive",
      type: "PrimitiveProperty",
      typeName: "double",
    };

    it("Should load KindOfQuantity synchronously", () => {
      testProperty.deserializeSync(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const koq = testProperty.getKindOfQuantitySync();
      assert(koq !== undefined);
      assert(koq!.name === "MyKindOfQuantity");
    });

    it("Should load KindOfQuantity", async () => {
      await testProperty.deserialize(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const koq = await testProperty.kindOfQuantity;
      assert(koq !== undefined);
      assert(koq!.name === "MyKindOfQuantity");
    });
  });

  describe("PropertyCategory in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    beforeEach(() => {
      const referencedSchema = new Schema("Reference", 1, 0, 0) as MutableSchema;
      referencedSchema.createPropertyCategorySync("MyCategory");

      const schema = new Schema("TestSchema", 1, 0, 0) as MutableSchema;
      schema.addReferenceSync(referencedSchema);

      const testClass = schema.createEntityClassSync("TestClass") as ECClass as MutableClass;
      testProperty = testClass.createPrimitivePropertySync("Primitive", PrimitiveType.Double);
    });

    const propertyJson = {
      category: "Reference.MyCategory",
      name: "Primitive",
      type: "PrimitiveProperty",
      typeName: "double",
    };

    it("Should load PropertyCategory synchronously", () => {
      testProperty.deserializeSync(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const cat = testProperty.getCategorySync();
      assert(cat !== undefined);
      assert(cat!.name === "MyCategory");
    });

    it("Should load PropertyCategory", async () => {
      await testProperty.deserialize(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const cat = await testProperty.category;
      assert(cat !== undefined);
      assert(cat!.name === "MyCategory");
    });
  });
  describe("toJson", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveProperty(testClass, "TestProperty", PrimitiveType.Double);
    });

    it("should successfully serialize valid JSON", async () => {
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
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parsePrimitivePropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const testPropSerialization = testProperty.toJson();
      expect(testPropSerialization.minLength).to.eql(2);
      expect(testPropSerialization.maxLength).to.eql(4);
      expect(testPropSerialization.minValue).to.eql(6);
      expect(testPropSerialization.maxValue).to.eql(8);
      expect(testPropSerialization.extendedTypeName).to.eql("SomeExtendedType");
    });
  });
});

describe("EnumerationProperty", () => {
  let parser = new JsonParser();
  describe("fromJson", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testEnum = await (schema as MutableSchema).createEnumeration("TestEnum");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnum",
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parseEnumerationPropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      expect(await testProperty.enumeration).to.eql(testEnum);

      // Should also work if typeName is not specified
      await testProperty.deserialize(parser.parseEnumerationPropertyProps({
        name: "TestProperty",
        type: "PrimitiveProperty",
      }, testProperty.class.name, testProperty.name));
      expect(await testProperty.enumeration).to.eql(testEnum);
    });

    it("should throw for invalid typeName", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        typeName: 0,
      };
      assert.throws(() => parser.parseEnumerationPropertyProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "ThisDoesNotMatch"
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(parser.parseEnumerationPropertyProps(propertyJson, testProperty.class.name, testProperty.name))).to.be.rejectedWith(ECObjectsError);
    });
  });
  describe("toJson", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testEnum = await (schema as MutableSchema).createEnumeration("TestEnum");
      testProperty = new EnumerationProperty(testClass, "TestProperty", new DelayedPromiseWithProps(testEnum.key, async () => testEnum));
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "TestSchema.TestEnum",
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parseEnumerationPropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const testPropSerialization = testProperty.toJson();
      assert(testPropSerialization.typeName, "TestSchema.TestEnum");
    });
  });
});

describe("StructProperty", () => {
  let parser = new JsonParser();
  describe("fromJson", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testStruct = await (schema as MutableSchema).createStructClass("TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", testStruct);
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parseStructPropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      expect(await testProperty.structClass).to.eql(testStruct);

      // Should also work if typeName is not specified
      await testProperty.deserialize(parser.parseStructPropertyProps({
        name: "TestProperty",
        type: "StructProperty",
      }, testProperty.class.name, testProperty.name));
      expect(await testProperty.structClass).to.eql(testStruct);
    });

    it("should throw for invalid typeName", () => {
      const json: any = {
        name: 0,
        type: "StructProperty",
        typeName: 0,
      };
      assert.throws(() => parser.parseStructPropertyProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "ThisDoesNotMatch"
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(parser.parseStructPropertyProps(propertyJson, testProperty.class.name, testProperty.name))).to.be.rejectedWith(ECObjectsError);
    });
  });
  describe("toJson", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = await (schema as MutableSchema).createEntityClass("TestClass");
      testStruct = await (schema as MutableSchema).createStructClass("TestStruct");
      testProperty = new StructProperty(testClass, "TestProperty", testStruct);
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "TestSchema.TestStruct",
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parseStructPropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const testPropSerialization = testProperty.toJson();
      assert(testPropSerialization.typeName, "TestStruct");
    });
  });
});

describe("PrimitiveArrayProperty", () => {
  let parser = new JsonParser();
  describe("fromJson", () => {
    let testProperty: PrimitiveArrayProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
    });

    it("should successfully deserialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveArrayProperty",
        minOccurs: 2,
        maxOccurs: 4,
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parsePrimitiveArrayPropertyProps(propertyJson, testProperty.class.name, testProperty.name));

      expect(testProperty.minOccurs).to.eql(2);
      expect(testProperty.maxOccurs).to.eql(4);
    });

    it("should throw for invalid minOccurs", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        minOccurs: "0",
      };
      assert.throws(() => parser.parsePrimitiveArrayPropertyProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
    it("should throw for invalid maxOccurs", () => {
      const json: any = {
        name: 0,
        type: "PrimitiveProperty",
        maxOccurs: "0",
      };
      assert.throws(() => parser.parsePrimitiveArrayPropertyProps(json, testProperty.class.name, testProperty.name), ECObjectsError);
    });
  });
  describe("toJson", () => {
    let testProperty: PrimitiveArrayProperty;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const testClass = new EntityClass(schema, "TestClass");
      testProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
    });

    it("should successfully serialize valid JSON", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveArrayProperty",
        minOccurs: 2,
        maxOccurs: 4,
      };
      expect(testProperty).to.exist;
      await testProperty.deserialize(parser.parsePrimitiveArrayPropertyProps(propertyJson, testProperty.class.name, testProperty.name));
      const testPropSerialization = testProperty.toJson();
      expect(testPropSerialization.minOccurs).to.eql(2);
      expect(testPropSerialization.maxOccurs).to.eql(4);
    });
  });
});
