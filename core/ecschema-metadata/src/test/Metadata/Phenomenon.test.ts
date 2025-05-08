/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { Phenomenon } from "../../Metadata/Phenomenon";
import { Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Phenomenon tests", () => {
  let testPhenomenon: Phenomenon;

  it("should get fullName", async () => {
    const schemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
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
    const phenomenon = await schema.getItem("testPhenomenon", Phenomenon);
    assert.isDefined(phenomenon);
    expect(phenomenon!.fullName).eq("TestSchema.testPhenomenon");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestEntityClass: {
        schemaItemType: "EntityClass",
        label: "Test Entity Class",
        description: "Used for testing",
        modifier: "Sealed",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on Phenomenon", async () => {
      const item = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(item);
      expect(Phenomenon.isPhenomenon(item)).to.be.true;
      expect(() => Phenomenon.assertIsPhenomenon(item)).not.to.throw();
      // verify against other schema item type
      const testEntityClass = await ecSchema.getItem("TestEntityClass");
      assert.isDefined(testEntityClass);
      expect(Phenomenon.isPhenomenon(testEntityClass)).to.be.false;
      expect(() => Phenomenon.assertIsPhenomenon(testEntityClass)).to.throw();
    });

    it("Phenomenon type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", Phenomenon)).to.be.instanceof(Phenomenon);
      expect(ecSchema.getItemSync("TestPhenomenon", Phenomenon)).to.be.instanceof(Phenomenon);
    });

    it("Phenomenon type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestEntityClass", Phenomenon)).to.be.undefined;
      expect(ecSchema.getItemSync("TestEntityClass", Phenomenon)).to.be.undefined;
    });
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "ExampleSchema", "es", 1, 0, 0);
      testPhenomenon = new Phenomenon(schema, "AREA");
    });
    it("Basic test", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
      $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
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
