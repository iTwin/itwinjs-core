/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { AnySchemaItem } from "../../Interfaces";
import { ECClass, StructClass } from "../../Metadata/Class";
import { EntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument, getElementChildren, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { SchemaReadHelper } from "../../Deserialization/Helper";
import { XmlParser } from "../../Deserialization/XmlParser";
import { SchemaKey } from "../../SchemaKey";

import { Constant, CustomAttributeClass, Enumeration, Format, KindOfQuantity, Phenomenon, PropertyCategory, SchemaItem, Unit, UnitSystem } from "../../ecschema-metadata";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

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
      expect(() => new Schema(context, "NewSchemaWithInvalidReadVersion", "new", 9999, 4, 5)).to.throw(ECObjectsError);
      expect(() => new Schema(context, "NewSchemaWithInvalidWriteVersion", "new", 12, 9999, 6)).to.throw(ECObjectsError);
      expect(() => new Schema(context, "NewSchemaWithInvalidMinorVersion", "new", 12, 34, 56700000)).to.throw(ECObjectsError);
    });
  });

  describe("miscellaneous API tests", () => {
    it("getReferenceNameByAlias, reference exists, correct name returned.", async () => {
      const refSchemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchema",
        version: "1.0.0",
        alias: "rs",
      };

      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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

      expect(testSchema.getReferenceNameByAlias("rs")).to.equal("RefSchema");
    });

    it("getReferenceNameByAlias, reference does not exist, returns undefined.", async () => {
      const refSchemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "RefSchema",
        version: "1.0.0",
        alias: "rs",
      };

      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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

      expect(testSchema.getReferenceNameByAlias("missing")).to.be.undefined;
    });

    it("getReferenceNameByAlias, no references, returns undefined.", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ValidSchema",
        version: "1.2.3",
        alias: "vs",
      };

      const context = new SchemaContext();
      const testSchema = await Schema.fromJson(schemaJson, context);

      expect(testSchema.getReferenceNameByAlias("rs")).to.be.undefined;
    });
  });

  describe("create schema items", () => {
    it("should succeed for entity class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);
    });

    it("should succeed for mixin class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createMixinClass("TestMixin");

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).to.equal(true);
      expect((await testSchema.getItem<Mixin>("TestMixin"))?.schemaItemType).to.equal(SchemaItemType.Mixin);
    });

    it("should succeed for struct class", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createStructClass("TestStruct");

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).to.equal(true);
      expect((await testSchema.getItem<StructClass>("TestStruct"))?.schemaItemType).to.equal(SchemaItemType.StructClass);
    });

    it("should succeed for non-class schema items", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      await (testSchema as MutableSchema).createKindOfQuantity("TestKindOfQuantity");
      await (testSchema as MutableSchema).createEnumeration("TestEnumeration");
      await (testSchema as MutableSchema).createUnit("TestUnit");
      await (testSchema as MutableSchema).createPropertyCategory("TestPropertyCategory");
      await (testSchema as MutableSchema).createFormat("TestFormat");

      const schemaItems = testSchema.getItems();

      expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);
      expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Enumeration);
      expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Unit);
      expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.PropertyCategory);
      expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Format);
      expect(schemaItems.next().done).to.equal(true);
    });

    it("should succeed with case-insensitive search", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      await (testSchema as MutableSchema).createEntityClass("testEntity");

      expect(await testSchema.getItem("TESTENTITY")).not.undefined;
      expect(await testSchema.getItem("TestEntity")).not.undefined;
      expect(await testSchema.getItem("testEntity")).not.undefined;
    });
  });

  describe("adding and deleting SchemaItems from schemas", async () => {
    it("should do nothing when deleting SchemaItem name that is not in schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
    });

    it("should do nothing when deleting SchemaItem name that is not in schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
    });

    it("should do nothing if SchemaItem is already deleted, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestUnitSystem"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
    });

    it("should do nothing if SchemaItem is already deleted", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestUnitSystem"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
    });

    it("should add and delete classes by case-insensitive names", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem1");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem2");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem3");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem1"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem1"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem2"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem2"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem3"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem3"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem1");
      expect(await testSchema.getItem("TestUnitSystem1")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("testunitsystem2");
      expect(await testSchema.getItem("TestUnitSystem2")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TESTUNITSYSTEM3");
      expect(await testSchema.getItem("TestUnitSystem3")).to.be.undefined;
    });

    it("should add and delete classes by case-insensitive names, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem1");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem2");
      await (testSchema as MutableSchema).createUnitSystem("TestUnitSystem3");

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem1"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem1"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem2"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem2"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      expect(ECClass.isSchemaItem(await testSchema.getItem("TestUnitSystem3"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem3"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem1");
      expect(await testSchema.getItem("TestUnitSystem1")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("testunitsystem2");
      expect(await testSchema.getItem("TestUnitSystem2")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TESTUNITSYSTEM3");
      expect(await testSchema.getItem("TestUnitSystem3")).to.be.undefined;
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

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestConstant"))).to.equal(true);
      expect((await testSchema.getItem<Constant>("TestConstant"))?.schemaItemType).to.equal(SchemaItemType.Constant);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestEnumeration"))).to.equal(true);
      expect((await testSchema.getItem<Enumeration>("TestEnumeration"))?.schemaItemType).to.equal(SchemaItemType.Enumeration);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestFormat"))).to.equal(true);
      expect((await testSchema.getItem<Format>("TestFormat"))?.schemaItemType).to.equal(SchemaItemType.Format);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestInvertedUnit"))).to.equal(true);
      expect((await testSchema.getItem<CustomAttributeClass>("TestInvertedUnit"))?.schemaItemType).to.equal(SchemaItemType.InvertedUnit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnit"))).to.equal(true);
      expect((await testSchema.getItem<Unit>("TestUnit"))?.schemaItemType).to.equal(SchemaItemType.Unit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestKindOfQuantity"))).to.equal(true);
      expect((await testSchema.getItem<KindOfQuantity>("TestKindOfQuantity"))?.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPhenomenon"))).to.equal(true);
      expect((await testSchema.getItem<Phenomenon>("TestPhenomenon"))?.schemaItemType).to.equal(SchemaItemType.Phenomenon);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPropertyCategory"))).to.equal(true);
      expect((await testSchema.getItem<PropertyCategory>("TestPropertyCategory"))?.schemaItemType).to.equal(SchemaItemType.PropertyCategory);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      (testSchema as MutableSchema).deleteSchemaItemSync("TestConstant");
      expect(await testSchema.getItem("TestConstant")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestEnumeration");
      expect(await testSchema.getItem("TestEnumeration")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestFormat");
      expect(await testSchema.getItem("TestFormat")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestInvertedUnit");
      expect(await testSchema.getItem("TestInvertedUnit")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnit");
      expect(await testSchema.getItem("TestUnit")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestKindOfQuantity");
      expect(await testSchema.getItem("TestKindOfQuantity")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestPhenomenon");
      expect(await testSchema.getItem("TestPhenomenon")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestPropertyCategory");
      expect(await testSchema.getItem("TestPropertyCategory")).to.be.undefined;

      (testSchema as MutableSchema).deleteSchemaItemSync("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
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

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestConstant"))).to.equal(true);
      expect((await testSchema.getItem<Constant>("TestConstant"))?.schemaItemType).to.equal(SchemaItemType.Constant);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestEnumeration"))).to.equal(true);
      expect((await testSchema.getItem<Enumeration>("TestEnumeration"))?.schemaItemType).to.equal(SchemaItemType.Enumeration);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestFormat"))).to.equal(true);
      expect((await testSchema.getItem<Format>("TestFormat"))?.schemaItemType).to.equal(SchemaItemType.Format);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestInvertedUnit"))).to.equal(true);
      expect((await testSchema.getItem<CustomAttributeClass>("TestInvertedUnit"))?.schemaItemType).to.equal(SchemaItemType.InvertedUnit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnit"))).to.equal(true);
      expect((await testSchema.getItem<Unit>("TestUnit"))?.schemaItemType).to.equal(SchemaItemType.Unit);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestKindOfQuantity"))).to.equal(true);
      expect((await testSchema.getItem<KindOfQuantity>("TestKindOfQuantity"))?.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPhenomenon"))).to.equal(true);
      expect((await testSchema.getItem<Phenomenon>("TestPhenomenon"))?.schemaItemType).to.equal(SchemaItemType.Phenomenon);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestPropertyCategory"))).to.equal(true);
      expect((await testSchema.getItem<PropertyCategory>("TestPropertyCategory"))?.schemaItemType).to.equal(SchemaItemType.PropertyCategory);

      expect(SchemaItem.isSchemaItem(await testSchema.getItem("TestUnitSystem"))).to.equal(true);
      expect((await testSchema.getItem<UnitSystem>("TestUnitSystem"))?.schemaItemType).to.equal(SchemaItemType.UnitSystem);

      await (testSchema as MutableSchema).deleteSchemaItem("TestConstant");
      expect(await testSchema.getItem("TestConstant")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestEnumeration");
      expect(await testSchema.getItem("TestEnumeration")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestFormat");
      expect(await testSchema.getItem("TestFormat")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestInvertedUnit");
      expect(await testSchema.getItem("TestInvertedUnit")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnit");
      expect(await testSchema.getItem("TestUnit")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestKindOfQuantity");
      expect(await testSchema.getItem("TestKindOfQuantity")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestPhenomenon");
      expect(await testSchema.getItem("TestPhenomenon")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestPropertyCategory");
      expect(await testSchema.getItem("TestPropertyCategory")).to.be.undefined;

      await (testSchema as MutableSchema).deleteSchemaItem("TestUnitSystem");
      expect(await testSchema.getItem("TestUnitSystem")).to.be.undefined;
    });
  });

  describe("adding and deleting classes from schemas", async () => {
    it("should do nothing when deleting class name that is not in schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;
    });

    it("should do nothing when deleting class name that is not in schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;
    });

    it("should do nothing if class is already deleted, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;
    });

    it("should do nothing if class is already deleted", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;
    });

    it("should add and delete classes by case-insensitive names", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity1");
      await (testSchema as MutableSchema).createEntityClass("TestEntity2");
      await (testSchema as MutableSchema).createEntityClass("TestEntity3");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity1"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity1"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity2"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity2"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity3"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity3"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity1");
      expect(await testSchema.getItem("TestEntity1")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("testentity2");
      expect(await testSchema.getItem("TestEntity2")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TESTENTITY3");
      expect(await testSchema.getItem("TestEntity3")).to.be.undefined;
    });

    it("should add and delete classes by case-insensitive names, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity1");
      await (testSchema as MutableSchema).createEntityClass("TestEntity2");
      await (testSchema as MutableSchema).createEntityClass("TestEntity3");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity1"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity1"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity2"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity2"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity3"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity3"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity1");
      expect(await testSchema.getItem("TestEntity1")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("testentity2");
      expect(await testSchema.getItem("TestEntity2")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TESTENTITY3");
      expect(await testSchema.getItem("TestEntity3")).to.be.undefined;
    });

    it("should successfully delete for all ECClasses from schema, synchronous", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");
      await (testSchema as MutableSchema).createMixinClass("TestMixin");
      await (testSchema as MutableSchema).createStructClass("TestStruct");
      await (testSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      await (testSchema as MutableSchema).createRelationshipClass("TestRelationship");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestMixin"))?.schemaItemType).to.equal(SchemaItemType.Mixin);

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestStruct"))?.schemaItemType).to.equal(SchemaItemType.StructClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestCustomAttribute"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestCustomAttribute"))?.schemaItemType).to.equal(SchemaItemType.CustomAttributeClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestRelationship"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestRelationship"))?.schemaItemType).to.equal(SchemaItemType.RelationshipClass);

      (testSchema as MutableSchema).deleteClassSync("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestMixin");
      expect(await testSchema.getItem("TestMixin")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestStruct");
      expect(await testSchema.getItem("TestStruct")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestCustomAttribute");
      expect(await testSchema.getItem("TestCustomAttribute")).to.be.undefined;

      (testSchema as MutableSchema).deleteClassSync("TestRelationship");
      expect(await testSchema.getItem("TestRelationship")).to.be.undefined;
    });

    it("should successfully delete for all ECClasses from schema", async () => {
      const testSchema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 1, 1);
      await (testSchema as MutableSchema).createEntityClass("TestEntity");
      await (testSchema as MutableSchema).createMixinClass("TestMixin");
      await (testSchema as MutableSchema).createStructClass("TestStruct");
      await (testSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      await (testSchema as MutableSchema).createRelationshipClass("TestRelationship");

      expect(ECClass.isECClass(await testSchema.getItem("TestEntity"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestEntity"))?.schemaItemType).to.equal(SchemaItemType.EntityClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestMixin"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestMixin"))?.schemaItemType).to.equal(SchemaItemType.Mixin);

      expect(ECClass.isECClass(await testSchema.getItem("TestStruct"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestStruct"))?.schemaItemType).to.equal(SchemaItemType.StructClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestCustomAttribute"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestCustomAttribute"))?.schemaItemType).to.equal(SchemaItemType.CustomAttributeClass);

      expect(ECClass.isECClass(await testSchema.getItem("TestRelationship"))).to.equal(true);
      expect((await testSchema.getItem<EntityClass>("TestRelationship"))?.schemaItemType).to.equal(SchemaItemType.RelationshipClass);

      await (testSchema as MutableSchema).deleteClass("TestEntity");
      expect(await testSchema.getItem("TestEntity")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestMixin");
      expect(await testSchema.getItem("TestMixin")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestStruct");
      expect(await testSchema.getItem("TestStruct")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestCustomAttribute");
      expect(await testSchema.getItem("TestCustomAttribute")).to.be.undefined;

      await (testSchema as MutableSchema).deleteClass("TestRelationship");
      expect(await testSchema.getItem("TestRelationship")).to.be.undefined;
    });
  });

  describe("bulk get methods for schema items", () => {
    let testSchema: Schema;

    before(async () => {
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
      let schemaItems: IterableIterator<AnySchemaItem>;

      before(() => {
        schemaItems = testSchema.getItems();
      });

      it("should return all schema items in schema", () => {
        const itemArray = Array.from(testSchema.getItems());
        expect(itemArray.length).to.equal(8);

        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.EntityClass);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Mixin);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.StructClass);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Enumeration);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Unit);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.PropertyCategory);
        expect(schemaItems.next().value.schemaItemType).to.equal(SchemaItemType.Format);
        expect(schemaItems.next().done).to.equal(true);
      });
    });

    describe("getClasses", () => {
      let schemaClasses: IterableIterator<ECClass>;

      before(() => {
        schemaClasses = testSchema.getClasses();
      });

      it("should return only class items in schema", async () => {
        const classArray = Array.from(testSchema.getClasses());
        expect(classArray.length).to.eql(3);

        expect(schemaClasses.next().value.schemaItemType).to.eql(SchemaItemType.EntityClass);
        expect(schemaClasses.next().value.schemaItemType).to.eql(SchemaItemType.Mixin);
        expect(schemaClasses.next().value.schemaItemType).to.eql(SchemaItemType.StructClass);
        expect(schemaClasses.next().done).to.eql(true);
      });
    });
  });

  describe("Schemas with newer ECXml version", async () => {
    const unsupportedVersionError = `The Schema 'TestSchema' has an unsupported ECVersion and cannot be serialized.`;

    type TestCase = [ xmlVersionMajor: number, xmlVersionMinor: number, deserializtionStatus: boolean, serializationStatus: boolean ];
    const testCases: TestCase[] = [
      [Schema.currentECXmlMajorVersion, Schema.currentECXmlMinorVersion - 1, true, true],
      [Schema.currentECXmlMajorVersion, Schema.currentECXmlMinorVersion, true, true],
      [Schema.currentECXmlMajorVersion, Schema.currentECXmlMinorVersion + 1, true, false],
      [Schema.currentECXmlMajorVersion + 1, Schema.currentECXmlMinorVersion, false, false],
      [Schema.currentECXmlMajorVersion + 1, Schema.currentECXmlMinorVersion + 1, false, false],
    ];

    async function testSerialization(schema: Schema, serializationStatus: boolean, expectedError: string) {
      const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
      if (serializationStatus) {
        await expect(schema.toXml(xmlDoc)).to.not.be.rejectedWith(ECObjectsError, expectedError);
        expect(() => schema.toJSON()).to.not.throw(ECObjectsError, expectedError);
      } else {
        await expect(schema.toXml(xmlDoc)).to.be.rejectedWith(ECObjectsError, expectedError);
        expect(() => schema.toJSON()).to.throw(ECObjectsError, expectedError);
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
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(xmlVersionMajor);
        expect(schema.originalECXmlMinorVersion).to.equal(xmlVersionMinor);
        expect(schema.getItemSync("testClass") !== undefined).to.equal(deserializtionStatus);

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
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(xmlVersionMajor);
        expect(schema.originalECXmlMinorVersion).to.equal(xmlVersionMinor);
        expect(await schema.getItem("testClass") !== undefined).to.equal(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas - sync", async () => {
      // eslint-disable-next-line prefer-const
      for (let [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
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

        let schema = new Schema(new SchemaContext());

        try {
          schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // When the ECXML major version is newer, deserialization will throw an error and the schema object will never get updated and the ECXMl version will remain the deafult latest supported.
          // Hence serialization should succeed in this case.
          if (ecMajorVersion > Schema.currentECXmlMajorVersion || (ecMajorVersion === Schema.currentECXmlMajorVersion && ecMinorVersion > Schema.currentECXmlMinorVersion))
            serializationStatus = true;

          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(ecMajorVersion);
        expect(schema.originalECXmlMinorVersion).to.equal(ecMinorVersion);
        expect(schema.getItemSync("testClass") !== undefined).to.equal(deserializtionStatus);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    it("Deserialize and serialize newer JS schemas - async", async () => {
      // eslint-disable-next-line prefer-const
      for (let [ecMajorVersion, ecMinorVersion, deserializtionStatus, serializationStatus] of testCases) {
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

        let schema = new Schema(new SchemaContext());
        try {
          schema = await Schema.fromJson(schemaJson, new SchemaContext());
        } catch (err: any) {
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // When the ECXML major version is newer, deserialization will throw an error and the schema object will never get updated and the ECXMl version will remain the deafult latest supported.
          // Hence serialization should succeed in this case.
          if (ecMajorVersion > Schema.currentECXmlMajorVersion || (ecMajorVersion === Schema.currentECXmlMajorVersion && ecMinorVersion > Schema.currentECXmlMinorVersion))
            serializationStatus = true;

          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(ecMajorVersion);
        expect(schema.originalECXmlMinorVersion).to.equal(ecMinorVersion);
        expect(await schema.getItem("testClass") !== undefined).to.equal(deserializtionStatus);

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
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(ecMajorVersion);
        expect(schema.originalECXmlMinorVersion).to.equal(ecMinorVersion);

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
          assert.equal(err.message, `The Schema 'TestSchema' has an unsupported ECVersion and cannot be loaded.`);
          assert.isFalse(deserializtionStatus);

          // Schema serialization should fail if the major ECXml version is newer
          await testSerialization(schema, serializationStatus, unsupportedVersionError);
          continue;
        }

        assert.isTrue(deserializtionStatus);
        expect(schema.originalECXmlMajorVersion).to.equal(ecMajorVersion);
        expect(schema.originalECXmlMinorVersion).to.equal(ecMinorVersion);

        // Schema serialization should fail if the major ECXml version is newer
        await testSerialization(schema, serializationStatus, unsupportedVersionError);
      }
    });

    describe("Schema with newer ECXml version and unknowns", async () => {
      let _schema: Schema;
      let _xmlReader: SchemaReadHelper<Document>;

      beforeEach(async () => {
        const context = new SchemaContext();
        _xmlReader = new SchemaReadHelper(XmlParser, context);
        _schema = new Schema(context);
      });

      async function deserializeXML(schemaXml: string) {
        try {
          await _xmlReader.readSchema(_schema, new DOMParser().parseFromString(schemaXml));
        } catch (err: any) {
          assert(false, `The schema should have been deserialized by ignoring the unknowns. Instead error was thrown: ${err.message}`);
        }
      }
      function deserializeXMLSync(schemaXml: string) {
        try {
          _xmlReader.readSchemaSync(_schema, new DOMParser().parseFromString(schemaXml));
        } catch (err: any) {
          assert(false, `The schema should have been deserialized by ignoring the unknowns. Instead error was thrown: ${err.message}`);
        }
      }
      async function deserializeJSON(schemaJSON: string) {
        try {
          _schema = await Schema.fromJson(schemaJSON, _schema.context);
        } catch (err: any) {
          assert(false, `The schema should have been deserialized by ignoring the unknowns. Instead error was thrown: ${err.message}`);
        }
      }

      function deserializeJSONSync(schemaJSON: string) {
        try {
          _schema = Schema.fromJsonSync(schemaJSON, _schema.context);
        } catch (err: any) {
          assert(false, `The schema should have been deserialized by ignoring the unknowns. Instead error was thrown: ${err.message}`);
        }
      }

      function testScenario() {
        assert.isTrue(_schema !== undefined);
        const validClass = _schema.getItemSync("ValidClass");
        expect(validClass).to.not.be.undefined;
        expect(_schema.getItemSync("UnknownItem")).to.be.undefined;
      }

      it.only("Schema XML with unknown class modifier", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECXmlMajorVersion}.${Schema.currentECXmlMinorVersion + 1}">
            <ECEntityClass typeName="ValidClass" description="Test Entity Class" />
            <ECEntityClass typeName="UnknownItem" description="Test Entity Class" modifier="UnknownModifier" />
          </ECSchema>`;

        await deserializeXML(schemaXml);
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);

        deserializeXMLSync(schemaXml);
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it.only("Schema JSON with unknown class modifier", async () => {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${Schema.currentECXmlMajorVersion}${Schema.currentECXmlMinorVersion + 1}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            UnknownItem: { schemaItemType: "EntityClass", name: "UnknownItem", modifier: "UnknownModifier" },
          },
        };

        await deserializeJSON(JSON.stringify(schemaJson));
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);

        deserializeJSONSync(JSON.stringify(schemaJson));
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);
      });

      it.only("Schema XML with unknown Schema Item Type", async () => {
        const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${Schema.currentECXmlMajorVersion}.${Schema.currentECXmlMinorVersion + 1}">
            <ECEntityClass typeName="ValidClass" description="Test Entity Class" />
            <UnknownItem typeName="UnknownItem" unknownAttribute="unknownAttr" />
          </ECSchema>`;

        await deserializeXML(schemaXml);
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);

        deserializeXMLSync(schemaXml);
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);
      });
      it.only("Schema JSON with unknown Schema Item Type", async () => {
        const schemaJson = {
          $schema: `https://dev.bentley.com/json_schemas/ec/${Schema.currentECXmlMajorVersion}${Schema.currentECXmlMinorVersion + 1}/ecschema`,
          name: "TestSchema",
          version: "1.0.0",
          alias: "ts",
          items: {
            ValidClass:  { schemaItemType: "EntityClass", name: "ValidClass" },
            UnknownItem: { schemaItemType: "UnknownItem", name: "UnknownItem" },
          },
        };

        await deserializeJSON(JSON.stringify(schemaJson));
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);

        deserializeJSONSync(JSON.stringify(schemaJson));
        testScenario();
        await testSerialization(_schema, false, unsupportedVersionError);
      });
    });
  });

  describe("fromJson", () => {
    describe("should successfully deserialize valid JSON", () => {
      function assertValidSchema(testSchema: Schema) {
        expect(testSchema.name).to.eql("ValidSchema");
        expect(testSchema.alias).to.eql("vs");
        expect(testSchema.label).to.eql("SomeDisplayLabel");
        expect(testSchema.description).to.eql("A really long description...");
        expect(testSchema.readVersion).to.eql(1);
        expect(testSchema.writeVersion).to.eql(2);
        expect(testSchema.minorVersion).to.eql(3);
      }

      it("with name/version first specified in JSON", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext());
        expect(testSchema).to.exist;
        await testSchema.fromJSON(propertyJson);
        assertValidSchema(testSchema);
      });

      it("with name/version repeated in JSON", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(propertyJson);
        assertValidSchema(testSchema);
      });

      it("should throw for invalid alias", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext());
        expect(testSchema).to.exist;
        await expect(testSchema.fromJSON(propertyJson)).to.be.rejectedWith(ECObjectsError, "The Schema ValidSchema does not have the required 'alias' attribute.");
      });

      it("should throw for invalid $schema", async () => {
        const schemaJson = {
          $schema: "https://badmetaschema.com",
          name: "InvalidSchema",
          version: "1.2.3",
        };
        const context = new SchemaContext();
        const testSchema = new Schema(context, "InvalidSchema", "is", 1, 2, 3);
        expect(testSchema).to.exist;
        await expect(testSchema.fromJSON(schemaJson as any)).to.be.rejectedWith(ECObjectsError, "The Schema 'InvalidSchema' has an unsupported namespace 'https://badmetaschema.com'.");
        await expect(Schema.fromJson(schemaJson as any, context)).to.be.rejectedWith(ECObjectsError, "The Schema 'InvalidSchema' has an unsupported namespace 'https://badmetaschema.com'.");
      });

      it("should throw for mismatched name", async () => {
        const json = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ThisDoesNotMatch",
          version: "1.2.3",
          alias: "bad",
        };
        const testSchema = new Schema(new SchemaContext(), "BadSchema", "bad", 1, 2, 3);
        expect(testSchema).to.exist;
        await expect(testSchema.fromJSON(json)).to.be.rejectedWith(ECObjectsError);
      });

      it("should throw for mismatched version", async () => {
        const json = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "BadSchema",
          version: "1.2.6",
          alias: "bad",
        };
        const testSchema = new Schema(new SchemaContext(), "BadSchema", "bad", 1, 2, 3);
        expect(testSchema).to.exist;
        await expect(testSchema.fromJSON(json)).to.be.rejectedWith(ECObjectsError);
      });
    });

    describe("toJSON", () => {
      it("Simple JSON serialization of an empty schema", async () => {
        const context = new SchemaContext();
        let schema: Schema = new Schema(context);
        expect(() => schema.toJSON()).to.throw(ECObjectsError, "The schema has an invalid or missing SchemaKey.");

        schema = new Schema(context, "EmptySchema", "es", 1, 2, 3);
        expect(() => schema.toJSON()).to.not.throw(ECObjectsError, "The schema has an invalid or missing SchemaKey.");
      });

      it("Simple serialization", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(schemaJson);
        const serialized = testSchema.toJSON();
        expect(serialized).to.deep.equal({ ...schemaJson, version: "01.02.03" });
      });
      it("Serialization - JSON stringify", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(schemaJson);
        const serializedString = JSON.stringify(testSchema);
        const serialized = JSON.parse(serializedString);
        expect(serialized).to.deep.equal({ ...schemaJson, version: "01.02.03" });
      });
      it("Serialization with one custom attribute- only class name", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema" });
        const serialized = testSchema.toJSON();
        assert.strictEqual(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
      });
      it("Serialization with one custom attribute- additional properties", () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        testSchema.fromJSONSync(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema", ShowClasses: true });
        const serialized = testSchema.toJSON();
        assert.strictEqual(serialized.customAttributes![0].className, "CoreCustomAttributes.HiddenSchema");
        assert.isTrue(serialized.customAttributes![0].ShowClasses);
      });
      it("Serialization with multiple custom attributes- only class name", async () => {
        const propertyJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
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
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(propertyJson);
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustomAttributes.HiddenSchema", ShowClasses: true });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreAttributes.HiddenSchema", FloatValue: 1.2 });
        (testSchema as MutableSchema).addCustomAttribute({ className: "CoreCustom.HiddenSchema", IntegerValue: 5 });
        const serialized = testSchema.toJSON();
        assert.isTrue(serialized.customAttributes![0].ShowClasses);
        assert.strictEqual(serialized.customAttributes![1].FloatValue, 1.2);
        assert.strictEqual(serialized.customAttributes![2].IntegerValue, 5);
      });
      it("Serialization with one reference", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(testSchema).to.exist;
        const entityClassJson = testSchema.toJSON();
        assert.isDefined(entityClassJson);
        assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
        assert.strictEqual(entityClassJson.references![0].version, "01.00.00");
      });
      it("Serialization with multiple references", () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(testSchema).to.exist;
        const entityClassJson = testSchema.toJSON();
        assert.isDefined(entityClassJson);
        assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
        assert.strictEqual(entityClassJson.references![0].version, "01.00.00");
        assert.strictEqual(entityClassJson.references![1].name, "AnotherRefSchema");
        assert.strictEqual(entityClassJson.references![1].version, "01.00.02");
      });
      it("Serialization with one reference and item", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        assert.isDefined(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const entityClassJson = testSchema.toJSON();
        assert.isDefined(entityClassJson);
        // eslint-disable-next-line @typescript-eslint/dot-notation
        assert.isDefined(entityClassJson.items!["testClass"]);
        assert.strictEqual(entityClassJson.items!.testClass.schemaItemType, "EntityClass");
        assert.strictEqual(entityClassJson.items!.testClass.label, "ExampleEntity");
        assert.strictEqual(entityClassJson.items!.testClass.description, "An example entity class.");
      });
      it("Serialization with one reference and multiple items", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        assert.isDefined(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const entityClassJson = testSchema.toJSON();
        assert.isDefined(entityClassJson);

        assert.isDefined(entityClassJson.items!.testClass);
        assert.strictEqual(entityClassJson.items!.testClass.schemaItemType, "EntityClass");
        assert.strictEqual(entityClassJson.items!.testClass.label, "ExampleEntity");
        assert.strictEqual(entityClassJson.items!.testClass.description, "An example entity class.");

        assert.isDefined(entityClassJson.items!.ExampleMixin);
        assert.strictEqual(entityClassJson.items!.ExampleMixin.schemaItemType, "Mixin");

        assert.isDefined(entityClassJson.items!.ExampleStruct);
        assert.strictEqual(entityClassJson.items!.ExampleMixin.schemaItemType, "Mixin");

        assert.isDefined(entityClassJson.items!.testEnum);
        assert.strictEqual(entityClassJson.items!.testEnum.schemaItemType, "Enumeration");
      });
    });

    it("Serialization with reference containing different minor version", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
      expect(testSchema).to.exist;
      const entityClassJson = testSchema.toJSON();
      assert.isDefined(entityClassJson);
      assert.strictEqual(entityClassJson.references![0].name, "RefSchema");
      assert.strictEqual(entityClassJson.references![0].version, "01.00.01");
    });

    it("Serialization with reference containing different write version, throws", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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

      await expect(Schema.fromJson(schemaJson, context)).to.be.rejectedWith(ECObjectsError, "Could not locate the referenced schema, RefSchema.01.00.00, of ValidSchema");
    });

    describe("toXML", () => {
      let newDom: Document;

      beforeEach(() => {
        newDom = createEmptyXmlDocument();
      });

      function getCustomAttribute(containerElement: Element, name: string): Element {
        const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
        expect(caElements.length).to.equal(1, "Expected 1 ECCustomAttributes Element");
        const caElement = containerElement.getElementsByTagName(name);
        expect(caElement.length).to.equal(1, `Expected one CustomAttribute Element with the name '${name}`);
        return caElement[0];
      }

      function getCAPropertyValueElement(schema: Element, caName: string, propertyName: string): Element {
        const attribute = getCustomAttribute(schema, caName);
        const propArray = attribute.getElementsByTagName(propertyName);
        expect(propArray.length).to.equal(1, `Expected 1 CustomAttribute Property with the name '${propertyName}'`);
        return propArray[0];
      }

      it("Simple XML serialization of an empty schema", async () => {
        const context = new SchemaContext();
        let schema: Schema = new Schema(context);
        const xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");

        await expect(schema.toXml(xmlDoc)).to.be.rejectedWith(ECObjectsError, `The schema has an invalid or missing SchemaKey.`);

        schema = new Schema(context, "EmptySchema", "ts", 1, 2, 3);
        await expect(schema.toXml(xmlDoc)).to.not.be.rejectedWith(ECObjectsError, `The schema has an invalid or missing SchemaKey.`);
      });

      it("Simple serialization", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
          label: "SomeDisplayLabel",
          description: "A really long description...",
        };
        const testSchema = new Schema(new SchemaContext(), "ValidSchema", "vs", 1, 2, 3);
        expect(testSchema).to.exist;
        await testSchema.fromJSON(schemaJson);

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        expect(serialized.nodeName).to.eql("ECSchema");
        expect(serialized.getAttribute("xmlns")).to.eql("http://www.bentley.com/schemas/Bentley.ECXML.3.2");
        expect(serialized.getAttribute("schemaName")).to.eql(schemaJson.name);
        expect(serialized.getAttribute("version")).to.eql("01.02.03");
        expect(serialized.getAttribute("alias")).to.eql(schemaJson.alias);
        expect(serialized.getAttribute("displayLabel")).to.eql(schemaJson.label);
        expect(serialized.getAttribute("description")).to.eql(schemaJson.description);
      });

      it("Deserialize after Serialization", async () => {

        const referenceJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(deserialized.toJSON()).to.eql(schema.toJSON());
      });

      it("Serialization with one reference", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(testSchema).to.exist;

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).to.eql(1);
        const reference = children[0];
        expect(reference.nodeName).to.eql("ECSchemaReference");
        expect(reference.getAttribute("name")).to.eql("RefSchema");
        expect(reference.getAttribute("version")).to.eql("01.00.00");
        expect(reference.getAttribute("alias")).to.eql("ref");
      });

      it("Serialization with multiple references", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(testSchema).to.exist;

        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).to.eql(2);

        const reference1 = children[0];
        expect(reference1.nodeName).to.eql("ECSchemaReference");
        expect(reference1.getAttribute("name")).to.eql("RefSchema");
        expect(reference1.getAttribute("version")).to.eql("01.00.00");
        expect(reference1.getAttribute("alias")).to.eql("ref");

        const reference2 = children[1];
        expect(reference2.nodeName).to.eql("ECSchemaReference");
        expect(reference2.getAttribute("name")).to.eql("AnotherRefSchema");
        expect(reference2.getAttribute("version")).to.eql("01.00.02");
        expect(reference2.getAttribute("alias")).to.eql("anotherRef");
      });

      it("Serialization with one reference and item", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        assert.isDefined(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).to.eql(2);

        const reference = children[0];
        expect(reference.nodeName).to.eql("ECSchemaReference");
        expect(reference.getAttribute("name")).to.eql("RefSchema");
        expect(reference.getAttribute("version")).to.eql("01.00.05");
        expect(reference.getAttribute("alias")).to.eql("ref");

        const entityClass = children[1];
        expect(entityClass.nodeName).to.eql("ECEntityClass");
        expect(entityClass.getAttribute("typeName")).to.eql("testClass");
        expect(entityClass.getAttribute("displayLabel")).to.eql("ExampleEntity");
        expect(entityClass.getAttribute("description")).to.eql("An example entity class.");
      });

      it("Serialization with one reference and multiple items", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        assert.isDefined(refBaseClass);
        await context.addSchema(refSchema);
        let testSchema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
        testSchema = await Schema.fromJson(schemaJson, context);
        const serialized = (await testSchema.toXml(newDom)).documentElement;
        const children = getElementChildren(serialized);
        expect(children.length).to.eql(5);

        const references = getElementChildrenByTagName(serialized, "ECSchemaReference");
        assert.strictEqual(references.length, 1);
        const reference = references[0];
        expect(reference.getAttribute("name")).to.eql("RefSchema");
        expect(reference.getAttribute("version")).to.eql("01.00.05");
        expect(reference.getAttribute("alias")).to.eql("ref");

        const entityClasses = getElementChildrenByTagName(serialized, "ECEntityClass");
        assert.strictEqual(entityClasses.length, 2);
        const entityClass = entityClasses[0];
        expect(entityClass.getAttribute("typeName")).to.eql("testClass");
        const mixin = entityClasses[1];
        expect(mixin.getAttribute("typeName")).to.eql("ExampleMixin");

        const structClasses = getElementChildrenByTagName(serialized, "ECStructClass");
        assert.strictEqual(structClasses.length, 1);
        const structClass = structClasses[0];
        expect(structClass.getAttribute("typeName")).to.eql("ExampleStruct");

        const enumerations = getElementChildrenByTagName(serialized, "ECEnumeration");
        assert.strictEqual(enumerations.length, 1);
        const enumeration = enumerations[0];
        expect(enumeration.getAttribute("typeName")).to.eql("testEnum");
      });

      /* it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "ValidSchema",
          version: "1.2.3",
          alias: "vs",
        };
        const context = new SchemaContext();
        const refSchema = new Schema(context, "RefSchema", 1, 0, 5);
        const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
        assert.isDefined(refCAClass);
        await context.addSchema(refSchema);
        const testSchema = await Schema.fromJson(schemaJson, new SchemaContext());
        (testSchema as MutableSchema).addReference(refSchema);
        (testSchema as MutableSchema).addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
        const serialized = (await testSchema.toXml(newDom)).documentElement;

        const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
        expect(attributeElement.getAttribute("xmlns")).to.equal("RefSchema.01.00.05");
      }); */

      it("Serialization with one custom attribute defined in same schema, only class name", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(attributeElement.getAttribute("xmlns")).to.equal("ValidSchema.01.02.03");
      });

      it("Serialization with one custom attribute, with Primitive property values", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(element.textContent).to.equal("True");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
        expect(element.textContent).to.equal("False");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
        expect(element.textContent).to.equal("1");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
        expect(element.textContent).to.equal("100");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
        expect(element.textContent).to.equal("200");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
        expect(element.textContent).to.equal(nowTicks.toString());
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
        expect(element.textContent).to.equal("100,200");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
        expect(element.textContent).to.equal("100,200,300");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
        expect(element.textContent).to.equal("geometry");
        element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
        expect(element.textContent).to.equal("binary");
      });

      it("Serialization with one custom attribute, with PrimitiveArray property values", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(children.length).to.equal(3);
        expect(children[0].textContent).to.equal("True");
        expect(children[1].textContent).to.equal("False");
        expect(children[2].textContent).to.equal("True");
      });

      it("Serialization with one custom attribute, with Struct property value", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(children.length).to.equal(2);
        expect(children[0].textContent).to.equal("1");
        expect(children[1].textContent).to.equal("test");
      });

      it("Serialization with one custom attribute, with Enumeration property value", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(children.length).to.equal(1);
        expect(children[0].textContent).to.equal("0");
      });

      it("Serialization with one custom attribute, with StructArray property value", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
        expect(structs.length).to.equal(2);

        let prop1 = structs[0].getElementsByTagName("Integer");
        expect(prop1.length).to.equal(1);
        expect(prop1[0].textContent).to.equal("1");

        let prop2 = structs[0].getElementsByTagName("String");
        expect(prop2.length).to.equal(1);
        expect(prop2[0].textContent).to.equal("test1");

        prop1 = structs[1].getElementsByTagName("Integer");
        expect(prop1.length).to.equal(1);
        expect(prop1[0].textContent).to.equal("2");

        prop2 = structs[1].getElementsByTagName("String");
        expect(prop2.length).to.equal(1);
        expect(prop2[0].textContent).to.equal("test2");
      });

      async function serialize(schemaJson: any): Promise<string> {
        const context = new SchemaContext();
        const testSchema = await Schema.fromJson(schemaJson, context);
        expect(testSchema).to.exist;

        const xmlDom = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "text/xml");
        await testSchema.toXml(xmlDom);
        return new XMLSerializer().serializeToString(xmlDom);
      }

      async function testKoQSerialization(presentationUnit: any): Promise<string> {
        const testSchemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
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
      expect(Schema.isSchema(undefinedSchema)).to.be.false;
    });

    it("should return true if object is of Schema type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 1, 2, 3);
      expect(Schema.isSchema(testSchema)).to.be.true;
    });

    it("should return false if object is not of Schema type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 12, 22, 93);
      const testClass = new EntityClass(testSchema, "ExampleEntity");
      expect(Schema.isSchema(testClass)).to.be.false;
      expect(Schema.isSchema("A")).to.be.false;
    });
  });
});
