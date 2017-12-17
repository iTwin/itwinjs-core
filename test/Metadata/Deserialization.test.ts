/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
import { SchemaContext } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";

describe("schema deserialization", () => {
  it("should succeed from json string", () => {
    const schemaString = JSON.stringify({
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      description: "This is a test description",
      label: "This is a test label",
    });

    const ecschema = ECSchema.fromJson(schemaString);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(2);
    expect(ecschema.minorVersion).equal(3);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });

  it("should succeed with name and version", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      description: "This is a test description",
      label: "This is a test label",
    };

    const ecschema = ECSchema.fromJson(schemaJson);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(2);
    expect(ecschema.minorVersion).equal(3);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });

  it("should fail with invalid version", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.100.0",
    };

    expect(() => {ECSchema.fromJson(schemaJson); }).to.throw(ECObjectsError);
  });

  it("should fail with invalid schema name", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "0TestSchema",
      version: "1.0.0",
    };

    expect(() => {ECSchema.fromJson(schemaJson); }).to.throw(ECObjectsError);
  });

  describe("with schema reference", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      references: [
        {
          name: "RefSchema",
          version: "1.0.5",
        },
      ],
    };

    it("should succeed when referenced schema is already in the schema context", () => {
      const refSchema = new ECSchema("RefSchema", 1, 0, 5);
      const context = new SchemaContext();
      context.addSchemaSync(refSchema);

      const schema = ECSchema.fromJson(schemaJson, context);
      assert.exists(schema);

      if (!schema.references)
        return;

      expect(schema.references.length).equal(1);
      if (!schema.references[0])
        assert.fail();
      assert.isTrue(schema.references[0] === refSchema);
    });

    it("should throw if the referenced schema cannot be found", () => {
      const context = new SchemaContext();
      expect(() => {ECSchema.fromJson(schemaJson, context); }).to.throw(ECObjectsError);
    });
  });
});
