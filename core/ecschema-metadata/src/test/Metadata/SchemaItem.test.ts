/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItem } from "../../Metadata/SchemaItem";
import { EntityClass } from "../../Metadata/EntityClass";
import { Schema } from "../../Metadata/Schema";
import { SchemaItemKey, SchemaKey } from "../../SchemaKey";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { AbstractSchemaItemType, SchemaItemType } from "../../ECObjects";
import { Mixin } from "../../Metadata/Mixin";
import { ECClass, StructClass } from "../../Metadata/Class";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { Enumeration } from "../../Metadata/Enumeration";
import { KindOfQuantity } from "../../Metadata/KindOfQuantity";
import { PropertyCategory } from "../../Metadata/PropertyCategory";
import { Unit } from "../../Metadata/Unit";
import { InvertedUnit } from "../../Metadata/InvertedUnit";
import { Constant } from "../../Metadata/Constant";
import { Phenomenon } from "../../Metadata/Phenomenon";
import { UnitSystem } from "../../Metadata/UnitSystem";
import { Format } from "../../ecschema-metadata";

/* eslint-disable @typescript-eslint/naming-convention */

describe("SchemaItem", () => {
  describe("toJSON", () => {
    let baseClass: any;
    let schema;

    before(() => {
      schema = new Schema(new SchemaContext(), "ExampleSchema", "example", 1, 0, 0);
      baseClass = new EntityClass(schema, "ExampleEntity");
    });

    it("Serialize SchemaItem Standalone", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schema: "ExampleSchema",
        version: "1.0.0",
        schemaItemType: "EntityClass",
        name: "ExampleEntity",
        alias: "example",
        label: "ExampleEntity",
        description: "An example entity class.",
      };
      await (baseClass as EntityClass).fromJSON(propertyJson);
      const testClass = (baseClass as EntityClass).toJSON(true, true);
      expect(testClass).to.exist;
      assert.strictEqual(testClass.$schema, "https://dev.bentley.com/json_schemas/ec/32/schemaitem");
      assert.strictEqual(testClass.schema, "ExampleSchema");
      assert.strictEqual(testClass.schemaVersion, "01.00.00");
      assert.strictEqual(testClass.schemaItemType, "EntityClass");
      assert.strictEqual(testClass.name, "ExampleEntity");
      assert.strictEqual(testClass.label, "ExampleEntity");
      assert.strictEqual(testClass.description, "An example entity class.");
    });
    it("Serialize SchemaItem", async () => {
      const schemaItemJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ExampleSchema",
        version: "1.0.0",
        alias: "ex",
        items: {
          ExampleEntity: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
        },
      };
      const ecschema = await Schema.fromJson(schemaItemJson, new SchemaContext());
      const testEntity = await ecschema.getTypedItem("ExampleEntity", EntityClass);
      assert.isDefined(testEntity);
      const testClass = testEntity!.toJSON(true, true);
      expect(testClass).to.exist;
      assert.strictEqual(testClass.$schema, "https://dev.bentley.com/json_schemas/ec/32/schemaitem");
      assert.strictEqual(testClass.schemaVersion, "01.00.00");
      assert.strictEqual(testClass.schemaItemType, "EntityClass");
      assert.strictEqual(testClass.name, "ExampleEntity");
      assert.strictEqual(testClass.label, "ExampleEntity");
      assert.strictEqual(testClass.description, "An example entity class.");
    });
    it("Serialize SchemaItem, standalone false", async () => {
      const schemaItemJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ExampleSchema",
        version: "1.0.0",
        alias: "ex",
        items: {
          ExampleEntity: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
        },
      };
      const ecschema = await Schema.fromJson(schemaItemJson, new SchemaContext());
      const testEntity = await ecschema.getTypedItem("ExampleEntity", EntityClass);
      assert.isDefined(testEntity);
      const testClass = testEntity!.toJSON();
      expect(testClass).to.exist;
      assert.strictEqual(testClass.schemaItemType, "EntityClass");
      assert.strictEqual(testClass.label, "ExampleEntity");
      assert.strictEqual(testClass.description, "An example entity class.");
      assert.strictEqual(testClass.name, undefined);
      assert.strictEqual(testClass.$schema, undefined);
      assert.strictEqual(testClass.schema, undefined);
      assert.strictEqual(testClass.schemaVersion, undefined);
    });
    it("Serialize SchemaItem, JSON stringify", async () => {
      const schemaItemJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "ExampleSchema",
        version: "1.0.0",
        alias: "ex",
        items: {
          ExampleEntity: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
        },
      };
      const ecschema = await Schema.fromJson(schemaItemJson, new SchemaContext());
      const testEntity = await ecschema.getTypedItem("ExampleEntity", EntityClass);
      assert.isDefined(testEntity);
      const testClassString = JSON.stringify(testEntity);
      const testClass = JSON.parse(testClassString);
      expect(testClass).to.exist;
      assert.strictEqual(testClass.schemaItemType, "EntityClass");
      assert.strictEqual(testClass.label, "ExampleEntity");
      assert.strictEqual(testClass.description, "An example entity class.");
      assert.strictEqual(testClass.name, undefined);
      assert.strictEqual(testClass.$schema, undefined);
      assert.strictEqual(testClass.schema, undefined);
      assert.strictEqual(testClass.schemaVersion, undefined);
    });
  });

  describe("toXml", () => {
    let baseClass: EntityClass;
    let schema: Schema;
    let newDom: Document;

    before(() => {
      schema = new Schema(new SchemaContext(), "ExampleSchema", "example", 1, 0, 0);
      baseClass = new EntityClass(schema, "ExampleEntity");
    });

    beforeEach(() => {
      newDom = createEmptyXmlDocument();
    });

    it("Serialize SchemaItem", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schema: "ExampleSchema",
        version: "1.0.0",
        schemaItemType: "EntityClass",
        name: "ExampleEntity",
        label: "ExampleEntity",
        description: "An example entity class.",
      };
      await baseClass.fromJSON(propertyJson);
      const testClass = await baseClass.toXml(newDom);
      expect(testClass.nodeName).to.eql("ECEntityClass");
      expect(testClass.getAttribute("typeName")).to.eql("ExampleEntity");
      expect(testClass.getAttribute("displayLabel")).to.eql("ExampleEntity");
      expect(testClass.getAttribute("description")).to.eql("An example entity class.");
    });
  });
});

