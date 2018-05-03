/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { ECSchemaXmlContext, SchemaKey } from "../../ECSchemaXmlContext";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECSchemaXmlContext", () => {

  it("should be able to convert schema XML to JSON", () => {
    const testSchemaXmlPath = path.join(KnownTestLocations.assetsDir, "TestSchema.ecschema.xml");
    const testSchemaJsonPath = path.join(KnownTestLocations.assetsDir, "TestSchema.ecschema.json");
    const expectedTestSchemaJson = require(testSchemaJsonPath);

    const context = new ECSchemaXmlContext();
    const schema = context.readSchemaFromXmlFile(testSchemaXmlPath);
    expect(schema).to.eql(expectedTestSchemaJson);
  });

  it("should call schema locater callback for missing schema references", () => {
    const testDomainXmlPath = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    const expectedBisCoreKey = {
      name: "BisCore",
      readVersion: 1,
      writeVersion: 0,
      minorVersion: 0,
    };
    const context = new ECSchemaXmlContext();

    const missingReferences: SchemaKey[] = [];
    context.setSchemaLocater((key: SchemaKey) => {
      missingReferences.push(key);
    });

    expect(() => context.readSchemaFromXmlFile(testDomainXmlPath)).to.throw("ReferencedSchemaNotFound");
    expect(missingReferences).to.have.lengthOf(1);
    expect(missingReferences[0]).to.eql(expectedBisCoreKey);
  });
});
