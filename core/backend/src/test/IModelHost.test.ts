/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { RpcRegistry } from "@itwin/core-common";
import { DbResult, Guid, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { BriefcaseManager } from "../BriefcaseManager";
import { BlobContainer } from "../BlobContainerService";
import { SnapshotDb } from "../IModelDb";
import { IModelHost, IModelHostOptions, KnownLocations } from "../IModelHost";
import { setOnlineStatus } from "../internal/OnlineStatus";
import { SettingsSqliteDb } from "../internal/workspace/SettingsSqliteDb";
import { Schemas } from "../Schema";
import { KnownTestLocations } from "./KnownTestLocations";
import { AzureServerStorage } from "@itwin/object-storage-azure";
import type { ServerStorage } from "@itwin/object-storage-core";
import { TestUtils } from "./TestUtils";
import { IModelTestUtils } from "./IModelTestUtils";
import { overrideSyncNativeLogLevels } from "../internal/NativePlatform";
import { settingsResourceName } from "../workspace/SettingsDb";
import { _getHubAccess, _hubAccess } from "../internal/Symbols";

describe("IModelHost", () => {
  const opts = { cacheDir: TestUtils.getCacheDir() };
  let savedBlobContainerService: BlobContainer.ContainerService | undefined;

  function getITwinWorkspaceDir(containerId: string): string {
    return path.join(opts.cacheDir!, "Workspace", containerId);
  }

  function createLocalSettingsDb(_iTwinId: string, containerId: string, settings: Record<string, unknown>): void {
    const dbDir = getITwinWorkspaceDir(containerId);
    const dbFileName = path.join(dbDir, "settings-db.itwin-workspace");
    fs.ensureDirSync(dbDir);
    SettingsSqliteDb.createNewDb(dbFileName, { manifest: { settingsName: `${containerId} settings` } });

    const db = new SettingsSqliteDb();
    db.openDb(dbFileName, OpenMode.ReadWrite);
    db.withSqliteStatement("INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => {
      stmt.bindString(1, settingsResourceName);
      stmt.bindString(2, JSON.stringify(settings));
      const rc = stmt.step();
      expect(rc).to.equal(DbResult.BE_SQLITE_DONE);
    });
    db.saveChanges();
    db.closeDb();
  }

  function createSettingsContainerService(iTwinId: string, containerIds: string[]): BlobContainer.ContainerService {
    return {
      create: async () => ({ baseUri: "", containerId: containerIds[0], provider: "azure" as const }),
      delete: async () => { },
      queryScope: async () => ({ iTwinId }),
      queryMetadata: async () => ({ containerType: "settings", label: "settings" }),
      queryContainersMetadata: async (_userToken, args) => {
        if (args.iTwinId !== iTwinId || args.containerType !== "settings")
          return [];

        return containerIds.map((containerId) => ({ containerId, containerType: "settings", label: containerId }));
      },
      updateJson: async () => { },
      requestToken: async ({ containerId }) => ({
        token: "",
        scope: { iTwinId },
        provider: "azure" as const,
        expiration: new Date(Date.now() + 3600000),
        metadata: { containerType: "settings", label: containerId },
        baseUri: "",
      }),
    };
  }

  beforeEach(async () => {
    await TestUtils.shutdownBackend();
    savedBlobContainerService = BlobContainer.service;
    setOnlineStatus(true);
  });

  afterEach(async () => {
    BlobContainer.service = savedBlobContainerService;
    setOnlineStatus(true);
    sinon.restore();
  });

  after(async () => {
    await TestUtils.startBackend();
  });

  it("valid default configuration", async () => {
    await IModelHost.startup(opts);

    // Valid registered implemented RPCs
    expect(RpcRegistry.instance.implementationClasses.size).to.equal(4);
    expect(RpcRegistry.instance.implementationClasses.get("IModelReadRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("IModelTileRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("SnapshotIModelRpcInterface")).to.exist;
    expect(RpcRegistry.instance.implementationClasses.get("DevToolsRpcInterface")).to.exist;

    expect(Schemas.getRegisteredSchema("BisCore")).to.exist;
    expect(Schemas.getRegisteredSchema("Generic")).to.exist;
    expect(Schemas.getRegisteredSchema("Functional")).to.exist;
  });

  it("should properly cleanup beforeExit event listeners on shutdown", async () => {
    const beforeCount = process.listenerCount("beforeExit");
    for (let i = 0; i <= 15; i++) {
      await IModelHost.startup();
      await IModelHost.shutdown();

    }
    const afterCount = process.listenerCount("beforeExit");
    expect(beforeCount).to.be.equal(afterCount);
  });

  it("should call logger sync function", async () => {
    let nSyncCalls = 0;
    overrideSyncNativeLogLevels(() => ++nSyncCalls);
    await IModelHost.startup(opts);
    expect(nSyncCalls).to.equal(0);
    Logger.setLevel("test-cat", LogLevel.Warning);
    expect(nSyncCalls).to.equal(1);
    overrideSyncNativeLogLevels(undefined);
  });

  it("should raise onAfterStartup events", async () => {
    const eventHandler = sinon.spy();
    IModelHost.onAfterStartup.addOnce(eventHandler);
    await IModelHost.startup(opts);
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
    const config: IModelHostOptions = {};
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

  it("should set Azure cloud storage provider for tile cache given credentials", async () => {
    const config: IModelHostOptions = {};
    config.tileCacheAzureCredentials = {
      account: "testAccount",
      accessKey: "testAccessKey",
    };

    await IModelHost.startup(config);

    assert.isDefined(IModelHost.tileStorage);
    assert.isDefined(IModelHost.tileStorage!.storage);
    assert.instanceOf(IModelHost.tileStorage!.storage, AzureServerStorage);
    assert.equal((IModelHost.tileStorage?.storage as any)._config.baseUrl, `https://${config.tileCacheAzureCredentials.account}.blob.core.windows.net`)
  });

  it("should set Azure cloud storage provider for tile cache with custom baseUrl", async () => {
    const config: IModelHostOptions = {};
    config.tileCacheAzureCredentials = {
      account: "testAccount",
      accessKey: "testAccessKey",
      baseUrl: "https://custom.blob.core.windows.net",
    };

    await IModelHost.startup(config);

    assert.isDefined(IModelHost.tileStorage);
    assert.isDefined(IModelHost.tileStorage!.storage);
    assert.instanceOf(IModelHost.tileStorage!.storage, AzureServerStorage);
    assert.equal((IModelHost.tileStorage?.storage as any)._config.baseUrl, config.tileCacheAzureCredentials.baseUrl)
  });

  it("should set custom cloud storage provider for tile cache", async () => {
    const config: IModelHostOptions = {};
    config.tileCacheStorage = {} as ServerStorage;

    await IModelHost.startup(config);

    assert.isDefined(IModelHost.tileStorage);
    assert.equal(IModelHost.tileStorage!.storage, config.tileCacheStorage);
  });

  it("should throw if both tileCacheStorage and tileCacheAzureCredentials are set", async () => {
    const config: IModelHostOptions = {};
    config.tileCacheAzureCredentials = {
      account: "testAccount",
      accessKey: "testAccessKey",
    };
    config.tileCacheStorage = {} as ServerStorage;

    await expect(IModelHost.startup(config)).to.be.rejectedWith("Cannot use both Azure and custom cloud storage providers for tile cache.");
  });

  it("should use local cache if cloud storage provider for tile cache is not set", async () => {
    await IModelHost.startup(opts);

    assert.isUndefined(IModelHost.tileStorage);
  });

  it("should cleanup tileStorage on shutdown", async () => {
    const config: IModelHostOptions = {};
    config.tileCacheStorage = {} as ServerStorage;

    await IModelHost.startup(config);

    assert.equal(IModelHost.tileStorage?.storage, config.tileCacheStorage);

    await IModelHost.shutdown();

    assert.isUndefined(IModelHost.tileStorage);
  });

  it("should throw if hubAccess is undefined and getter is called", async () => {
    await IModelHost.startup(opts);
    expect(IModelHost[_getHubAccess]()).undefined;
    expect(() => IModelHost[_hubAccess]).throws();
  });

  it("loads iTwin workspaces from the discovered iTwin settings container", async () => {
    const iTwinId = Guid.createValue();
    createLocalSettingsDb(iTwinId, "itwin-settings-a", {
      "dict-a": { "app/testA": "value-a" },
      "dict-b": { "app/testB": "value-b" },
    });
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a"]);

    await IModelHost.startup(opts);

    const firstWorkspace = await IModelHost.getITwinWorkspace(iTwinId);
    const secondWorkspace = await IModelHost.getITwinWorkspace(iTwinId);

    expect(secondWorkspace).to.not.equal(firstWorkspace);
    expect(firstWorkspace.settings.getString("app/testA")).to.equal("value-a");
    expect(firstWorkspace.settings.getString("app/testB")).to.equal("value-b");
    expect(firstWorkspace.settings.dictionaries.some((dictionary) => dictionary.props.name === "dict-a")).to.be.true;
    expect(firstWorkspace.settings.dictionaries.some((dictionary) => dictionary.props.name === "dict-b")).to.be.true;
    expect(secondWorkspace.settings.getString("app/testA")).to.equal("value-a");
    expect(secondWorkspace.settings.getString("app/testB")).to.equal("value-b");
  });

  it("returns an empty iTwin workspace if no root settings container exists", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, []);

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.dictionaries.length).to.equal(0);
  });

  it("fails if multiple iTwin settings containers exist for the same iTwin", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a", "itwin-settings-b"]);

    await IModelHost.startup(opts);

    await expect(IModelHost.getITwinWorkspace(iTwinId)).to.be.rejectedWith("Multiple iTwin settings containers were found");
  });

  it("loads iTwin workspace from container props without network calls", async () => {
    const containerId = "itwin-settings-offline";
    const workspaceDir = path.join(opts.cacheDir!, "Workspace", containerId, containerId);
    const dbFileName = path.join(workspaceDir, "settings-db.itwin-workspace");
    fs.ensureDirSync(workspaceDir);
    SettingsSqliteDb.createNewDb(dbFileName, { manifest: { settingsName: `${containerId} settings` } });

    const db = new SettingsSqliteDb();
    db.openDb(dbFileName, OpenMode.ReadWrite);
    db.withSqliteStatement("INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => {
      stmt.bindString(1, settingsResourceName);
      stmt.bindString(2, JSON.stringify({ "dict-a": { "app/testA": "value-a" } }));
      const rc = stmt.step();
      expect(rc).to.equal(DbResult.BE_SQLITE_DONE);
    });
    db.saveChanges();
    db.closeDb();

    const networkService = {
      create: sinon.stub().resolves({ baseUri: "", containerId, provider: "azure" as const }),
      delete: sinon.stub().resolves(),
      queryScope: sinon.stub().resolves({ iTwinId: Guid.createValue() }),
      queryMetadata: sinon.stub().resolves({ containerType: "settings", label: "settings" }),
      queryContainersMetadata: sinon.stub().resolves([]),
      updateJson: sinon.stub().resolves(),
      requestToken: sinon.stub().resolves({
        token: "",
        scope: { iTwinId: Guid.createValue() },
        provider: "azure" as const,
        expiration: new Date(Date.now() + 3600000),
        metadata: { containerType: "settings", label: containerId },
        baseUri: "",
      }),
    };
    BlobContainer.service = networkService;

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace({
      accessToken: "",
      baseUri: "",
      containerId,
      storageType: "azure",
    });

    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(networkService.queryContainersMetadata.called).to.be.false;
    expect(networkService.requestToken.called).to.be.false;
  });

  it("computeSchemaChecksum", () => {
    const assetsDir = path.join(KnownTestLocations.assetsDir, "ECSchemaOps");
    const schemaXmlPath = path.join(assetsDir, "SchemaA.ecschema.xml");
    let referencePaths = [assetsDir];
    let sha1 = IModelHost.computeSchemaChecksum({ schemaXmlPath, referencePaths });
    expect(sha1).equal("3ac6578060902aa0b8426b61d62045fdf7fa0b2b");

    expect(() => IModelHost.computeSchemaChecksum({ schemaXmlPath, referencePaths, exactMatch: true })).throws("Failed to read schema SchemaA.ecschema");

    referencePaths = [path.join(assetsDir, "exact-match")];
    sha1 = IModelHost.computeSchemaChecksum({ schemaXmlPath, referencePaths, exactMatch: true });
    expect(sha1).equal("2a618664fbba1df7c05f27d7c0e8f58de250003b");
  });
});
