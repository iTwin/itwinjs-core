/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, use as useFromChai } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { emptyDirSync, existsSync, mkdirsSync, removeSync } from "fs-extra";
import { join } from "path";
import * as azureBlob from "@azure/storage-blob";
import { BriefcaseDb, CloudSqlite, EditableWorkspaceDb, IModelDb, IModelHost, KnownLocations, SnapshotDb, SQLiteDb, SqliteStatement } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { assert, BeDuration, DbResult, GuidString, OpenMode } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

useFromChai(chaiAsPromised);

export namespace CloudSqliteTest {
  export type TestContainer = CloudSqlite.CloudContainer & { isPublic: boolean };
  export const httpAddr = "127.0.0.1:10000";
  export const storage: CloudSqlite.AccountAccessProps = {
    accessName: "devstoreaccount1",
    storageType: `azure?emulator=${httpAddr}&sas=1`,
  };
  const credential = new azureBlob.StorageSharedKeyCredential(storage.accessName, "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==");

  export async function createAzureContainer(container: TestContainer) {
    const pipeline = azureBlob.newPipeline(credential);
    const blobService = new azureBlob.BlobServiceClient(`http://${httpAddr}/${storage.accessName}`, pipeline);
    setSasToken(container, "racwdl");
    try {
      await blobService.deleteContainer(container.containerId);
    } catch (e) {
    }
    await blobService.createContainer(container.containerId, container.isPublic ? { access: "blob" } : undefined);
  }
  export async function initializeContainers(containers: TestContainer[]) {
    for await (const container of containers) {
      await createAzureContainer(container);
      container.initializeContainer({ checksumBlockNames: true });
    }
  }
  export function makeEmptyDir(name: LocalDirName) {
    mkdirsSync(name);
    emptyDirSync(name);
  }

  export function makeCloudSqliteContainer(containerId: string, isPublic: boolean): TestContainer {
    const cont = CloudSqlite.createCloudContainer({ ...storage, containerId, writeable: true, accessToken: "" }) as TestContainer;
    cont.isPublic = isPublic;
    return cont;
  }

