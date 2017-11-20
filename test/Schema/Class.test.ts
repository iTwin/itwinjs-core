/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
import { ECClass, EntityClass } from "../../source/Metadata/Class";
import { SchemaContext } from "../../source/Context";

describe("class", () => {
  describe("deserialization", () => {
    it("class with base class", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testBaseClass: {
            schemaChildType: "EntityClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "TestSchema.testBaseClass",
          },
        },
      };

      const ecschema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecschema);

      let testClass = ecschema.getClass("testClass");
      assert.isDefined(testClass);
      testClass = testClass as ECClass;
      assert.isDefined(testClass.baseClass);

      const baseClass = ecschema.getClass("testBaseClass");
      assert.isDefined(baseClass);

      assert.isTrue(baseClass === testClass.baseClass);
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
        children: {
          testClass: {
            schemaChildType: "EntityClass",
            baseClass: "RefSchema.BaseClassInRef",
          },
        },
      };

      const refSchema = new ECSchema("RefSchema", 1, 0, 5);
      const refBaseClass = refSchema.createEntityClass("BaseClassInRef");

      const context = new SchemaContext();
      context.addSchema(refSchema);

      const schema = ECSchema.fromJson(schemaJson, context);

      const testClass = schema.getClass("testClass");

      assert.isDefined(testClass);
      assert.isDefined(testClass!.baseClass);
      assert.isTrue(testClass!.baseClass === refBaseClass);
    });

    // Used to test that all property types are deserialized correctly. For failure and other tests look at the property
    // specific test files.
    it("with properties", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testStruct: {
            schemaChildType: "StructClass",
          },
          testClass: {
            schemaChildType: "EntityClass",
            properties: [
              {
                propertyType: "PrimitiveProperty",
                name: "testPrimProp",
              },
              {
                propertyType: "StructProperty",
                name: "testStructProp",
                typeName: "TestSchema.testStruct",
              },
              {
                propertyType: "PrimitiveArrayProperty",
                name: "testPrimArrProp",
              },
              {
                propertyType: "StructArrayProperty",
                name: "testStructArrProp",
                typeName: "TestSchema.testStruct",
              },
            ],
          },
        },
      };

      const ecSchema = ECSchema.fromJson(schemaJson);
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getClass<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testPrimProp = testEntity!.getProperty("testPrimProp");
      assert.isDefined(testPrimProp);
      const testPrimArrProp = testEntity!.getProperty("testPrimArrProp");
      assert.isDefined(testPrimArrProp);
      const testStructProp = testEntity!.getProperty("testStructProp");
      assert.isDefined(testStructProp);
      const testStructArrProp = testEntity!.getProperty("testStructArrProp");
      assert.isDefined(testStructArrProp);
    });
  });
});
