/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { Phenomenon } from "../../Metadata/Phenomenon";
import { Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

describe("Phenomenon tests", () => {
  let testPhenomenon: Phenomenon;

  it("should get fullName", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        testPhenomenon: {
          schemaItemType: "Phenomenon",
          name: "AREA",
          label: "Area",
          definition: "Units.LENGTH(2)",
        },
      },
    };

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    assert.isDefined(schema);
    const phenomenon = await schema.getItem<Phenomenon>("testPhenomenon");
    assert.isDefined(phenomenon);
    expect(phenomenon!.fullName).eq("TestSchema.testPhenomenon");
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.fromJSON(json);
      assert.strictEqual(testPhenomenon.label, "Area");
      assert.strictEqual(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });
  describe("Sync fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("Basic test", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.fromJSONSync(json);
      assert.strictEqual(testPhenomenon.label, "Area");
      assert.strictEqual(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });

  describe("toJSON", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("async - Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.fromJSON(json);
      const phenomSerialization = testPhenomenon.toJSON(true, true);
      assert.strictEqual(phenomSerialization.definition, "Units.LENGTH(2)");
    });
    it("sync - Basic test", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.fromJSONSync(json);
      const phenomSerialization = testPhenomenon.toJSON(true, true);
      assert.strictEqual(phenomSerialization.definition, "Units.LENGTH(2)");
    });
    it("async - JSON stringify serialization", async () => {
      const phenomJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.fromJSON(phenomJson);
      const json = JSON.stringify(testPhenomenon);
      const phenomSerialization = JSON.parse(json);
      assert.strictEqual(phenomSerialization.definition, "Units.LENGTH(2)");
    });
    it("sync - JSON stringify serialization", () => {
      const phenomJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.fromJSONSync(phenomJson);
      const json = JSON.stringify(testPhenomenon);
      const phenomSerialization = JSON.parse(json);
      assert.strictEqual(phenomSerialization.definition, "Units.LENGTH(2)");
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
      schemaItemType: "Phenomenon",
      name: "AREA",
      definition: "Units.LENGTH(2)",
    };

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });

    it("should properly serialize", async () => {
      await testPhenomenon.fromJSON(schemaJson);
      const serialized = await testPhenomenon.toXml(newDom);
      expect(serialized.nodeName).to.eql("Phenomenon");
      expect(serialized.getAttribute("typeName")).to.eql("AREA");
      expect(serialized.getAttribute("definition")).to.eql("Units.LENGTH(2)");
    });
  });
});
