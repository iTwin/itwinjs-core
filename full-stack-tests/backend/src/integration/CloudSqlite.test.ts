/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, use as useFromChai } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { existsSync, removeSync } from "fs-extra";
import { join } from "path";
import { BriefcaseDb, CloudSqlite, EditableWorkspaceDb, KnownLocations, SnapshotDb, SQLiteDb } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { assert, DbResult, GuidString, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

// spell:ignore localstore itwindb

useFromChai(chaiAsPromised);

describe("CloudSqlite", () => {
  const azSqlite = AzuriteTest.Sqlite;
  let caches: CloudSqlite.CloudCache[];
  let testContainers: AzuriteTest.Sqlite.TestContainer[];
  let testBimGuid: GuidString;
  const user1 = "CloudSqlite test1";
  const user2 = "CloudSqlite test2";

  before(async () => {
    testContainers = azSqlite.makeContainers([["test1", false], ["test2", false], ["test3", true]]);
    caches = azSqlite.makeCaches(["cache1", "cache2"]);
    await azSqlite.initializeContainers(testContainers);

    expect(caches[0].isDaemon).false;

    const testBimFileName = join(KnownTestLocations.assetsDir, "test.bim");
    const imodel = SnapshotDb.openFile(testBimFileName);
    testBimGuid = imodel.iModelId;
    imodel.close();

    const tempDbFile = join(KnownLocations.tmpdir, "TestWorkspaces", "testWs.db");
    if (existsSync(tempDbFile))
      removeSync(tempDbFile);
    EditableWorkspaceDb.createEmpty(tempDbFile); // just to create a db with a few tables

    await azSqlite.uploadFile(testContainers[0], caches[0], "c0-db1:0", tempDbFile);
    await azSqlite.uploadFile(testContainers[0], caches[0], "testBim", testBimFileName);
    await azSqlite.uploadFile(testContainers[1], caches[0], "c1-db1:2.1", tempDbFile);
    await azSqlite.uploadFile(testContainers[2], caches[0], "c2-db1", tempDbFile);
    await azSqlite.uploadFile(testContainers[2], caches[0], "testBim", testBimFileName);
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

    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      await expect(contain1.copyDatabase("badName", "bad2")).eventually.rejectedWith("no such database");
      await contain1.copyDatabase("testBim", "testBim2");
    });

    expect(contain1.queryDatabases().length).equals(3);

    await expect(BriefcaseDb.open({ fileName: "testBim2", container: contain1 })).rejectedWith("write lock not held");
    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      expect(contain1.hasWriteLock);
      const briefcase = await BriefcaseDb.open({ fileName: "testBim2", container: contain1 });
      expect(briefcase.getBriefcaseId()).equals(0);
      expect(briefcase.iModelId).equals(testBimGuid);
      expect(briefcase.nativeDb.cloudContainer).equals(contain1);
      briefcase.close();
    });

    await db.withLockedContainer({ moniker: user1, container: contain1, dbName: "testBim2" }, async () => {
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

    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      await contain1.copyDatabase("testBim", "testBim33");
      await contain1.deleteDatabase("testBim2");
      expect(contain1.hasLocalChanges).true;
      contain1.abandonChanges();
    });
    expect(contain1.hasLocalChanges).false;
    expect(contain1.queryDatabases().length).equals(3);
    expect(contain1.queryDatabase("testBim33")).undefined;
    expect(contain1.queryDatabase("testBim2")).not.undefined;

    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      await expect(contain1.deleteDatabase("badName")).eventually.rejectedWith("no such database");
      await contain1.deleteDatabase("testBim2");
    });

    expect(contain1.queryDatabase("testBim2")).undefined;
    expect(contain1.queryDatabases().length).equals(2);

    contain1.disconnect();
    await azSqlite.setSasToken(contain1, false); // don't ask for delete permission
    contain1.connect(caches[1]);
    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      await expect(contain1.cleanDeletedBlocks()).eventually.rejectedWith("not authorized").property("errorNumber", 403);
    });

    contain1.disconnect();
    await azSqlite.setSasToken(contain1, true); // now ask for delete permission
    contain1.connect(caches[1]);

    await CloudSqlite.withWriteLock(user1, contain1, async () => contain1.cleanDeletedBlocks());
    expect(contain1.garbageBlocks).equals(0); // should successfully purge

    // should be connected
    expect(contain1.isConnected);

    // can't connect two containers with same name
    const cont2 = azSqlite.makeContainer(contain1.containerId, false);

    await azSqlite.setSasToken(cont2, true);

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
    await CloudSqlite.withWriteLock(user1, contain1, async () => {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      expect(() => cont2.acquireWriteLock(user1)).throws("is currently locked").property("errorNumber", DbResult.BE_SQLITE_BUSY);
    });

    // test busy retry handler
    let retries = 0;
    await CloudSqlite.withWriteLock(user2, cont2, async () => {
      await expect(CloudSqlite.withWriteLock(user1, contain1, async () => { }, async (lockedBy: string, expires: string) => {
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
    await azSqlite.setSasToken(contain1, false); // get a read-only token
    contain1.connect(caches[0]); // connect works with readonly token
    expect(contain1.isConnected);
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => contain1.acquireWriteLock(user1)).throws("not authorized").property("errorNumber", DbResult.BE_SQLITE_AUTH);
    expect(contain1.hasWriteLock).false;
    expect(contain1.hasLocalChanges).false;

    // try anonymous access
    const anonContainer = testContainers[2];
    anonContainer.accessToken = "";
    anonContainer.connect(caches[0]);
    dbs = anonContainer.queryDatabases();
    expect(dbs.length).equals(2);
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => anonContainer.acquireWriteLock(user1)).throws("not authorized").property("errorNumber", DbResult.BE_SQLITE_AUTH);

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

