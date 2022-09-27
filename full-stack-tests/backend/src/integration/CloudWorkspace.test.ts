/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs-extra";
import { join } from "path";
import { BaseSettings, CloudSqlite, EditableWorkspaceDb, IModelHost, IModelJsFs, ITwinWorkspace, SettingsPriority } from "@itwin/core-backend";
import { assert } from "@itwin/core-bentley";
import { CloudSqliteTest } from "./CloudSqlite.test";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

describe("Cloud workspace containers", () => {

  async function initializeContainer(containerId: string) {
    const cloudCont1 = CloudSqliteTest.makeCloudSqliteContainer(containerId, false);
    await CloudSqliteTest.initializeContainers([cloudCont1]);
  }
  it("cloud workspace", async () => {

    const testDbName = "testDb";
    const containerId = "test-1-2-3";
    const containerDict = {
      "cloudSqlite/accountProps": CloudSqliteTest.storage,
      "cloudSqlite/containerId": containerId,
    };

    const makeCloudCache = (name: string) => {
      const cacheProps = {
        rootDir: join(IModelHost.cacheDir, "cloud", name),
        cacheSize: "20G",
        name,
      };
      IModelJsFs.recursiveMkDirSync(cacheProps.rootDir);
      fs.emptyDirSync(cacheProps.rootDir);
      return CloudSqlite.createCloudCache(cacheProps);
    };

    const workspace1 = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace1"), testCloudCache: makeCloudCache("test1") });
    const workspace2 = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace2"), testCloudCache: makeCloudCache("test2") });
    const settings = workspace1.settings;
    settings.addDictionary("containers", SettingsPriority.application, containerDict);

    await initializeContainer(containerId);
    const wsCont1 = workspace1.getContainer({ containerId, writeable: true, accessToken: CloudSqliteTest.makeSasToken(containerId, "rwadl") }, CloudSqliteTest.storage);

    const makeVersion = async (version?: string) => {
      expect(wsCont1.cloudContainer).not.undefined;
      await CloudSqlite.withWriteLock("Cloud workspace test", wsCont1.cloudContainer!, async () => {
        const wsDbEdit = new EditableWorkspaceDb({ dbName: testDbName }, wsCont1);
        try {
          await wsDbEdit.createDb(version);
          const account1 = settings.getObject<CloudSqlite.AccountAccessProps>("cloudSqlite/accountProps")!;
          expect(account1).deep.equals(CloudSqliteTest.storage);
          const contain1 = settings.getString("cloudSqlite/containerId")!;
          expect(contain1).equals(containerId);

          wsDbEdit.addString("myVersion", wsDbEdit.dbFileName.split(":")[1]);
          wsDbEdit.addString("string 1", "value of string 1");
          wsDbEdit.close();
        } finally {
          wsCont1.dropWorkspaceDb(wsDbEdit);
        }
      });
    };
    await makeVersion();
    await makeVersion("1.2");
    await makeVersion("v1.2.4");
    await makeVersion("1.1.3");
    await makeVersion("1.1.4-beta");
    await makeVersion("3");
    await expect(makeVersion("badname")).rejectedWith("invalid version");

    expect(wsCont1.cloudContainer?.hasWriteLock).false;

    const wsCont2 = workspace2.getContainer({ containerId, accessToken: CloudSqliteTest.makeSasToken(containerId, "rl") }, CloudSqliteTest.storage);
    const ws2Cloud = wsCont2.cloudContainer;
    assert(ws2Cloud !== undefined);

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => ws2Cloud.acquireWriteLock("other session")).to.throw("container is not writeable");

    let ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName });
    expect(ws2.getString("string 1")).equals("value of string 1");
    ws2.container.dropWorkspaceDb(ws2);

    expect(() => wsCont2.getWorkspaceDb({ dbName: testDbName, version: "^2.0.0" })).throws("No version of");

    // change the workspace in one cache and see that it is updated in the other
    const newVal = "new value for string 1";
    assert(undefined !== wsCont1.cloudContainer);
    await CloudSqlite.withWriteLock("Cloud workspace test", wsCont1.cloudContainer, async () => {
      const ws3 = new EditableWorkspaceDb({ dbName: testDbName, version: "1.1.4-beta" }, wsCont1);
      ws3.open();
      ws3.updateString("string 1", newVal);
      ws3.close();
    });

    ws2Cloud.checkForChanges();
    expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "~1.1.0" })).contains("1.1.3");
    expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "1.2.0" })).contains("1.2.0");
    expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: ">1.0.0 <3.0.0" })).contains("1.2.4");
    expect(wsCont2.resolveDbFileName({ dbName: testDbName, version: "1.0.0" })).contains("1.0.0");

    ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName, version: "~1.1.0", includePrerelease: true });
    expect(ws2.dbFileName).contains("1.1.4-beta");
    expect(ws2.getString("string 1")).equals(newVal);
    expect(ws2.getString("myVersion")).equals("1.1.4-beta");
    ws2.container.dropWorkspaceDb(ws2);

    ws2 = wsCont2.getWorkspaceDb({ dbName: testDbName });
    expect(ws2.dbFileName).contains("3.0.0");
    expect(ws2.getString("string 1")).equals("value of string 1");
    expect(ws2.getString("myVersion")).equals("3.0.0");
    ws2.container.dropWorkspaceDb(ws2);

    workspace1.close();
    workspace2.close();

    const dict = {
      "cloud/accounts": [
        {
          name: "test/account",
          accessName: "devstoreaccount1",
          storageType: "azure?emulator=127.0.0.1:10000&sas=1",
        },
      ],
      "cloud/containers": [
        {
          name: "test/container1",
          accountName: "test/account",
          containerId,
        },
      ],
      "workspace/databases": [
        {
          name: "test/test1",
          dbName: testDbName,
          containerName: "test/container1",
          version: "^1",
        },
      ],
    };
    const workspace3 = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace3"), testCloudCache: makeCloudCache("test3") });
    workspace3.settings.addDictionary("testDict", SettingsPriority.application, dict);
    const db = await workspace3.getWorkspaceDb("test/test1", async (props, account) => {
      expect(props.containerId).equal(containerId);
      expect(account.accessName).equal("devstoreaccount1");
      return CloudSqliteTest.makeSasToken(props.containerId, "r");
    });
    expect(db.dbFileName).equal("testDb:1.2.4");
    expect(db.dbName).equal("testDb");
    expect(db.container.id).equal(containerId);

    const db2 = await workspace3.getWorkspaceDb("test/test1", async () => {
      expect(false).true; // should not be called since we already loaded the container
      return "";
    });
    expect(db2).equal(db);

    workspace3.close();
  });

});
