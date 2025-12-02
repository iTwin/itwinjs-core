/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, beforeEach, describe, expect, it } from "vitest";
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
    expect(schema).toBeDefined();
    const phenomenon = await schema.getItem("testPhenomenon", Phenomenon);
    expect(phenomenon).toBeDefined();
    expect(phenomenon!.fullName).toEqual("TestSchema.testPhenomenon");
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

    beforeEach(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
    });

    it("typeguard and type assertion should work on Phenomenon", async () => {
      const item = await ecSchema.getItem("TestPhenomenon");
      expect(item).toBeDefined();
      expect(Phenomenon.isPhenomenon(item)).toBe(true);
      expect(() => Phenomenon.assertIsPhenomenon(item)).not.toThrow();
      // verify against other schema item type
      const testEntityClass = await ecSchema.getItem("TestEntityClass");
      expect(testEntityClass).toBeDefined();
      expect(Phenomenon.isPhenomenon(testEntityClass)).toBe(false);
      expect(() => Phenomenon.assertIsPhenomenon(testEntityClass)).toThrow();
    });

    it("Phenomenon type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", Phenomenon)).toBeInstanceOf(Phenomenon);
      expect(ecSchema.getItemSync("TestPhenomenon", Phenomenon)).toBeInstanceOf(Phenomenon);
    });

    it("Phenomenon type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestEntityClass", Phenomenon)).toBeUndefined();
      expect(ecSchema.getItemSync("TestEntityClass", Phenomenon)).toBeUndefined();
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
      expect(testPhenomenon.label).toBe("Area");
      expect(testPhenomenon.definition).toBe("Units.LENGTH(2)");
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
      expect(testPhenomenon.label).toBe("Area");
      expect(testPhenomenon.definition).toBe("Units.LENGTH(2)");
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
      expect(phenomSerialization.definition).toBe("Units.LENGTH(2)");
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
      expect(phenomSerialization.definition).toBe("Units.LENGTH(2)");
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
      expect(phenomSerialization.definition).toBe("Units.LENGTH(2)");
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
      expect(phenomSerialization.definition).toBe("Units.LENGTH(2)");
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
      expect(serialized.nodeName).toEqual("Phenomenon");
      expect(serialized.getAttribute("typeName")).toEqual("AREA");
      expect(serialized.getAttribute("definition")).toEqual("Units.LENGTH(2)");
    });
  });
});
