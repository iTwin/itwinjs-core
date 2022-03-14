/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { join } from "path";
import { BaseSettings, CloudSqlite, EditableWorkspaceDb, IModelHost, ITwinWorkspace, SettingsPriority } from "@itwin/core-backend";
import { assert } from "@itwin/core-bentley";
import { CloudSqliteTest } from "./CloudSqlite.test";

describe.only("Cloud workspace containers", () => {

  async function initializeContainer(containerId: string) {
    const cloudCont1 = CloudSqliteTest.makeCloudSqliteContainer(containerId, false);
    await CloudSqliteTest.initializeContainers([cloudCont1]);
  }
  it("cloud workspace", async () => {

    const containerId = "test-1-2-3";
    const containerDict = {
      "cloudSqlite/accountProps": CloudSqliteTest.storage,
      "cloudSqlite/containerId": containerId,
    };

    const workspace1 = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace1"), cloudCache: { name: "test1", clearContents: true } });
    const workspace2 = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestWorkspace2"), cloudCache: { name: "test2", clearContents: true } });
    const settings = workspace1.settings;
    settings.addDictionary("containers", SettingsPriority.application, containerDict);

    const testDbName = "testDb";

    await initializeContainer(containerId);
    const wsCont1 = workspace1.getContainer({ containerId, cloudProps: { ...CloudSqliteTest.storage, containerId, writeable: true, sasToken: CloudSqliteTest.makeSasToken(containerId, "rwadl") } });
    assert(undefined !== wsCont1.cloudContainer);

    await CloudSqlite.withWriteLock("Cloud workspace test", wsCont1.cloudContainer, async () => {
      const wsDbEdit = new EditableWorkspaceDb(testDbName, wsCont1);
      await wsDbEdit.createDb();
      const account1 = settings.getObject<CloudSqlite.AccountProps>("cloudSqlite/accountProps")!;
      expect(account1).deep.equals(CloudSqliteTest.storage);
      const contain1 = settings.getString("cloudSqlite/containerId")!;
      expect(contain1).equals(containerId);

      wsDbEdit.addString("string 1", "value of string 1");
      wsDbEdit.close();
    });

    const wsCont2 = workspace2.getContainer({ containerId, cloudProps: { ...CloudSqliteTest.storage, containerId, sasToken: CloudSqliteTest.makeSasToken(containerId, "rl") } });
    const ws2Cloud = wsCont2.cloudContainer;
    assert(ws2Cloud !== undefined);

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => ws2Cloud.acquireWriteLock("other session")).to.throw("container is not writeable");

    let ws2 = await wsCont2.getWorkspaceDb({ dbName: testDbName });
    let val = ws2.getString("string 1");
    expect(val).equals("value of string 1");
    ws2.container.dropWorkspaceDb(ws2);

    // change the workspace in one cache and see that it is updated in the other
    const newVal = "new value for string 1";
    await CloudSqlite.withWriteLock("Cloud workspace test", wsCont1.cloudContainer, async () => {
      const ws3 = new EditableWorkspaceDb(testDbName, wsCont1);
      ws3.open();
      ws3.updateString("string 1", newVal);
      ws3.close();
    });

    await ws2Cloud.checkForChanges();
    ws2 = await wsCont2.getWorkspaceDb({ dbName: testDbName });
    val = ws2.getString("string 1");
    expect(val).equals(newVal);
    ws2.container.dropWorkspaceDb(ws2);
  });

});
