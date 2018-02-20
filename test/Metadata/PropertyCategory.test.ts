/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import PropertyCategory from "../../source/Metadata/PropertyCategory";
import { SchemaKey } from "../../source/ECObjects";

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
    let testMixin: PropertyCategory;

    beforeEach(() => {
      const schema = new Schema(new SchemaKey("TestSchema", 1, 0, 0));
      testMixin = new PropertyCategory(schema, "TestCategory");
    });

    it("should throw for invalid priority", async () => {
      expect(testMixin).to.exist;
      const json = { priority: "1" };
      await expect(testMixin.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The PropertyCategory TestCategory has an invalid 'priority' attribute. It should be of type 'number'.`);
    });
  });
});
