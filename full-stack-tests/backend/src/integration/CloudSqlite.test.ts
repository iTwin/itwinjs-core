/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect, use as useFromChai } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { existsSync, removeSync } from "fs-extra";
import { join } from "path";
import * as sinon from "sinon";
import { _nativeDb, BlobContainer, BriefcaseDb, CloudSqlite, IModelHost, IModelJsFs, KnownLocations, PropertyStore, SnapshotDb, SQLiteDb } from "@itwin/core-backend";
import { KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { assert, BeDuration, DbResult, Guid, GuidString, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests

// spell:ignore localstore itwindb

useFromChai(chaiAsPromised);

describe("CloudSqlite", () => {
  const azSqlite = AzuriteTest.Sqlite;
  let caches: CloudSqlite.CloudCache[];
  let testContainers: AzuriteTest.Sqlite.TestContainer[];
  let testBimGuid: GuidString;
  let testBimFileName: string;
  const user1 = "CloudSqlite test1";
  const user2 = "CloudSqlite test2";

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    testContainers = await azSqlite.createContainers([
      { containerId: "test1", logId: "logId-1" },
      { containerId: "test2" },
      { containerId: "test3", logId: "logId-3", isPublic: true },
      { containerId: "test1", logId: "logId-1", lockExpireSeconds: 5 },
      { containerId: "test1", logId: "logId-1", lockExpireSeconds: 60 },

    ]);
    caches = azSqlite.makeCaches(["cache1", "cache2"]);
    azSqlite.initializeContainers(testContainers);

    expect(caches[0].isDaemon).false;

    testBimFileName = join(KnownTestLocations.assetsDir, "test.bim");
    const imodel = SnapshotDb.openFile(testBimFileName);
    testBimGuid = imodel.iModelId;
    imodel.close();

    const tempDbFile = join(KnownLocations.tmpdir, "TestWorkspaces", "testWs.db");
    if (existsSync(tempDbFile))
      removeSync(tempDbFile);

    PropertyStore.PropertyDb.createNewDb(tempDbFile);

    await azSqlite.uploadFile(testContainers[0], caches[0], "c0-db1:0", tempDbFile);
    await azSqlite.uploadFile(testContainers[0], caches[0], "testBim", testBimFileName);
    await azSqlite.uploadFile(testContainers[1], caches[0], "c1-db1:2.1", tempDbFile);
    await azSqlite.uploadFile(testContainers[1], caches[0], "testBim", testBimFileName);
    await azSqlite.uploadFile(testContainers[2], caches[0], "c2-db1", tempDbFile);
    await azSqlite.uploadFile(testContainers[2], caches[0], "testBim", testBimFileName);
  });
  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("should query bcvHttpLog", async () => {
    const c1Props = { containerId: testContainers[0].containerId, baseUri: AzuriteTest.baseUri, userToken: "" };
    let metadata = await AzuriteTest.service.queryMetadata(c1Props);
    let json = metadata.json!;

    expect(json.blockSize).equal("64K");
    await AzuriteTest.service.updateJson(c1Props, { blockSize: "128K", newProp: true });
    metadata = await AzuriteTest.service.queryMetadata(c1Props);
    json = metadata.json!;
    expect(json.blockSize).equal("128K");
    expect(json.newProp).equal(true);
    expect(metadata.containerType).equal("cloud-sqlite");

    testContainers[0].connect(caches[1]);

    let rows = testContainers[0].queryHttpLog();
    expect(rows.length).to.equal(2); // manifest and bcv_kv GETs.

    // endTime to exclude these first 2 entries in later queries.
    await BeDuration.wait(10);
    const endTime = new Date().toISOString();

    rows = testContainers[0].queryHttpLog({ startFromId: 2 });
    expect(rows.length).to.equal(1);
    expect(rows[0].id).to.equal(2);

    await CloudSqlite.withWriteLock({ user: "test", container: testContainers[0] }, async () => {
      await CloudSqlite.uploadDb(testContainers[0], { localFileName: testBimFileName, dbName: "newDbName" });
    });

    // 6 entries added by uploading db.
    // 2 entries from before. Expect 6 total entries because we're filtering by endTime from before.
    rows = testContainers[0].queryHttpLog({ finishedAtOrAfterTime: endTime, startFromId: 1 });
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = testContainers[0].queryHttpLog({ finishedAtOrAfterTime: endTime });
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = testContainers[0].queryHttpLog({ finishedAtOrAfterTime: endTime, startFromId: 1, showOnlyFinished: true });
    expect(rows.length).to.equal(6);
    expect(rows.find((value) => {
      return value.id === 1 || value.id === 2;
    })).to.equal(undefined);

    rows = testContainers[0].queryHttpLog({ showOnlyFinished: true });
    expect(rows.length).to.equal(8);

    rows = testContainers[0].queryHttpLog({ startFromId: 4, showOnlyFinished: true });
    expect(rows.length).to.equal(5);

    // Clean up.
    await CloudSqlite.withWriteLock({ user: "test", container: testContainers[0] }, async () => {
      await testContainers[0].deleteDatabase("newDbName");
    });

    testContainers[0].disconnect({ detach: true });

  });

  it("should pass cloudSqliteLogId through container to database", async () => {
    testContainers[0].connect(caches[1]);
    let db = SnapshotDb.openFile("testBim", { container: testContainers[0] });
    db.withPreparedSqliteStatement("PRAGMA bcv_client", (stmt) => {
      stmt.step();
      // cloudsqlitelogid of "logId-1" passed to testContainers[0] so expect logId-1
      expect(stmt.getValueString(0)).equal("logId-1");
    });
    db.close();
    testContainers[0].disconnect({ detach: true });

    testContainers[1].connect(caches[1]);
    db = SnapshotDb.openFile("testBim", { container: testContainers[1] });
    db.withPreparedSqliteStatement("PRAGMA bcv_client", (stmt) => {
      stmt.step();
      // no cloudsqlitelogid provided to this container so undefined and expect the default of empty string
      expect(stmt.getValueString(0)).equal("");
    });
    db.close();
    testContainers[1].disconnect({ detach: true });

    const containerId = Guid.createValue();
    const container = (await azSqlite.createContainers([{ containerId, logId: "" }]))[0];
    azSqlite.initializeContainers([container]);
    await azSqlite.uploadFile(container, caches[1], "testBim", testBimFileName);
    container.connect(caches[1]);
    db = SnapshotDb.openFile("testBim", { container });
    db.withPreparedSqliteStatement("PRAGMA bcv_client", (stmt) => {
      // empty string provided to container for cloudsqlitelogid so expect empty string
      expect(stmt.getValueString(0)).equal("");
    });
    db.close();
    container.disconnect({ detach: true });
  });

  it("writeLockExpires getter", async () => {
    const container = testContainers[0];
    container.connect(caches[1]);
    let writeLockExpiryTimeNoWriteLock = container.writeLockExpires; // Should be empty string when no write lock.
    expect(writeLockExpiryTimeNoWriteLock).to.equal("");
    await CloudSqlite.withWriteLock({user: "testuser", container}, async () => {
      const firstWriteLockExpiryTime = Date.parse(container.writeLockExpires);
      await BeDuration.wait(500); // sleep 500ms so we get a new write lock expiry time.
      await CloudSqlite.withWriteLock({user: "testuser", container}, async () => {
        const secondWriteLockExpiryTime = Date.parse(container.writeLockExpires);
        expect(secondWriteLockExpiryTime).to.be.greaterThanOrEqual(firstWriteLockExpiryTime);
        // subtract 30 minutes and make sure its less than the first write lock expiry time.
        // This tests that the secondWriteLockExpiryTime is a 'refresh' of the default expiry time of 1 hour.
        // and not extending the expiry time already present by another hour.
        // If it were extending the default expiry time of 1 hour, then second writelockexpirytime would be over 1 hour in the future
        // and the below assert would fail.
        expect(secondWriteLockExpiryTime - (30 * 60 * 1000)).to.be.lessThan(firstWriteLockExpiryTime);
      });
    });
    writeLockExpiryTimeNoWriteLock = container.writeLockExpires; // Should be empty string when no write lock.
    expect(writeLockExpiryTimeNoWriteLock).to.equal("");
    container.disconnect({detach: true});
  });

  it("Should a single user upload changes successfully even if write lock expires", async () => {
    const testContainer1 = testContainers[0];
    const testCache = azSqlite.makeCaches(["testCache"])[0];
    testContainer1.connect(testCache);
    testContainer1.acquireWriteLock(user1);
    await testContainer1.copyDatabase("testBim", "testBimCopy");
    const db = await BriefcaseDb.open({ fileName: "testBimCopy", container: testContainer1 });
    db.saveFileProperty({ name: "logMask", namespace: "logMaskTest", id: 1, subId: 1 }, "this is a test");
    db.close();
    // set the expires time to five mins earlier, which avoids waiting for 5 mins here.
    await azSqlite.setWriteLockToExpired(testContainer1, "bcv_kv.bcv");
    await expect(testContainer1.uploadChanges()).to.eventually.be.fulfilled;
    testContainer1.disconnect();
  });

  it("Should user1 fail to upload changes if user2 holds write lock after user1's expiration time", async () => {
    // simulate two users in two processes
    // test container 1 and test container 2 are actually the same cloud container
    const testContainer1 = testContainers[3];
    const testContainer2 = testContainers[4];
    expect(testContainer1.containerId).equal(testContainer2.containerId);
    expect(testContainer1.baseUri).equal(testContainer2.baseUri);
    const testCache1 = azSqlite.makeCaches(["testCache1"])[0];
    const testCache2 = azSqlite.makeCaches(["testCache2"])[0];
    // user1 grabs the write lock, make some changes but don't release the write lock
    // after a specific amount of time, the write lock expires
    testContainer1.connect(testCache1);
    testContainer1.acquireWriteLock(user1);
    await testContainer1.copyDatabase("testBim", "testBimCopy1");
    const db1 = await BriefcaseDb.open({ fileName: "testBimCopy1", container: testContainer1 });
    db1.saveFileProperty({ name: "logMask", namespace: "logMaskTest", id: 1, subId: 1 }, "this is a test");
    db1.close();
    // set the expires time to five mins earlier, which avoids waiting for 5 mins here.
    await azSqlite.setWriteLockToExpired(testContainer1, "bcv_kv.bcv");
    // user2 grabs the write lock
    testContainer2.connect(testCache2);
    testContainer2.acquireWriteLock(user2);
    // user1 tries to upload changes, it should fail because user1's write lock has expired and user2 is using it
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    expect(() => testContainer1.uploadChanges()).to.throw(`Container [${testContainer1.containerId}] is currently locked by another user`);
    testContainer1.disconnect();
    testContainer2.disconnect();
  });

  it("should query bcv stat table", async () => {
    const cache = azSqlite.makeCache("bcv-stat-cache");
    const container = testContainers[0];
    container.connect(cache);

    const checkOptionalReturnValues = (bcvStats: CloudSqlite.BcvStats, expectDefined: boolean) => {
      if (expectDefined) {
        expect(bcvStats.activeClients).to.not.be.undefined;
        expect(bcvStats.attachedContainers).to.not.be.undefined;
        expect(bcvStats.ongoingPrefetches).to.not.be.undefined;
        expect(bcvStats.totalClients).to.not.be.undefined;
      } else {
        expect(bcvStats.activeClients).to.be.undefined;
        expect(bcvStats.attachedContainers).to.be.undefined;
        expect(bcvStats.ongoingPrefetches).to.be.undefined;
        expect(bcvStats.totalClients).to.be.undefined;
      }
    };
    let stats = container.queryBcvStats();
    checkOptionalReturnValues(stats, false);
    stats = container.queryBcvStats({addClientInformation: false});
    checkOptionalReturnValues(stats, false);
    expect(cache.isDaemon).to.be.false;
    // daemonless is always 0 locked blocks.
    expect(stats.lockedCacheslots).to.equal(0);
    // we haven't opened any databases yet, so have 0 entries in the cache.
    expect(stats.populatedCacheslots).to.equal(0);
    // 10 gb in bytes, current cache size defined by this test suite.
    const tenGb = 10 * (1024 * 1024 * 1024);
    // 64 kb, current block size defined by this test suite.
    const blockSize = 64 * 1024;
    // totalCacheslots is the number of entries allowed in the cachefile.
    expect(stats.totalCacheslots).to.equal(tenGb / blockSize);

    const dbs = container.queryDatabases();
    expect(dbs.length).to.be.greaterThanOrEqual(1);
    let db = container.queryDatabase(dbs[0]);
    expect(db !== undefined).to.be.true;
    expect(db!.localBlocks).to.equal(0);
    const prefetch = CloudSqlite.startCloudPrefetch(container, dbs[0]);
    await prefetch.promise;
    // Check bcv stats again after prefetching a database.
    db = container.queryDatabase(dbs[0]);
    expect(db!.localBlocks).to.equal(db!.totalBlocks);
    stats = container.queryBcvStats({addClientInformation: true});
    checkOptionalReturnValues(stats, true);
    expect(stats.lockedCacheslots).to.equal(0);
    expect(stats.populatedCacheslots).to.equal(db!.totalBlocks);
    expect(stats.totalCacheslots).to.equal(tenGb / blockSize);
    container.disconnect({detach: true});
  });

  it("cloud containers", async () => {
    expect(undefined !== caches[0]);

    const contain1 = testContainers[0];
    contain1.connect(caches[1]); // connect it to the second cloudCache
    expect(contain1.isConnected);
    expect(contain1.storageType).equals("azure");
    expect(contain1.baseUri).equals(AzuriteTest.baseUri);

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
    expect(db[_nativeDb].cloudContainer).equals(contain1);
    db.closeDb();
    expect(db[_nativeDb].cloudContainer).undefined;

    dbProps = contain1.queryDatabase(dbs[0]);
    assert(dbProps !== undefined);
    expect(dbProps.totalBlocks).greaterThan(0);

    let imodel = SnapshotDb.openFile("testBim", { container: contain1 });
    expect(imodel.getBriefcaseId()).equals(0);
    expect(imodel.iModelId).equals(testBimGuid);
    imodel.close();

    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      await expect(contain1.copyDatabase("badName", "bad2")).eventually.rejectedWith("no such database");
      await contain1.copyDatabase("testBim", "testBim2");
    });

    expect(contain1.queryDatabases().length).equals(3);

    await expect(BriefcaseDb.open({ fileName: "testBim2", container: contain1 })).rejectedWith("write lock not held");
    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      expect(contain1.hasWriteLock).to.be.true;
      await CloudSqlite.withWriteLock({user: user1, container: contain1 }, async () => {
        expect(contain1.hasWriteLock).to.be.true;
      });
      expect(contain1.hasWriteLock).to.be.true; // Make sure that nested withWriteLocks with the same user don't release the write lock.
      const briefcase = await BriefcaseDb.open({ fileName: "testBim2", container: contain1 });
      expect(briefcase.getBriefcaseId()).equals(0);
      expect(briefcase.iModelId).equals(testBimGuid);
      expect(briefcase[_nativeDb].cloudContainer).equals(contain1);
      briefcase.close();
    });

    await db.withLockedContainer({ user: user1, container: contain1, dbName: "testBim2" }, async () => {
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

    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      await contain1.copyDatabase("testBim", "testBim33");
      await contain1.deleteDatabase("testBim2");
      expect(contain1.hasLocalChanges).true;
      contain1.abandonChanges();
    });
    expect(contain1.hasLocalChanges).false;
    expect(contain1.queryDatabases().length).equals(3);
    expect(contain1.queryDatabase("testBim33")).undefined;
    expect(contain1.queryDatabase("testBim2")).not.undefined;

    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      await expect(contain1.deleteDatabase("badName")).eventually.rejectedWith("no such database");
      await contain1.deleteDatabase("testBim2");
    });

    expect(contain1.queryDatabase("testBim2")).undefined;
    expect(contain1.queryDatabases().length).equals(2);

    contain1.disconnect();
    await azSqlite.setSasToken(contain1, "read"); // don't ask for delete permission
    contain1.connect(caches[1]);
    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      // need nSeconds 0 or the blocks of the database we just deleted won't be deleted.
      await expect(CloudSqlite.cleanDeletedBlocks(contain1, { nSeconds: 0 })).eventually.rejectedWith("delete block failed (403)");
    });

    contain1.disconnect();
    await azSqlite.setSasToken(contain1, "admin"); // now ask for delete permission
    contain1.connect(caches[1]);

    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => CloudSqlite.cleanDeletedBlocks(contain1, {nSeconds: 0}));
    expect(contain1.garbageBlocks).equals(0); // should successfully purge

    // should be connected
    expect(contain1.isConnected);

    // can't connect two containers with same name
    const cont2 = await azSqlite.makeContainer({ containerId: contain1.containerId, isPublic: false });
    await azSqlite.setSasToken(cont2, "write");

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
    await CloudSqlite.withWriteLock({ user: user1, container: contain1 }, async () => {
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      expect(() => cont2.acquireWriteLock(user1)).throws("is currently locked").property("errorNumber", DbResult.BE_SQLITE_BUSY);
    });

    // test busy retry handler
    let retries = 0;
    await CloudSqlite.withWriteLock({ user: user2, container: cont2 }, async () => {
      await expect(CloudSqlite.withWriteLock({
        user: user1,
        container: contain1,
        busyHandler: async (lockedBy: string, expires: string) => {
          expect(lockedBy).equals(user2);
          expect(expires.length).greaterThan(0);
          return ++retries < 5 ? undefined : "stop";
        },
      }, async () => { })).rejectedWith("is currently locked");
    });
    expect(retries).equals(5); // retry handler should be called 5 times

    cont2.disconnect({ detach: true });
    contain1.disconnect({ detach: true });

    // can't connect with invalid token
    contain1.accessToken = "bad";
    expect(() => contain1.connect(caches[0])).throws("403").property("errorNumber", 403);

    // Now attempt to obtain the write lock with a token that doesn't authorize it, expecting auth error
    await azSqlite.setSasToken(contain1, "read"); // get a read-only token
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

    // destroying a cache disconnects all connected containers
    const testDestroyDisconnects = false; // this causes problems due to refresh timers. Re-enable when next addon is build
    if (testDestroyDisconnects) {
      expect(contain1.isConnected).true;
      expect(anonContainer.isConnected).true;
    } else {
      contain1.disconnect();
      anonContainer.disconnect();
    }

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

  it("should be able to interrupt cleanDeletedBlocks operation", async () => {
    const cache = azSqlite.makeCache("clean-blocks-cache");
    const container = testContainers[0];

    const dbName = "testBimForCleaningBlocks";

    const pathToCopy = join(KnownLocations.tmpdir, `${dbName}`);

    if (IModelJsFs.existsSync(pathToCopy))
      IModelJsFs.removeSync(pathToCopy);
    const sqliteDb = new SQLiteDb();
    sqliteDb.createDb(pathToCopy, undefined, { rawSQLite: true });
    sqliteDb.executeSQL("CREATE TABLE TestData(id INTEGER PRIMARY KEY,val BLOB)");
    // Insert 16mb so we have some data to delete.
    sqliteDb.executeSQL(`INSERT INTO TestData(id,val) VALUES (1, randomblob(1024*1024*16))`);

    sqliteDb.saveChanges();
    sqliteDb.closeDb();
    await azSqlite.setSasToken(container, "write"); // get a write token to be able to upload.
    await azSqlite.uploadFile(container, cache, dbName, pathToCopy);

    container.connect(cache);
    const dbs = container.queryDatabases();
    expect(dbs.length).to.be.greaterThanOrEqual(1);
    const db = container.queryDatabase(dbName);
    expect(db !== undefined).to.be.true;

    expect(container.garbageBlocks).to.be.equal(0);
    container.acquireWriteLock("testuser");
    await container.deleteDatabase(dbName);
    await container.uploadChanges();
    expect(container.queryDatabase(dbName)).to.be.undefined;

    expect(container.garbageBlocks).to.be.greaterThan(0);
    const garbageBlocksPrev = container.garbageBlocks;

    // cleanDeletedBlocks defaults to an nSeconds of 3600, so we expect to keep our garbage blocks, because they are less than 3600 seconds old.
    await CloudSqlite.cleanDeletedBlocks(container, {});
    expect(container.garbageBlocks).to.be.equal(garbageBlocksPrev);

    // Upload dummy block to simulate an orphaned block.
    const blockName = await azSqlite.uploadDummyBlock(container, 24);
    // findOrphanedBlocks is false, so we expect to keep our dummy block.
    await CloudSqlite.cleanDeletedBlocks(container, {findOrphanedBlocks: false});
    await expect(azSqlite.checkBlockExists(container, blockName)).to.eventually.become(true);
    // findOrphanedBlocks is true, so we expect to remove our dummy block.
    await CloudSqlite.cleanDeletedBlocks(container, {findOrphanedBlocks: true});
    await expect(azSqlite.checkBlockExists(container, blockName)).to.eventually.become(false);

    expect(container.garbageBlocks).to.be.equal(garbageBlocksPrev);

    const onProgress = sinon.stub();
    onProgress.onFirstCall().returns(2);

    // Faking the interval setup in cleanDeletedBlocks.
    const clock = sinon.useFakeTimers({toFake: ["setInterval"], shouldAdvanceTime: true, advanceTimeDelta: 1});
    let resolved = false;
    CloudSqlite.cleanDeletedBlocks(container, {nSeconds: 0, findOrphanedBlocks: true, onProgress}).then(() => {
      resolved = true;
    }).catch(() => {
      resolved = true;
    });

    while (!resolved) {
      await clock.tickAsync(250);
      await new Promise((resolve) => clock.setTimeout(resolve, 1));
    }
    container.checkForChanges();

    expect(onProgress.called).to.be.true;
    // We aborted our cleanup, so expect no progress to be shown.
    expect(container.garbageBlocks).to.be.equal(garbageBlocksPrev);

    resolved = false;
    clock.reset();
    clock.restore();

    onProgress.reset();
    onProgress.returns(0);
    // One final clean that we don't interrupt ( because we always return 0 from onProgress)
    await CloudSqlite.cleanDeletedBlocks(container, {nSeconds: 0, onProgress});
    container.checkForChanges();
    expect(container.garbageBlocks).to.be.equal(0);

    container.releaseWriteLock();
    container.disconnect({detach: true});
  });

  /** make sure that the auto-refresh for container tokens happens every hour */
  it("Auto refresh container tokens", async () => {
    const contain1 = testContainers[0];

    const contProps = { baseUri: AzuriteTest.baseUri, containerId: contain1.containerId, storageType: AzuriteTest.storageType, writeable: true };
    // must be valid token so property store can connect
    const accessToken = await CloudSqlite.requestToken(contProps);

    let refreshedToken = "refreshed token";
    sinon.stub(CloudSqlite, "requestToken").callsFake(async () => refreshedToken);

    const clock = sinon.useFakeTimers(); // must be before creating PropertyStore container
    const ps1 = new PropertyStore.CloudAccess({ ...contProps, accessToken });
    const c1 = ps1.container as CloudSqlite.CloudContainer & { refreshPromise?: Promise<void> };
    expect(c1.accessToken).equals(accessToken);

    // test that the token is refreshed every hour, 24 times
    for (let i = 0; i < 24; i++) {
      clock.tick(60 * 60 * 1000); // advance clock by 1 hour so token is auto-refreshed

      // token refresh happens on a timer, but is async. Normally that's fine - it doesn't matter when it finishes.
      // But for this test we have to wait for it to finish so we can check the new token value.
      await c1.refreshPromise; // wait for refresh to finish, if it's pending (note: promise can be undefined, that's fine - await does nothing)

      expect(c1.accessToken).equal(refreshedToken);
      refreshedToken = `refreshed ${i + 1} times`; // change the token for the next refresh
    }

    ps1.close(); // kills the timer that's using fake clock. Must be before restoring sinon stubs
    clock.restore();
    sinon.restore();
  });

  it("should throw error if BlobContainer.service is undefined", async () => {
    const contain1 = testContainers[0];
    const contProps = { baseUri: AzuriteTest.baseUri, containerId: contain1.containerId, storageType: AzuriteTest.storageType, writeable: true };

    const service = BlobContainer.service;
    BlobContainer.service = undefined; // ensures the service is un-instantiated
    await expect(CloudSqlite.requestToken(contProps)).to.be.rejectedWith("BlobContainer.service is not defined");
    BlobContainer.service = service;
  });
});

