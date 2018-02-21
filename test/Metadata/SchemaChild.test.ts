/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import SchemaChild from "../../source/Metadata/SchemaChild";
import { SchemaChildType, SchemaKey, SchemaChildKey } from "../../source/ECObjects";

describe("SchemaChild", () => {
  describe("fromJson", () => {
    let testChild: SchemaChild;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      class MockSchemaChild extends SchemaChild {
        constructor(name: string) { super(schema, name, SchemaChildType.EntityClass); }
        public async accept() {}
      }
      testChild = new MockSchemaChild("BadSchemaChild");
    });

    it("should throw for missing schemaChildType", async () => {
      expect(testChild).to.exist;
      await expect(testChild.fromJson({})).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadSchemaChild is missing the required schemaChildType property.`);
    });

    it("should throw for invalid schemaChildType", async () => {
      expect(testChild).to.exist;
      const json: any = { schemaChildType: 0 };
      await expect(testChild.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadSchemaChild has an invalid 'schemaChildType' attribute. It should be of type 'string'.`);
    });

    it("should throw for mismatched schemaChildType", async () => {
      expect(testChild).to.exist;
      const json = { schemaChildType: "Mixin" };
      await expect(testChild.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadSchemaChild has an incompatible schemaChildType. It must be "EntityClass", not "Mixin".`);
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testChild).to.exist;
      const json: any = {
        schemaChildType: "EntityClass",
        [attributeName]: value,
      };
      await expect(testChild.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadSchemaChild has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid name", async () => testInvalidAttribute("name", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute("description", "string", 0));
    it("should throw for invalid label", async () => testInvalidAttribute("label", "string", 0));
    it("should throw for invalid schema", async () => testInvalidAttribute("schema", "string", 0));
    it("should throw for invalid schemaVersion", async () => testInvalidAttribute("schemaVersion", "string", 0));
  });
});

describe("SchemaChildKey", () => {
  describe("matches", () => {
    const schemaKeyA = new SchemaKey("SchemaTest", 1, 2, 3);
    const schemaKeyB = new SchemaKey("OtherTestSchema", 1, 2, 3);

    const typeA = SchemaChildType.Mixin;
    const typeB = SchemaChildType.EntityClass;

    it("should return false if names do not match", () => {
      expect(new SchemaChildKey("MixinA", typeA, schemaKeyA).matches(new SchemaChildKey("MixinB", typeA, schemaKeyA))).to.be.false;
    });

    it("should return false if types do not match", () => {
      expect(new SchemaChildKey("Name", typeA, schemaKeyA).matches(new SchemaChildKey("Name", typeB, schemaKeyA))).to.be.false;
      expect(new SchemaChildKey("Name", typeA, schemaKeyA).matches(new SchemaChildKey("Name", undefined, schemaKeyA))).to.be.false;
      expect(new SchemaChildKey("Name", undefined, schemaKeyA).matches(new SchemaChildKey("Name", typeA, schemaKeyA))).to.be.false;
    });

    it("should return false if types do not match", () => {
      expect(new SchemaChildKey("Name", typeA, schemaKeyA).matches(new SchemaChildKey("Name", typeA, schemaKeyB))).to.be.false;
    });

    it("should return true if keys match", () => {
      expect(new SchemaChildKey("MixinA", typeA, schemaKeyA).matches(new SchemaChildKey("MixinA", typeA, schemaKeyA))).to.be.true;
    });
  });
});
