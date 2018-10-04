/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";
import SchemaItem from "../../src/Metadata/SchemaItem";
import { SchemaKey, SchemaItemKey, SchemaItemType } from "../../src/ECObjects";
import EntityClass from "../../src/Metadata/EntityClass";

describe("SchemaItem", () => {
  describe("fromJson", () => {
    let testItem: SchemaItem;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      class MockSchemaItem extends SchemaItem {
        public readonly schemaItemType!: SchemaItemType.EntityClass; // tslint:disable-line
        constructor(name: string) {
          super(schema, name);
          this.schemaItemType = SchemaItemType.EntityClass;
        }
        public async accept() { }
      }
      testItem = new MockSchemaItem("BadSchemaItem");
    });
    it("should throw for missing schemaItemType", async () => {
      expect(testItem).to.exist;
      await expect(testItem.fromJson({})).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem is missing the required schemaItemType property.`);
    });
    it("should throw for invalid schemaItemType", async () => {
      expect(testItem).to.exist;
      const json: any = { schemaItemType: 0 };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);
    });

    it("should throw for mismatched schemaItemType", async () => {
      expect(testItem).to.exist;
      const json = { schemaItemType: "Mixin" };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an incompatible schemaItemType. It must be "EntityClass", not "Mixin".`);
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testItem).to.exist;
      const json: any = {
        schemaItemType: "EntityClass",
        [attributeName]: value,
      };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid name", async () => testInvalidAttribute("name", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute("description", "string", 0));
    it("should throw for invalid label", async () => testInvalidAttribute("label", "string", 0));
    it("should throw for invalid schema", async () => testInvalidAttribute("schema", "string", 0));
    it("should throw for invalid schemaVersion", async () => testInvalidAttribute("schemaVersion", "string", 0));
  });
  describe("toJson", () => {
    let baseClass: any;
    let schema;
    before(() => {
      schema = new Schema("ExampleSchema", 1, 0, 0);
      baseClass = new EntityClass(schema, "ExampleEntity");
    });
    it("Serialize SchemaItem Standalone", async () => {
      const propertyJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
        schema: "ExampleSchema",
        version: "1.0.0",
        schemaItemType: "EntityClass",
        name: "ExampleEntity",
        label: "ExampleEntity",
        description: "An example entity class.",
      };
      await (baseClass as EntityClass).fromJson(propertyJson);
      const testClass = await (baseClass as EntityClass).toJson(true, true);
      expect(testClass).to.exist;
      assert(testClass.$schema, "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem");
      assert(testClass.schema, "ExampleSchema");
      assert(testClass.schemaVersion, "1.0.0");
      assert(testClass.schemaItemType, "EntityClass");
      assert(testClass.name, "ExampleEntity");
      assert(testClass.label, "ExampleEntity");
      assert(testClass.description, "An example entity class.");
    });
    it("Serialize SchemaItem", async () => {
      const schemaItemJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
      const ecschema = await Schema.fromJson(schemaItemJson);
      const testEntity = await ecschema.getItem<EntityClass>("ExampleEntity");
      assert.isDefined(testEntity);
      const testClass = await testEntity!.toJson(true, true);
      expect(testClass).to.exist;
      assert(testClass.schemaItemType, "EntityClass");
      assert(testClass.name, "ExampleEntity");
      assert(testClass.description, "An example entity class.");
    });
  });
});

describe("SchemaItemKey", () => {
  describe("matches", () => {
    const schemaKeyA = new SchemaKey("SchemaTest", 1, 2, 3);
    const schemaKeyB = new SchemaKey("OtherTestSchema", 1, 2, 3);

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
});
