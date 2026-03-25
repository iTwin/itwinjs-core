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
import { SettingsSqliteDb } from "../../internal/workspace/SettingsSqliteDb";
import { SettingsContainers, settingsResourceName } from "../../workspace/SettingsDb";
import { SettingsEditor } from "../../workspace/SettingsEditor";
import { TestUtils } from "../TestUtils";

describe("ITwin Workspace", () => {
  const opts = { cacheDir: TestUtils.getCacheDir() };
  let savedBlobContainerService: BlobContainer.ContainerService | undefined;

  function getITwinWorkspaceDir(containerId: string): string {
    return path.join(opts.cacheDir ?? NativeLibrary.defaultCacheDir, "Workspace", containerId);
  }

  function writeSettingsDb(dbFileName: string, settings: Record<string, unknown>, settingsName: string): void {
    fs.ensureDirSync(path.dirname(dbFileName));
    SettingsSqliteDb.createNewDb(dbFileName, { manifest: { settingsName } });

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
      "dict-a": { "app/testA": "value-a" },
      "dict-b": { "app/testB": "value-b" },
    });
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a"]);

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(workspace.settings.getString("app/testB")).to.equal("value-b");
    expect(workspace.settings.dictionaries.some((dictionary) => dictionary.props.name === "dict-b")).to.be.true;
  });

  it("returns an empty iTwin workspace if no root settings container exists", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, []);

    await IModelHost.startup(opts);

    const workspace = await IModelHost.getITwinWorkspace(iTwinId);
    expect(workspace.settings.dictionaries.length).to.equal(0);
    expect(workspace.settings.getString("app/testA")).to.be.undefined;
  });

  it("fails if multiple iTwin settings containers exist for the same iTwin", async () => {
    const iTwinId = Guid.createValue();
    BlobContainer.service = createSettingsContainerService(iTwinId, ["itwin-settings-a", "itwin-settings-b"]);

    await IModelHost.startup(opts);

    await expect(IModelHost.getITwinWorkspace(iTwinId)).to.be.rejectedWith("Multiple iTwin settings containers were found");
  });

  it("loads iTwin workspace from container props without network calls", async () => {
    const containerId = "itwin-settings-offline";
    createLocalSettingsDb(containerId, { "dict-a": { "app/testA": "value-a" } });

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
      accessToken: "",
      baseUri: "",
      containerId,
      storageType: "azure",
    });

    expect(workspace.settings.getString("app/testA")).to.equal("value-a");
    expect(queryContainersMetadata.called).to.be.false;
    expect(requestToken.called).to.be.false;
  });

  it("saveITwinSettingDictionary updates a dictionary and closes the editor", async () => {
    const iTwinId = Guid.createValue();
    const sourceDict = { "app/value": 1 };
    const updateSetting = sinon.spy();
    const close = sinon.spy();

    const withEditableDb = sinon.stub().callsFake(async ({ operation }: { operation: (db: unknown) => void }) => {
      operation({ updateSetting });
    });

    const constructStub = sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as unknown as SettingsEditor,
      container: { withEditableDb } as any,
    });

    await IModelHost.saveITwinSettingDictionary(iTwinId, "dict-a", sourceDict);

    expect(constructStub.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(withEditableDb.calledOnce).to.be.true;
    expect(withEditableDb.firstCall.args[0].user).to.equal(IModelHost.userMoniker);
    expect(updateSetting.calledOnce).to.be.true;
    expect(updateSetting.firstCall.args[0].settingName).to.equal("dict-a");
    expect(updateSetting.firstCall.args[0].value).to.deep.equal(sourceDict);
    expect(updateSetting.firstCall.args[0].value).to.not.equal(sourceDict);
    expect(close.calledOnce).to.be.true;
  });

  it("saveITwinSettingDictionary closes editor when write operation fails", async () => {
    const iTwinId = Guid.createValue();
    const close = sinon.spy();
    const withEditableDb = sinon.stub().rejects(new Error("save failed"));

    sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as unknown as SettingsEditor,
      container: { withEditableDb } as any,
    });

    await expect(IModelHost.saveITwinSettingDictionary(iTwinId, "dict-a", { "app/value": 1 })).to.be.rejectedWith("save failed");
    expect(close.calledOnce).to.be.true;
  });

  it("deleteITwinSettingDictionary is a no-op when no iTwin settings container exists", async () => {
    const iTwinId = Guid.createValue();
    const getContainerId = sinon.stub(SettingsContainers, "getITwinContainerId").resolves(undefined);
    const constructStub = sinon.stub(SettingsEditor, "constructForITwin");

    await IModelHost.deleteITwinSettingDictionary(iTwinId, "dict-a");

    expect(getContainerId.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(constructStub.called).to.be.false;
  });

  it("deleteITwinSettingDictionary removes a dictionary and closes the editor", async () => {
    const iTwinId = Guid.createValue();
    const removeSetting = sinon.spy();
    const close = sinon.spy();

    sinon.stub(SettingsContainers, "getITwinContainerId").resolves("itwin-container-id");

    const withEditableDb = sinon.stub().callsFake(async ({ operation }: { operation: (db: unknown) => void }) => {
      operation({ removeSetting });
    });

    const constructStub = sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as unknown as SettingsEditor,
      container: { withEditableDb } as any,
    });

    await IModelHost.deleteITwinSettingDictionary(iTwinId, "dict-a");

    expect(constructStub.calledOnceWithExactly(iTwinId)).to.be.true;
    expect(withEditableDb.calledOnce).to.be.true;
    expect(withEditableDb.firstCall.args[0].user).to.equal(IModelHost.userMoniker);
    expect(removeSetting.calledOnceWithExactly("dict-a")).to.be.true;
    expect(close.calledOnce).to.be.true;
  });

  it("deleteITwinSettingDictionary closes editor when write operation fails", async () => {
    const iTwinId = Guid.createValue();
    const close = sinon.spy();
    const withEditableDb = sinon.stub().rejects(new Error("delete failed"));

    sinon.stub(SettingsContainers, "getITwinContainerId").resolves("itwin-container-id");
    sinon.stub(SettingsEditor, "constructForITwin").resolves({
      editor: { close } as unknown as SettingsEditor,
      container: { withEditableDb } as any,
    });

    await expect(IModelHost.deleteITwinSettingDictionary(iTwinId, "dict-a")).to.be.rejectedWith("delete failed");
    expect(close.calledOnce).to.be.true;
  });
});
