/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { PrimitiveType } from "../../ECObjects";
import type { ECClass, MutableClass } from "../../Metadata/Class";
import type { MutableSchema} from "../../Metadata/Schema";
import { Schema } from "../../Metadata/Schema";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Property Inheritance", () => {
  describe("Struct class with two levels of base classes", () => {
    // Using a struct here, because entity has a different implementation
    //
    //  [RootClass:P1,P2]
    //         |
    //  [MiddleClass:P2,P1,P3]
    //         |
    //  [TestClass:P4,P3]
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        RootClass: {
          schemaItemType: "StructClass",
          properties: [
            { name: "P1", type: "PrimitiveProperty", typeName: "string" },
            { name: "P2", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        MiddleClass: {
          schemaItemType: "StructClass", baseClass: "TestSchema.RootClass",
          properties: [
            { name: "P2", type: "PrimitiveProperty", typeName: "string" },
            { name: "P1", type: "PrimitiveProperty", typeName: "string" },
            { name: "P3", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        TestClass: {
          schemaItemType: "StructClass", baseClass: "TestSchema.MiddleClass",
          properties: [
            { name: "P4", type: "PrimitiveProperty", typeName: "string" },
            { name: "P3", type: "PrimitiveProperty", typeName: "string" }],
        },
      },
    };

    const expectedResult = ["P1(MiddleClass)", "P2(MiddleClass)", "P3(TestClass)", "P4(TestClass)"];

    it("async iteration", async () => {
      const schema = (await Schema.fromJson(schemaJson, new SchemaContext())) as MutableSchema;
      const testClass = await schema.getItem<ECClass>("TestClass");
      const props = await testClass!.getProperties();
      const names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);
    });

    it("sync iteration", () => {
      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext()) as MutableSchema;
      const testClass = schema.getItemSync<ECClass>("TestClass");
      const props = testClass!.getPropertiesSync();
      const names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);
    });
  });

  describe("Entity class with two levels of base classes", () => {
    //  [RootClass:P1,P2]
    //         |
    //  [MiddleClass:P2,P1,P3]
    //         |
    //  [TestClass:P4,P3]
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        RootClass: {
          schemaItemType: "EntityClass",
          properties: [
            { name: "P1", type: "PrimitiveProperty", typeName: "string" },
            { name: "P2", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        MiddleClass: {
          schemaItemType: "EntityClass", baseClass: "TestSchema.RootClass",
          properties: [
            { name: "P2", type: "PrimitiveProperty", typeName: "string" },
            { name: "P1", type: "PrimitiveProperty", typeName: "string" },
            { name: "P3", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        TestClass: {
          schemaItemType: "EntityClass", baseClass: "TestSchema.MiddleClass",
          properties: [
            { name: "P4", type: "PrimitiveProperty", typeName: "string" },
            { name: "P3", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
      },
    };

    const expectedResult = ["P1(MiddleClass)", "P2(MiddleClass)", "P3(TestClass)", "P4(TestClass)"];

    it("async iteration", async () => {
      const schema = (await Schema.fromJson(schemaJson, new SchemaContext())) as MutableSchema;
      const testClass = await schema.getItem<ECClass>("TestClass");
      const props = await testClass!.getProperties();
      const names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);
    });

    it("sync iteration", () => {
      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext()) as MutableSchema;
      const testClass = schema.getItemSync<ECClass>("TestClass");
      const props = testClass!.getPropertiesSync();
      const names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);
    });
  });

  describe("Cache invalidation when things change", () => {
    //  [RootClass:P1,P2]
    //         |
    //  [MiddleClass:P2,P1,P3]  (Mixin:P5)
    //         |               /
    //         [TestClass:P4,P3]
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        RootClass: {
          schemaItemType: "EntityClass",
          properties: [{ name: "P1", type: "PrimitiveProperty", typeName: "string" }],
        },
        Mixin: {
          schemaItemType: "Mixin", appliesTo: "TestSchema.RootClass",
          properties: [{ name: "P5", type: "PrimitiveProperty", typeName: "string" }],
        },
        TestClass: { schemaItemType: "EntityClass", baseClass: "TestSchema.RootClass", mixins: ["TestSchema.Mixin"] },
      },
    };

    const expectedResult = ["P1(RootClass)", "P5(Mixin)"];
    const expectedResult2 = ["P1(RootClass)", "P2(RootClass)", "P5(Mixin)"];
    const expectedResult3 = ["P1(RootClass)", "P2(RootClass)", "P5(Mixin)", "P3(TestClass)"];

    it("async iteration", async () => {
      const schema = (await Schema.fromJson(schemaJson, new SchemaContext())) as MutableSchema;
      const testClass = await schema.getItem("TestClass") as MutableClass;
      const rootClass = await schema.getItem("RootClass") as MutableClass;
      let props = await testClass.getProperties();
      let names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      await rootClass.createPrimitiveProperty("P2", PrimitiveType.String);

      // this should use the cache and return old results
      props = await testClass.getProperties();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      props = await testClass.getProperties(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      await testClass.createPrimitiveProperty("P3", PrimitiveType.String);

      // this should use the cache and return old results
      props = await testClass.getProperties();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      props = await testClass.getProperties(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult3);
    });

    it("sync iteration", () => {
      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext()) as MutableSchema;
      const testClass = schema.getItemSync("TestClass") as MutableClass;
      const rootClass = schema.getItemSync("RootClass") as MutableClass;
      let props = testClass.getPropertiesSync();
      let names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      rootClass.createPrimitivePropertySync("P2", PrimitiveType.String);

      // this should use the cache and return old results
      props = testClass.getPropertiesSync();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      props = testClass.getPropertiesSync(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      testClass.createPrimitivePropertySync("P3", PrimitiveType.String);

      // this should use the cache and return old results
      props = testClass.getPropertiesSync();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      props = testClass.getPropertiesSync(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult3);
    });
  });

  describe("Cache invalidation when things change with struct class", () => {
    //  [RootClass:P1,P2]
    //         |
    //  [MiddleClass:P2,P1,P3]
    //         |
    //  [TestClass:P4,P3]
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        RootClass: {
          schemaItemType: "StructClass",
          properties: [{ name: "P1", type: "PrimitiveProperty", typeName: "string" }],
        },
        TestClass: { schemaItemType: "StructClass", baseClass: "TestSchema.RootClass" },
      },
    };

    const expectedResult = ["P1(RootClass)"];
    const expectedResult2 = ["P1(RootClass)", "P2(RootClass)"];
    const expectedResult3 = ["P1(RootClass)", "P2(RootClass)", "P3(TestClass)"];

    it("async iteration", async () => {
      const schema = (await Schema.fromJson(schemaJson, new SchemaContext())) as MutableSchema;
      const testClass = await schema.getItem("TestClass") as MutableClass;
      const rootClass = await schema.getItem("RootClass") as MutableClass;
      let props = await testClass.getProperties();
      let names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      await rootClass.createPrimitiveProperty("P2", PrimitiveType.String);

      // this should use the cache and return old results
      props = await testClass.getProperties();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      props = await testClass.getProperties(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      await testClass.createPrimitiveProperty("P3", PrimitiveType.String);

      // this should use the cache and return old results
      props = await testClass.getProperties();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      props = await testClass.getProperties(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult3);
    });

    it("sync iteration", () => {
      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext()) as MutableSchema;
      const testClass = schema.getItemSync("TestClass") as MutableClass;
      const rootClass = schema.getItemSync("RootClass") as MutableClass;
      let props = testClass.getPropertiesSync();
      let names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      rootClass.createPrimitivePropertySync("P2", PrimitiveType.String);

      // this should use the cache and return old results
      props = testClass.getPropertiesSync();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult);

      props = testClass.getPropertiesSync(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      testClass.createPrimitivePropertySync("P3", PrimitiveType.String);

      // this should use the cache and return old results
      props = testClass.getPropertiesSync();
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult2);

      props = testClass.getPropertiesSync(true);
      names = props.map((p) => `${p.name}(${p.class.name})`);
      assert.deepEqual(names, expectedResult3);
    });
  });

  describe("Entity with complex base and mixin hierarchy", () => {
    // This is the class hierarchy used in this test. The numbers indicate override priority,
    // i.e., the order that they should be returned by testClass.getAllBaseClasses():
    //
    //  [A:P1,P2]  (B)  (C:P3)  (D:P4)          [] := EntityClass
    //     \      /      /     /            () := Mixin
    //    2[ G:P1 ]  (E)    (F)
    //           \    /     /
    //             [H:P2]
    // We are using the labels to tell the properties apart which have been overwritten
    const testSchemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "01.00.00",
      alias: "ts",
      items: {
        A: {
          schemaItemType: "EntityClass",
          properties: [
            { name: "P1", type: "PrimitiveProperty", typeName: "string" },
            { name: "P2", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        B: { schemaItemType: "Mixin", appliesTo: "TestSchema.A" },
        C: {
          schemaItemType: "Mixin", appliesTo: "TestSchema.A",
          properties: [
            { name: "P3", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        D: {
          schemaItemType: "Mixin", appliesTo: "TestSchema.A",
          properties: [
            { name: "P4", type: "PrimitiveProperty", typeName: "string" },
          ],
        },
        E: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.C" },
        F: { schemaItemType: "Mixin", appliesTo: "TestSchema.A", baseClass: "TestSchema.D" },
        G: {
          schemaItemType: "EntityClass", baseClass: "TestSchema.A", mixins: ["TestSchema.B"],
          properties: [{ name: "P1", type: "PrimitiveProperty", typeName: "string" }],
        },
        H: {
          schemaItemType: "EntityClass", baseClass: "TestSchema.G", mixins: ["TestSchema.E", "TestSchema.F"],
          properties: [{ name: "P2", type: "PrimitiveProperty", typeName: "string" }],
        },
      },
    };
    const expectedOrder = ["P1(G)", "P2(H)", "P3(C)", "P4(D)"];

    it("async iteration", async () => {
      const schema = await Schema.fromJson(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const testClass = await schema.getItem<ECClass>("H");
      expect(testClass).to.exist;
      const result = await testClass!.getProperties();
      const names = result.map((p) => `${p.name}(${p.class.name})`);

      assert.deepEqual(names, expectedOrder);
    });

    it("sync iteration", () => {
      const schema = Schema.fromJsonSync(testSchemaJson, new SchemaContext());
      expect(schema).to.exist;

      const testClass = schema.getItemSync<ECClass>("H");
      expect(testClass).to.exist;
      const result = testClass!.getPropertiesSync();
      const names = result.map((p) => `${p.name}(${p.class.name})`);

      assert.deepEqual(names, expectedOrder);
    });
  });
});
