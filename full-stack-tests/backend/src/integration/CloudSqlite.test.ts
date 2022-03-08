/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { emptyDirSync, existsSync, mkdirsSync, rmSync } from "fs-extra";
import { join } from "path";
import * as azureBlob from "@azure/storage-blob";
import { BriefcaseDb, CloudSqlite, EditableWorkspaceDb, IModelHost, IModelJsNative, KnownLocations, SnapshotDb, SQLiteDb } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { assert, DbResult, GuidString, OpenMode } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

describe("CloudSqlite", () => {
  type TestContainer = IModelJsNative.CloudContainer & { isPublic: boolean };
  let caches: IModelJsNative.CloudCache[];
  let testContainers: TestContainer[];
  let credentials: azureBlob.StorageSharedKeyCredential;
  let testBimGuid: GuidString;
  const user = "CloudSqlite test";

  const httpAddr = "127.0.0.1:10000";
  const storage: CloudSqlite.AccountProps = {
    accountName: "devstoreaccount1",
    storageType: `azure?emulator=${httpAddr}&sas=1`,
  };
  const emulatorKey = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

  const makeEmptyDir = (name: LocalDirName) => {
    mkdirsSync(name);
    emptyDirSync(name);
  };

  const makeContainer = (containerId: string, isPublic: boolean): TestContainer => {
    const cont = new IModelHost.platform.CloudContainer({ ...storage, containerId, writeable: true, sasToken: "" }) as TestContainer;
    cont.isPublic = isPublic;
    return cont;
  };
  const makeCache = (name: string) => {
    const rootDir = join(IModelHost.cacheDir, name);
    makeEmptyDir(rootDir);
    return new IModelHost.platform.CloudCache({ name, rootDir });
  };
  const setSasToken = (container: IModelJsNative.CloudContainer, permissionFlags: string) => {
    const now = new Date();
    container.sasToken = azureBlob.generateBlobSASQueryParameters({
      containerName: container.containerId,
      permissions: azureBlob.ContainerSASPermissions.parse(permissionFlags),
      startsOn: now,
      expiresOn: new Date(now.valueOf() + 86400),
    }, credentials).toString();
  };

  before(async () => {
    testContainers = [makeContainer("test1", false), makeContainer("test2", false), makeContainer("test3", true)];
    caches = [makeCache("cache1"), makeCache("cache2")];
    credentials = new azureBlob.StorageSharedKeyCredential(storage.accountName, emulatorKey);
    const pipeline = azureBlob.newPipeline(credentials);
    const blobService = new azureBlob.BlobServiceClient(`http://${httpAddr}/${storage.accountName}`, pipeline);

    for await (const container of testContainers) {
      setSasToken(container, "racwdl");
      try {
        await blobService.deleteContainer(container.containerId);
      } catch (e) {
      }
      await blobService.createContainer(container.containerId, container.isPublic ? { access: "blob" } : undefined);
      container.initializeContainer();
    }
    const testBimFileName = join(KnownTestLocations.assetsDir, "test.bim");
    const imodel = SnapshotDb.openFile(testBimFileName);
    testBimGuid = imodel.iModelId;
    imodel.close();

    const uploadFile = async (container: IModelJsNative.CloudContainer, cache: IModelJsNative.CloudCache, dbName: string, localFileName: LocalFileName) => {
      expect(container.isAttached).false;
      container.attach(cache);
      expect(container.isAttached);

      await CloudSqlite.withWriteLock(user, container, async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
      expect(container.isAttached);
      container.detach();
      expect(container.isAttached).false;
    };

    const tempDbFile = join(KnownLocations.tmpdir, "TestWorkspaces", "testws.db");
    if (existsSync(tempDbFile))
      rmSync(tempDbFile);
    EditableWorkspaceDb.createEmpty(tempDbFile); // just create a db with a few tables

    await uploadFile(testContainers[0], caches[0], "c0-db1", tempDbFile);
    await uploadFile(testContainers[0], caches[0], "testBim", testBimFileName);
    await uploadFile(testContainers[1], caches[0], "c1-db1", tempDbFile);
    await uploadFile(testContainers[2], caches[0], "c2-db1", tempDbFile);
    await uploadFile(testContainers[2], caches[0], "testBim", testBimFileName);
  });

  it("cloud containers", async () => {
    expect(undefined !== caches[0]);

    const contain1 = testContainers[0];
    contain1.attach(caches[1]); // attach it to the second cloudCache
    expect(contain1.isAttached);

    // first container has 2 databases
    let dbs = contain1.queryDatabases();
    expect(dbs.length).equals(2);
    expect(dbs[0]).equals("c0-db1");

    let dbProps = contain1.queryDatabase(dbs[0]);
    assert(dbProps !== undefined);
    expect(dbProps.dirtyBlocks).equals(0);
    expect(dbProps.localBlocks).equals(0);
    expect(dbProps.pinned).equals(0);
    expect(dbProps.transactions).equals(false);

    // open a cloud database for read
    const db = new SQLiteDb();
    db.openDb("c0-db1", OpenMode.Readonly, contain1);
    expect(db.isOpen);
    db.closeDb();

    dbProps = contain1.queryDatabase(dbs[0]);
    assert(dbProps !== undefined);
    expect(dbProps.localBlocks).greaterThan(0);

    let imodel = SnapshotDb.openFile("testBim", { container: contain1 });
    expect(imodel.getBriefcaseId()).equals(0);
    expect(imodel.iModelId).equals(testBimGuid);
    imodel.close();

    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await expect(contain1.copyDatabase("badName", "bad2")).eventually.rejectedWith("no such database");
      await contain1.copyDatabase("testBim", "testBim2");
    });

    expect(contain1.queryDatabases().length).equals(3);

    await expect(BriefcaseDb.open({ fileName: "testBim2", container: contain1 })).rejectedWith("write lock not held");
    await CloudSqlite.withWriteLock(user, contain1, async () => {
      expect(contain1.hasWriteLock);
      const briefcase = await BriefcaseDb.open({ fileName: "testBim2", container: contain1 });
      expect(briefcase.getBriefcaseId()).equals(0);
      expect(briefcase.iModelId).equals(testBimGuid);
      briefcase.close();
    });

    await CloudSqlite.withWriteLock(user, contain1, async () => {
      IModelHost.platform.DgnDb.vacuum("testBim2", contain1);
      expect(contain1.hasLocalChanges);
      dbProps = contain1.queryDatabase("testBim2");
      assert(dbProps !== undefined);
      expect(dbProps.dirtyBlocks).greaterThan(0);
      expect(dbProps.localBlocks).greaterThan(0);
      expect(dbProps.localBlocks).equals(dbProps.totalBlocks);
    });

    expect(contain1.queryDatabase("testBim2")?.dirtyBlocks).equals(0);

    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await expect(contain1.deleteDatabase("badName")).eventually.rejectedWith("no such database");
      await contain1.deleteDatabase("testBim2");
      expect(contain1.hasLocalChanges);
    });
    expect(contain1.queryDatabase("testBim2")).undefined;
    expect(contain1.garbageBlocks).greaterThan(0);
    expect(contain1.queryDatabases().length).equals(2);

    contain1.detach();
    setSasToken(contain1, "rwl"); // don't ask for delete permission
    contain1.attach(caches[1]);
    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await expect(contain1.cleanDeletedBlocks()).eventually.rejectedWith("not authorized").property("errorNumber", 403);
    });

    contain1.detach();
    setSasToken(contain1, "rwdl"); // now ask for delete permission
    contain1.attach(caches[1]);

    await CloudSqlite.withWriteLock(user, contain1, async () => contain1.cleanDeletedBlocks());
    expect(contain1.garbageBlocks).equals(0); // should successfully purge

    // can't attach a container to another cache
    expect(() => contain1.attach(caches[0])).throws("container already attached");

    // can't attach two containers with same name
    const cont2 = makeContainer(contain1.containerId, false);

    setSasToken(cont2, "racwdl");

    expect(() => cont2.attach(caches[1])).throws("container with that name already attached");
    expect(cont2.isAttached).false;
    cont2.attach(caches[0]); // attach it to a different cache
    expect(cont2.isAttached);

    // in second cache, testBim should not be local
    dbProps = cont2.queryDatabase("testBim");
    assert(dbProps !== undefined);
    expect(dbProps.dirtyBlocks).equals(0);
    expect(dbProps.localBlocks).equals(0);
    expect(dbProps.totalBlocks).greaterThan(0);
    expect(dbProps.pinned).equals(0);

    expect(cont2.queryDatabase("badName")).undefined;
    await expect(cont2.pinDatabase("badName", true)).eventually.rejectedWith("no such database").property("errorNumber", DbResult.BE_SQLITE_ERROR);

    // now pin it and make sure all its blocks are pinned and local
    await cont2.pinDatabase("testBim", true);
    dbProps = cont2.queryDatabase("testBim");
    assert(dbProps !== undefined);
    expect(dbProps.pinned).equals(dbProps.totalBlocks);
    expect(dbProps.localBlocks).equals(dbProps.totalBlocks);

    // unpin it and make sure all its blocks are local but not pinned
    await cont2.pinDatabase("testBim", false);
    dbProps = cont2.queryDatabase("testBim");
    assert(dbProps !== undefined);
    expect(dbProps.pinned).equals(0);
    expect(dbProps.localBlocks).equals(dbProps.totalBlocks);

    // when one cache has the lock the other should fail to obtain it
    await CloudSqlite.withWriteLock(user, contain1, async () => {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      expect(() => cont2.acquireWriteLock(user)).throws("cannot obtain write lock").property("errorNumber", DbResult.BE_SQLITE_BUSY);
    });

    cont2.detach();
    contain1.detach();

    // can't attach with invalid token
    contain1.sasToken = "bad";
    expect(() => contain1.attach(caches[0])).throws("403").property("errorNumber", 403);

    // Now attempt to obtain the write lock with a token that doesn't authorize it, expecting auth error
    setSasToken(contain1, "rl"); // get a read-only token
    contain1.attach(caches[0]); // attach works with readonly token
    expect(contain1.isAttached);
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => contain1.acquireWriteLock(user)).throws("not authorized").property("errorNumber", DbResult.BE_SQLITE_AUTH);
    expect(contain1.hasWriteLock).false;
    expect(contain1.hasLocalChanges).false;

    // try anonymous access
    const anonContainer = testContainers[2];
    anonContainer.sasToken = "";
    anonContainer.attach(caches[0]);
    dbs = anonContainer.queryDatabases();
    expect(dbs.length).equals(2);
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => anonContainer.acquireWriteLock(user)).throws("not authorized").property("errorNumber", DbResult.BE_SQLITE_AUTH);

    // read a database from anonymous container readonly
    imodel = SnapshotDb.openFile("testBim", { container: anonContainer });
    expect(imodel.getBriefcaseId()).equals(0);
    expect(imodel.iModelId).equals(testBimGuid);
    imodel.close();

    // save so we can re-open
    const wasCache1 = { name: caches[0].name, rootDir: caches[0].rootDir, guid: caches[0].guid };
    const wasCache2 = { name: caches[1].name, rootDir: caches[1].rootDir, guid: caches[1].guid };

    // destroying a cache detaches all attached containers
    expect(contain1.isAttached);
    expect(anonContainer.isAttached);
    caches[0].destroy();
    expect(contain1.isAttached).false;
    expect(anonContainer.isAttached).false;
    caches[1].destroy();

    // closing and then reopening (usually in another session) a cache should preserve its guid (via localstore.itwindb)
    const newCache1 = new IModelHost.platform.CloudCache(wasCache1);
    const newCache2 = new IModelHost.platform.CloudCache(wasCache2);
    expect(newCache1.guid).equals(wasCache1.guid);
    expect(newCache2.guid).equals(wasCache2.guid);
    expect(newCache1.guid).not.equals(newCache2.guid);
    newCache1.destroy();
    newCache2.destroy();
  });
});

