/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { PhysicalElement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Schema XML Import Tests", () => {
  let imodel: SnapshotDb;

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

    await imodel.importSchemaStrings([schemaString]); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

  it("Schema import for newer ECXml Versions", async () => {
    const helperFunction = async (imodelDb: SnapshotDb, xmlSchema: string[], importSchema: boolean) => {
      try {
        // ECObjects is expected to throw for schemas that fail to import
        if (importSchema)
          await imodelDb.importSchemaStrings(xmlSchema);
        else
          imodelDb.getSchemaProps(xmlSchema[0]);
      } catch (error: any) {
        return false;
      }
      return true;
    };

    // Incrementing major ECXml version is not supported
    for (let testCase of [`4.1`, `5.10`]) {
      assert(!(await helperFunction(imodel, [`<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${testCase}"/>`], true)), `Schema ${testCase} import should not have succeeded.`);
      assert(!(await helperFunction(imodel, [`TestSchema`], false)), `Schema ${testCase} test should not have succeeded.`);
    }

    // Importing a set of schemas should all fail if any one of them fails
    {
      const schemaXmls = [`<ECSchema schemaName="TestSchema1" alias="ts1" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2"/>`,
        `<ECSchema schemaName="TestSchema2" alias="ts2" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.8"/>`,
        `<ECSchema schemaName="TestSchema3" alias="ts3" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.4.5"/>`];

      assert(!(await helperFunction(imodel, schemaXmls, true)), `Schema import should not have succeeded.`);
      assert(!(await helperFunction(imodel, [`TestSchema1`], false)), `Schema TestSchema1 import should not have succeeded.`);
      assert(!(await helperFunction(imodel, [`TestSchema2`], false)), `Schema TestSchema2 import should not have succeeded.`);
      assert(!(await helperFunction(imodel, [`TestSchema3`], false)), `Schema TestSchema3 import should not have succeeded.`);
    }

    // Schema should be imported successfully
    for (let testCase of [`3.2`, `3.5`]) {
      assert(await helperFunction(imodel, [`<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${testCase}"/>`], true), `Schema ${testCase} import should have succeeded.`);
      assert(await helperFunction(imodel, [`TestSchema`], false), `Schema ${testCase} test should have succeeded.`);
    }
  });
});
