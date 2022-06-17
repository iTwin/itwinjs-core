/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { emptyDirSync, existsSync, mkdirsSync, rmSync } from "fs-extra";
import { dirname, join } from "path";
import * as azureBlob from "@azure/storage-blob";
import {
  BriefcaseDb, CloudSqlite, EditableWorkspaceDb, IModelHost, IModelJsFs, IModelJsNative, KnownLocations, SnapshotDb, SQLiteDb,
} from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { assert, DbResult, Guid, GuidString, OpenMode, StopWatch } from "@itwin/core-bentley";
import { LocalDirName, LocalFileName } from "@itwin/core-common";

export namespace CloudSqliteTest {
  export type TestContainer = CloudSqlite.Container & { isPublic: boolean };
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
    const cont = new IModelHost.platform.CloudContainer({ ...storage, containerId, writeable: true, accessToken: "" }) as TestContainer;
    cont.isPublic = isPublic;
    return cont;
  }

  export function makeCloudSqliteContainers(props: [string, boolean][]): TestContainer[] {
    const containers = [];
    for (const entry of props)
      containers.push(makeCloudSqliteContainer(entry[0], entry[1]));

    return containers;
  }
  export function makeCache(name: string) {
    const rootDir = join(IModelHost.cacheDir, name);
    makeEmptyDir(rootDir);
    return new IModelHost.platform.CloudCache({ name, rootDir });

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
  export function setSasToken(container: CloudSqlite.Container, permissionFlags: string) {
    container.accessToken = makeSasToken(container.containerId, permissionFlags);
  }
  export async function uploadFile(container: CloudSqlite.Container, cache: IModelJsNative.CloudCache, dbName: string, localFileName: LocalFileName) {
    expect(container.isConnected).false;
    container.connect(cache);
    expect(container.isConnected);

    await container.withWriteLock("upload", async () => CloudSqlite.uploadDb(container, { dbName, localFileName }));
    expect(container.isConnected);
    container.detach();
    expect(container.isConnected).false;
  }
}

