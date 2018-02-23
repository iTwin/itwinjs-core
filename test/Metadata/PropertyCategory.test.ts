/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import PropertyCategory from "../../source/Metadata/PropertyCategory";
import * as sinon from "sinon";

describe("PropertyCategory", () => {
  describe("deserialization", () => {
    it("fully defined ", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          testPropCategory: {
            schemaChildType: "PropertyCategory",
            priority: 5,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);

      const child = await ecSchema.getChild("testPropCategory");
      assert.isDefined(child);
      assert.isTrue(child instanceof PropertyCategory);

      const propCat = child as PropertyCategory;
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
        schemaChildType: "PropertyCategory",
        priority: "1",
      };
      await expect(testCategory.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The PropertyCategory TestCategory has an invalid 'priority' attribute. It should be of type 'number'.`);
    });
  });

  describe("accept", () => {
    let testCategory: PropertyCategory;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testCategory = new PropertyCategory(schema, "TestCategory");
    });

    it("should call visitPropertyCategory on a SchemaChildVisitor object", async () => {
      expect(testCategory).to.exist;
      const mockVisitor = { visitPropertyCategory: sinon.spy() };
      await testCategory.accept(mockVisitor);
      expect(mockVisitor.visitPropertyCategory.calledOnce).to.be.true;
      expect(mockVisitor.visitPropertyCategory.calledWithExactly(testCategory)).to.be.true;
    });

    it("should safely handle a SchemaChildVisitor without visitPropertyCategory defined", async () => {
      expect(testCategory).to.exist;
      await testCategory.accept({});
    });
  });
});