describe("SchemaItemKey", () => {
  const schemaKeyA = new SchemaKey("SchemaTest", 1, 2, 3);
  const schemaKeyB = new SchemaKey("OtherTestSchema", 1, 2, 3);

  describe("matches", () => {
    it("should return false if names do not match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matches(new SchemaItemKey("MixinB", schemaKeyA))).to.be.false;
    });

    it("should return false if types do not match", () => {
      expect(new SchemaItemKey("Name", schemaKeyA).matches(new SchemaItemKey("Name", schemaKeyB))).to.be.false;
    });

    it("should return true if keys match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matches(new SchemaItemKey("MixinA", schemaKeyA))).to.be.true;
    });
  });

  describe("matchesFullName", () => {
    it("should return true if names match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matchesFullName("SchemaTest.01.02.03.MixinA")).to.be.true;
    });

    it("should return false if schema does not match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matchesFullName("SchemaTestB.01.02.03.MixinA")).to.be.false;
    });

    it("should return false if schema version does not match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matchesFullName("SchemaTest.01.02.00.MixinA")).to.be.false;
    });

    it("should return false if name does not match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matchesFullName("SchemaTest.01.02.03.MixinB")).to.be.false;
    });
  });

  describe("isSchemaItem", () => {
    it("should return false if schemaItem is undefined", () => {
      const undefinedSchemaItem = undefined;
      expect(SchemaItem.isSchemaItem(undefinedSchemaItem)).to.be.false;
    });

    it("should return true if object is of SchemaItem type", () => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "example", 1, 0, 0);
      const entityClass = new EntityClass(schema, "ExampleEntity");
      expect(entityClass).to.exist;
      expect(SchemaItem.isSchemaItem(entityClass)).to.be.true;
    });

    it("should return false if object is not of SchemaItem type", () => {
      const testSchema = new Schema(new SchemaContext(), "testSchema", "ts", 12, 22, 93);
      expect(SchemaItem.isSchemaItem(testSchema)).to.be.false;
      expect(SchemaItem.isSchemaItem("A")).to.be.false;
    });
  });

  describe("schemaItemType static property", () => {
    it("should return correct value on Class", () => {
      expect(SchemaItem.schemaItemType).to.equal(AbstractSchemaItemType.SchemaItem);
      expect(ECClass.schemaItemType).to.equal(AbstractSchemaItemType.Class);
    });

    it("should return proper types for known classes", () => {
      expect(EntityClass.schemaItemType).to.eql(SchemaItemType.EntityClass);
      expect(Mixin.schemaItemType).to.eql(SchemaItemType.Mixin);
      expect(StructClass.schemaItemType).to.eql(SchemaItemType.StructClass);
      expect(CustomAttributeClass.schemaItemType).to.eql(SchemaItemType.CustomAttributeClass);
      expect(RelationshipClass.schemaItemType).to.eql(SchemaItemType.RelationshipClass);
      expect(Enumeration.schemaItemType).to.eql(SchemaItemType.Enumeration);
      expect(KindOfQuantity.schemaItemType).to.eql(SchemaItemType.KindOfQuantity);
      expect(PropertyCategory.schemaItemType).to.eql(SchemaItemType.PropertyCategory);
      expect(Unit.schemaItemType).to.eql(SchemaItemType.Unit);
      expect(InvertedUnit.schemaItemType).to.eql(SchemaItemType.InvertedUnit);
      expect(Constant.schemaItemType).to.eql(SchemaItemType.Constant);
      expect(Phenomenon.schemaItemType).to.eql(SchemaItemType.Phenomenon);
      expect(UnitSystem.schemaItemType).to.eql(SchemaItemType.UnitSystem);
      expect(Format.schemaItemType).to.eql(SchemaItemType.Format);
    });
  });
});