describe("CloudSqlite", () => {
  let caches: IModelJsNative.CloudCache[];
  let testContainers: CloudSqliteTest.TestContainer[];
  let testBimGuid: GuidString;
  const user = "CloudSqlite test";
  const user2 = "CloudSqlite test2";

  before(async () => {
    testContainers = CloudSqliteTest.makeCloudSqliteContainers([["test1", false], ["test2", false], ["test3", true]]);
    caches = CloudSqliteTest.makeCaches(["cache1", "cache2"]);
    await CloudSqliteTest.initializeContainers(testContainers);

    expect(caches[0].isDaemon).false;

    const testBimFileName = join(KnownTestLocations.assetsDir, "test.bim");
    const imodel = SnapshotDb.openFile(testBimFileName);
    testBimGuid = imodel.iModelId;
    imodel.close();

    const tempDbFile = join(KnownLocations.tmpdir, "TestWorkspaces", "testws.db");
    if (existsSync(tempDbFile))
      rmSync(tempDbFile);
    EditableWorkspaceDb.createEmpty(tempDbFile); // just to create a db with a few tables

    await CloudSqliteTest.uploadFile(testContainers[0], caches[0], "c0-db1:0", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[0], caches[0], "testBim", testBimFileName);
    await CloudSqliteTest.uploadFile(testContainers[1], caches[0], "c1-db1:2.1", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[2], caches[0], "c2-db1", tempDbFile);
    await CloudSqliteTest.uploadFile(testContainers[2], caches[0], "testBim", testBimFileName);
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

    await contain1.withWriteLock(user, async () => {
      await expect(contain1.copyDatabase("badName", "bad2")).eventually.rejectedWith("no such database");
      await contain1.copyDatabase("testBim", "testBim2");
    });

    expect(contain1.queryDatabases().length).equals(3);

    await expect(BriefcaseDb.open({ fileName: "testBim2", container: contain1 })).rejectedWith("write lock not held");
    await contain1.withWriteLock(user, async () => {
      expect(contain1.hasWriteLock);
      const briefcase = await BriefcaseDb.open({ fileName: "testBim2", container: contain1 });
      expect(briefcase.getBriefcaseId()).equals(0);
      expect(briefcase.iModelId).equals(testBimGuid);
      expect(briefcase.nativeDb.cloudContainer).equals(contain1);
      briefcase.close();
    });

    await contain1.withWriteLock(user, async () => {
      db.openDb("testBim2", OpenMode.ReadWrite, contain1);
      db.nativeDb.vacuum();
      db.closeDb();

      expect(contain1.hasLocalChanges).true;
      dbProps = contain1.queryDatabase("testBim2");
      assert(dbProps !== undefined);
      expect(dbProps.dirtyBlocks).greaterThan(0);
      expect(dbProps.localBlocks).greaterThan(0);
      expect(dbProps.localBlocks).equals(dbProps.totalBlocks);
    });

    expect(contain1.queryDatabase("testBim2")?.dirtyBlocks).equals(0);

    await contain1.withWriteLock(user, async () => {
      await expect(contain1.deleteDatabase("badName")).eventually.rejectedWith("no such database");
      await contain1.deleteDatabase("testBim2");
    });

    expect(contain1.queryDatabase("testBim2")).undefined;
    expect(contain1.queryDatabases().length).equals(2);

    contain1.disconnect();
    CloudSqliteTest.setSasToken(contain1, "rwl"); // don't ask for delete permission
    contain1.connect(caches[1]);
    await contain1.withWriteLock(user, async () => {
      await expect(contain1.cleanDeletedBlocks()).eventually.rejectedWith("not authorized").property("errorNumber", 403);
    });

    contain1.disconnect();
    CloudSqliteTest.setSasToken(contain1, "rwdl"); // now ask for delete permission
    contain1.connect(caches[1]);

    await contain1.withWriteLock(user, async () => contain1.cleanDeletedBlocks());
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
    await contain1.withWriteLock(user, async () => {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      expect(() => cont2.acquireWriteLock(user)).throws("is currently locked").property("errorNumber", DbResult.BE_SQLITE_BUSY);
    });

    let retries = 0;
    await cont2.withWriteLock(user2, async () => {
      await expect(contain1.withWriteLock(user, async () => { }, async (lockedBy: string, expires: string) => {
        expect(lockedBy).equals(user2);
        expect(expires.length).greaterThan(0);
        return ++retries < 5;
      })).rejectedWith("is currently locked");
    });
    expect(retries).equals(5); // retry handler should be called 5 times

    cont2.detach();
    contain1.detach();

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
    const wasCache1 = { name: caches[0].name, rootDir: caches[0].rootDir, guid: caches[0].guid };
    const wasCache2 = { name: caches[1].name, rootDir: caches[1].rootDir, guid: caches[1].guid };

    // destroying a cache detaches all attached containers
    expect(contain1.isConnected);
    expect(anonContainer.isConnected);
    caches[0].destroy();
    expect(contain1.isConnected).false;
    expect(anonContainer.isConnected).false;
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

  it.only("simultaneous writes", async () => {
    const codeContainer = CloudSqliteTest.makeCloudSqliteContainer("codes", false);
    await CloudSqliteTest.createAzureContainer(codeContainer);
    codeContainer.initializeContainer({ checksumBlockNames: false, blockSize: 256 * 1024 });

    const tempDbFile = join(KnownLocations.tmpdir, "TestWrites", "codes.db");
    if (existsSync(tempDbFile))
      rmSync(tempDbFile);

    const db = new SQLiteDb();
    IModelJsFs.recursiveMkDirSync(dirname(tempDbFile));
    db.createDb(tempDbFile);
    db.executeSQL("CREATE TABLE codeSpecs(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,json TEXT)");
    db.executeSQL("CREATE TABLE reservations(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE, json TEXT)");
    db.executeSQL("CREATE TABLE sources(id INTEGER PRIMARY KEY,type TEXT NOT NULL,name TEXT,json TEXT,UNIQUE(type,name))");
    db.executeSQL("CREATE TABLE codes(guid BLOB PRIMARY KEY NOT NULL,spec INTEGER NOT NULL,scope BLOB NOT NULL,value TEXT NOT NULL COLLATE NOCASE," +
      "lastMod TIMESTAMP NOT NULL DEFAULT(julianday('now'))," +
      "source INTEGER,flags INTEGER,reserved INTEGER,json TEXT," +
      "UNIQUE(spec,scope,value)," +
      "FOREIGN KEY(spec) REFERENCES codeSpecs(id)," +
      "FOREIGN KEY(source) REFERENCES sources(id)," +
      "FOREIGN KEY(reserved) REFERENCES reservations(id))");
    db.executeSQL("CREATE INDEX reserved_idx ON codes(reserved) WHERE reserved IS NOT NULL");
    db.executeSQL("CREATE TRIGGER timeStamp AFTER UPDATE ON codes WHEN old.lastMod=new.lastMod AND old.lastMod != julianday('now') BEGIN UPDATE codes SET lastMod=julianday('now') WHERE guid=new.guid; END");

    db.saveChanges();
    db.closeDb();

    const codeCache = CloudSqliteTest.makeCache("codes");
    await CloudSqliteTest.uploadFile(codeContainer, codeCache, "codeIdx", tempDbFile);
    codeContainer.connect(codeCache);
    expect(codeContainer.isConnected);

    // Logger.initializeToConsole();
    // Logger.setLevel("CloudSqlite", LogLevel.Trace);
    // codeCache.setLogMask(0xff);

    const outFile = join(KnownLocations.tmpdir, "TestWrites", "codeIdx.db");
    if (IModelJsFs.existsSync(outFile))
      IModelJsFs.removeSync(outFile);

    const timer = new StopWatch("lock", true);
    let count = 0;
    const scope = Guid.createValue();
    await codeContainer.withWriteLock(user2, async () => {
      db.openDb("codeIdx", OpenMode.ReadWrite, codeContainer);
      db.executeSQL(`INSERT INTO codeSpecs(name) VALUES("bsi:SpatialCategory")`);
      db.withSqliteStatement(`INSERT INTO reservations(name,json) VALUES(?,?)`, (stmt) => {
        stmt.bindString(1, "Create New Wing 5d");
        stmt.bindString(2, JSON.stringify({ contact: "Jim Jones", date: "1/1/2022" }));
        stmt.step();
      });
      db.withSqliteStatement(`INSERT INTO sources(type,name,json) VALUES(?,?,?)`, (stmt) => {
        stmt.bindString(1, "iModel");
        stmt.bindString(2, Guid.createValue());
        stmt.bindString(3, JSON.stringify({ importer: "OpenPlant" }));
        stmt.step();
      });
      db.withSqliteStatement(`INSERT INTO codes(guid,spec,scope,value,reserved,source) VALUES(?,?,?,?,?,?)`, (stmt) => {
        for (let i = 0; i < 100000; ++i) {
          stmt.bindGuid(1, Guid.createValue());
          stmt.bindInteger(2, 1);
          stmt.bindGuid(3, scope);
          stmt.bindString(4, `value-${i}`);
          if (i % 10 === 0)
            stmt.bindInteger(5, 1);
          else
            stmt.bindNull(5);
          stmt.bindInteger(6, 1);
          stmt.step();
          stmt.reset();
        }
      });
      db.saveChanges();
      db.closeDb();
      count++;
      await codeContainer.cleanDeletedBlocks();
      console.log(`add codes took ${timer.elapsedSeconds} seconds`);
      timer.start();
    });
    console.log(`lock took ${timer.elapsedSeconds} seconds for ${count} cycles (${timer.elapsedSeconds * 1000 / count} milliseconds per request)`);

    const codeCache2 = CloudSqliteTest.makeCache("codes2");
    const codeContainer2 = CloudSqliteTest.makeCloudSqliteContainer("codes", false);
    CloudSqliteTest.setSasToken(codeContainer2, "racwdl");
    codeContainer2.connect(codeCache2);
    expect(codeContainer2.isConnected);
    const db2 = new SQLiteDb();
    db2.openDb("codeIdx", { openMode: OpenMode.Readonly, defaultTxn: IModelJsNative.DefaultTxnMode.None }, codeContainer2);
    db2.withSqliteStatement(`SELECT count(*) FROM codes WHERE reserved=1`, (stmt) => {
      stmt.step();
      expect(stmt.getValueInteger(0)).equal(10000);
    });

    await codeContainer.withWriteLock(user2, async () => {
      db.openDb("codeIdx", OpenMode.ReadWrite, codeContainer);
      db.executeSQL(`DELETE FROM codes WHERE value="value-20"`);
      db.saveChanges();
      db.closeDb();
    });

    db2.withSqliteStatement(`SELECT count(*) FROM codes WHERE reserved=1`, (stmt) => {
      stmt.step();
      expect(stmt.getValueInteger(0)).equal(10000);
    });

    codeContainer2.checkForChanges();
    db2.withSqliteStatement(`SELECT count(*) FROM codes WHERE reserved=1`, (stmt) => {
      stmt.step();
      expect(stmt.getValueInteger(0)).equal(10000 - 1);
    });

    // timer.start();
    // db.openDb("codeIdx", OpenMode.Readonly, codeContainer);
    // db.nativeDb.vacuum({ into: `file:${outFile}?vfs=win32` });
    // db.closeDb();
    // console.log(`vacuum took ${timer.elapsedSeconds} seconds`);
  });
});

