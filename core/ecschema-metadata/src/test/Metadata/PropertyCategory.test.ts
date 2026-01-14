/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { PropertyCategory } from "../../Metadata/PropertyCategory";
import { Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory", () => {
  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
      TestPropertyCategory: {
        schemaItemType: "PropertyCategory",
        type: "string",
        typeName: "test",
        priority: 5,
      },
    });

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    expect(schema).toBeDefined();
    const testPropCategory = await schema.getItem("TestPropertyCategory", PropertyCategory);
    expect(testPropCategory).toBeDefined();
    expect(testPropCategory!.fullName).toEqual("TestSchema.TestPropertyCategory");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestPropertyCategory: {
        schemaItemType: "PropertyCategory",
        label: "Test Property Category",
        description: "Used for testing",
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

    it("typeguard and type assertion should work on PropertyCategory", async () => {
      const testPropertyCategory = await ecSchema.getItem("TestPropertyCategory");
      expect(testPropertyCategory).toBeDefined();
      expect(PropertyCategory.isPropertyCategory(testPropertyCategory)).toBe(true);
      expect(() => PropertyCategory.assertIsPropertyCategory(testPropertyCategory)).not.toThrow();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      expect(testPhenomenon).toBeDefined();
      expect(testPhenomenon);
      expect(PropertyCategory.isPropertyCategory(testPhenomenon)).toBe(false);
      expect(() => PropertyCategory.assertIsPropertyCategory(testPhenomenon)).toThrow();
    });

    it("PropertyCategory type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPropertyCategory", PropertyCategory)).toBeInstanceOf(PropertyCategory);
      expect(ecSchema.getItemSync("TestPropertyCategory", PropertyCategory)).toBeInstanceOf(PropertyCategory);
    });

    it("PropertyCategory type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", PropertyCategory)).toBeUndefined();
      expect(ecSchema.getItemSync("TestPhenomenon", PropertyCategory)).toBeUndefined();
    });
  });

  describe("deserialization", () => {
    it("fully defined ", async () => {
      const testSchema = createSchemaJsonWithItems({
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 5,
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      expect(ecSchema).toBeDefined();

      const item = await ecSchema.getItem("TestPropertyCategory", PropertyCategory);
      expect(item).toBeDefined();
      expect(item?.schemaItemType === SchemaItemType.PropertyCategory).toBe(true);

      const propCat = item as PropertyCategory;
      expect(propCat).toBeDefined();
      expect(propCat.priority).toBe(5);
    });
  });

  describe("fromJson", () => {
    it("TODO", async () => {
      // TODO: Implement test...
    });
  });

  describe("toJSON", () => {
    it("fully defined", async () => {
      const testSchema = createSchemaJsonWithItems({
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 5,
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      expect(ecSchema).toBeDefined();

      const item = await ecSchema.getItem("TestPropertyCategory");
      expect(item).toBeDefined();
      expect(item?.schemaItemType === SchemaItemType.PropertyCategory).toBe(true);

      const propCat = item as PropertyCategory;
      expect(propCat).toBeDefined();
      const propCatSerialization = propCat.toJSON(true, true);
      expect(propCatSerialization.priority).toBe(5);
    });
    it("fully defined, JSON stringy serialization", async () => {
      const testSchema = createSchemaJsonWithItems({
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 5,
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      expect(ecSchema).toBeDefined();

      const item = await ecSchema.getItem("TestPropertyCategory");
      expect(item).toBeDefined();
      expect(item?.schemaItemType === SchemaItemType.PropertyCategory).toBe(true);

      const propCat = item as PropertyCategory;
      expect(propCat).toBeDefined();
      const json = JSON.stringify(propCat);
      const propCatSerialization = JSON.parse(json);
      expect(propCatSerialization.priority).toBe(5);
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    const schemaJson = createSchemaJsonWithItems({
      TestPropertyCategory: {
        schemaItemType: "PropertyCategory",
        type: "string",
        typeName: "test",
        priority: 5,
      },
    });

    it("should serialize properly", async () => {
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecschema).toBeDefined();
      const testPropCategory = await ecschema.getItem("TestPropertyCategory", PropertyCategory);
      expect(testPropCategory).toBeDefined();

      const serialized = await testPropCategory!.toXml(newDom);
      expect(serialized.nodeName).toEqual("PropertyCategory");
      expect(serialized.getAttribute("typeName")).toEqual("TestPropertyCategory");
      expect(serialized.getAttribute("priority")).toEqual("5");
    });
  });
});
