/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
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
    assert.isDefined(schema);
    const testPropCategory = await schema.getTypedItem("TestPropertyCategory", PropertyCategory);
    assert.isDefined(testPropCategory);
    expect(testPropCategory!.fullName).eq("TestSchema.TestPropertyCategory");
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

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on PropertyCategory", async () => {
      const testPropertyCategory = await ecSchema.getItem("TestPropertyCategory");
      assert.isDefined(testPropertyCategory);
      expect(PropertyCategory.isPropertyCategory(testPropertyCategory)).to.be.true;
      expect(() => PropertyCategory.assertIsPropertyCategory(testPropertyCategory)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(PropertyCategory.isPropertyCategory(testPhenomenon)).to.be.false;
      expect(() => PropertyCategory.assertIsPropertyCategory(testPhenomenon)).to.throw();
    });

    it("PropertyCategory type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPropertyCategory")).to.be.instanceof(PropertyCategory);
      expect(ecSchema.getItemSync("TestPropertyCategory")).to.be.instanceof(PropertyCategory);
    });

    it("PropertyCategory type should reject for other item types on getItem/Sync", async () => {
      await expect(ecSchema.getItem("TestPhenomenon", PropertyCategory)).to.be.rejected;
      expect(() => ecSchema.getItemSync("TestPhenomenon", PropertyCategory)).to.throw();
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
      assert.isDefined(ecSchema);

      const item = await ecSchema.getTypedItem("TestPropertyCategory", PropertyCategory);
      assert.isDefined(item);
      assert.isTrue(item?.schemaItemType === SchemaItemType.PropertyCategory);

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
      const testSchema = createSchemaJsonWithItems({
        TestPropertyCategory: {
          schemaItemType: "PropertyCategory",
          type: "string",
          typeName: "test",
          priority: 5,
        },
      });

      const ecSchema = await Schema.fromJson(testSchema, new SchemaContext());
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("TestPropertyCategory");
      assert.isDefined(item);
      assert.isTrue(item?.schemaItemType === SchemaItemType.PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      const propCatSerialization = propCat.toJSON(true, true);
      expect(propCatSerialization.priority).equal(5);
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
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("TestPropertyCategory");
      assert.isDefined(item);
      assert.isTrue(item?.schemaItemType === SchemaItemType.PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      const json = JSON.stringify(propCat);
      const propCatSerialization = JSON.parse(json);
      expect(propCatSerialization.priority).equal(5);
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
      assert.isDefined(ecschema);
      const testPropCategory = await ecschema.getTypedItem("TestPropertyCategory", PropertyCategory);
      assert.isDefined(testPropCategory);

      const serialized = await testPropCategory!.toXml(newDom);
      expect(serialized.nodeName).to.eql("PropertyCategory");
      expect(serialized.getAttribute("typeName")).to.eql("TestPropertyCategory");
      expect(serialized.getAttribute("priority")).to.eql("5");
    });
  });
});
