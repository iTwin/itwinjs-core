/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import type { SchemaKey } from "../../ECSchemaXmlContext";
import { ECSchemaXmlContext } from "../../ECSchemaXmlContext";
import { KnownTestLocations } from "../KnownTestLocations";
import { SequentialLogMatcher } from "../SequentialLogMatcher";

describe("ECSchemaXmlContext", () => {

  it("should be able to convert schema XML to JSON", () => {
    const testSchemaXmlPath = path.join(KnownTestLocations.assetsDir, "TestSchema.ecschema.xml");
    const testSchemaJsonPath = path.join(KnownTestLocations.assetsDir, "TestSchema.ecschema.json");
    const expectedTestSchemaJson = JSON.parse(fs.readFileSync(testSchemaJsonPath, { encoding: "utf-8" }));

    const context = new ECSchemaXmlContext();
    const schema = context.readSchemaFromXmlFile(testSchemaXmlPath);
    expect(schema).to.eql(expectedTestSchemaJson);
  });

  it("setSchemaLocater, should call schema locater callback for missing schema references", () => {
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECObjectsNative").message(/Unable to locate referenced schema/gm);
    slm.append().error().category("ECObjectsNative").message(/Failed to read XML file/gm);
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
    expect(slm.finishAndDispose()).to.true;
  });

  it("setFirstSchemaLocater, should call schema locater callback for missing schema references", () => {
    const slm = new SequentialLogMatcher();
    slm.append().error().category("ECObjectsNative").message(/Unable to locate referenced schema/gm);
    slm.append().error().category("ECObjectsNative").message(/Failed to read XML file/gm);
    const testDomainXmlPath = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    const expectedBisCoreKey = {
      name: "BisCore",
      readVersion: 1,
      writeVersion: 0,
      minorVersion: 0,
    };
    const context = new ECSchemaXmlContext();
    const missingReferences: SchemaKey[] = [];
    context.setFirstSchemaLocater((key: SchemaKey) => {
      missingReferences.push(key);
    });

    expect(() => context.readSchemaFromXmlFile(testDomainXmlPath)).to.throw("ReferencedSchemaNotFound");
    expect(missingReferences).to.have.lengthOf(1);
    expect(missingReferences[0]).to.eql(expectedBisCoreKey);
    expect(slm.finishAndDispose()).to.true;
  });
});
