/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

import Schema, { MutableSchema } from "../../src/Metadata/Schema";
import EntityClass from "../../src/Metadata/EntityClass";
import { SchemaContext } from "../../src/Context";
import { DelayedPromiseWithProps } from "../../src/DelayedPromise";
import ECClass, { MutableClass } from "../../src/Metadata/Class";
import { ECObjectsError } from "../../src/Exception";
import { SchemaItemType } from "../../src/ECObjects";

describe("ECClass", () => {
  let schema: Schema;

  describe("get properties", () => {
    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
    });

    it("inherited properties from base class", async () => {
      const baseClass = new EntityClass(schema, "TestBase");
      const basePrimProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("BasePrimProp");

      const entityClass = new EntityClass(schema, "TestClass");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

      expect(await entityClass.getProperty("BasePrimProp")).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", false)).to.be.undefined;
      expect(await entityClass.getProperty("BasePrimProp", true)).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("BasePrimProp")).equal(basePrimProp);
      expect(await entityClass.getInheritedProperty("PrimProp")).to.be.undefined;
    });

    it("inherited properties from base class synchronously", () => {
      const baseClass = (schema as MutableSchema).createEntityClassSync("TestBase");
      const basePrimProp = (baseClass as ECClass as MutableClass).createPrimitivePropertySync("BasePrimProp");

      const entityClass = (schema as MutableSchema).createEntityClassSync("TestClass");
      (entityClass as ECClass as MutableClass).createPrimitivePropertySync("PrimProp");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

      expect(entityClass.getPropertySync("BasePrimProp")).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", false)).to.be.undefined;
      expect(entityClass.getPropertySync("BasePrimProp", true)).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("BasePrimProp")).equal(basePrimProp);
      expect(entityClass.getInheritedPropertySync("PrimProp")).to.be.undefined;
    });

    it("case-insensitive search", async () => {
      const entityClass = new EntityClass(schema, "TestClass");
      const primProp = await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      expect(await entityClass.getProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getProperty("testprop")).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP")).equal(primProp);
    });

    it("case-insensitive inherited property search", async () => {
      const baseClass = new EntityClass(schema, "BaseClass");
      const primProp = await (baseClass as ECClass as MutableClass).createPrimitiveProperty("TestProp");

      const entityClass = new EntityClass(schema, "TestClass");
      entityClass.baseClass = new DelayedPromiseWithProps(baseClass.key, async () => baseClass);

      expect(await entityClass.getProperty("TESTPROP", true)).equal(primProp);
      expect(await entityClass.getProperty("testprop", true)).equal(primProp);
      expect(await entityClass.getProperty("tEsTpRoP", true)).equal(primProp);

      expect(await entityClass.getInheritedProperty("TESTPROP")).equal(primProp);
      expect(await entityClass.getInheritedProperty("testprop")).equal(primProp);
      expect(await entityClass.getInheritedProperty("tEsTpRoP")).equal(primProp);
    });
  });

  describe("deserialization", () => {
    it("class with base class", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      schema = await Schema.fromJson(schemaJson);
      assert.isDefined(schema);

      const testClass = await schema.getItem<EntityClass>("testClass");
      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);

      const baseClass = await schema.getItem<EntityClass>("testBaseClass");
      assert.isDefined(baseClass);
      assert.isTrue(baseClass === await testClass!.baseClass);
    });

    it("class with base class in reference schema", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");

      const context = new SchemaContext();
      await context.addSchema(refSchema);

      schema = await Schema.fromJson(schemaJson, context);

      const testClass = await schema.getItem<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(await testClass!.baseClass);
      assert.isTrue(await testClass!.baseClass === refBaseClass);
    });
    const oneCustomAttributeJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "CoreCustomAttributes.HiddenSchema",
              ShowClasses: true,

            },
          ],
        },
      },
    };
    it("async - Deserialize One Custom Attribute", async () => {

      schema = await Schema.fromJson(oneCustomAttributeJson);

      const testClass = await schema.getItem<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"]);
      assert(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      schema = Schema.fromJsonSync(oneCustomAttributeJson);

      const testClass = schema.getItemSync<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"]);
      assert(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    const twoCustomAttributesJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "CoreCustomAttributes.HiddenSchema",
            },
            {
              className: "ExampleCustomAttributes.ExampleSchema",
            },
          ],
        },
      },
    };
    it("async - Deserialize Two Custom Attributes", async () => {

      schema = await Schema.fromJson(twoCustomAttributesJson);

      const testClass = await schema.getItem<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"]);
      assert.isDefined(testClass!.customAttributes!["ExampleCustomAttributes.ExampleSchema"]);
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      schema = Schema.fromJsonSync(twoCustomAttributesJson);

      const testClass = schema.getItemSync<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"]);
      assert.isDefined(testClass!.customAttributes!["ExampleCustomAttributes.ExampleSchema"]);
    });
    const mustBeAnArrayJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testClass: {
          schemaItemType: "EntityClass",
          customAttributes: "ExampleCustomAttributes.ExampleSchema",
        },
      },
    };
    it("async - Custom Attributes must be an array", async () => {
      await expect(Schema.fromJson(mustBeAnArrayJson)).to.be.rejectedWith(ECObjectsError, `The AnyClass testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
    it("sync - Custom Attributes must be an array", async () => {
      assert.throws(() => Schema.fromJsonSync(mustBeAnArrayJson), ECObjectsError, `The AnyClass testClass has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
    it("sync - Deserialize Multiple Custom Attributes with additional properties", () => {
      const classJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testClass: {
            schemaItemType: "EntityClass",
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
          },
        },
      };
      schema = Schema.fromJsonSync(classJson);

      const testClass = schema.getItemSync<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"]);
      assert.isDefined(testClass!.customAttributes!["ExampleCustomAttributes.ExampleSchema"]);
      assert.isDefined(testClass!.customAttributes!["AnotherCustomAttributes.ExampleSchema1"]);
      assert(testClass!.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === 1.2);
      assert(testClass!.customAttributes!["ExampleCustomAttributes.ExampleSchema"].ExampleAttribute === true);
      assert(testClass!.customAttributes!["AnotherCustomAttributes.ExampleSchema1"].Example2Attribute === "example");
    });

    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testPrimProp",
              },
              {
                type: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                type: "PrimitiveArrayProperty",
                typeName: "string",
                name: "testPrimArrProp",
              },
              {
                type: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getItem<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testPrimProp = await testEntity!.getProperty("testPrimProp");
      assert.isDefined(testPrimProp);
      const testPrimArrProp = await testEntity!.getProperty("testPrimArrProp");
      assert.isDefined(testPrimArrProp);
      const testStructProp = await testEntity!.getProperty("testStructProp");
      assert.isDefined(testStructProp);
      const testStructArrProp = await testEntity!.getProperty("testStructArrProp");
      assert.isDefined(testStructArrProp);
    });
  });

  describe("deserialization sync", () => {
    it("class with base class", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      schema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(schema);

      const testClass = schema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testClass);
      assert.isDefined(testClass!.getBaseClassSync());

      const baseClass = schema.getItemSync<EntityClass>("testBaseClass");
      assert.isDefined(baseClass);
      assert.isTrue(baseClass === testClass!.getBaseClassSync());
    });

    it("class with base class in reference schema", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "RefSchema",
            version: "1.0.5",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const refBaseClass = (refSchema as MutableSchema).createEntityClassSync("BaseClassInRef");

      const context = new SchemaContext();
      context.addSchemaSync(refSchema);

      schema = Schema.fromJsonSync(schemaJson, context);

      const testClass = schema.getItemSync<EntityClass>("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.getBaseClassSync());
      assert.isTrue(testClass!.getBaseClassSync() === refBaseClass);
    });
    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                type: "PrimitiveProperty",
                typeName: "double",
                name: "testPrimProp",
              },
              {
                type: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                type: "PrimitiveArrayProperty",
                typeName: "string",
                name: "testPrimArrProp",
              },
              {
                type: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testPrimProp = testEntity!.getPropertySync("testPrimProp");
      assert.isDefined(testPrimProp);
      const testPrimArrProp = testEntity!.getPropertySync("testPrimArrProp");
      assert.isDefined(testPrimArrProp);
      const testStructProp = testEntity!.getPropertySync("testStructProp");
      assert.isDefined(testStructProp);
      const testStructArrProp = testEntity!.getPropertySync("testStructArrProp");
      assert.isDefined(testStructArrProp);
    });
  });

  describe("fromJson", () => {
    let testClass: ECClass;
    class MockECClass extends ECClass {
      public readonly schemaItemType!: SchemaItemType.EntityClass; // tslint:disable-line
      constructor(newSchema: Schema, name: string) {
        super(newSchema, name);
        this.schemaItemType = SchemaItemType.EntityClass;
      }
      public async accept() { }
    }

    beforeEach(() => {
      testClass = new MockECClass(schema, "TestClass");
    });

    it("should throw for invalid modifier", async () => {
      expect(testClass).to.exist;
      const invalidModifierJson = { schemaItemType: "EntityClass", modifier: 0 };
      await expect(testClass.fromJson(invalidModifierJson)).to.be.rejectedWith(ECObjectsError, `The ECClass TestClass has an invalid 'modifier' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid baseClass", async () => {
      expect(testClass).to.exist;
      const invalidBaseClassJson = { schemaItemType: "EntityClass", baseClass: 0 };
      await expect(testClass.fromJson(invalidBaseClassJson)).to.be.rejectedWith(ECObjectsError, `The ECClass TestClass has an invalid 'baseClass' attribute. It should be of type 'string'.`);

      const unloadedBaseClassJson = { schemaItemType: "EntityClass", baseClass: "ThisClassDoesNotExist" };
      await expect(testClass.fromJson(unloadedBaseClassJson)).to.be.rejectedWith(ECObjectsError);
    });
  });
  describe("toJson", () => {
    const schemaJsonOne = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testBaseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.testBaseClass",
          properties: [
            {
              name: "ValidProp",
              description: "A really long description...",
              label: "SomeDisplayLabel",
              type: "PrimitiveProperty",
              isReadOnly: true,
              priority: 100,
              typeName: "double",
            },
          ],
        },
      },
    };
    it("async - Simple serialization", async () => {
      schema = await Schema.fromJson(schemaJsonOne);
      assert.isDefined(schema);

      const testClass = await schema.getItem<EntityClass>("testClass");
      assert.isDefined(testClass);
      expect(testClass).to.exist;
      const serialized = testClass!.toJson(true, true);
      expect(serialized.baseClass).eql("TestSchema.testBaseClass");
      expect(serialized.properties[0].name).eql("ValidProp");
      expect(serialized.properties[0].description).eql("A really long description...");
      expect(serialized.properties[0].label).eql("SomeDisplayLabel");
      expect(serialized.properties[0].type).eql("PrimitiveProperty");
      expect(serialized.properties[0].isReadOnly).eql(true);
      expect(serialized.properties[0].priority).eql(100);
    });
    it("sync - Simple serialization", () => {
      schema = Schema.fromJsonSync(schemaJsonOne);
      assert.isDefined(schema);

      const testClass = schema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testClass);
      const serialized = testClass!.toJson(true, true);
      assert(serialized.properties[0].name, "ValidProp");
      assert(serialized.properties[0].description, "A really long description...");
      assert(serialized.properties[0].label, "SomeDisplayLabel");
      assert(serialized.properties[0].type, "PrimitiveProperty");
      assert(serialized.properties[0].isReadOnly === true);
      assert(serialized.properties[0].priority === 100);
    });
    const schemaJsonFive = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testBaseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.testBaseClass",
          properties: [
            {
              name: "ValidProp",
              description: "A really long description...",
              label: "SomeDisplayLabel",
              type: "PrimitiveProperty",
              isReadOnly: true,
              priority: 100,
              typeName: "double",
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
            },
          ],
        },
      },
    };
    it("async - Serialization with multiple custom attributes- additional properties", async () => {
      schema = await Schema.fromJson(schemaJsonFive);
      assert.isDefined(schema);

      const testClass = await schema.getItem<EntityClass>("testClass");
      assert.isDefined(testClass);
      const serialized = testClass!.toJson(true, true);
      assert(serialized.properties[0].customAttributes[0].ShowClasses === true);
      assert(serialized.properties[0].customAttributes[1].FloatValue === 1.2);
      assert(serialized.properties[0].customAttributes[2].IntegerValue === 5);
    });
    it("sync - Serialization with multiple custom attributes- additional properties", () => {
      schema = Schema.fromJsonSync(schemaJsonFive);
      assert.isDefined(schema);

      const testClass = schema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testClass);
      const serialized = testClass!.toJson(true, true);
      assert(serialized.properties[0].customAttributes[0].ShowClasses === true);
      assert(serialized.properties[0].customAttributes[1].FloatValue === 1.2);
      assert(serialized.properties[0].customAttributes[2].IntegerValue === 5);
    });
    const schemaJsonSix = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testBaseClass: {
          schemaItemType: "EntityClass",
        },
        testClass: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.testBaseClass",
          properties: [
            {
              name: "A",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "B",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "C",
              type: "PrimitiveProperty",
              typeName: "double",
            },
            {
              name: "D",
              type: "PrimitiveProperty",
              typeName: "double",
            },
          ],
        },
      },
    };
    it("async - Serialization with proper order of properties", async () => {
      schema = await Schema.fromJson(schemaJsonSix);
      assert.isDefined(schema);

      const testClass = await schema.getItem<EntityClass>("testClass");
      assert.isDefined(testClass);
      const serialized = testClass!.toJson(true, true);
      assert(serialized.properties[0].name, "A");
      assert(serialized.properties[1].name, "B");
      assert(serialized.properties[2].name, "C");
      assert(serialized.properties[3].name, "D");
    });
    it("sync - Serialization with proper order of properties", () => {
      schema = Schema.fromJsonSync(schemaJsonSix);
      assert.isDefined(schema);

      const testClass = schema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testClass);
      const serialized = testClass!.toJson(true, true);
      assert(serialized.properties[0].name, "A");
      assert(serialized.properties[1].name, "B");
      assert(serialized.properties[2].name, "C");
      assert(serialized.properties[3].name, "D");
    });
  });

  describe("accept", () => {
    let testClass: ECClass;
    class MockECClass extends ECClass { }

    beforeEach(() => {
      testClass = new MockECClass(schema, "TestClass");
    });

    it("should call visitClass on a SchemaItemVisitor object", async () => {
      expect(testClass).to.exist;
      const mockVisitor = { visitClass: sinon.spy() };
      await testClass.accept(mockVisitor);
      expect(mockVisitor.visitClass.calledOnce).to.be.true;
      expect(mockVisitor.visitClass.calledWithExactly(testClass)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitClass defined", async () => {
      expect(testClass).to.exist;
      await testClass.accept({});
    });
  });

  describe("getAllBaseClasses", () => {
    // This is the class hierarchy used in this test. The numbers indicate override priority,
    // i.e., the order that they should be returned by testClass.getAllBaseClasses():
    //
    //  2[A]  3(B)  5(C)  7(D)          [] := EntityClass
    //     \   /     /     /            () := Mixin
    //    1[ G ]  4(E)  6(F)
    //        \    /     /
    //        [    H    ]
    //
    const testSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        A: { schemaItemType: "EntityClass" },
        B: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        C: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        D: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        E: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.C" },
        F: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.D" },
        G: { schemaItemType: "EntityClass", baseClass: "TestSchema.A", mixins: ["TestSchema.B"] },
        H: { schemaItemType: "EntityClass", baseClass: "TestSchema.G", mixins: ["TestSchema.E", "TestSchema.F"] },
      },
    };
    const expectedNames = ["G", "A", "B", "E", "C", "F", "D"];

    it("should correctly traverse a complex inheritance hierarchy", async () => {
      const actualNames: string[] = [];

      schema = await Schema.fromJson(testSchemaJson);
      expect(schema).to.exist;

      const testClass = await schema.getItem<ECClass>("H");
      expect(testClass).to.exist;
      for await (const baseClass of testClass!.getAllBaseClasses()) {
        actualNames.push(baseClass.name);
      }

      expect(actualNames).to.eql(expectedNames);
    });

    it("should correctly traverse a complex inheritance hierarchy synchronously", () => {
      schema = Schema.fromJsonSync(testSchemaJson);
      expect(schema).to.exist;
      const testClass = schema.getItemSync<ECClass>("H");
      expect(testClass).to.exist;

      const syncActualNames: string[] = [];
      for (const baseClass of testClass!.getAllBaseClassesSync()) {
        syncActualNames.push(baseClass.name);
      }
      expect(syncActualNames).to.eql(expectedNames);
    });
  });

  describe("NavProperty on CustomAttributeClass", () => {
    function createSchemaJson(nestedJson: any): any {
      return createSchemaJsonWithItems({
        TestCA: {
          schemaItemType: "CustomAttributeClass",
          ...nestedJson,
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
        NavPropRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "Embedding",
          strengthDirection: "Forward",
          modifier: "Sealed",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            constraintClasses: ["TestSchema.TestEntity"],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            constraintClasses: ["TestSchema.TestEntity"],
          },
        },
      });
    }

    it("should throw", async () => {
      const json = createSchemaJson({
        appliesTo: "Any",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      await assert.isRejected(Schema.fromJson(json), "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
    });

    it("should throw synchronously", () => {
      const json = createSchemaJson({
        appliesTo: "Any",
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.NavPropRelationship",
            direction: "forward",
          },
        ],
      });

      assert.throw(() => Schema.fromJsonSync(json), "The Navigation Property TestCA.testNavProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.");
    });
  });
});
