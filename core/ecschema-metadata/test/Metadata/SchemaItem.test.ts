/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { Schema } from "./../../src/Metadata/Schema";
import { SchemaKey, SchemaItemKey } from "./../../src/SchemaKey";
import { EntityClass } from "./../../src/Metadata/EntityClass";

describe("SchemaItem", () => {
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
      await (baseClass as EntityClass).deserialize(propertyJson);
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
