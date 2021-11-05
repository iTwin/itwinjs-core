/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { RpcRegistry } from "@itwin/core-common";
import { BriefcaseManager } from "../BriefcaseManager";
import { SnapshotDb } from "../IModelDb";
import { IModelHost, IModelHostConfiguration, KnownLocations } from "../IModelHost";
import { Schemas } from "../Schema";
import { IModelTestUtils, TestUtils } from "./index";
import { AzureBlobStorage } from "../CloudStorageBackend";

describe("IModelHost", () => {

  beforeEach(async () => {
    await TestUtils.shutdownBackend();
  });

  afterEach(async () => {
    sinon.restore();
  });

  after(async () => {
    await TestUtils.startBackend();
  });

  it("valid default configuration", async () => {
    await IModelHost.startup();

    // Valid registered implemented RPCs
    expect(RpcRegistry.instance.implementationClasses.size).to.equal(5);
    expect(RpcRegistry.instance.implementationClasses.get("IModelReadRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("IModelTileRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("SnapshotIModelRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("WipRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("DevToolsRpcInterface")).to.exist;

    expect(Schemas.getRegisteredSchema("BisCore")).to.exist;
    expect(Schemas.getRegisteredSchema("Generic")).to.exist;
    expect(Schemas.getRegisteredSchema("Functional")).to.exist;
  });

  it("should raise onAfterStartup events", async () => {
    const eventHandler = sinon.spy();
    IModelHost.onAfterStartup.addOnce(eventHandler);
    await IModelHost.startup();
    expect(eventHandler.calledOnce).to.be.true;
  });

  it("should raise onBeforeShutdown events", async () => {
    await TestUtils.startBackend();
    const eventHandler = sinon.spy();
    IModelHost.onBeforeShutdown.addOnce(eventHandler);
    const filename = IModelTestUtils.resolveAssetFile("GetSetAutoHandledStructProperties.bim");

    const workspaceClose = sinon.spy((IModelHost.appWorkspace as any), "close");
    const saveSettings = IModelHost.appWorkspace.settings as any;
    const settingClose = sinon.spy(saveSettings, "close");
    expect(workspaceClose.callCount).eq(0);
    expect(settingClose.callCount).eq(0);
    expect(saveSettings._remove).to.not.be.undefined;

    // shutdown should close any opened iModels. Make sure that happens
    const imodel1 = SnapshotDb.openFile(filename, { key: "imodel1" });
    const imodel2 = SnapshotDb.openFile(filename, { key: "imodel2" });
    const imodel3 = SnapshotDb.openFile(filename, { key: "imodel3" });
    const imodel4 = SnapshotDb.openFile(filename, { key: "imodel4" });
    assert.notEqual(imodel1, imodel2);
    assert.notEqual(imodel2, imodel3);
    expect(imodel1.isOpen).to.be.true;
    expect(imodel2.isOpen).to.be.true;
    expect(imodel3.isOpen).to.be.true;
    imodel4.close(); // make sure it gets removed so we don't try to close it again on shutdown
    await TestUtils.shutdownBackend();
    expect(eventHandler.calledOnce).to.be.true;
    assert.isFalse(imodel1.isOpen, "shutdown should close iModel1");
    assert.isFalse(imodel2.isOpen, "shutdown should close iModel2");
    assert.isFalse(imodel3.isOpen, "shutdown should close iModel3");
    expect(workspaceClose.callCount).eq(1);
    expect(settingClose.callCount).eq(1);
    expect(saveSettings._remove).to.be.undefined;
  });

  it("should auto-shutdown on process beforeExit event", async () => {
    await TestUtils.startBackend();
    expect(IModelHost.isValid).to.be.true;
    const eventHandler = sinon.spy();
    IModelHost.onBeforeShutdown.addOnce(eventHandler);
    process.emit("beforeExit", 0);
    await new Promise((resolve) => setImmediate(resolve));
    expect(eventHandler.calledOnce).to.be.true;
    expect(IModelHost.isValid).to.be.false;
  });

  it("should set the briefcase cache directory to expected locations", async () => {
    const config = new IModelHostConfiguration();
    const cacheSubDir = "imodels";

    // Test cache default location
    await IModelHost.shutdown();
    await IModelHost.startup(config);
    let expectedDir = path.join(IModelHost.cacheDir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);

    // Test custom cache location
    await IModelHost.shutdown();
    config.cacheDir = KnownLocations.tmpdir;
    await IModelHost.startup(config);
    expectedDir = path.join(KnownLocations.tmpdir, cacheSubDir);
    assert.strictEqual(expectedDir, BriefcaseManager.cacheDir);
  });

  it("should set Azure cloud storage provider for tile cache", async () => {
    const config = new IModelHostConfiguration();
    config.tileCacheAzureCredentials = {
      account: "testAccount",
      accessKey: "testAccessKey",
    };

    const setUseTileCacheStub = sinon.stub();
    sinon.stub(IModelHost, "platform").get(() => ({
      setUseTileCache: setUseTileCacheStub,
    }));

    await IModelHost.startup(config);

    assert.isTrue(IModelHost.tileCacheService instanceof AzureBlobStorage);
    const credential = (IModelHost.tileCacheService as any)._credential;
    assert.equal(credential.accountName, "testAccount");
    assert.isTrue(setUseTileCacheStub.calledOnceWithExactly(false));
  });

  it("should set custom cloud storage provider for tile cache", async () => {
    const config = new IModelHostConfiguration();
    config.tileCacheService = {} as AzureBlobStorage;

    const setUseTileCacheStub = sinon.stub();
    sinon.stub(IModelHost, "platform").get(() => ({
      setUseTileCache: setUseTileCacheStub,
    }));

    await IModelHost.startup(config);

    assert.equal(IModelHost.tileCacheService, config.tileCacheService);
    assert.isTrue(setUseTileCacheStub.calledOnceWithExactly(false));
  });

  it("should throw if both tileCacheService and tileCacheAzureCredentials are set", async () => {
    const config = new IModelHostConfiguration();
    config.tileCacheAzureCredentials = {
      account: "testAccount",
      accessKey: "testAccessKey",
    };
    config.tileCacheService = {} as AzureBlobStorage;

    await expect(IModelHost.startup(config)).to.be.rejectedWith("Cannot use both Azure and custom cloud storage providers for tile cache.");
  });

  it("should use local cache if cloud storage provider for tile cache is not set", async () => {
    const setUseTileCacheStub = sinon.stub();
    sinon.stub(IModelHost, "platform").get(() => ({
      setUseTileCache: setUseTileCacheStub,
    }));

    await IModelHost.startup();

    assert.isUndefined(IModelHost.tileCacheService);
    assert.isUndefined(IModelHost.tileUploader);
    assert.isTrue(setUseTileCacheStub.calledOnceWithExactly(true));
  });

  it("should cleanup tileCacheService and tileUploader on shutdown", async () => {
    const config = new IModelHostConfiguration();
    config.tileCacheService = {} as AzureBlobStorage;

    await IModelHost.startup(config);

    assert.equal(IModelHost.tileCacheService, config.tileCacheService);
    assert.isDefined(IModelHost.tileUploader);

    await IModelHost.shutdown();

    assert.isUndefined(IModelHost.tileCacheService);
    assert.isUndefined(IModelHost.tileUploader);
  });

  // TODO:
  it.skip("should cleanup everything on shutdown", () => {

  });

});
