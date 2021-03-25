/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { IModelHost, IModelHostConfiguration, KnownLocations } from "../../IModelHost";
import { BriefcaseManager } from "../../BriefcaseManager";
import { RpcRegistry } from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { Schemas } from "../../Schema";

describe("IModelHost", () => {

  afterEach(async () => {
    // Restore the backend to the initial state.
    await IModelTestUtils.shutdownBackend();
    await IModelTestUtils.startBackend();
  });

  it("valid default configuration", async () => {
    await IModelTestUtils.shutdownBackend();
    await IModelHost.startup();

    // Valid registered implemented RPCs
    expect(RpcRegistry.instance.implementationClasses.size).to.equal(6);
    expect(RpcRegistry.instance.implementationClasses.get("IModelReadRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("IModelTileRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("IModelWriteRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("SnapshotIModelRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("WipRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("DevToolsRpcInterface")).to.exist;

    expect(Schemas.getRegisteredSchema("BisCore")).to.exist;
    expect(Schemas.getRegisteredSchema("Generic")).to.exist;
    expect(Schemas.getRegisteredSchema("Functional")).to.exist;
  });

  it("should set the briefcase cache directory to expected locations", async () => {
    // Shutdown IModelHost to allow this test to use it.
    await IModelTestUtils.shutdownBackend();

    const config = new IModelHostConfiguration();
    const cacheSubDir = "imodels";

    // Test legacy 1.0 cache location
    config.briefcaseCacheDir = path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"); // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    assert.strictEqual(config.briefcaseCacheDir, BriefcaseManager.cacheDir); // eslint-disable-line deprecation/deprecation

    // Test 3.0 cache default location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    await IModelHost.startup(config);
    let expectedDir = path.join(IModelHost.cacheDir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);

    // Test 2.0 custom cache location
    await IModelHost.shutdown();
    config.briefcaseCacheDir = undefined; // eslint-disable-line deprecation/deprecation
    config.cacheDir = KnownLocations.tmpdir;
    await IModelHost.startup(config);
    expectedDir = path.join(KnownLocations.tmpdir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);
  });

});
