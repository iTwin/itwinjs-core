/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Schema } from "../../src/Metadata/Schema";
import { Phenomenon } from "../../src/Metadata/Phenomenon";
import { SchemaContext } from "../../src/Context";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

describe("Phenomenon tests", () => {
  let testPhenomenon: Phenomenon;
  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
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
      await testPhenomenon.deserialize(json);
      assert.strictEqual(testPhenomenon.label, "Area");
      assert.strictEqual(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });
  describe("Sync fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
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
      testPhenomenon.deserializeSync(json);
      assert.strictEqual(testPhenomenon.label, "Area");
      assert.strictEqual(testPhenomenon.definition, "Units.LENGTH(2)");
    });
  });
  describe("toJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("async - Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      await testPhenomenon.deserialize(json);
      const phenomSerialization = testPhenomenon.toJson(true, true);
      assert.strictEqual(phenomSerialization.definition, "Units.LENGTH(2)");
    });
    it("sync - Basic test", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schemaItemType: "Phenomenon",
        name: "AREA",
        definition: "Units.LENGTH(2)",
      };
      testPhenomenon.deserializeSync(json);
      const phenomSerialization = testPhenomenon.toJson(true, true);
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
      const schema = new Schema(new SchemaContext(), "ExampleSchema", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });

    it("should properly serialize", async () => {
      await testPhenomenon.deserialize(schemaJson);
      const serialized = await testPhenomenon.toXml(newDom);
      expect(serialized.nodeName).to.eql("Phenomenon");
      expect(serialized.getAttribute("typeName")).to.eql("AREA");
      expect(serialized.getAttribute("definition")).to.eql("Units.LENGTH(2)");
    });
  });
});
