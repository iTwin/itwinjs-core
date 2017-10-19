/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";
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

    const ecschema = ECSchema.fromObject(schemaString);
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

    const ecschema = ECSchema.fromObject(schemaJson);
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

    expect(() => {ECSchema.fromObject(schemaJson); }).to.throw(ECObjectsError);
  });

  it("should fail with invalid schema name", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "0TestSchema",
      version: "1.0.0",
    };

    expect(() => {ECSchema.fromObject(schemaJson); }).to.throw(ECObjectsError);
  });
});
