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
    class MockSchemaChild extends SchemaChild {
      constructor(name: string) {
        const schema = new Schema("TestSchema", 1, 0, 0);
        super(schema, name, SchemaChildType.EntityClass);
      }
      public async accept() {}
    }

    async function testInvalidAttribute(child: SchemaChild, attributeName: string, expectedType: string, value: any) {
      expect(child).to.exist;
      const json: any = { [attributeName]: value };
      await expect(child.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild ${child.name} has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid name", async () => testInvalidAttribute(new MockSchemaChild("BadSchema"), "name", "string", 0));
    it("should throw for invalid description", async () => testInvalidAttribute(new MockSchemaChild("BadSchema"), "description", "string", 0));
    it("should throw for invalid label", async () => testInvalidAttribute(new MockSchemaChild("BadSchema"), "label", "string", 0));
    it("should throw for invalid schema", async () => testInvalidAttribute(new MockSchemaChild("BadSchema"), "schema", "string", 0));
    it("should throw for invalid schemaVersion", async () => testInvalidAttribute(new MockSchemaChild("BadSchema"), "schemaVersion", "string", 0));
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
