/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";
import PropertyCategory from "../../src/Metadata/PropertyCategory";
import * as sinon from "sinon";

describe("PropertyCategory", () => {
  describe("deserialization", () => {
    it("fully defined ", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testPropCategory: {
            schemaItemType: "PropertyCategory",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("testPropCategory");
      assert.isDefined(item);
      assert.isTrue(item instanceof PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      expect(propCat.priority).equal(5);
    });
  });

  describe("fromJson", () => {
    let testCategory: PropertyCategory;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testCategory = new PropertyCategory(schema, "TestCategory");
    });

    it("should throw for invalid priority", async () => {
      expect(testCategory).to.exist;
      const json = {
        schemaItemType: "PropertyCategory",
        priority: "1",
      };
      await expect(testCategory.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The PropertyCategory TestCategory has an invalid 'priority' attribute. It should be of type 'number'.`);
    });
  });
  describe("toJson", () => {
    it("fully defined", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testPropCategory: {
            schemaItemType: "PropertyCategory",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);

      const item = await ecSchema.getItem("testPropCategory");
      assert.isDefined(item);
      assert.isTrue(item instanceof PropertyCategory);

      const propCat = item as PropertyCategory;
      assert.isDefined(propCat);
      const propCatSerialization = propCat.toJson(true, true);
      expect(propCatSerialization.priority).equal(5);
    });
  });

  describe("accept", () => {
    let testCategory: PropertyCategory;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testCategory = new PropertyCategory(schema, "TestCategory");
    });

    it("should call visitPropertyCategory on a SchemaItemVisitor object", async () => {
      expect(testCategory).to.exist;
      const mockVisitor = { visitPropertyCategory: sinon.spy() };
      await testCategory.accept(mockVisitor);
      expect(mockVisitor.visitPropertyCategory.calledOnce).to.be.true;
      expect(mockVisitor.visitPropertyCategory.calledWithExactly(testCategory)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitPropertyCategory defined", async () => {
      expect(testCategory).to.exist;
      await testCategory.accept({});
    });
  });
});
