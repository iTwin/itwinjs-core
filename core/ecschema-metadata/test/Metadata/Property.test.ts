/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { SchemaContext } from "../../src/Context";
import { DelayedPromiseWithProps } from "../../src/DelayedPromise";
import { PrimitiveType } from "../../src/ECObjects";
import { ECObjectsError } from "../../src/Exception";
import { ECClass, MutableClass, StructClass } from "../../src/Metadata/Class";
import { CustomAttribute } from "../../src/Metadata/CustomAttribute";
import { EntityClass } from "../../src/Metadata/EntityClass";
import { Enumeration } from "../../src/Metadata/Enumeration";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { EnumerationArrayProperty, EnumerationProperty, MutableProperty, NavigationProperty, PrimitiveArrayProperty, PrimitiveProperty, Property, StructArrayProperty, StructProperty } from "../../src/Metadata/Property";
import { PropertyCategory } from "../../src/Metadata/PropertyCategory";
import { RelationshipClass } from "../../src/Metadata/RelationshipClass";
import { MutableSchema, Schema } from "../../src/Metadata/Schema";
import { PropertyType } from "../../src/PropertyTypes";

describe("Property", () => {
  let testClass: EntityClass;
  let testCategory: PropertyCategory;
  let testKindOfQuantity: KindOfQuantity;
  let testEnumeration: Enumeration;
  let testStruct: StructClass;
  let testRelationship: RelationshipClass;

  class MockProperty extends Property implements MutableProperty {
    constructor(name: string, type: PropertyType = PropertyType.String) {
      super(testClass, name, type);
    }

    public addCustomAttribute(customAttribute: CustomAttribute) {
      super.addCustomAttribute(customAttribute);
    }
  }

  beforeEach(async () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProp.deserialize(propertyJson);
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.label).to.eql("SomeDisplayLabel");
      expect(testProp.description).to.eql("A really long description...");
      expect(testProp.priority).to.eql(1000);
      expect(testProp.isReadOnly).to.eql(false);
      expect(await testProp.category).to.eql(testCategory);
      expect(await testProp.kindOfQuantity).to.eql(testKindOfQuantity);
    });

    it("should throw for non-existent category", async () => {
      const testProp = new MockProperty("BadProp");
      // Also test for a PropertyCategory that doesn't exist
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        category: "TestSchema.NonExistentPropertyCategory",
      };
      await testProp.deserialize(propertyJson);
      await expect(testProp.category).to.be.rejectedWith(ECObjectsError, `The Property BadProp has a 'category' ("TestSchema.NonExistentPropertyCategory") that cannot be found.`);

    });

    it("should throw for non-existent kindOfQuantity", async () => {
      const testProp = new MockProperty("BadProp");
      const propertyJson = {
        name: "BadProp",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.NonExistentKindOfQuantity",
      };
      await testProp.deserialize(propertyJson);
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
      await testProp.deserialize(propertyJson);
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
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
      });
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
    });
    it("Serialization with one custom attribute- additional properties", () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      testProp.deserializeSync(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
        ShowClasses: true,
      });
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].className === "CoreCustomAttributes.HiddenSchema");
      assert(serialized.customAttributes[0].ShowClasses === true);
    });
    it("Serialization with multiple custom attributes- only class name", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        name: "ValidProp",
        type: "PrimitiveProperty",
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(propertyJson);
      testProp.addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema" });
      testProp.addCustomAttribute({ className: "CoreAttributes.HiddenSchema" });
      testProp.addCustomAttribute({ className: "CoreCustom.HiddenSchema" });
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
      };
      const testProp = new MockProperty("ValidProp");
      expect(testProp).to.exist;
      await testProp.deserialize(propertyJson);
      testProp.addCustomAttribute({
        className: "CoreCustomAttributes.HiddenSchema",
        ShowClasses: true,
      });
      testProp.addCustomAttribute({
        className: "CoreAttributes.HiddenSchema",
        FloatValue: 1.2,
      });
      testProp.addCustomAttribute({
        className: "CoreCustom.HiddenSchema",
        IntegerValue: 5,
      });
      const serialized = testProp.toJson();
      assert(serialized.customAttributes[0].ShowClasses === true);
      assert(serialized.customAttributes[1].FloatValue === 1.2);
      assert(serialized.customAttributes[2].IntegerValue === 5);
    });
  });
});

