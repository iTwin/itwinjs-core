/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { SchemaContext } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";
import { SchemaKey } from "../../source/ECObjects";

describe("schema deserialization", () => {
  it("should succeed from json string", async () => {
    const schemaString = JSON.stringify({
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      description: "This is a test description",
      label: "This is a test label",
    });

    const ecschema = await Schema.fromJson(schemaString);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(2);
    expect(ecschema.minorVersion).equal(3);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });

  it("should succeed with name and version", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      description: "This is a test description",
      label: "This is a test label",
    };

    const ecschema = await Schema.fromJson(schemaJson);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(2);
    expect(ecschema.minorVersion).equal(3);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });

  it("should fail with invalid version", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.100.0",
    };

    await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
  });

  it("should fail with invalid schema name", async () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "0TestSchema",
      version: "1.0.0",
    };

    await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
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

    it("should succeed when referenced schema is already in the schema context", async () => {
      const refSchema = new Schema(new SchemaKey("RefSchema", 1, 0, 5));
      const context = new SchemaContext();
      await context.addSchema(refSchema);

      const schema = await Schema.fromJson(schemaJson, context);
      assert.exists(schema);

      if (!schema.references)
        return;

      expect(schema.references.length).equal(1);
      if (!schema.references[0])
        assert.fail();
      assert.isTrue(schema.references[0] === refSchema);
    });

    it("should throw if the referenced schema cannot be found", async () => {
      const context = new SchemaContext();
      await expect(Schema.fromJson(schemaJson, context)).to.be.rejectedWith(ECObjectsError);
    });
  });
});
