/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { IModelError } from "@itwin/core-common";
import { SnapshotDb } from "../../core-backend";
import { IModelSchemaLoader } from "../../IModelSchemaLoader";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("IModelSchemaLoader", () => {
  let imodel: SnapshotDb;

  before(async () => {
    IModelTestUtils.registerTestBimSchema();
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));

    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails
  });

  after(() => {
    imodel.close();
  });

  it("should load a known EC Schema by name from an existing iModel", () => {
    const schemaLoader = new IModelSchemaLoader(imodel);
    const schema = schemaLoader.getSchema("TestBim");
    assert.isDefined(schema);
    assert.equal(schema.name, "TestBim");
  });

  it("context not specified, should load a known EC Schema by name from an existing iModel", () => {
    const schemaLoader = new IModelSchemaLoader(imodel);
    const schema = schemaLoader.getSchema("TestBim");
    assert.isDefined(schema);
    assert.equal(schema.name, "TestBim");
  });

  it("load unknown EC Schema by name should throw NotFound IModelError", () => {
    const schemaLoader = new IModelSchemaLoader(imodel);
    assert.throws(() => schemaLoader.getSchema("DoesNotExist"), IModelError);
  });

  it("try load unknown EC Schema by name should return undefined", () => {
    const schemaLoader = new IModelSchemaLoader(imodel);
    const schema = schemaLoader.tryGetSchema("DoesNotExist");
    assert.isUndefined(schema);
  });
});