describe("PrimitiveProperty", () => {
  describe("fromJson", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);

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
        typeName: "string",
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });
  });

  describe("KindOfQuantity in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    beforeEach(() => {
      const context = new SchemaContext();
      const referencedSchema = new Schema(context, "Reference", 1, 0, 0) as MutableSchema;
      referencedSchema.createKindOfQuantitySync("MyKindOfQuantity");

      const schema = new Schema(context, "TestSchema", 1, 0, 0) as MutableSchema;
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
      testProperty.deserializeSync(propertyJson);
      const koq = testProperty.getKindOfQuantitySync();
      assert(koq !== undefined);
      assert(koq!.name === "MyKindOfQuantity");
    });

    it("Should load KindOfQuantity", async () => {
      await testProperty.deserialize(propertyJson);
      const koq = await testProperty.kindOfQuantity;
      assert(koq !== undefined);
      assert(koq!.name === "MyKindOfQuantity");
    });
  });

  describe("PropertyCategory in referenced schema", () => {
    let testProperty: PrimitiveProperty;
    beforeEach(() => {
      const context = new SchemaContext();
      const referencedSchema = new Schema(context, "Reference", 1, 0, 0) as MutableSchema;
      referencedSchema.createPropertyCategorySync("MyCategory");

      const schema = new Schema(context, "TestSchema", 1, 0, 0) as MutableSchema;
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
      testProperty.deserializeSync(propertyJson);
      const cat = testProperty.getCategorySync();
      assert(cat !== undefined);
      assert(cat!.name === "MyCategory");
    });

    it("Should load PropertyCategory", async () => {
      await testProperty.deserialize(propertyJson);
      const cat = await testProperty.category;
      assert(cat !== undefined);
      assert(cat!.name === "MyCategory");
    });
  });
  describe("toJson", () => {
    let testProperty: PrimitiveProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);
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
  describe("fromJson", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);
      expect(await testProperty.enumeration).to.eql(testEnum);
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        typeName: "ThisDoesNotMatch",
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
  describe("toJson", () => {
    let testProperty: EnumerationProperty;
    let testEnum: Enumeration;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);
      const testPropSerialization = testProperty.toJson();
      assert(testPropSerialization.typeName, "TestSchema.TestEnum");
    });
  });
});

describe("StructProperty", () => {
  describe("fromJson", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);
      expect(await testProperty.structClass).to.eql(testStruct);
    });

    it("should throw for mismatched typeName", async () => {
      const propertyJson = {
        name: "TestProperty",
        type: "StructProperty",
        typeName: "ThisDoesNotMatch",
      };
      expect(testProperty).to.exist;
      await expect(testProperty.deserialize(propertyJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
  describe("toJson", () => {
    let testProperty: StructProperty;
    let testStruct: StructClass;

    beforeEach(async () => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);
      const testPropSerialization = testProperty.toJson();
      assert(testPropSerialization.typeName, "TestStruct");
    });
  });
});

describe("PrimitiveArrayProperty", () => {
  describe("fromJson", () => {
    let testProperty: PrimitiveArrayProperty;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
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
      await testProperty.deserialize(propertyJson);

      expect(testProperty.minOccurs).to.eql(2);
      expect(testProperty.maxOccurs).to.eql(4);
    });

    describe("toJson", () => {
      let testArrayProperty: PrimitiveArrayProperty;

      beforeEach(() => {
        const schema = new Schema(new SchemaContext(), "TestSchema", 1, 0, 0);
        const testClass = new EntityClass(schema, "TestClass");
        testArrayProperty = new PrimitiveArrayProperty(testClass, "TestProperty");
      });

      it("should successfully serialize valid JSON", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveArrayProperty",
          minOccurs: 2,
          maxOccurs: 4,
        };
        expect(testArrayProperty).to.exist;
        await testArrayProperty.deserialize(propertyJson);
        const testPropSerialization = testArrayProperty.toJson();
        expect(testPropSerialization.minOccurs).to.eql(2);
        expect(testPropSerialization.maxOccurs).to.eql(4);
      });
    });
  });
});
