/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import SchemaChild from "../../source/Metadata/SchemaChild";
import { SchemaChildType } from "../../source/ECObjects";

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
