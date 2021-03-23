/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { PropertyCategory } from "../../Metadata/PropertyCategory";
import { Schema } from "../../Metadata/Schema";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyCategory", () => {
  describe("deserialization", () => {
    it("fully defined ", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        alias: "TestSchema",
        items: {
          TestPropertyCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem<PropertyCategory>("TestPropertyCategory");
      assert.isDefined(item);
      assert.isTrue(item instanceof PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      expect(propCat.priority).equal(5);
    });
  });

  describe("fromJson", () => {
    it("TODO", async () => {
      // TODO: Implement test...
    });
  });

  describe("toJSON", () => {
    it("fully defined", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          TestPropertyCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("TestPropertyCategory");
      assert.isDefined(item);
      assert.isTrue(item instanceof PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      const propCatSerialization = propCat.toJSON(true, true);
      expect(propCatSerialization.priority).equal(5);
    });
    it("fully defined, JSON stringy serialization", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          TestPropertyCategory: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("TestPropertyCategory");
      assert.isDefined(item);
      assert.isTrue(item instanceof PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      const json = JSON.stringify(propCat);
      const propCatSerialization = JSON.parse(json);
      expect(propCatSerialization.priority).equal(5);
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 5,
        },
      },
    };

    it("should serialize properly", async () => {
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecschema);
      const testPropCategory = await ecschema.getItem<PropertyCategory>("TestPropertyCategory");
      assert.isDefined(testPropCategory);

      const serialized = await testPropCategory!.toXml(newDom);
      expect(serialized.nodeName).to.eql("PropertyCategory");
      expect(serialized.getAttribute("typeName")).to.eql("TestPropertyCategory");
      expect(serialized.getAttribute("priority")).to.eql("5");
    });
  });
});
