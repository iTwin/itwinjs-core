/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { expect } from "chai";
import * as fs from "fs-extra";
import { join } from "path";
import { BaseSettings, BlobContainer, CloudSqlite, EditableWorkspaceDb, IModelHost, IModelJsFs, SettingDictionary, SettingsPriority, StandaloneDb, Workspace, WorkspaceContainer, WorkspaceDb } from "@itwin/core-backend";
import { assert, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

describe.skip("Cloud workspace containers", () => {
  const iTwinId = Guid.createValue();
  const orgContainer = "organization 1";
  const itwin1Container = "iTwin 1";
  const itwin2Container = "iTwin 2";
  const iModelContainer = "iModel 1";
  const baseUri = AzuriteTest.baseUri;
  const storageType = "azure" as const;
  const wsDbName = "workspace-db";

  async function initializeWorkspace(containerId: string, dbName: string, manifest: WorkspaceDb.Manifest) {
    await BlobContainer.service?.create({ scope: { iTwinId }, containerId, metadata: { containerType: "workspace", label: "workspace for test" }, userToken: AzuriteTest.service.userToken.admin });
    await WorkspaceContainer.initialize({ props: { baseUri, containerId, storageType }, dbName, manifest });
  }
  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeWorkspace(orgContainer, wsDbName, { workspaceName: "all settings for org" });
    await initializeWorkspace(itwin1Container, wsDbName, { workspaceName: "all settings for iTwin1" });
    await initializeWorkspace(itwin2Container, wsDbName, { workspaceName: "all settings for iTwin2" });
    await initializeWorkspace(iModelContainer, wsDbName, { workspaceName: "all settings for iModel 1" });

  });
  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("cloud workspace", async () => {
    const appDict = {
      "app1/settings/maxTree": 22,
    };

    const makeCloudCache = (cacheName: string) => {
      const cacheProps = {
        cacheDir: join(IModelHost.cacheDir, "cloud", cacheName),
        cacheSize: "20G",
        cacheName,
      };
      IModelJsFs.recursiveMkDirSync(cacheProps.cacheDir);
      fs.emptyDirSync(cacheProps.cacheDir);
      return CloudSqlite.CloudCaches.getCache(cacheProps);
    };

    const workspace1 = Workspace.construct(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace1"), testCloudCache: makeCloudCache("test1") });
    const workspace2 = Workspace.construct(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace2"), testCloudCache: makeCloudCache("test2") });
    const settings = workspace1.settings;
    settings.addDictionary("containers", SettingsPriority.application, appDict);

    const props = { containerId: orgContainer, writeable: true, baseUri, storageType };
    const accessToken = await CloudSqlite.requestToken(props);
    const wsCont1 = workspace1.getContainer({ ...props, accessToken });

    const user = "workspace admin";
    const workspaceName = "test workspace";
    const makeVersion = async (increment: WorkspaceDb.VersionIncrement) => {
      expect(wsCont1.cloudContainer).not.undefined;
      await CloudSqlite.withWriteLock({ user, container: wsCont1.cloudContainer! }, async () => {
        const newVer = await wsCont1.makeNewVersion({ dbName: "workspace" }, increment);
        const wsDbEdit = EditableWorkspaceDb.construct({ dbName: newVer.newName }, wsCont1);
        wsDbEdit.addString("myVersion", wsDbEdit.dbFileName.split(":")[1]);
        wsDbEdit.addString("string 1", "value of string 1");
        wsDbEdit.close();
      });
    };
    // await makeVersion("patch");
    // await makeVersion("1.2");
    // await makeVersion("v1.2.4");
    // await makeVersion("1.1.3");
    // await makeVersion("1.1.4-beta");
    // await makeVersion("3");
    // await expect(makeVersion("badname")).rejectedWith("invalid version");

    // expect(wsCont1.cloudContainer?.hasWriteLock).false;

    // const props2 = { containerId, writeable: false, baseUri: AzuriteTest.baseUri, storageType: "azure" as const };
    // const accessToken2 = await CloudSqlite.requestToken(props2);
    // const wsCont2 = workspace2.getContainer({ ...props2, accessToken: accessToken2 });
    // const ws2Cloud = wsCont2.cloudContainer;
    // assert(ws2Cloud !== undefined);

    // // eslint-disable-next-line @typescript-eslint/promise-function-async
    // expect(() => ws2Cloud.acquireWriteLock("other session")).to.throw("container is not writeable");

    // let ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName });
    // ws2.open();
    // const manifest = ws2.manifest;
    // expect(manifest.lastEditedBy).equals(user); // updated when the EditableWorkspaceDb is closed with the write lock held
    // expect(manifest.workspaceName).equals(workspaceName);
    // expect(ws2.getString("string 1")).equals("value of string 1");
    // ws2.container.closeWorkspaceDb(ws2);

    // expect(() => wsCont2.getWorkspaceDb({ dbName: testDbName, version: "^2.0.0" })).throws("No version of");

    // // change the workspace in one cache and see that it is updated in the other
    // const newVal = "new value for string 1";
    // assert(undefined !== wsCont1.cloudContainer);
    // const admin2 = "Cloud workspace admin 2";
    // await CloudSqlite.withWriteLock({ user: admin2, container: wsCont1.cloudContainer }, async () => {
    //   const ws3 = EditableWorkspaceDb.construct({ dbName: testDbName, version: "1.1.4-beta" }, wsCont1);
    //   ws3.open();
    //   ws3.updateString("string 1", newVal);
    //   ws3.close();
    // });

    // ws2Cloud.checkForChanges();
    // expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "~1.1.0" })).contains("1.1.3");
    // expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "1.2.0" })).contains("1.2.0");
    // expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: ">1.0.0 <3.0.0" })).contains("1.2.4");
    // expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "1.0.0" })).contains("1.0.0");

    // ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName, version: "~1.1.0", includePrerelease: true });
    // ws2.open();
    // expect(ws2.manifest.lastEditedBy).equal(admin2);
    // expect(ws2.manifest.workspaceName).equals(workspaceName);
    // expect(ws2.dbFileName).contains("1.1.4-beta");
    // expect(ws2.getString("string 1")).equals(newVal);
    // expect(ws2.getString("myVersion")).equals("1.1.4-beta");
    // ws2.container.closeWorkspaceDb(ws2);

    // ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName });
    // ws2.open();
    // expect(ws2.dbFileName).contains("3.0.0");
    // expect(ws2.getString("string 1")).equals("value of string 1");
    // expect(ws2.getString("myVersion")).equals("3.0.0");
    // ws2.container.closeWorkspaceDb(ws2);

    // workspace1.close();
    // workspace2.close();

    // const wsTest1: WorkspaceDb.CloudProps = {
    //   dbName: testDbName,
    //   containerId,
    //   baseUri: "http://127.0.0.1:10000/devstoreaccount1",
    //   storageType: "azure",
    //   version: "^1",
    // };
    // const workspace3 = Workspace.construct(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace3"), testCloudCache: makeCloudCache("test3") });
    // const db = await workspace3.getWorkspaceDb(wsTest1);
    // expect(db.dbFileName).equal("testDb:1.2.4");
    // expect(db.dbName).equal(testDbName);
    // expect(db.container.id).equal(containerId);

    // const db2 = await workspace3.getWorkspaceDb(wsTest1);
    // expect(db2).equal(db);
    // workspace3.close();
  });

  it.only("Settings Workspaces", async () => {
    // const tmpdir = join(__dirname, "output", "settingsTest");
    // IModelJsFs.recursiveMkDirSync(tmpdir);
    // fs.emptyDirSync(tmpdir);

    // const fileName = join(tmpdir, "settings.bim");
    // const imodel = StandaloneDb.createEmpty(fileName, {
    //   rootSubject: { name: "settings works tests" },
    //   globalOrigin: { x: 0, y: 0 },
    //   projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
    // });

    // const imodelSettings: SettingDictionary = {};
    // imodelSettings[Workspace.settingName.settingsWorkspaces] = [wsTest1];

    // imodel.saveSettingDictionary("Dict2", imodelSettings);
    // imodel.close();

    // const imodel2 = await StandaloneDb.open({ fileName });
    // imodel2.close();
  });

});

