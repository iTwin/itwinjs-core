/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ECSchema } from "../../source/Metadata/Schema";

describe("schema deserialization from json object", () => {
  it("should succeed with name and version", () => {
    const schemaJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.0.0",
      description: "This is a test description",
      label: "This is a test label",
    };

    const ecschema = ECSchema.fromObject(schemaJson);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(0);
    expect(ecschema.minorVersion).equal(0);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });
});

describe("schema deserialization from json string", () => {
  it("should succeed with name and version", () => {
    const schemaString = JSON.stringify({
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.0.0",
      description: "This is a test description",
      label: "This is a test label",
    });

    const ecschema = ECSchema.fromObject(schemaString);
    expect(ecschema.name).equal("TestSchema");
    expect(ecschema.readVersion).equal(1);
    expect(ecschema.writeVersion).equal(0);
    expect(ecschema.minorVersion).equal(0);
    expect(ecschema.description).equal("This is a test description");
    expect(ecschema.label).equal("This is a test label");
  });
});