  export function makeCloudSqliteContainers(props: [string, boolean][]): TestContainer[] {
    const containers = [];
    for (const entry of props)
      containers.push(makeCloudSqliteContainer(entry[0], entry[1]));

    return containers;
  }
  export function makeCache(cacheName: string) {
    const cacheDir = join(IModelHost.cacheDir, cacheName);
    makeEmptyDir(cacheDir);
    return CloudSqlite.CloudCaches.getCache({ cacheName, cacheDir });

  }
  export function makeCaches(names: string[]) {
    const caches = [];
    for (const name of names)
      caches.push(makeCache(name));
    return caches;
  }
  export function makeSasToken(containerName: string, permissionFlags: string) {
    const now = new Date();
    return azureBlob.generateBlobSASQueryParameters({
      containerName,
      permissions: azureBlob.ContainerSASPermissions.parse(permissionFlags),
      startsOn: now,
      expiresOn: new Date(now.valueOf() + 86400 * 1000), // one day, in milliseconds
      version: "2018-03-28", // note: fails without this value
    }, credential).toString();
  }
  export function setSasToken(container: CloudSqlite.CloudContainer, permissionFlags: string) {
    container.accessToken = makeSasToken(container.containerId, permissionFlags);
  }
  export async function uploadFile(container: CloudSqlite.CloudContainer, cache: CloudSqlite.CloudCache, dbName: string, localFileName: LocalFileName) {
    expect(container.isConnected).false;
    container.connect(cache);
    expect(container.isConnected);

    await CloudSqlite.withWriteLock("upload", container, async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
    expect(container.isConnected);
    container.disconnect({ detach: true });
    expect(container.isConnected).false;
  }
}

describe("CloudSqlite", () => {
  let caches: CloudSqlite.CloudCache[];
  let testContainers: CloudSqliteTest.TestContainer[];
  let testBimGuid: GuidString;
  let testBimFileName: string;
  const user = "CloudSqlite test";
  const user2 = "CloudSqlite test2";

  before(async () => {
    testContainers = CloudSqliteTest.makeCloudSqliteContainers([["test1", false], ["test2", false], ["test3", true]]);
    caches = CloudSqliteTest.makeCaches(["cache1", "cache2"]);
    await CloudSqliteTest.initializeContainers(testContainers);

    expect(caches[0].isDaemon).false;

    testBimFileName = join(KnownTestLocations.assetsDir, "test.bim");
    const imodel = SnapshotDb.openFile(testBimFileName);
    testBimGuid = imodel.iModelId;
    imodel.close();

    const tempDbFile = join(KnownLocations.tmpdir, "TestWorkspaces", "testws.db");
    if (existsSync(tempDbFile))
      removeSync(tempDbFile);
    EditableWorkspaceDb.createEmpty(tempDbFile); // just to create a db with a few tables

    await CloudSqliteTest.uploadFile(testContainers[0], caches[0], "c0-db1:0", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[0], caches[0], "testBim", testBimFileName);
    await CloudSqliteTest.uploadFile(testContainers[1], caches[0], "c1-db1:2.1", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[2], caches[0], "c2-db1", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[2], caches[0], "testBim", testBimFileName);
  });

  it("should query bcvHttpLog", async () => {
    const containerId = Guid.createValue();
    const sasToken = CloudSqliteTest.makeSasToken(containerId, "rwl");
    const containerProps: CloudSqlite.ContainerAccessProps = {
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
      containerId,
      accessToken: sasToken,
      cloudSqliteLogId: "ContainerIdentifier",
      writeable: true,
    };
    const container = CloudSqlite.createCloudContainer(containerProps);
    container.initializeContainer();
    container.connect(cache);

    let rows = container.queryHttpLog();
    expect(rows.length).to.equal(2); // manifest and bcv_kv GETs.

    // endTime to exclude these first 2 entries in later queries.
    await BeDuration.wait(10);
    const endTime = new Date().toISOString();

    rows = container.queryHttpLog({startFromId: 2});
    expect(rows.length).to.equal(1);
    expect(rows[0].id).to.equal(2);

    container.acquireWriteLock("test");
    await CloudSqlite.uploadDb(container, {localFileName: testBimFileName, dbName: testBimFileName});
    container.releaseWriteLock();
    container.checkForChanges();

    // 6 entries added by grabbing the write lock and checking for changes.
    // 2 entries from before. Expect 6 total entries because we're filtering by endTime from before.
    rows = container.queryHttpLog({finishedAtOrAfterTime: endTime, startFromId: 1});
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = container.queryHttpLog({finishedAtOrAfterTime: endTime});
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = container.queryHttpLog({finishedAtOrAfterTime: endTime, startFromId: 1, showOnlyFinished: true});
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = container.queryHttpLog({showOnlyFinished: true});
    expect(rows.length).to.equal(8);

    rows = container.queryHttpLog({startFromId: 4, showOnlyFinished: true});
    expect(rows.length).to.equal(5);

  });

  it("should pass cloudSqliteLogId through container to database", async () => {
    const containerId = Guid.createValue();
    const sasToken = CloudSqliteTest.makeSasToken(containerId, "rwl");
    const containerProps: CloudSqlite.ContainerAccessProps = {
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
      containerId,
      accessToken: sasToken,
      cloudSqliteLogId: "ContainerIdentifier",
      writeable: true,
    };
    const container = CloudSqlite.createCloudContainer(containerProps);
    container.initializeContainer();
    container.connect(cache);

    container.acquireWriteLock("test");
    await CloudSqlite.uploadDb(container, {localFileName: testBimFileName, dbName: testBimFileName});
    container.releaseWriteLock();
    container.checkForChanges();

    let db: IModelJsNative.DgnDb = new IModelDb.openDgnDb(testBimFileName, OpenMode.Readonly, undefined, container);
    let stmt = new SqliteStatement();
    stmt.prepare(db, "PRAGMA bcv_client");
    stmt.step();
    expect(stmt.getValueString(0)).equal(containerProps.cloudSqliteLogId);
    stmt.dispose();
    db.closeIModel();
    container.disconnect();

    const containerProps2: CloudSqlite.ContainerAccessProps = {
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
      containerId,
      cloudSqliteLogId: "",
      accessToken: sasToken,
      writeable: true,
    };
    const container2 = CloudSqlite.createCloudContainer(containerProps2);
    container2.connect(cache);

    container2.checkForChanges();

    db = new IModelDb.openDgnDb(testBimFileName, OpenMode.Readonly, undefined, container);
    stmt.prepare(db, "PRAGMA bcv_client");
    stmt.step();
    expect(stmt.getValueString(0)).equal(containerProps2.cloudSqliteLogId);
    stmt.dispose();
    db.closeIModel();
    container2.disconnect();

    const containerProps3: CloudSqlite.ContainerAccessProps = { // No cloudsqlitelogid, so undefined. Should be "" by default.
      accessName: CloudSqliteTest.storage.accessName,
      storageType: CloudSqliteTest.storage.storageType,
      containerId,
      accessToken: sasToken,
      writeable: true,
    };
    const container3 = CloudSqlite.createCloudContainer(containerProps3);
    container3.connect(cache);

    container3.checkForChanges();

    db = new IModelDb.openDgnDb(testBimFileName, OpenMode.Readonly, undefined, container);
    stmt.prepare(db, "PRAGMA bcv_client");
    stmt.step();
    expect(stmt.getValueString(0)).equal("");
    stmt.dispose();
    db.closeIModel();
    container3.disconnect();
  });

  it("cloud containers", async () => {
    expect(undefined !== caches[0]);

    const contain1 = testContainers[0];
    contain1.connect(caches[1]); // connect it to the second cloudCache
    expect(contain1.isConnected);

    // first container has 2 databases
    let dbs = contain1.queryDatabases();
    expect(dbs.length).equals(2);
    expect(dbs).contains("c0-db1:0");

    let dbProps = contain1.queryDatabase(dbs[0]);
    assert(dbProps !== undefined);
    expect(dbProps.dirtyBlocks).equals(0);
    expect(dbProps.localBlocks).equals(0);
    expect(dbProps.transactions).equals(false);

    // open a cloud database for read
    const db = new SQLiteDb();
    db.openDb("c0-db1:0", OpenMode.Readonly, contain1);
    expect(db.isOpen);
    expect(db.nativeDb.cloudContainer).equals(contain1);
    db.closeDb();
    expect(db.nativeDb.cloudContainer).undefined;

    dbProps = contain1.queryDatabase(dbs[0]);
    assert(dbProps !== undefined);
    expect(dbProps.totalBlocks).greaterThan(0);

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
      expect(briefcase.nativeDb.cloudContainer).equals(contain1);
      briefcase.close();
    });

    await db.withLockedContainer({ user, container: contain1, dbName: "testBim2" }, async () => {
      db.vacuum();
      db.closeDb();

      expect(contain1.hasLocalChanges).true;
      dbProps = contain1.queryDatabase("testBim2");
      assert(dbProps !== undefined);
      expect(dbProps.dirtyBlocks).greaterThan(0);
      expect(dbProps.localBlocks).greaterThan(0);
      expect(dbProps.localBlocks).equals(dbProps.totalBlocks);
    });
    expect(db.isOpen).false;
    expect(contain1.queryDatabase("testBim2")?.dirtyBlocks).equals(0);

    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await contain1.copyDatabase("testBim", "testBim33");
      await contain1.deleteDatabase("testBim2");
      expect(contain1.hasLocalChanges).true;
      contain1.abandonChanges();
    });
    expect(contain1.hasLocalChanges).false;
    expect(contain1.queryDatabases().length).equals(3);
    expect(contain1.queryDatabase("testBim33")).undefined;
    expect(contain1.queryDatabase("testBim2")).not.undefined;

    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await expect(contain1.deleteDatabase("badName")).eventually.rejectedWith("no such database");
      await contain1.deleteDatabase("testBim2");
    });

    expect(contain1.queryDatabase("testBim2")).undefined;
    expect(contain1.queryDatabases().length).equals(2);

    contain1.disconnect();
    CloudSqliteTest.setSasToken(contain1, "rwl"); // don't ask for delete permission
    contain1.connect(caches[1]);
    await CloudSqlite.withWriteLock(user, contain1, async () => {
      await expect(contain1.cleanDeletedBlocks()).eventually.rejectedWith("not authorized").property("errorNumber", 403);
    });

    contain1.disconnect();
    CloudSqliteTest.setSasToken(contain1, "rwdl"); // now ask for delete permission
    contain1.connect(caches[1]);

    await CloudSqlite.withWriteLock(user, contain1, async () => contain1.cleanDeletedBlocks());
    expect(contain1.garbageBlocks).equals(0); // should successfully purge

    // should be connected
    expect(contain1.isConnected);

    // can't connect two containers with same name
    const cont2 = CloudSqliteTest.makeCloudSqliteContainer(contain1.containerId, false);

    CloudSqliteTest.setSasToken(cont2, "racwdl");

    expect(() => cont2.connect(caches[1])).throws("container with that name already attached");
    expect(cont2.isConnected).false;
    cont2.connect(caches[0]); // connect it to a different cache
    expect(cont2.isConnected);

    // in second cache, testBim should not be local
    dbProps = cont2.queryDatabase("testBim");
    assert(dbProps !== undefined);
    expect(dbProps.dirtyBlocks).equals(0);
    expect(dbProps.localBlocks).equals(0);
    expect(dbProps.totalBlocks).greaterThan(0);

    // when one cache has the lock the other should fail to obtain it
    await CloudSqlite.withWriteLock(user, contain1, async () => {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      expect(() => cont2.acquireWriteLock(user)).throws("is currently locked").property("errorNumber", DbResult.BE_SQLITE_BUSY);
    });

    // test busy retry handler
    let retries = 0;
    await CloudSqlite.withWriteLock(user2, cont2, async () => {
      await expect(CloudSqlite.withWriteLock(user, contain1, async () => { }, async (lockedBy: string, expires: string) => {
        expect(lockedBy).equals(user2);
        expect(expires.length).greaterThan(0);
        return ++retries < 5 ? undefined : "stop";
      })).rejectedWith("is currently locked");
    });
    expect(retries).equals(5); // retry handler should be called 5 times

    cont2.disconnect({ detach: true });
    contain1.disconnect({ detach: true });

    // can't connect with invalid token
    contain1.accessToken = "bad";
    expect(() => contain1.connect(caches[0])).throws("403").property("errorNumber", 403);

    // Now attempt to obtain the write lock with a token that doesn't authorize it, expecting auth error
    CloudSqliteTest.setSasToken(contain1, "rl"); // get a read-only token
    contain1.connect(caches[0]); // connect works with readonly token
    expect(contain1.isConnected);
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => contain1.acquireWriteLock(user)).throws("not authorized").property("errorNumber", DbResult.BE_SQLITE_AUTH);
    expect(contain1.hasWriteLock).false;
    expect(contain1.hasLocalChanges).false;

    // try anonymous access
    const anonContainer = testContainers[2];
    anonContainer.accessToken = "";
    anonContainer.connect(caches[0]);
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
    const wasCache1 = { cacheName: caches[0].name, cacheDir: caches[0].rootDir, guid: caches[0].guid };
    const wasCache2 = { cacheName: caches[1].name, cacheDir: caches[1].rootDir, guid: caches[1].guid };

    // destroying a cache detaches all attached containers
    expect(contain1.isConnected);
    expect(anonContainer.isConnected);
    caches[0].destroy();
    expect(contain1.isConnected).false;
    expect(anonContainer.isConnected).false;
    caches[1].destroy();

    // closing and then reopening (usually in another session) a cache should preserve its guid (via localstore.itwindb)
    const newCache1 = CloudSqlite.CloudCaches.getCache(wasCache1);
    const newCache2 = CloudSqlite.CloudCaches.getCache(wasCache2);
    expect(newCache1.guid).equals(wasCache1.guid);
    expect(newCache2.guid).equals(wasCache2.guid);
    expect(newCache1.guid).not.equals(newCache2.guid);
    newCache1.destroy();
    newCache2.destroy();
  });

});

