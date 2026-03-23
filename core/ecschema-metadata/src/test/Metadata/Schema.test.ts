/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { ECClassModifier, PrimitiveType, PropertyType, SchemaItemType, StrengthType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { ECClass, StructClass } from "../../Metadata/Class";
import { EntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument, getElementChildren, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { SchemaReadHelper } from "../../Deserialization/Helper";
import { XmlParser } from "../../Deserialization/XmlParser";
import { SchemaKey } from "../../SchemaKey";
import { expectAsyncToThrow, expectToThrow } from "../TestUtils/AssertionHelpers";

import { Constant, CustomAttributeClass, ECSchemaNamespaceUris, Enumeration, Format, InvertedUnit, KindOfQuantity, Phenomenon, Property, PropertyCategory, RelationshipClass, SchemaItem, Unit, UnitSystem } from "../../ecschema-metadata";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */
describe("Schema", () => {
  describe("api creation of schema", () => {
    it("with only the essentials", () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchemaCreation", "ts", 10, 99, 15);
      assert.strictEqual(testSchema.name, "TestSchemaCreation");
      assert.strictEqual(testSchema.readVersion, 10);
      assert.strictEqual(testSchema.writeVersion, 99);
      assert.strictEqual(testSchema.minorVersion, 15);
    });

    it("with invalid version numbers should fail", () => {
      const context = new SchemaContext();
      expect(() => new Schema(context, "NewSchemaWithInvalidReadVersion", "new", 9999, 4, 5)).toThrow(ECSchemaError);
      expect(() => new Schema(context, "NewSchemaWithInvalidWriteVersion", "new", 12, 9999, 6)).toThrow(ECSchemaError);
      expect(() => new Schema(context, "NewSchemaWithInvalidMinorVersion", "new", 12, 34, 56700000)).toThrow(ECSchemaError);
    });
  });

  describe("miscellaneous API tests", () => {
    it("getReferenceNameByAlias, reference exists, correct name returned.", async () => {
      const refSchemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "RefSchema",
        version: "1.0.0",
        alias: "rs",
      };

      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
        ],
      };
      const context = new SchemaContext();
      await Schema.fromJson(refSchemaJson, context);
      const testSchema = await Schema.fromJson(schemaJson, context);

      expect(testSchema.getReferenceNameByAlias("rs")).toEqual("RefSchema");
    });

    it("getReferenceNameByAlias, reference does not exist, returns undefined.", async () => {
      const refSchemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "RefSchema",
        version: "1.0.0",
        alias: "rs",
      };

      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
        ],
      };
      const context = new SchemaContext();
      await Schema.fromJson(refSchemaJson, context);
      const testSchema = await Schema.fromJson(schemaJson, context);

      expect(testSchema.getReferenceNameByAlias("missing")).toBeUndefined();
    });

    it("getReferenceNameByAlias, no references, returns undefined.", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      const context = new SchemaContext();
      const testSchema = await Schema.fromJson(schemaJson, context);

      expect(testSchema.getReferenceNameByAlias("rs")).toBeUndefined();
    });
  });

  describe("create schema items", () => {
    it("should succeed for entity class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);
    });

    it("should succeed for mixin class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createMixinClass("TestMixin");

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).toEqual(true);
      expect((await testSchema.getItem("TestMixin", Mixin))?.schemaItemType).toEqual(SchemaItemType.Mixin);
    });

    it("should succeed for struct class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createStructClass("TestStruct");

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).toEqual(true);
      expect((await testSchema.getItem("TestStruct", StructClass))?.schemaItemType).toEqual(SchemaItemType.StructClass);
    });

    it("should succeed for non-class schema items", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createKindOfQuantity("TestKindOfQuantity");
      await (testSchema as MutableSchema).createEnumeration("TestEnumeration");
      await (testSchema as MutableSchema).createUnit("TestUnit");
      await (testSchema as MutableSchema).createPropertyCategory("TestPropertyCategory");
      await (testSchema as MutableSchema).createFormat("TestFormat");

      const schemaItems = Array.from(testSchema.getItems());

      expect(schemaItems.length).toEqual(5);
      expect(schemaItems[0].schemaItemType).toEqual(SchemaItemType.KindOfQuantity);
      expect(schemaItems[1].schemaItemType).toEqual(SchemaItemType.Enumeration);
      expect(schemaItems[2].schemaItemType).toEqual(SchemaItemType.Unit);
      expect(schemaItems[3].schemaItemType).toEqual(SchemaItemType.PropertyCategory);
      expect(schemaItems[4].schemaItemType).toEqual(SchemaItemType.Format);
    });

    it("should succeed with case-insensitive search", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      await (testSchema as MutableSchema).createEntityClass("testEntity");

      expect(await testSchema.getItem("TESTENTITY")).toBeDefined();
      expect(await testSchema.getItem("TestEntity")).toBeDefined();
      expect(await testSchema.getItem("testEntity")).toBeDefined();
    });
  });

  describe("adding and deleting SchemaItems from schemas", async () => {
    it("should do nothing when deleting SchemaItem name that is not in schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });

    it("should do nothing when deleting SchemaItem name that is not in schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });

    it("should do nothing if SchemaItem is already deleted, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });

    it("should do nothing if SchemaItem is already deleted", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });

    it("should add and delete classes by case-insensitive names", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem1");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem2");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem3");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem1"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem1", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem2"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem2", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem3"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem3", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem1");
      expect(await testSchema.getItem("TestUnitSystem1")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("testunitsystem2");
      expect(await testSchema.getItem("TestUnitSystem2")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TESTUNITSYSTEM3");
      expect(await testSchema.getItem("TestUnitSystem3")).toBeUndefined();
    });

    it("should add and delete classes by case-insensitive names, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem1");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem2");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem3");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem1"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem1", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem2"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem2", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem3"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem3", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem1");
      expect(await testSchema.getItem("TestUnitSystem1")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("testunitsystem2");
      expect(await testSchema.getItem("TestUnitSystem2")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TESTUNITSYSTEM3");
      expect(await testSchema.getItem("TestUnitSystem3")).toBeUndefined();
    });

    it("should successfully delete for all SchemaItems from schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createConstant("TestConstant");
      await (testSchema as MutableSchema).createEnumeration("TestEnumeration");
      await (testSchema as MutableSchema).createFormat("TestFormat");
      await (testSchema as MutableSchema).createInvertedUnit("TestInvertedUnit");
      await (testSchema as MutableSchema).createUnit("TestUnit");
      await (testSchema as MutableSchema).createKindOfQuantity("TestKindOfQuantity");
      await (testSchema as MutableSchema).createPhenomenon("TestPhenomenon");
      await (testSchema as MutableSchema).createPropertyCategory("TestPropertyCategory");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestConstant"))).toEqual(true);
      expect((await testSchema.getItem("TestConstant", Constant))?.schemaItemType).toEqual(SchemaItemType.Constant);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestEnumeration"))).toEqual(true);
      expect((await testSchema.getItem("TestEnumeration", Enumeration))?.schemaItemType).toEqual(SchemaItemType.Enumeration);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestFormat"))).toEqual(true);
      expect((await testSchema.getItem("TestFormat", Format))?.schemaItemType).toEqual(SchemaItemType.Format);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestInvertedUnit"))).toEqual(true);
      expect((await testSchema.getItem("TestInvertedUnit", InvertedUnit))?.schemaItemType).toEqual(SchemaItemType.InvertedUnit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnit"))).toEqual(true);
      expect((await testSchema.getItem("TestUnit", Unit))?.schemaItemType).toEqual(SchemaItemType.Unit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestKindOfQuantity"))).toEqual(true);
      expect((await testSchema.getItem("TestKindOfQuantity", KindOfQuantity))?.schemaItemType).toEqual(SchemaItemType.KindOfQuantity);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPhenomenon"))).toEqual(true);
      expect((await testSchema.getItem("TestPhenomenon", Phenomenon))?.schemaItemType).toEqual(SchemaItemType.Phenomenon);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPropertyCategory"))).toEqual(true);
      expect((await testSchema.getItem("TestPropertyCategory", PropertyCategory))?.schemaItemType).toEqual(SchemaItemType.PropertyCategory);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestConstant");
      expect(await testSchema.getItem("TestConstant")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestEnumeration");
      expect(await testSchema.getItem("TestEnumeration")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestFormat");
      expect(await testSchema.getItem("TestFormat")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestInvertedUnit");
      expect(await testSchema.getItem("TestInvertedUnit")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnit");
      expect(await testSchema.getItem("TestUnit")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestKindOfQuantity");
      expect(await testSchema.getItem("TestKindOfQuantity")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestPhenomenon");
      expect(await testSchema.getItem("TestPhenomenon")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestPropertyCategory");
      expect(await testSchema.getItem("TestPropertyCategory")).toBeUndefined();

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });

    it("should successfully delete for all SchemaItems from schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createConstant("TestConstant");
      await (testSchema as MutableSchema).createEnumeration("TestEnumeration");
      await (testSchema as MutableSchema).createFormat("TestFormat");
      await (testSchema as MutableSchema).createInvertedUnit("TestInvertedUnit");
      await (testSchema as MutableSchema).createUnit("TestUnit");
      await (testSchema as MutableSchema).createKindOfQuantity("TestKindOfQuantity");
      await (testSchema as MutableSchema).createPhenomenon("TestPhenomenon");
      await (testSchema as MutableSchema).createPropertyCategory("TestPropertyCategory");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestConstant"))).toEqual(true);
      expect((await testSchema.getItem("TestConstant", Constant))?.schemaItemType).toEqual(SchemaItemType.Constant);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestEnumeration"))).toEqual(true);
      expect((await testSchema.getItem("TestEnumeration", Enumeration))?.schemaItemType).toEqual(SchemaItemType.Enumeration);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestFormat"))).toEqual(true);
      expect((await testSchema.getItem("TestFormat", Format))?.schemaItemType).toEqual(SchemaItemType.Format);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestInvertedUnit"))).toEqual(true);
      expect((await testSchema.getItem("TestInvertedUnit", InvertedUnit))?.schemaItemType).toEqual(SchemaItemType.InvertedUnit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnit"))).toEqual(true);
      expect((await testSchema.getItem("TestUnit", Unit))?.schemaItemType).toEqual(SchemaItemType.Unit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestKindOfQuantity"))).toEqual(true);
      expect((await testSchema.getItem("TestKindOfQuantity", KindOfQuantity))?.schemaItemType).toEqual(SchemaItemType.KindOfQuantity);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPhenomenon"))).toEqual(true);
      expect((await testSchema.getItem("TestPhenomenon", Phenomenon))?.schemaItemType).toEqual(SchemaItemType.Phenomenon);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPropertyCategory"))).toEqual(true);
      expect((await testSchema.getItem("TestPropertyCategory", PropertyCategory))?.schemaItemType).toEqual(SchemaItemType.PropertyCategory);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).toEqual(true);
      expect((await testSchema.getItem("TestUnitSystem", UnitSystem))?.schemaItemType).toEqual(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestConstant");
      expect(await testSchema.getItem("TestConstant")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestEnumeration");
      expect(await testSchema.getItem("TestEnumeration")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestFormat");
      expect(await testSchema.getItem("TestFormat")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestInvertedUnit");
      expect(await testSchema.getItem("TestInvertedUnit")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnit");
      expect(await testSchema.getItem("TestUnit")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestKindOfQuantity");
      expect(await testSchema.getItem("TestKindOfQuantity")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestPhenomenon");
      expect(await testSchema.getItem("TestPhenomenon")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestPropertyCategory");
      expect(await testSchema.getItem("TestPropertyCategory")).toBeUndefined();

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).toBeUndefined();
    });
  });

  describe("adding and deleting classes from schemas", async () => {
    it("should do nothing when deleting class name that is not in schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();
    });

    it("should do nothing when deleting class name that is not in schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();
    });

    it("should do nothing if class is already deleted, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();
    });

    it("should do nothing if class is already deleted", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();
    });

    it("should add and delete classes by case-insensitive names", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity1");
      await (testSchema as MutableSchema).createEntityClass("TestEntity2");
      await (testSchema as MutableSchema).createEntityClass("TestEntity3");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity1"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity1", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity2"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity2", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity3"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity3", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity1");
      expect(await testSchema.getItem("TestEntity1")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("testentity2");
      expect(await testSchema.getItem("TestEntity2")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TESTENTITY3");
      expect(await testSchema.getItem("TestEntity3")).toBeUndefined();
    });

    it("should add and delete classes by case-insensitive names, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity1");
      await (testSchema as MutableSchema).createEntityClass("TestEntity2");
      await (testSchema as MutableSchema).createEntityClass("TestEntity3");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity1"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity1", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity2"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity2", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity3"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity3", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity1");
      expect(await testSchema.getItem("TestEntity1")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("testentity2");
      expect(await testSchema.getItem("TestEntity2")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TESTENTITY3");
      expect(await testSchema.getItem("TestEntity3")).toBeUndefined();
    });

    it("should successfully delete for all ECClasses from schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");
      await (testSchema as MutableSchema).createMixinClass("TestMixin");
      await (testSchema as MutableSchema).createStructClass("TestStruct");
      await (testSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      await (testSchema as MutableSchema).createRelationshipClass("TestRelationship");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).toEqual(true);
      expect((await testSchema.getItem("TestMixin", Mixin))?.schemaItemType).toEqual(SchemaItemType.Mixin);

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).toEqual(true);
      expect((await testSchema.getItem("TestStruct", StructClass))?.schemaItemType).toEqual(SchemaItemType.StructClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestCustomAttribute"))).toEqual(true);
      expect((await testSchema.getItem("TestCustomAttribute", CustomAttributeClass))?.schemaItemType).toEqual(SchemaItemType.CustomAttributeClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestRelationship"))).toEqual(true);
      expect((await testSchema.getItem("TestRelationship", RelationshipClass))?.schemaItemType).toEqual(SchemaItemType.RelationshipClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestMixin");
      expect(await testSchema.getItem("TestMixin")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestStruct");
      expect(await testSchema.getItem("TestStruct")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestCustomAttribute");
      expect(await testSchema.getItem("TestCustomAttribute")).toBeUndefined();

      (testSchema as MutableSchema).deleteClassSync("TestRelationship");
      expect(await testSchema.getItem("TestRelationship")).toBeUndefined();
    });

    it("should successfully delete for all ECClasses from schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");
      await (testSchema as MutableSchema).createMixinClass("TestMixin");
      await (testSchema as MutableSchema).createStructClass("TestStruct");
      await (testSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      await (testSchema as MutableSchema).createRelationshipClass("TestRelationship");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).toEqual(true);
      expect((await testSchema.getItem("TestEntity", EntityClass))?.schemaItemType).toEqual(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).toEqual(true);
      expect((await testSchema.getItem("TestMixin", Mixin))?.schemaItemType).toEqual(SchemaItemType.Mixin);

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).toEqual(true);
      expect((await testSchema.getItem("TestStruct", StructClass))?.schemaItemType).toEqual(SchemaItemType.StructClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestCustomAttribute"))).toEqual(true);
      expect((await testSchema.getItem("TestCustomAttribute", CustomAttributeClass))?.schemaItemType).toEqual(SchemaItemType.CustomAttributeClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestRelationship"))).toEqual(true);
      expect((await testSchema.getItem("TestRelationship", RelationshipClass))?.schemaItemType).toEqual(SchemaItemType.RelationshipClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestMixin");
      expect(await testSchema.getItem("TestMixin")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestStruct");
      expect(await testSchema.getItem("TestStruct")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestCustomAttribute");
      expect(await testSchema.getItem("TestCustomAttribute")).toBeUndefined();

      await (testSchema as MutableSchema).deleteClass("TestRelationship");
      expect(await testSchema.getItem("TestRelationship")).toBeUndefined();
    });
  });

  describe("bulk get methods for schema items", () => {
    let testSchema: Schema;

    beforeAll(async () => {
      testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");
      await (testSchema as MutableSchema).createMixinClass("TestMixin");
      await (testSchema as MutableSchema).createStructClass("TestStruct");
      await (testSchema as MutableSchema).createKindOfQuantity("TestKindOfQuantity");
      await (testSchema as MutableSchema).createEnumeration("TestEnumeration");
      await (testSchema as MutableSchema).createUnit("TestUnit");
      await (testSchema as MutableSchema).createPropertyCategory("TestPropertyCategory");
      await (testSchema as MutableSchema).createFormat("TestFormat");
    });

    describe("getItems", () => {
      let schemaItems: SchemaItem[];

      beforeEach(() => {
        schemaItems = Array.from(testSchema.getItems());
      });

      it("should return all schema items in schema", () => {
        const itemArray = Array.from(testSchema.getItems());
        expect(itemArray.length).toEqual(8);

        expect(schemaItems.length).toEqual(8);
        expect(schemaItems[0].schemaItemType).toEqual(SchemaItemType.EntityClass);
        expect(schemaItems[1].schemaItemType).toEqual(SchemaItemType.Mixin);
        expect(schemaItems[2].schemaItemType).toEqual(SchemaItemType.StructClass);
        expect(schemaItems[3].schemaItemType).toEqual(SchemaItemType.KindOfQuantity);
        expect(schemaItems[4].schemaItemType).toEqual(SchemaItemType.Enumeration);
        expect(schemaItems[5].schemaItemType).toEqual(SchemaItemType.Unit);
        expect(schemaItems[6].schemaItemType).toEqual(SchemaItemType.PropertyCategory);
        expect(schemaItems[7].schemaItemType).toEqual(SchemaItemType.Format);
      });

      it("should return only class items in schema", async () => {
        const classArray = Array.from(testSchema.getItems(ECClass));
        expect(classArray.length).toEqual(3);

        expect(classArray[0].schemaItemType).toEqual(SchemaItemType.EntityClass);
        expect(classArray[1].schemaItemType).toEqual(SchemaItemType.Mixin);
        expect(classArray[2].schemaItemType).toEqual(SchemaItemType.StructClass);
      });

      it("should return only enumeration items in schema", async () => {
        const classArray = Array.from(testSchema.getItems(Enumeration));
        expect(classArray.length).toEqual(1);

        expect(classArray[0].schemaItemType).toEqual(SchemaItemType.Enumeration);
      });
    });
  });

  describe("Schemas with newer ECXml version", async () => {
    const unsupportedVersionError = `The Schema 'TestSchema' has an unsupported ECSpecVersion and cannot be serialized.`;

    type TestCase = [ xmlVersionMajor: number, xmlVersionMinor: number, deserializtionStatus: boolean, serializationStatus: boolean ];
    const testCases: TestCase[] = [
      // [3, 1, false, false], // Will have to be uncommented and the test below updated when the ECSpec Version gets incremented next.
      [Schema.currentECSpecMajorVersion, Schema.currentECSpecMinorVersion - 1, false, false],
      [Schema.currentECSpecMajorVersion, Schema.currentECSpecMinorVersion, true, true],
      [Schema.currentECSpecMajorVersion, Schema.currentECSpecMinorVersion + 1, true, false],
      [Schema.currentECSpecMajorVersion + 1, Schema.currentECSpecMinorVersion, false, false],
      [Schema.currentECSpecMajorVersion + 1, Schema.currentECSpecMinorVersion + 1, false, false],
    ];

    async function testSerialization(schema: Schema, serializationStatus: boolean, expectedError: string) {
      const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
      if (serializationStatus) {
        // Expect serialization to succeed
        await expect(schema.toXml(xmlDoc)).resolves.toBeDefined();
        expect(() => schema.toJSON()).not.toThrow();
      } else {
        // Expect serialization to fail with the expected error
        await expectAsyncToThrow(async () => schema.toXml(xmlDoc), ECSchemaError, expectedError);
        expectToThrow(() => schema.toJSON(), ECSchemaError, expectedError);
      }
    }

    it("Deserialize and serialize newer XML schemas - sync", async () => {
      for (const [xmlVersionMajor, xmlVersionMinor, deserializtionStatus, serializationStatus] of testCases) {
        const parser = new DOMParser();
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${xmlVersionMajor}.${xmlVersionMinor}">
            <ECEntityClass typeName="testClass" description="Test Entity Class" />
          </ECSchema>`;

        const document = parser.parseFromString(schemaXml);
        const context = new SchemaContext();
        const reader = new SchemaReadHelper(XmlParser, context);
        const schema: Schema = new Schema(context);

        try {
          reader.readSchemaSync(schema, document);
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${xmlVersionMajor}.${xmlVersionMinor} and cannot be loaded.`);
          assert.ok(!deserializtionStatus, `Deserialization check failed for ECXML version ${xmlVersionMajor}.${xmlVersionMinor}`);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus, `Deserialization check failed for ECXML version ${xmlVersionMajor}.${xmlVersionMinor}`);
        expect(schema.originalECSpecMajorVersion).toEqual(xmlVersionMajor);
        expect(schema.originalECSpecMinorVersion).toEqual(xmlVersionMinor);
        expect(schema.getItemSync("testClass") !== undefined).toEqual(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer XML schemas - async", async () => {
      for (const [xmlVersionMajor, xmlVersionMinor, deserializtionStatus, serializationStatus] of testCases) {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${xmlVersionMajor}.${xmlVersionMinor}">
            <ECEntityClass typeName="testClass" description="Test Entity Class" />
          </ECSchema>`;

        const context = new SchemaContext();
        const reader = new SchemaReadHelper(XmlParser, context);
        const schema: Schema = new Schema(context);

        try {
          await reader.readSchema(schema, new DOMParser().parseFromString(schemaXml));
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${xmlVersionMajor}.${xmlVersionMinor} and cannot be loaded.`);
          assert.ok(!deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus);
        expect(schema.originalECSpecMajorVersion).toEqual(xmlVersionMajor);
        expect(schema.originalECSpecMinorVersion).toEqual(xmlVersionMinor);
        expect(await schema.getItem("testClass") !== undefined).toEqual(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas - sync", async () => {
      for (const [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${ecMajorVersion}${ecMinorVersion}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          items: {
            testClass: {
              schemaItemType: "EntityClass",
              name: "EntityTest",
              label: "EntityTest",
              description: "An example entity class.",
            },
          },
        };

        // Create a schema with a proper SchemaKey so it can be serialized even if deserialization fails
        let schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);

        try {
          schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${ecMajorVersion}.${ecMinorVersion} and cannot be loaded.`);
          assert.ok(!deserializtionStatus);

          // When the ECXML major version is newer, deserialization will throw an error and the schema object will never get updated. The ECXMl version will then remain the default latest supported.
          // Hence, serialization should succeed in this case.
          await testSerialization(schema, true, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus);
        expect(schema.originalECSpecMajorVersion).toEqual(ecMajorVersion);
        expect(schema.originalECSpecMinorVersion).toEqual(ecMinorVersion);
        expect(schema.getItemSync("testClass") !== undefined).toEqual(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas - async", async () => {
      for (const [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${ecMajorVersion}${ecMinorVersion}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          items: {
            testClass: {
              schemaItemType: "EntityClass",
              name: "EntityTest",
              label: "EntityTest",
              description: "An example entity class.",
            },
          },
        };

        // Create a schema with a proper SchemaKey so it can be serialized even if deserialization fails
        let schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
        try {
          schema = await Schema.fromJson(schemaJson, new SchemaContext());
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${ecMajorVersion}.${ecMinorVersion} and cannot be loaded.`);
          assert.ok(!deserializtionStatus);

          // When the ECXML major version is newer, deserialization will throw an error and the schema object will never get updated. The ECXMl version will then remain the default latest supported.
          // Hence, serialization should succeed in this case.
          await testSerialization(schema, true, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus);
        expect(schema.originalECSpecMajorVersion).toEqual(ecMajorVersion);
        expect(schema.originalECSpecMinorVersion).toEqual(ecMinorVersion);
        expect(await schema.getItem("testClass") !== undefined).toEqual(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas without a parser - sync", async () => {
      for (const [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${ecMajorVersion}${ecMinorVersion}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
        };

        const schema = new Schema(new SchemaContext());
        try {
          schema.fromJSONSync(schemaJson);
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${ecMajorVersion}.${ecMinorVersion} and cannot be loaded.`);
          assert.ok(!deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus);
        expect(schema.originalECSpecMajorVersion).toEqual(ecMajorVersion);
        expect(schema.originalECSpecMinorVersion).toEqual(ecMinorVersion);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas without a parser - async", async () => {
      for (const [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${ecMajorVersion}${ecMinorVersion}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
        };

        const schema = new Schema(new SchemaContext());
        try {
          await schema.fromJSON(schemaJson);
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion ${ecMajorVersion}.${ecMinorVersion} and cannot be loaded.`);
          assert.ok(!deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.ok(deserializtionStatus);
        expect(schema.originalECSpecMajorVersion).toEqual(ecMajorVersion);
        expect(schema.originalECSpecMinorVersion).toEqual(ecMinorVersion);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    describe("Schema with newer ECXml version and unknowns", async () => {
      let _schema: Schema;
      let _xmlReader: SchemaReadHelper<Document>;
      let _context: SchemaContext;

      beforeEach(async () => {
        _context = new SchemaContext();
        _xmlReader = new SchemaReadHelper(XmlParser, _context);
      });

      const jsonSchemaTemplate = {
        $schema: `https://dev.bentley.com/json_schemas/ec/${Schema.currentECSpecMajorVersion}${Schema.currentECSpecMinorVersion + 1}/ecschema`,
        name: "TestSchema",
        version: "1.0.0",
        alias: "ts",
      };

      async function deserializeAndTestXml(schemaXml: string, testFunction: any) {
        _schema = new Schema(_context);
        try {
          await _xmlReader.readSchema(_schema, new DOMParser().parseFromString(schemaXml));
        } catch (err: any) {
          assert(false, `The schema should have been deserialized, instead error was thrown: ${err.message}`);
        }
        testFunction();
        await testSerialization(_schema, false, unsupportedVersionError);
      }
      function deserializeAndTestXmlSync(schemaXml: string, testFunction: any) {
        _schema = new Schema(_context);
        try {
          _xmlReader.readSchemaSync(_schema, new DOMParser().parseFromString(schemaXml));
        } catch (err: any) {
          assert(false, `The schema should have been deserialized, instead error was thrown: ${err.message}`);
        }
        testFunction();
      }

      async function deserializeAndTestJSON(schemaJSON: string, testFunction: any) {
        _schema = new Schema(_context);
        try {
          _schema = await Schema.fromJson(schemaJSON, _schema.context);
        } catch (err: any) {
          assert(false, `The schema should have been deserialized, instead error was thrown: ${err.message}`);
        }
        testFunction();
        await testSerialization(_schema, false, unsupportedVersionError);
      }
      function deserializeAndTestJSONSync(schemaJSON: string, testFunction: any) {
        _schema = new Schema(_context);
        try {
          _schema = Schema.fromJsonSync(schemaJSON, _schema.context);
        } catch (err: any) {
          assert(false, `The schema should have been deserialized, instead error was thrown: ${err.message}`);
        }
        testFunction();
      }

      function testUnknownClassModifiers() {
        assert.ok(_schema !== undefined);
        expect(_schema.getItemSync("ValidClass")).toBeDefined();

        for (const className of [`UnknownEntityClass`, `UnknownStructClass`, `UnknownRelationshipClass`, `UnknownMixinClass`]) {
          const unknownItem = _schema.getItemSync(className) as EntityClass | StructClass | RelationshipClass | CustomAttributeClass | Mixin;
          expect(unknownItem).toBeDefined();
          expect(unknownItem.modifier).toEqual(ECClassModifier.None);
        }
      }
      it("Schema XML with unknown class modifier", async () => {
        await new SchemaReadHelper(XmlParser, _context).readSchema(new Schema(_context), new DOMParser().parseFromString(`<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="CoreCustomAttributes" alias="CoreCA" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECCustomAttributeClass typeName="IsMixin" description="Applied to abstract ECEntityClasses which serve as secondary base classes for normal ECEntityClasses." displayLabel="Is Mixin" appliesTo="EntityClass" modifier="Sealed" >
              <ECProperty propertyName="AppliesToEntityClass" typeName="string" description="This mixin may only be applied to entity classes which derive from this class.  Class Name should be fully specified as 'alias:ClassName'" />
            </ECCustomAttributeClass>
          </ECSchema>`));

        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA" />
            <ECEntityClass typeName="ValidClass" description="Test Entity Class" />
            <ECEntityClass typeName="UnknownEntityClass" description="Test Entity Class" modifier="UnknownModifier" />
            <ECStructClass typeName="UnknownStructClass" description="Test Entity Class" modifier="UnknownModifier" />
            <ECRelationshipClass typeName="UnknownRelationshipClass" strength="referencing" modifier="UnknownModifier">
              <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
                <Class class="ValidClass"/>
              </Source>
              <Target multiplicity="(0..*)" roleLabel="is referenced by" polymorphic="true">
                <Class class="ValidClass"/>
              </Target>
            </ECRelationshipClass>
            <ECEntityClass typeName="UnknownMixinClass" description="Test Entity Class" modifier="UnknownModifier">
              <ECCustomAttributes>
                <IsMixin>
                  <AppliesToEntityClass>ValidClass</AppliesToEntityClass>
                </IsMixin>
              </ECCustomAttributes>
            </ECEntityClass>
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testUnknownClassModifiers);
        deserializeAndTestXmlSync(schemaXml, testUnknownClassModifiers);
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with unknown class modifier", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            UnknownEntityClass: { schemaItemType: "EntityClass", name: "UnknownEntityClass", modifier: "UnknownModifier" },
            UnknownStructClass: { schemaItemType: "StructClass", name: "UnknownStructClass", modifier: "UnknownModifier" },
            UnknownRelationshipClass: { schemaItemType: "RelationshipClass", name: "UnknownRelationshipClass", strength: "Referencing", strengthDirection: "Forward", modifier: "UnknownModifier",
              source: { multiplicity: "(0..*)", roleLabel: "refers to", polymorphic: true,
                constraintClasses: [ "TestSchema.ValidClass" ],
              },
              target: { multiplicity: "(0..*)", roleLabel: "Target RoleLabel", polymorphic: true,
                constraintClasses: [ "TestSchema.ValidClass" ],
              },
            },
            UnknownMixinClass: {
              schemaItemType: "Mixin",
              appliesTo: "TestSchema.ValidClass",
              modifier: "UnknownModifier",
            },
            UnknownCustomAttributeClass: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "AnyClass, Schema, AnyProperty",
              modifier: "UnknownModifier",
            },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testUnknownClassModifiers);
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testUnknownClassModifiers);
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      function testClasses(isUnknownItemUndefined: boolean) {
        expect(_schema.getItemSync("ValidClass")).toBeDefined();
        expect(_schema.getItemSync("UnknownItem") === undefined).toEqual(isUnknownItemUndefined);
      }
      it("Schema XML with unknown Schema Item Type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEntityClass typeName="ValidClass" description="Test Entity Class" />
            <UnknownItem typeName="UnknownItem" unknownAttribute="unknownAttr" />
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testClasses.bind(this, true));
        deserializeAndTestXmlSync(schemaXml, testClasses.bind(this, true));
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with unknown Schema Item Type", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            UnknownItem: { schemaItemType: "UnknownItem", name: "UnknownItem" },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testClasses.bind(this, true));
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testClasses.bind(this, true));
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema XML with Schema Item Type having unknown attributes", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEntityClass typeName="ValidClass" description="Test Entity Class" />
            <ECEntityClass typeName="UnknownItem" unknownAttribute="unknownAttr" />
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testClasses.bind(this, false));
        deserializeAndTestXmlSync(schemaXml, testClasses.bind(this, false));
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with Schema Item Type having unknown attributes", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            UnknownItem: { schemaItemType: "EntityClass", name: "UnknownItem", unknownAttribute: "unknownAttr" },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testClasses.bind(this, false));
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testClasses.bind(this, false));
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      function testUnknownProperty() {
        const testClass = _schema.getItemSync("TestClass") as EntityClass;
        expect(testClass).toBeDefined();
        expect(testClass.getPropertySync("ValidProperty")).toBeDefined();

        let unknownProperty = testClass.getPropertySync(`UnknownPrimitiveProperty`) as Property;
        expect(unknownProperty).toBeDefined();
        expect(unknownProperty.propertyType).toEqual(PropertyType.String);

        unknownProperty = testClass.getPropertySync(`UnknownArrayProperty`) as Property;
        expect(unknownProperty).toBeDefined();
        expect(unknownProperty.propertyType).toEqual(PropertyType.String_Array);
      }
      it("Schema XML with property having an unknown primitive type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEntityClass typeName="TestClass">
              <ECProperty propertyName="ValidProperty" typeName="string" />
              <ECProperty propertyName="UnknownPrimitiveProperty" typeName="UnknownType" />
              <ECArrayProperty propertyName="UnknownArrayProperty" typeName="string"/>
            </ECEntityClass>
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testUnknownProperty);
        deserializeAndTestXmlSync(schemaXml,testUnknownProperty);
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with property having an unknown primitive type", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            TestClass: {
              schemaItemType: "EntityClass",
              properties: [
                {
                  name: "ValidProperty",
                  type: "PrimitiveProperty",
                  typeName: "string",
                },
                {
                  name: "UnknownPrimitiveProperty",
                  type: "PrimitiveProperty",
                  typeName: "UnknownType",
                },
                {
                  name: "UnknownArrayProperty",
                  type: "PrimitiveArrayProperty",
                  typeName: "UnknownType",
                },
              ],
            },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testUnknownProperty);
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testUnknownProperty);
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      function testUnknownPropertyType() {
        const testClass = _schema.getItemSync("TestClass") as EntityClass;
        expect(testClass).toBeDefined();
        expect(testClass.getPropertySync("ValidProperty")).toBeDefined();
        expect(testClass.getPropertySync("UnknownProperty")).toBeUndefined();
      }
      it("Schema XML with property having an unknown property kind", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEntityClass typeName="TestClass">
              <ECProperty propertyName="ValidProperty" typeName="string" />
              <UnknownProperty propertyName="UnknownProperty" />
            </ECEntityClass>
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testUnknownPropertyType);
        deserializeAndTestXmlSync(schemaXml, testUnknownPropertyType);
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with property having an unknown property kind", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            TestClass: {
              schemaItemType: "EntityClass",
              properties: [
                {
                  name: "ValidProperty",
                  type: "PrimitiveProperty",
                  typeName: "string",
                },
                {
                  name: "UnknownProperty",
                  type: "UnknownProperty",
                },
              ],
            },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testUnknownPropertyType);
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testUnknownPropertyType);
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      function testEnumBackingType() {
        const enumVal = _schema.getItemSync("TestEnumeration") as Enumeration;
        expect(enumVal).toBeDefined();
        expect(enumVal.type).toEqual(PrimitiveType.String);
      }
      it("Schema XML with unknown enumeration backing type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEnumeration typeName="TestEnumeration" backingTypeName="UnknownType" />
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testEnumBackingType);
        deserializeAndTestXmlSync(schemaXml, testEnumBackingType);
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with unknown enumeration backing type", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            TestEnumeration: {
              schemaItemType: "Enumeration",
              type: "UnknownType",
              isStrict: true,
              enumerators: [{
                name: "TestValue",
                label: "TestValue",
                value: "T",
              }],
            },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testEnumBackingType);
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testEnumBackingType);
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      function testRelationshipStrength() {
        const relationshipClass = _schema.getItemSync("TestRelationship") as RelationshipClass;
        expect(relationshipClass).toBeDefined();
        expect(relationshipClass.strength).toEqual(StrengthType.Referencing);
      }
      it("Schema XML with relationship class having unknown strength type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECSpecMajorVersion}.${Schema.currentECSpecMinorVersion + 1}">
            <ECEntityClass typeName="Source"/>
            <ECEntityClass typeName="Target"/>

            <ECRelationshipClass typeName="TestRelationship" modifier="None" direction="forward" strength="UnknownType">
              <Source multiplicity="(1..1)" roleLabel="likes" polymorphic="False">
                <Class class="Source" />
              </Source>
              <Target multiplicity="(1..1)" roleLabel="is liked by" polymorphic="True">
                <Class class="Target" />
              </Target>
            </ECRelationshipClass>
          </ECSchema>`;

        await deserializeAndTestXml(schemaXml, testRelationshipStrength);
        deserializeAndTestXmlSync(schemaXml, testRelationshipStrength);
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it("Schema JSON with relationship class having unknown strength type", async () => {
        const schemaJson = {
          ...jsonSchemaTemplate,
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            TestRelationship: { schemaItemType: "RelationshipClass", name: "TestRelationship", strength: "UnknownType", strengthDirection: "Forward",
              source: { multiplicity: "(0..*)", roleLabel: "refers to", polymorphic: true,
                constraintClasses: [ "TestSchema.ValidClass" ],
              },
              target: { multiplicity: "(0..*)", roleLabel: "Target RoleLabel", polymorphic: true,
                constraintClasses: [ "TestSchema.ValidClass" ],
              },
            },
          },
        };

        await deserializeAndTestJSON(JSON.stringify(schemaJson), testRelationshipStrength);
        deserializeAndTestJSONSync(JSON.stringify(schemaJson), testRelationshipStrength);
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      it("should throw an error for version V3_2, when encountered an unknown type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
            <ECSchema schemaName="Test" alias="test" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECStructClass typeName="PrimStruct">
            <ECProperty propertyName="p2d" typeName="Point2d" />
            <ECProperty propertyName="p3d" typeName="Point3d" />
          </ECStructClass>
          <ECEntityClass typeName="UseOfWrongPropertyTags">
            <ECProperty propertyName="Struct" typeName="PrimStruct" />
            <ECStructArrayProperty propertyName="Struct_Array" typeName="PrimStruct" />
          </ECEntityClass>
          </ECSchema>`;

          _schema = new Schema(_context);
          try {
            await _xmlReader.readSchema(_schema, new DOMParser().parseFromString(schemaXml));
          } catch (err: any) {
            assert.equal(err.message, `The provided primitive type, Test.PrimStruct, is not a valid PrimitiveType or Enumeration.`);
          }
      });
    });
  });

  describe("fromJson", () => {
    describe("should successfully deserialize valid JSON", () => {
      function assertValidSchema(testSchema: Schema) {
        expect(testSchema.name).toEqual("ValidSchema");
        expect(testSchema.alias).toEqual("vs");
        expect(testSchema.label).toEqual("SomeDisplayLabel");
        expect(testSchema.description).toEqual("A really long description...");
        expect(testSchema.readVersion).toEqual(1);
        expect(testSchema.writeVersion).toEqual(2);
        expect(testSchema.minorVersion).toEqual(3);
      }

      it("with name/version first specified in JSON", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext());
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(propertyJson);
        assertValidSchema(testSchema);
      });

      it("with name/version repeated in JSON", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(propertyJson);
        assertValidSchema(testSchema);
      });

      it("should throw for invalid alias", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext());
        expect(testSchema).toBeDefined();
        await expectAsyncToThrow(
          async () => testSchema.fromJSON(propertyJson),
          ECSchemaError,
          "The Schema ValidSchema does not have the required 'alias' attribute.",
        );
      });

      it("should throw for invalid $schema", async () => {
        const schemaJson = {
          $schema: "https://badmetaschema.com",
          name: "InvalidSchema",
          version: "1.2.3",
        };
        const context = new SchemaContext();
        const testSchema = new Schema(context, "InvalidSchema", "is", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await expectAsyncToThrow(
          async () => testSchema.fromJSON(schemaJson as any),
          ECSchemaError,
          "The Schema 'InvalidSchema' has an unsupported namespace 'https://badmetaschema.com'.",
        );
        await expectAsyncToThrow(
          async () => Schema.fromJson(schemaJson as any, context),
          ECSchemaError,
          "The Schema 'InvalidSchema' has an unsupported namespace 'https://badmetaschema.com'.",
        );
      });

      it("should throw for mismatched name", async () => {
        const json = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ThisDoesNotMatch",
          version: "1.2.3",
          alias: "bad",
        };
        const testSchema = new Schema(new SchemaContext(), "BadSchema", "bad", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await expect(testSchema.fromJSON(json)).rejects.toThrow(ECSchemaError);
      });

      it("should throw for mismatched version", async () => {
        const json = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "BadSchema",
          version: "1.2.6",
          alias: "bad",
        };
        const testSchema = new Schema(new SchemaContext(), "BadSchema", "bad", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await expect(testSchema.fromJSON(json)).rejects.toThrow(ECSchemaError);
      });
    });

    describe("toJSON", () => {
      it("Simple JSON serialization of an empty schema", async () => {
        const context = new SchemaContext();
        let schema: Schema = new Schema(context);
        expect(() => schema.toJSON()).to.throw("The schema has an invalid or missing SchemaKey.");

        schema = new Schema(context, "EmptySchema", "es", 1, 2, 3);
        expect(() => schema.toJSON()).to.not.throw();
      });

      it("Simple serialization", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(schemaJson);
        const serialized = testSchema.toJSON();
        expect(serialized).to.deep.equal({ ...schemaJson, version: "01.02.03" });
      });
      it("Serialization - JSON stringify", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(schemaJson);
        const serializedString = JSON.stringify(testSchema);
        const serialized = JSON.parse(serializedString);
        expect(serialized).to.deep.equal({ ...schemaJson, version: "01.02.03" });
      });
      it("Serialization with one custom attribute- only class name", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema" });
        const serialized = testSchema.toJSON();
        assert.strictEqual(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
      });
      it("Serialization with one custom attribute- additional properties", () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        testSchema.fromJSONSync(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema", ShowClasses: true });
        const serialized = testSchema.toJSON();
        assert.strictEqual(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
        assert.ok(serialized.customAttributes![0].ShowClasses);
      });
      it("Serialization with multiple custom attributes- only class name", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema" });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreAttributes.HiddenSchema" });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustom.HiddenSchema" });
        const serialized = testSchema.toJSON();
        assert.strictEqual(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
        assert.strictEqual(serialized.customAttributes![1].className, "CoreAttributes.HiddenSchema");
        assert.strictEqual(serialized.customAttributes![2].className, "CoreCustom.HiddenSchema");
      });
      it("Serialization with multiple custom attributes- additional properties", async () => {
        const propertyJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema", ShowClasses: true });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreAttributes.HiddenSchema", FloatValue: 1.2 });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustom.HiddenSchema", IntegerValue: 5 });
        const serialized = testSchema.toJSON();
        assert.ok(serialized.customAttributes![0].ShowClasses);
        assert.strictEqual(serialized.customAttributes![1].FloatValue, 1.2);
        assert.strictEqual(serialized.customAttributes![2].IntegerValue, 5);
      });
      it("Serialization with one reference", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          references: [
            {
              name: "RefSchema",
              version: "1.0.0",
            },
          ],
        };
        const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 0);
        const context = new SchemaContext();
        await context.addSchema(refSchema);
        let testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        expect(testSchema).toBeDefined();
        const entityClassJson = testSchema.toJSON();
        assert.ok(entityClassJson);
        assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
        assert.strictEqual(entityClassJson.references![0].version, "01.00.00");
      });
      it("Serialization with multiple references", () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          references: [
            {
              name: "RefSchema",
              version: "1.0.0",
            },
            {
              name: "AnotherRefSchema",
              version: "1.0.2",
            },
          ],
        };
        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 0);
        const anotherRefSchema = new Schema(context, "AnotherRefSchema", "anoref", 1, 0, 2);
        context.addSchemaSync(refSchema);
        context.addSchemaSync(anotherRefSchema);
        let testSchema = new Schema(context, "ValidSchema", "vs", 1, 2, 3);
        testSchema = Schema.fromJsonSync(schemaJson, context);
        expect(testSchema).toBeDefined();
        const entityClassJson = testSchema.toJSON();
        assert.ok(entityClassJson);
        assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
        assert.strictEqual(entityClassJson.references![0].version, "01.00.00");
        assert.strictEqual(entityClassJson.references![1].name, "AnotherRefSchema");
        assert.strictEqual(entityClassJson.references![1].version, "01.00.02");
      });
      it("Serialization with one reference and item", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.2.3",
          alias: "ts",
          references: [
            {
              name: "RefSchema",
              version: "1.0.5",
            },
          ],
          items: {
            testClass: {
              schemaItemType: "EntityClass",
              label: "ExampleEntity",
              description: "An example entity class.",
            },
          },
        };

        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
        const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
        assert.ok(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const entityClassJson = testSchema.toJSON();
        assert.ok(entityClassJson);
        // eslint-disable-next-line @typescript-eslint/dot-notation
        assert.ok(entityClassJson.items!["testClass"]);
        assert.strictEqual(entityClassJson.items!.testClass.schemaItemType, "EntityClass");
        assert.strictEqual(entityClassJson.items!.testClass.label, "ExampleEntity");
        assert.strictEqual(entityClassJson.items!.testClass.description, "An example entity class.");
      });
      it("Serialization with one reference and multiple items", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.2.3",
          alias: "ts",
          references: [
            {
              name: "RefSchema",
              version: "1.0.5",
            },
          ],
          items: {
            testEnum: {
              schemaItemType: "Enumeration",
              type: "int",
              enumerators: [
                {
                  name: "ZeroValue",
                  value: 0,
                  label: "None",
                },
              ],
            },
            testClass: {
              schemaItemType: "EntityClass",
              label: "ExampleEntity",
              description: "An example entity class.",
            },
            ExampleMixin: {
              schemaItemType: "Mixin",
              appliesTo: "TestSchema.testClass",
            },
            ExampleStruct: {
              schemaItemType: "StructClass",
              name: "ExampleStruct",
              modifier: "sealed",
              properties: [
                {
                  type: "PrimitiveArrayProperty",
                  name: "ExamplePrimitiveArray",
                  typeName: "TestSchema.testEnum",
                  minOccurs: 7,
                  maxOccurs: 20,
                },
              ],
            },
          },
        };

        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
        const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
        assert.ok(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const entityClassJson = testSchema.toJSON();
        assert.ok(entityClassJson);

        assert.ok(entityClassJson.items!.testClass);
        assert.strictEqual(entityClassJson.items!.testClass.schemaItemType, "EntityClass");
        assert.strictEqual(entityClassJson.items!.testClass.label, "ExampleEntity");
        assert.strictEqual(entityClassJson.items!.testClass.description, "An example entity class.");

        assert.ok(entityClassJson.items!.ExampleMixin);
        assert.strictEqual(entityClassJson.items!.ExampleMixin.schemaItemType, "Mixin");

        assert.ok(entityClassJson.items!.ExampleStruct);
        assert.strictEqual(entityClassJson.items!.ExampleMixin.schemaItemType, "Mixin");

        assert.ok(entityClassJson.items!.testEnum);
        assert.strictEqual(entityClassJson.items!.testEnum.schemaItemType, "Enumeration");
      });
    });

    it("Serialization with reference containing different minor version", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
        ],
      };
      const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 1);
      const context = new SchemaContext();
      await context.addSchema(refSchema);
      let testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
      testSchema = await Schema.fromJson(schemaJson, context);
      expect(testSchema).toBeDefined();
      const entityClassJson = testSchema.toJSON();
      assert.ok(entityClassJson);
      assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
      assert.strictEqual(entityClassJson.references![0].version, "01.00.01");
    });

    it("Serialization with reference containing different write version, throws", async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        references: [
          {
            name: "RefSchema",
            version: "1.0.0",
          },
        ],
      };
      const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 1, 0);
      const context = new SchemaContext();
      await context.addSchema(refSchema);

      await expectAsyncToThrow(
        async () => Schema.fromJson(schemaJson, context),
        ECSchemaError,
        "Could not locate the referenced schema, RefSchema.01.00.00, of ValidSchema",
      );
    });

    describe("toXML", () => {
      let newDom: Document;

      beforeEach(() => {
        newDom = createEmptyXmlDocument();
      });

      function getCustomAttribute(containerElement: Element, name: string): Element {
        const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
        expect(caElements.length).toEqual(1);
        const caElement = containerElement.getElementsByTagName(name);
        expect(caElement.length).toEqual(1);
        return caElement[0];
      }

      function getCAPropertyValueElement(schema: Element, caName: string, propertyName: string): Element {
        const attribute = getCustomAttribute(schema, caName);
        const propArray = attribute.getElementsByTagName(propertyName);
        expect(propArray.length).toEqual(1);
        return propArray[0];
      }

      it("Simple XML serialization of an empty schema", async () => {
        const context = new SchemaContext();
        let schema: Schema = new Schema(context);
        const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");

        await expectAsyncToThrow(
          async () => schema.toXml(xmlDoc),
          ECSchemaError,
          `The schema has an invalid or missing SchemaKey.`,
        );

        schema = new Schema(context, "EmptySchema", "ts", 1, 2, 3);
        await expect(schema.toXml(xmlDoc)).resolves.toBeDefined();
      });

      it("Simple serialization", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).toBeDefined();
        await testSchema.fromJSON(schemaJson);

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        expect(serialized.nodeName).toEqual("ECSchema");
        expect(serialized.getAttribute("xmlns")).toEqual("http://www.bentley.com/schemas/Bentley.ECXML.3.2");
        expect(serialized.getAttribute("schemaName")).toEqual(schemaJson.name);
        expect(serialized.getAttribute("version")).toEqual("01.02.03");
        expect(serialized.getAttribute("alias")).toEqual(schemaJson.alias);
        expect(serialized.getAttribute("displayLabel")).toEqual(schemaJson.label);
        expect(serialized.getAttribute("description")).toEqual(schemaJson.description);
      });

      it("Deserialize after Serialization", async () => {

        const referenceJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "RefSchema",
          version: "1.2.3",
          alias: "rf",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          items: {
            testClass: {
              schemaItemType: "EntityClass",
              label: "ExampleEntity",
              description: "An example entity class.",
              modifier: "Sealed",
            },
          },
        };

        const coreCASchema =
        {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          alias: "CoreCA",
          description: "Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes.",
          items: {
            XIsMixin: {
              appliesTo: "EntityClass",
              description: "Applied to abstract ECEntityClasses which serve as secondary base classes for normal ECEntityClasses.",
              label: "Is Mixin",
              modifier: "Sealed",
              CoreCustomAttributes: [{
                description: "This mixin may only be applied to entity classes which derive from this class.  Class Name should be fully specified as 'alias:ClassName'",
                name: "AppliesToEntityClass",
                type: "PrimitiveProperty",
                typeName: "string",
              }],
              schemaItemType: "CustomAttributeClass",
            },
          },
          label: "Core Custom Attributes",
          name: "CoreCustomAttributes",
          version: "01.00.03",
        };

        const context = new SchemaContext();
        Schema.fromJsonSync(coreCASchema, context);
        Schema.fromJsonSync(referenceJson, context);

        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          references: [
            {
              name: "RefSchema",
              version: "01.02.03",
            },
            {
              name: "CoreCustomAttributes",
              version: "01.00.03",
            },
          ],
          items: {
            IShellMetadata: {
              schemaItemType: "Mixin",
              label: "Shell metadata",
              description: "Common shell metadata",
              appliesTo: "RefSchema.testClass",
            },
          },
        };

        const schema = Schema.fromJsonSync(schemaJson, context);
        const serialized = (await schema.toXml(newDom)).documentElement;

        const deserialContext = new SchemaContext();
        const reader = new SchemaReadHelper(XmlParser, deserialContext);
        Schema.fromJsonSync(referenceJson, deserialContext);
        Schema.fromJsonSync(coreCASchema, deserialContext);

        const deserialized = reader.readSchemaSync(new Schema(deserialContext), serialized.ownerDocument);
        expect(deserialized).to.not.be.null;
        expect(deserialized.toJSON()).toEqual(schema.toJSON());
      });

      it("Serialization with one reference", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          references: [
            {
              name: "RefSchema",
              version: "1.0.0",
            },
          ],
        };
        const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 0);
        const context = new SchemaContext();
        await context.addSchema(refSchema);
        let testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        expect(testSchema).toBeDefined();

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).toEqual(1);
        const reference = children[0];
        expect(reference.nodeName).toEqual("ECSchemaReference");
        expect(reference.getAttribute("name")).toEqual("RefSchema");
        expect(reference.getAttribute("version")).toEqual("01.00.00");
        expect(reference.getAttribute("alias")).toEqual("ref");
      });

      it("Serialization with multiple references", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          references: [
            {
              name: "RefSchema",
              version: "1.0.0",
            },
            {
              name: "AnotherRefSchema",
              version: "1.0.2",
            },
          ],
        };
        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 0);
        const anotherRefSchema = new Schema(context, "AnotherRefSchema", "anotherRef", 1, 0, 2);
        context.addSchemaSync(refSchema);
        context.addSchemaSync(anotherRefSchema);
        let testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        expect(testSchema).toBeDefined();

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).toEqual(2);

        const reference1 = children[0];
        expect(reference1.nodeName).toEqual("ECSchemaReference");
        expect(reference1.getAttribute("name")).toEqual("RefSchema");
        expect(reference1.getAttribute("version")).toEqual("01.00.00");
        expect(reference1.getAttribute("alias")).toEqual("ref");

        const reference2 = children[1];
        expect(reference2.nodeName).toEqual("ECSchemaReference");
        expect(reference2.getAttribute("name")).toEqual("AnotherRefSchema");
        expect(reference2.getAttribute("version")).toEqual("01.00.02");
        expect(reference2.getAttribute("alias")).toEqual("anotherRef");
      });

      it("Serialization with one reference and item", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.2.3",
          alias: "ts",
          references: [
            {
              name: "RefSchema",
              version: "1.0.5",
            },
          ],
          items: {
            testClass: {
              schemaItemType: "EntityClass",
              label: "ExampleEntity",
              description: "An example entity class.",
            },
          },
        };

        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
        const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
        assert.ok(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).toEqual(2);

        const reference = children[0];
        expect(reference.nodeName).toEqual("ECSchemaReference");
        expect(reference.getAttribute("name")).toEqual("RefSchema");
        expect(reference.getAttribute("version")).toEqual("01.00.05");
        expect(reference.getAttribute("alias")).toEqual("ref");

        const entityClass = children[1];
        expect(entityClass.nodeName).toEqual("ECEntityClass");
        expect(entityClass.getAttribute("typeName")).toEqual("testClass");
        expect(entityClass.getAttribute("displayLabel")).toEqual("ExampleEntity");
        expect(entityClass.getAttribute("description")).toEqual("An example entity class.");
      });

      it("Serialization with one reference and multiple items", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.2.3",
          alias: "ts",
          references: [
            {
              name: "RefSchema",
              version: "1.0.5",
            },
          ],
          items: {
            testEnum: {
              schemaItemType: "Enumeration",
              type: "int",
              enumerators: [
                {
                  name: "ZeroValue",
                  value: 0,
                  label: "None",
                },
              ],
            },
            testClass: {
              schemaItemType: "EntityClass",
              label: "ExampleEntity",
              description: "An example entity class.",
            },
            ExampleMixin: {
              schemaItemType: "Mixin",
              appliesTo: "TestSchema.testClass",
            },
            ExampleStruct: {
              schemaItemType: "StructClass",
              name: "ExampleStruct",
              modifier: "sealed",
              properties: [
                {
                  type: "PrimitiveArrayProperty",
                  name: "ExamplePrimitiveArray",
                  typeName: "TestSchema.testEnum",
                  minOccurs: 7,
                  maxOccurs: 20,
                },
              ],
            },
          },
        };

        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
        const refBaseClass = await (refSchema as MutableSchema).createEntityClass("BaseClassInRef");
        assert.ok(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).toEqual(5);

        const references = getElementChildrenByTagName(serialized, "ECSchemaReference");
        assert.strictEqual(references.length, 1);
        const reference = references[0];
        expect(reference.getAttribute("name")).toEqual("RefSchema");
        expect(reference.getAttribute("version")).toEqual("01.00.05");
        expect(reference.getAttribute("alias")).toEqual("ref");

        const entityClasses = getElementChildrenByTagName(serialized, "ECEntityClass");
        assert.strictEqual(entityClasses.length, 2);
        const entityClass = entityClasses[0];
        expect(entityClass.getAttribute("typeName")).toEqual("testClass");
        const mixin = entityClasses[1];
        expect(mixin.getAttribute("typeName")).toEqual("ExampleMixin");

        const structClasses = getElementChildrenByTagName(serialized, "ECStructClass");
        assert.strictEqual(structClasses.length, 1);
        const structClass = structClasses[0];
        expect(structClass.getAttribute("typeName")).toEqual("ExampleStruct");

        const enumerations = getElementChildrenByTagName(serialized, "ECEnumeration");
        assert.strictEqual(enumerations.length, 1);
        const enumeration = enumerations[0];
        expect(enumeration.getAttribute("typeName")).toEqual("testEnum");
      });

      /* it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUri.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };
        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", 1, 0, 5);
        const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
        assert.ok(refCAClass);
        await context.addSchema(refSchema);
        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());
        (testSchema as MutableSchema).addReference(refSchema);
        (testSchema as MutableSchema).addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
        expect(attributeElement.getAttribute("xmlns")).toEqual("RefSchema.01.00.05");
      }); */

      it("Serialization with one custom attribute defined in same schema, only class name", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
            },
          },
        };
        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());
        await testSchema.fromJSON(schemaJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "TestCustomAttribute" });
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
        expect(attributeElement.getAttribute("xmlns")).to.be.empty;
      });

      it("Serialization with one qualified custom attribute defined in same schema, only class name", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
            },
          },
        };
        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());
        await testSchema.fromJSON(schemaJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "ValidSchema.TestCustomAttribute" });
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
        expect(attributeElement.getAttribute("xmlns")).toEqual("ValidSchema.01.02.03");
      });

      it("Serialization with one custom attribute, with Primitive property values", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
              properties: [
                {
                  type: "PrimitiveProperty",
                  typeName: "boolean",
                  name: "TrueBoolean",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "boolean",
                  name: "FalseBoolean",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "int",
                  name: "Integer",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "long",
                  name: "Long",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "double",
                  name: "Double",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "dateTime",
                  name: "DateTime",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "point2d",
                  name: "Point2D",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "point3d",
                  name: "Point3D",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "Bentley.Geometry.Common.IGeometry",
                  name: "IGeometry",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "binary",
                  name: "Binary",
                },
              ],
            },
          },
        };

        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());

        const nowTicks = Date.now();
        const ca = {
          className: "TestCustomAttribute",
          TrueBoolean: true,
          FalseBoolean: false,
          Integer: 1,
          Long: 100,
          Double: 200,
          DateTime: new Date(nowTicks),
          Point2D: { x: 100, y: 200 },
          Point3D: { x: 100, y: 200, z: 300 },
          IGeometry: "geometry",
          Binary: "binary",
        };

        (testSchema as MutableSchema).addCustomAttribute(ca);
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        let element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "TrueBoolean");
        expect(element.textContent).toEqual("True");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
        expect(element.textContent).toEqual("False");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
        expect(element.textContent).toEqual("1");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
        expect(element.textContent).toEqual("100");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
        expect(element.textContent).toEqual("200");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
        expect(element.textContent).toEqual(nowTicks.toString());
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
        expect(element.textContent).toEqual("100,200");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
        expect(element.textContent).toEqual("100,200,300");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
        expect(element.textContent).toEqual("geometry");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
        expect(element.textContent).toEqual("binary");
      });

      it("Serialization with one custom attribute, with PrimitiveArray property values", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
              properties: [
                {
                  type: "PrimitiveArrayProperty",
                  typeName: "boolean",
                  name: "BooleanArray",
                },
              ],
            },
          },
        };

        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());

        const ca = {
          className: "TestCustomAttribute",
          BooleanArray: [true, false, true],
        };

        (testSchema as MutableSchema).addCustomAttribute(ca);
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "BooleanArray");
        const children = element.childNodes;
        expect(children.length).toEqual(3);
        expect(children[0].textContent).toEqual("True");
        expect(children[1].textContent).toEqual("False");
        expect(children[2].textContent).toEqual("True");
      });

      it("Serialization with one custom attribute, with Struct property value", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
              properties: [
                {
                  type: "StructProperty",
                  typeName: "ValidSchema.TestStruct",
                  name: "Struct",
                },
              ],
            },
            TestStruct: {
              schemaItemType: "StructClass",
              properties: [
                {
                  type: "PrimitiveProperty",
                  typeName: "int",
                  name: "Integer",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "string",
                  name: "String",
                },
              ],
            },
          },
        };

        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());

        const ca = {
          className: "TestCustomAttribute",
          Struct: {
            Integer: 1,
            String: "test",
          },
        };

        (testSchema as MutableSchema).addCustomAttribute(ca);
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Struct");
        const children = element.childNodes;
        expect(children.length).toEqual(2);
        expect(children[0].textContent).toEqual("1");
        expect(children[1].textContent).toEqual("test");
      });

      it("Serialization with one custom attribute, with Enumeration property value", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
              properties: [
                {
                  type: "PrimitiveProperty",
                  typeName: "ValidSchema.TestEnumeration",
                  name: "TestEnumProperty",
                },
              ],
            },
            TestEnumeration: {
              schemaItemType: "Enumeration",
              type: "int",
              enumerators: [
                {
                  name: "FirstValue",
                  value: 0,
                },
                {
                  name: "SecondValue",
                  value: 1,
                },
              ],
            },
          },
        };

        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());

        const ca = {
          className: "TestCustomAttribute",
          TestEnumProperty: 0,
        };

        (testSchema as MutableSchema).addCustomAttribute(ca);
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "TestEnumProperty");
        const children = element.childNodes;
        expect(children.length).toEqual(1);
        expect(children[0].textContent).toEqual("0");
      });

      it("Serialization with one custom attribute, with StructArray property value", async () => {
        const schemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          items: {
            TestCustomAttribute: {
              schemaItemType: "CustomAttributeClass",
              appliesTo: "Schema",
              properties: [
                {
                  type: "StructArrayProperty",
                  typeName: "ValidSchema.TestStruct",
                  name: "StructArray",
                },
              ],
            },
            TestStruct: {
              schemaItemType: "StructClass",
              properties: [
                {
                  type: "PrimitiveProperty",
                  typeName: "int",
                  name: "Integer",
                },
                {
                  type: "PrimitiveProperty",
                  typeName: "string",
                  name: "String",
                },
              ],
            },
          },
        };

        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());

        const ca = {
          className: "TestCustomAttribute",
          StructArray: [
            {
              Integer: 1,
              String: "test1",
            },
            {
              Integer: 2,
              String: "test2",
            },
          ],
        };

        (testSchema as MutableSchema).addCustomAttribute(ca);
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "StructArray");
        const structs = element.getElementsByTagName("TestStruct");
        expect(structs.length).toEqual(2);

        let prop1 = structs[0].getElementsByTagName("Integer");
        expect(prop1.length).toEqual(1);
        expect(prop1[0].textContent).toEqual("1");

        let prop2 = structs[0].getElementsByTagName("String");
        expect(prop2.length).toEqual(1);
        expect(prop2[0].textContent).toEqual("test1");

        prop1 = structs[1].getElementsByTagName("Integer");
        expect(prop1.length).toEqual(1);
        expect(prop1[0].textContent).toEqual("2");

        prop2 = structs[1].getElementsByTagName("String");
        expect(prop2.length).toEqual(1);
        expect(prop2[0].textContent).toEqual("test2");
      });

      async function serialize(schemaJson: any): Promise<string> {
        const context = new SchemaContext();
        const testSchema = await Schema.fromJson(schemaJson, context);
        expect(testSchema).toBeDefined();

        const xmlDom = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "text/xml");
        await testSchema.toXml(xmlDom);
        return new XMLSerializer().serializeToString(xmlDom);
      }

      async function testKoQSerialization(presentationUnit: any): Promise<string> {
        const testSchemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          description: "Test serialization",
          items: {
            SI: { schemaItemType: "UnitSystem" },
            LENGTH: { schemaItemType: "Phenomenon", label: "Length", definition: "LENGTH" },
            M: { schemaItemType: "Unit", label: "m", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "M" },
            MM: { schemaItemType: "Unit", label: "mm", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "MM" },
            FT: { schemaItemType: "Unit", label: "ft", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "IN" },

            TestFormat: { schemaItemType:"Format", label:"testFormat", type:"Decimal", precision:6, formatTraits:["KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel"]},
            TestKoq: { schemaItemType:"KindOfQuantity", label:"testKoq", relativeError:0.00001, persistenceUnit:"TestSchema.M", ...presentationUnit},
          },
        };

        const matches = (await serialize(testSchemaJson)).match(/presentationUnits="(.+?)"/);
        if (!matches)
          assert(false);
        return matches[0];
      }

      it("KoQ serialization with overriden formats", async () => {
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M][TestSchema.MM][TestSchema.FT]"]}), `presentationUnits="TestFormat(4)[M][MM][FT]"`);
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M][TestSchema.MM][TestSchema.FT|]"]}), `presentationUnits="TestFormat(4)[M][MM][FT|]"`);
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M|alpha][TestSchema.MM][TestSchema.FT|]"]}), `presentationUnits="TestFormat(4)[M|alpha][MM][FT|]"`);
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M|alpha][TestSchema.MM|bravo][TestSchema.FT]"]}), `presentationUnits="TestFormat(4)[M|alpha][MM|bravo][FT]"`);
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M|alpha][TestSchema.MM|bravo][TestSchema.FT|]"]}), `presentationUnits="TestFormat(4)[M|alpha][MM|bravo][FT|]"`);
        assert.deepEqual(await testKoQSerialization({presentationUnits: ["TestSchema.TestFormat(4)[TestSchema.M|alpha][TestSchema.MM|bravo][TestSchema.FT|charlie]"]}), `presentationUnits="TestFormat(4)[M|alpha][MM|bravo][FT|charlie]"`);
      });

      async function testCompositeFormatSerialization(compositeFormat: any): Promise<string> {
        const testSchemaJson = {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          description: "Test serialization",
          items: {
            SI: { schemaItemType: "UnitSystem" },
            LENGTH: { schemaItemType: "Phenomenon", label: "Length", definition: "LENGTH" },
            M: { schemaItemType: "Unit", label: "m", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "M" },
            MM: { schemaItemType: "Unit", label: "mm", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "MM" },
            FT: { schemaItemType: "Unit", label: "ft", phenomenon: "TestSchema.LENGTH", unitSystem: "TestSchema.SI", definition: "IN" },

            TestFormat: { schemaItemType:"Format", label:"testFormat", type:"Decimal", precision:6, formatTraits:["KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel"], composite:{...compositeFormat}},
          },
        };

        const str = await serialize(testSchemaJson);
        const matches = str.match(/<Composite ([^]+?)\/Composite>/g);
        if (!matches)
          assert(false);
        return matches[0];
      }

      it("Composite format serialization with overriden formats", async () => {
        assert.deepEqual(await testCompositeFormatSerialization({units:[{name:"TestSchema.M"},{name:"TestSchema.MM"},{name:"TestSchema.FT"}]}),
          `<Composite spacer=" " includeZero="true"><Unit>M</Unit><Unit>MM</Unit><Unit>FT</Unit></Composite>`);

        assert.deepEqual(await testCompositeFormatSerialization({units:[{name:"TestSchema.M",label:"metre"},{name:"TestSchema.MM"},{name:"TestSchema.FT"}]}),
          `<Composite spacer=" " includeZero="true"><Unit label="metre">M</Unit><Unit>MM</Unit><Unit>FT</Unit></Composite>`);

        assert.deepEqual(await testCompositeFormatSerialization({units:[{name:"TestSchema.M",label:"metre"},{name:"TestSchema.MM", label:""},{name:"TestSchema.FT"}]}),
          `<Composite spacer=" " includeZero="true"><Unit label="metre">M</Unit><Unit label="">MM</Unit><Unit>FT</Unit></Composite>`);

        assert.deepEqual(await testCompositeFormatSerialization({units:[{name:"TestSchema.M",label:"metre"},{name:"TestSchema.MM", label:""},{name:"TestSchema.FT", label: "\""}]}),
          `<Composite spacer=" " includeZero="true"><Unit label="metre">M</Unit><Unit label="">MM</Unit><Unit label="&quot;">FT</Unit></Composite>`);
      });
    });
  }); // Schema tests

  describe("SchemaKey ", () => {
    // Tests to ensure the schemaKey compareByVersion exists
    // and calls into ECVersion.compare.  See ECVersion.test.ts
    // for more comprehensive cases.
    describe("compareByVersion", () => {
      it("exact match, returns zero", async () => {
        const context = new SchemaContext();
        const leftSchema = new Schema(context, "LeftSchema", "ls", 1, 2, 3);
        const rightSchema = new Schema(context, "RightSchema", "rs", 1, 2, 3);
        const result = leftSchema.schemaKey.compareByVersion(rightSchema.schemaKey);
        assert.strictEqual(result, 0);
      });
    });
    describe("setVersion Tests", () => {
      it("Update read, write and minor version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, "TestSchema", "ls", 1, 2, 3);
        testSchema.setVersion(2, 3, 4);
        assert.strictEqual(testSchema.readVersion, 2);
        assert.strictEqual(testSchema.writeVersion, 3);
        assert.strictEqual(testSchema.minorVersion, 4);
      });
      it("Update read version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, "TestSchema", "ls", 1, 2, 3);
        testSchema.setVersion(2);
        assert.strictEqual(testSchema.readVersion, 2);
        assert.strictEqual(testSchema.writeVersion, 2);
        assert.strictEqual(testSchema.minorVersion, 3);
      });
      it("Update write version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, "TestSchema", "ls", 1, 2, 3);
        testSchema.setVersion(undefined, 3);
        assert.strictEqual(testSchema.readVersion, 1);
        assert.strictEqual(testSchema.writeVersion, 3);
        assert.strictEqual(testSchema.minorVersion, 3);
      });
      it("Update write version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, "TestSchema", "ls", 1, 2, 3);
        testSchema.setVersion(undefined, undefined, 4);
        assert.strictEqual(testSchema.readVersion, 1);
        assert.strictEqual(testSchema.writeVersion, 2);
        assert.strictEqual(testSchema.minorVersion, 4);
      });
      it("version not initialized, update read version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, new SchemaKey("TestSchema"), "ts");
        testSchema.setVersion(1);
        assert.strictEqual(testSchema.readVersion, 1);
        assert.strictEqual(testSchema.writeVersion, 0);
        assert.strictEqual(testSchema.minorVersion, 0);
      });
      it("version not initialized, update write version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, new SchemaKey("TestSchema"), "ts");
        testSchema.setVersion(undefined, 1);
        assert.strictEqual(testSchema.readVersion, 0);
        assert.strictEqual(testSchema.writeVersion, 1);
        assert.strictEqual(testSchema.minorVersion, 0);
      });
      it("version not initialized, update write version, version set correctly", async () => {
        const context = new SchemaContext();
        const testSchema = new Schema(context, new SchemaKey("TestSchema"), "ts");
        testSchema.setVersion(undefined, undefined, 1);
        assert.strictEqual(testSchema.readVersion, 0);
        assert.strictEqual(testSchema.writeVersion, 0);
        assert.strictEqual(testSchema.minorVersion, 1);
      });
    });
  });

  describe("isSchema", () => {
    it("should return false if schema is undefined", () => {
      const undefinedSchema = undefined;
      expect(Schema.isSchema(undefinedSchema)).toBe(false);
    });

    it("should return true if object is of Schema type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 1, 2, 3);
      expect(Schema.isSchema(testSchema)).toBe(true);
    });

    it("should return false if object is not of Schema type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 12, 22, 93);
      const testClass = new EntityClass(testSchema, "ExampleEntity");
      expect(Schema.isSchema(testClass)).toBe(false);
      expect(Schema.isSchema("A")).toBe(false);
    });
  });

  describe("isDynamic", () => {
    it("should return false if schema does not have any custom attributes", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 1, 2, 3);
      expect(testSchema.customAttributes).toBeUndefined();
      expect(testSchema.isDynamic).toBe(false);
    });

    it("should return false if schema does not have the dynamic custom attribute", async () => {
      const schemaContext = await BisTestHelper.getNewContext();
      const testSchema = await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.0.0",
        alias: "ts",
        customAttributes: [
          { className: "TestSchema.CAClass" },
        ],
        items: {
          "CAClass": {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          }
        }
      }, schemaContext);
      expect(testSchema.isDynamic).toBe(false);
    });

    it("should return true if schema has the dynamic custom attribute", async () => {
      const schemaContext = await BisTestHelper.getNewContext();
      const testSchema = await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.0.0",
        alias: "ts",
        references: [
          { name: "CoreCustomAttributes", version: "01.00.01" },
        ],
        customAttributes: [
          { className: "CoreCustomAttributes.DynamicSchema" },
        ],
      }, schemaContext);
      expect(testSchema.isDynamic).toBe(true);
    });
  });
});
