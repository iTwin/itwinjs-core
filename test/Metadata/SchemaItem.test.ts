/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import SchemaItem from "../../source/Metadata/SchemaItem";
import { SchemaKey, SchemaItemKey, SchemaItemType } from "../../source/ECObjects";

describe("SchemaItem", () => {
  describe("fromJson", () => {
    let testItem: SchemaItem;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      class MockSchemaItem extends SchemaItem {
        public readonly schemaItemType!: SchemaItemType.EntityClass; // tslint:disable-line
        constructor(name: string) {
          super(schema, name);
          this.schemaItemType = SchemaItemType.EntityClass;
        }
        public async accept() {}
      }
      testItem = new MockSchemaItem("BadSchemaItem");
    });
    it("should throw for missing schemaItemType", async () => {
      expect(testItem).to.exist;
      await expect(testItem.fromJson({})).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem is missing the required schemaItemType property.`);
    });
    it("should throw for invalid schemaItemType", async () => {
      expect(testItem).to.exist;
      const json: any = { schemaItemType: 0 };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);
    });

    it("should throw for mismatched schemaItemType", async () => {
      expect(testItem).to.exist;
      const json = { schemaItemType: "Mixin" };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an incompatible schemaItemType. It must be "EntityClass", not "Mixin".`);
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testItem).to.exist;
      const json: any = {
        schemaItemType: "EntityClass",
        [attributeName]: value,
      };
      await expect(testItem.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadSchemaItem has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid name", async () => testInvalidAttribute("name", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute("description", "string", 0));
    it("should throw for invalid label", async () => testInvalidAttribute("label", "string", 0));
    it("should throw for invalid schema", async () => testInvalidAttribute("schema", "string", 0));
    it("should throw for invalid schemaVersion", async () => testInvalidAttribute("schemaVersion", "string", 0));
  });
});

describe("SchemaItemKey", () => {
  describe("matches", () => {
    const schemaKeyA = new SchemaKey("SchemaTest", 1, 2, 3);
    const schemaKeyB = new SchemaKey("OtherTestSchema", 1, 2, 3);

    it("should return false if names do not match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matches(new SchemaItemKey("MixinB", schemaKeyA))).to.be.false;
    });

    it("should return false if types do not match", () => {
      expect(new SchemaItemKey("Name", schemaKeyA).matches(new SchemaItemKey("Name", schemaKeyB))).to.be.false;
    });

    it("should return true if keys match", () => {
      expect(new SchemaItemKey("MixinA", schemaKeyA).matches(new SchemaItemKey("MixinA", schemaKeyA))).to.be.true;
    });
  });
});
