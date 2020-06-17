/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { BackendRequestContext, PhysicalElement, SnapshotDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Schema XML Import Tests (#standalone)", () => {
  let imodel: SnapshotDb;
  const requestContext = new BackendRequestContext();

  before(() => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "SchemaXMLImport.bim");
    imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaXMLImportTest" } }); // IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    if (imodel)
      imodel.close();
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    await imodel.importSchemaStrings(requestContext, [schemaString]); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

});
