/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BaseSettings, CloudSqlite, EditableWorkspaceDb, IModelHost, IModelJsFs, ITwinWorkspace, SettingsPriority } from "@itwin/core-backend";
import { expect } from "chai";
import { join } from "path";

describe("Cloud workspace containers", () => {

  it.skip("cloud containers", async () => {
    const accountProps: CloudSqlite.AccountProps = {
      accountName: "devstoreaccount1",
      storageType: "azure?emulator=127.0.0.1:10000&sas=0",
    };
    const containerProps: CloudSqlite.ContainerProps = {
      containerId: "test-container",
      sasToken: "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    };

    const containerDict = {
      "cloudSqlite/accountProps": accountProps,
      "cloudSqlite/containerProps": containerProps,
    };
    const workspace = new ITwinWorkspace(new BaseSettings(), { containerDir: join(IModelHost.cacheDir, "TestCloudWorkspaces") });
    const settings = workspace.settings;
    settings.addDictionary("containers", SettingsPriority.application, containerDict);

    const daemonDir = join(workspace.containerDir, "cloud");
    IModelJsFs.purgeDirSync(daemonDir);

    const testContainerName = "test-container";
    const testDbName = "testDb";
    const container = workspace.getContainer({ containerName: testContainerName });
    const ws1 = new EditableWorkspaceDb(testDbName, container);
    const dbName = ws1.localFile;
    if (IModelJsFs.existsSync(dbName))
      IModelJsFs.unlinkSync(dbName);

    const account1 = settings.getObject<CloudSqlite.AccountProps>("cloudSqlite/accountProps")!;
    expect(account1).deep.equals(accountProps);
    const contain1 = settings.getObject<CloudSqlite.ContainerProps>("cloudSqlite/containerProps")!;
    expect(contain1).deep.equals(containerProps);

    const cloudAccess = { ...account1, ...contain1, daemonDir };
    ws1.create();
    ws1.addString("string 1", "value of string 1");
    ws1.close();
    await ws1.upload(cloudAccess);

    IModelJsFs.unlinkSync(dbName);
    let ws2 = await container.getWorkspaceDb({ dbName: testDbName, cloudProps: { ...containerProps, ...accountProps } });
    let val = ws2.getString("string 1");
    expect(val).equals("value of string 1");
    ws2.container.dropWorkspaceDb(ws2);

    const newVal = "new value for string 1";
    const ws3 = new EditableWorkspaceDb(testDbName, container);
    // await  ws3.openCloudDb(cloudAccess);
    ws3.open();
    ws3.updateString("string 1", newVal);
    ws3.close();

    await CloudSqlite.deleteDb({ ...ws3, ...cloudAccess });
    await ws3.upload(cloudAccess);

    ws2 = await container.getWorkspaceDb({ dbName: testDbName, cloudProps: { ...containerProps, ...accountProps } });
    val = ws2.getString("string 1");
    expect(val).equals(newVal);
    ws2.container.dropWorkspaceDb(ws2);
  });

});
