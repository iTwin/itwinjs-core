/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { IModelHost, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { getSchemaJsonFromIModel } from "../../ECSchemaFromIModel";

describe("getSchemaJsonFromIModel", () => {
  let imodel: SnapshotDb;

  before(async () => {
    await IModelHost.startup({ cacheDir: path.join(__dirname, ".cache") });
    IModelTestUtils.registerTestBimSchema();
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));

    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails
  });

  after(() => {
    imodel.close();
  });

  it("should load a known EC Schema by name from an existing iModel", () => {
    const getSchema = getSchemaJsonFromIModel(imodel);
    const schema = getSchema("TestBim");
    assert.isDefined(schema);
  });

  it("try load unknown EC Schema by name should return undefined", () => {
    const getSchema = getSchemaJsonFromIModel(imodel);
    const schema = getSchema("DoesNotExist");
    assert.isUndefined(schema);
  });
});
