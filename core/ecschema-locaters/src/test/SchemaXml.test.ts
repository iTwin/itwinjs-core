/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import * as sinon from "sinon";
import { SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "../SchemaXmlFileLocater";
import { SchemaXml } from "../SchemaXml";

describe("SchemaXml tests:", () => {
  let locater: SchemaXmlFileLocater;
  let resultLocater: SchemaXmlFileLocater;
  let context: SchemaContext;
  let resultContext: SchemaContext;
  const outDir = path.join(__dirname, "output");

  before(() => {
    fs.ensureDirSync(outDir);
  });

  beforeEach(() => {
    locater = new SchemaXmlFileLocater();
    locater.addSchemaSearchPath(path.join(__dirname, "assets"));
    context = new SchemaContext();
    context.addLocater(locater);

    resultLocater = new SchemaXmlFileLocater();
    resultLocater.addSchemaSearchPath(path.join(__dirname, "output"));
    resultContext = new SchemaContext();
    resultContext.addLocater(resultLocater);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("writeFile creates schema xml file successfully.", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    await SchemaXml.writeFile(schema!, outDir);

    const resultSchema = await resultContext.getSchema(schemaKey, SchemaMatchType.Exact);

    expect(resultSchema).to.not.be.undefined;
    expect(resultSchema?.schemaKey.matches(schema?.schemaKey as SchemaKey)).to.be.true;
  });

  it("writeFile with bad path specified, should fail.", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    await expect(SchemaXml.writeFile(schema!, "badPath")).to.be.rejectedWith(`The output directory 'badPath' does not exist.`);
  });

  it("writeFile, writeFile fails, failure handled properly.", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);
    sinon.stub(fs, "writeFile").rejects(new Error("SomeError"));
    const outFile = path.resolve(outDir, `${schema!.name}.ecschema.xml`);

    await expect(SchemaXml.writeFile(schema!, outDir)).to.be.rejectedWith(`An error occurred writing to file '${outFile}': SomeError`);
  });
});
