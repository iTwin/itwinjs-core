/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { NativeLibrary } from "@bentley/imodeljs-native";
import { DbResult, Guid, OpenMode } from "@itwin/core-bentley";
import { BlobContainer } from "../../BlobContainerService";
import { IModelHost } from "../../IModelHost";
import { setOnlineStatus } from "../../internal/OnlineStatus";
import { WorkspaceSqliteDb } from "../../internal/workspace/WorkspaceSqliteDb";
import { SettingsPriority } from "../../workspace/Settings";
import { settingsWorkspaceDbName } from "../../workspace/SettingsDb";
import { SettingsEditor, settingsResourceName } from "../../workspace/SettingsEditor";
import { TestUtils } from "../TestUtils";

describe("ITwin Workspace", () => {
  const opts = { cacheDir: TestUtils.getCacheDir() };
  let savedBlobContainerService: BlobContainer.ContainerService | undefined;

  function getITwinWorkspaceDir(containerId: string): string {
    return path.join(opts.cacheDir ?? NativeLibrary.defaultCacheDir, "Workspace", containerId);
  }

  function writeSettingsDb(dbFileName: string, settings: Record<string, unknown>, workspaceName: string): void {
    fs.ensureDirSync(path.dirname(dbFileName));
    WorkspaceSqliteDb.createNewDb(dbFileName, { manifest: { workspaceName } });

    const db = new WorkspaceSqliteDb();
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

  function createLocalSettingsDb(containerId: string, settings: Record<string, unknown>): void {
    const dbDir = getITwinWorkspaceDir(containerId);
    const dbFileName = path.join(dbDir, "settings-db.itwin-workspace");
    writeSettingsDb(dbFileName, settings, `${containerId} settings`);
  }

  function createSettingsContainerService(iTwinId: string, containerIds: string[]): BlobContainer.ContainerService {
    return {
      create: async () => ({ baseUri: "", containerId: containerIds[0], provider: "azure" as const }),
      delete: async () => { },
      queryScope: async () => ({ iTwinId }),
      queryMetadata: async () => ({ containerType: "settings", label: "settings" }),
      queryContainersMetadata: async () => containerIds.map((containerId) => ({ containerId, containerType: "settings", label: containerId })),
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

  afterEach(() => {
    BlobContainer.service = savedBlobContainerService;
    setOnlineStatus(true);
    sinon.restore();
  });

  after(async () => {
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  });

  it("loads iTwin workspaces from the settings container", async () => {
    const iTwinId = Guid.createValue();
    createLocalSettingsDb("itwin-settings-a", {
      "app/testA": "value-a",
      "app/testB": "value-b",
    });
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a"]);

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(workspace.settings.getString("app/testB")).to.equal("value-b");
    workspace.close();
  });

  it("returns an empty iTwin workspace if no root settings container exists", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, []);

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.dictionaries.length).to.equal(0);
    expect(workspace.settings.getString("app/testA")).to.be.undefined;
    workspace.close();
  });

  it("fails if multiple iTwin settings containers exist for the same iTwin", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a", "itwin-settings-b"]);

    await IModelHost.startup(opts);

    await expect(IModelHost.getITwinWorkspace(iTwinId)).to.be.rejectedWith("Multiple iTwin settings containers were found");
  });

  it("loads iTwin workspace from container props without network calls", async () => {
    const containerId = "itwin-settings-offline";
    createLocalSettingsDb(containerId, { "app/testA": "value-a" });

    const unexpectedNetworkCall = sinon.stub().rejects(new Error("unexpected network call"));
    const queryContainersMetadata = sinon.stub().resolves([]);
    const requestToken = sinon.stub().resolves({
      token: "",
      scope: { iTwinId: Guid.createValue() },
      provider: "azure" as const,
      expiration: new Date(Date.now() + 3600000),
      metadata: { containerType: "settings", label: containerId },
      baseUri: "",
    });

    const networkService: BlobContainer.ContainerService = {
      create: unexpectedNetworkCall,
      delete: unexpectedNetworkCall,
      queryScope: unexpectedNetworkCall,
      queryMetadata: unexpectedNetworkCall,
      queryContainersMetadata,
      updateJson: unexpectedNetworkCall,
      requestToken,
    };
    BlobContainer.service = networkService;

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace({
      baseUri: "",
      containerId,
      storageType: "azure",
      priority: SettingsPriority.iTwin,
      dbName: settingsWorkspaceDbName,
      includePrerelease: true,
    });

    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(queryContainersMetadata.called).to.be.false;
    expect(requestToken.called).to.be.false;
    workspace.close();
  });

  it("getITwinWorkspace loads all named dictionaries from the settings container", async () => {
    const iTwinId = Guid.createValue();
    const containerId = "itwin-settings-multi";
    const dbDir = getITwinWorkspaceDir(containerId);
    const dbFileName = path.join(dbDir, "settings-db.itwin-workspace");

    // Create a local SettingsDb with two named dictionary resources
    fs.ensureDirSync(path.dirname(dbFileName));
    WorkspaceSqliteDb.createNewDb(dbFileName, { manifest: { workspaceName: "multi-dict settings" } });
    const db = new WorkspaceSqliteDb();
    db.openDb(dbFileName, OpenMode.ReadWrite);
    db.withSqliteStatement("INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => {
      stmt.bindString(1, "dict-a");
      stmt.bindString(2, JSON.stringify({ "app/testA": "value-a" }));
      expect(stmt.step()).to.equal(DbResult.BE_SQLITE_DONE);
    });
    db.withSqliteStatement("INSERT INTO strings(id,value) VALUES(?,?)", (stmt) => {
      stmt.bindString(1, "dict-b");
      stmt.bindString(2, JSON.stringify({ "app/testB": "value-b" }));
      expect(stmt.step()).to.equal(DbResult.BE_SQLITE_DONE);
    });
    db.saveChanges();
    db.closeDb();

    BlobContainer.service = createSettingsContainerService(iTwinId, [containerId]);
    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(workspace.settings.getString("app/testB")).to.equal("value-b");
    workspace.close();
  });

  it("saveSettingDictionary saves a named dictionary and closes the editor", async () => {
    const iTwinId = Guid.createValue();
    const updateSettingsResource = sinon.spy();
    const close = sinon.spy();

    const withEditableDb = sinon.stub().callsFake(async (_user: string, operation: (db: any) => void) => {
      operation({ updateSettingsResource });
    });
    const constructStub = sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as any,
      container: { withEditableDb } as any,
    });

    await IModelHost.saveSettingDictionary(iTwinId, "myDict", { "app/value": 1, "app/name": "test" });

    expect(constructStub.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(withEditableDb.calledOnce).to.be.true;
    expect(withEditableDb.firstCall.args[0]).to.equal(IModelHost.userMoniker);
    expect(updateSettingsResource.calledOnce).to.be.true;
    expect(updateSettingsResource.firstCall.args[0]).to.deep.equal({ "app/value": 1, "app/name": "test" });
    expect(updateSettingsResource.firstCall.args[1]).to.equal("myDict");
    expect(close.calledOnce).to.be.true;
  });

  it("deleteSettingDictionary is a no-op when no iTwin settings container exists", async () => {
    const iTwinId = Guid.createValue();
    const getEditor = sinon.stub(SettingsEditor, "getForITwin").resolves(undefined);
    const constructStub = sinon.stub(SettingsEditor, "constructForITwin");

    await IModelHost.deleteSettingDictionary(iTwinId, "myDict");

    expect(getEditor.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(constructStub.called).to.be.false;
  });

  it("deleteSettingDictionary removes a named dictionary and closes the editor", async () => {
    const iTwinId = Guid.createValue();
    const removeString = sinon.spy();
    const close = sinon.spy();

    const withEditableDb = sinon.stub().callsFake(async (_user: string, operation: (db: any) => void) => {
      operation({ removeString });
    });
    const getEditor = sinon.stub(SettingsEditor, "getForITwin").resolves({
      editor: { close } as any,
      container: { withEditableDb } as any,
    });

    await IModelHost.deleteSettingDictionary(iTwinId, "myDict");

    expect(getEditor.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(withEditableDb.calledOnce).to.be.true;
    expect(withEditableDb.firstCall.args[0]).to.equal(IModelHost.userMoniker);
    expect(removeString.calledOnceWithExactly("myDict")).to.be.true;
    expect(close.calledOnce).to.be.true;
  });

  it("saveSettingDictionary closes editor even on error", async () => {
    const iTwinId = Guid.createValue();
    const close = sinon.spy();
    sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as any,
      container: { withEditableDb: sinon.stub().rejects(new Error("write failed")) } as any,
    });

    await expect(IModelHost.saveSettingDictionary(iTwinId, "x", {})).to.be.rejectedWith("write failed");
    expect(close.calledOnce).to.be.true;
  });

  it("deleteSettingDictionary closes editor even on error", async () => {
    const iTwinId = Guid.createValue();
    const close = sinon.spy();
    sinon.stub(SettingsEditor, "getForITwin").resolves({
      editor: { close } as any,
      container: { withEditableDb: sinon.stub().rejects(new Error("delete failed")) } as any,
    });

    await expect(IModelHost.deleteSettingDictionary(iTwinId, "x")).to.be.rejectedWith("delete failed");
    expect(close.calledOnce).to.be.true;
  });
});
