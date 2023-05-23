/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import { Suite } from "mocha";
import { CloudSqlite, ECDb, IModelHost, SharedSchemaChannel, StandaloneDb } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { DbResult } from "@itwin/core-bentley";

// spell:ignore mkdirs

const blockSize = 64 * 1024;
const sharedSchemaChannelId = "shared-channel-1";

async function initializeSharedChannelDb(containerId: string): Promise<void> {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await SharedSchemaChannel.CloudAccess.initializeDb({ props: { ...props, accessToken }, initContainer: { blockSize } });
}

async function makeSharedChannelAccess(moniker: string): Promise<SharedSchemaChannel.CloudAccess> {
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId: sharedSchemaChannelId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const sharedStore = new SharedSchemaChannel.CloudAccess({ ...props, accessToken });
  sharedStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: moniker }));
  sharedStore.lockParams.moniker = moniker;
  return sharedStore;
}

function getCheckSum(db: StandaloneDb, type: "ecdb_schema" | "ecdb_map" | "sqlite_schema"): string {
  return db.withStatement(`PRAGMA checksum(${type})`, (stmt) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const val = stmt.getValue(0).getString();
    assert.isNotEmpty(val);
    stmt.dispose();
    return val;
  });
};
function getSchemaHashes(db: StandaloneDb) {
  return {
    eCDbSchema: getCheckSum(db, "ecdb_schema"),
    eCDbMap: getCheckSum(db, "ecdb_map"),
    sQLiteSchema: getCheckSum(db, "sqlite_schema"),
  };
};

function getTables(db: StandaloneDb): string[] {
  const results: string[] = [];
  db.withSqliteStatement("select sql from sqlite_master where type='table' and name like 'ec\\_%' escape '\\' order by name", (stmt) => {
    while (stmt.step() == DbResult.BE_SQLITE_ROW) {
      results.push(stmt.getValueString(0));
    }
  });
  return results;
}

describe("SharedSchemaChannel", () => {
  let sharedChannelAccess1: SharedSchemaChannel.CloudAccess;
  let sharedChannelAccess2: SharedSchemaChannel.CloudAccess;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeSharedChannelDb(sharedSchemaChannelId);

    sharedChannelAccess1 = await makeSharedChannelAccess("cloudAccess1");
    sharedChannelAccess2 = await makeSharedChannelAccess("cloudAccess2");
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  /**
   * 1. Initialize cloud sqlite
   * 2. get path to the cloud sqlite file
   * 3. create an iModel
   * 4. Imodel.nativeDb.sharedSchemaChannelInit(sharedSchemaChannelId)
   *  ca 1 for b1
   *  ca 2 for b2
   */
  it("access SyncDB", async () => {
    const sharedChannelReader1 = sharedChannelAccess1.reader;
    const sharedChannelWriter1 = sharedChannelAccess1.writeLocker;
    const channelUri = path.join(sharedChannelAccess1.getCache().rootDir, "cachefile.bcv");

    // const briefcase = sharedChannelReader1.createBriefcase("briefcase1", channelUri);
    const briefcase = await sharedChannelWriter1.createBriefcaseAsync("briefcase1", channelUri);
    console.log(getSchemaHashes(briefcase));

    assert.notDeepEqual(getTables(briefcase), sharedChannelReader1.getTables());

    // import schema1 in briefcase 1
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    briefcase.importSchemaStrings([schema1], channelUri);
    console.log(getSchemaHashes(briefcase));
    // const briefcaseTables = getTables(briefcase);
    // sharedChannelAccess1.synchronizeWithCloud();

    // import schema2 in briefcase 1
    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    briefcase.importSchemaStrings([schema2], channelUri);
    // briefcase.importSchemaStrings([schema2], sharedChannelUri);
    briefcase.saveChanges();
    console.log(getSchemaHashes(briefcase));
    // console.log(getTables(briefcase));
    // console.log(getTables(sharedChannelReader1));

    // const briefcaseResults = getTables(briefcase);
    // const sharedChannelResults = getTables(sharedChannelReader1);
    // assert.notDeepEqual(briefcaseResults, sharedChannelResults);

    // briefcase.close();
    sharedChannelAccess1.synchronizeWithCloud();
    const briefcaseTables = getTables(briefcase);
    const sharedChannelTables = sharedChannelReader1.getTables();
    assert.deepEqual(briefcaseTables, sharedChannelTables);

    briefcase.close();
    sharedChannelAccess1.close();
    sharedChannelAccess2.close();
  });

  it("shared channel init using SyncDB??", async () => {
    const sharedChannelReader1 = sharedChannelAccess1.reader;
    const sharedChannelWriter1 = sharedChannelAccess1.writeLocker;
    const channelUri = path.join(sharedChannelAccess1.getCache().rootDir, "shared-channel-1\\SyncDB");

    const briefcase = await sharedChannelWriter1.createBriefcaseAsync("briefcase1", channelUri);
    sharedChannelAccess1.synchronizeWithCloud();

    const briefcaseTables = getTables(briefcase);
    const sharedChannelTables = sharedChannelReader1.getTables();
    assert.deepEqual(briefcaseTables, sharedChannelTables);
    console.log(briefcaseTables);
    console.log(sharedChannelTables);

    briefcase.close();
    sharedChannelAccess1.close();
    sharedChannelAccess2.close();
  });

  it("Create sharedChannel in the cloud??", async () => {
    const sharedChannelReader1 = sharedChannelAccess1.reader;
    const sharedChannelWriter1 = sharedChannelAccess1.writeLocker;

    const channelUrl = path.join("http://127.0.0.1:10000/devstoreaccount1/shared-channel-1", "sharedChannel.ecdb");
    const channelDb = new ECDb();
    channelDb.createDb(channelUrl);
    channelDb.saveChanges();
    channelDb.closeDb();

    const briefcase = await sharedChannelWriter1.createUnlinkedBriefcaseAsync("briefcase1");
    briefcase.nativeDb.sharedChannelInit(channelUrl);

    sharedChannelAccess1.synchronizeWithCloud();

    const briefcaseTables = getTables(briefcase);
    const sharedChannelTables = sharedChannelReader1.getTables();
    // assert.deepEqual(briefcaseTables, sharedChannelTables);
    console.log(briefcaseTables);
    console.log(sharedChannelTables);

    briefcase.close();
    sharedChannelAccess1.close();
    sharedChannelAccess2.close();
  });

  it.only("direct insert", async () => {
    const sharedChannelReader1 = sharedChannelAccess1.reader;
    const sharedChannelWriter1 = sharedChannelAccess1.writeLocker;

    // const channelUri = path.join(sharedChannelAccess1.getCache().rootDir, "cachefile.bcv");
    // const briefcase = await sharedChannelWriter1.createBriefcaseAsync("briefcase1", channelUri);
    // const briefcase = await sharedChannelWriter1.createUnlinkedBriefcaseAsync("briefcase1");
    // briefcase.nativeDb.sharedChannelInit(channelUri);

    sharedChannelWriter1.addProperty("test-class-1");

    sharedChannelAccess1.synchronizeWithCloud();

    // const briefcaseTables = getTables(briefcase);
    // const sharedChannelTables = sharedChannelReader1.getTables();
    // assert.notDeepEqual(briefcaseTables, sharedChannelTables);
    // console.log(briefcaseTables);
    // console.log(sharedChannelTables);

    // briefcase.close();
    sharedChannelAccess1.close();
    sharedChannelAccess2.close();
  })

  it("Use sharedSchemaChannel to import schemas to cloudSqlite", async () => {
    const channel1Uri = path.join(sharedChannelAccess1.getCache().rootDir, "cachefile.bcv");
    const channel2Uri = path.join(sharedChannelAccess2.getCache().rootDir, "cachefile.bcv");
    const b1 = await sharedChannelAccess1.writeLocker.createBriefcaseAsync("briefcase1", channel1Uri);
    const b2 = await sharedChannelAccess2.writeLocker.createBriefcaseAsync("briefcase1", channel2Uri);

    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    b1.importSchemaStrings([schema1], channel1Uri);
    sharedChannelAccess1.synchronizeWithCloud();

    // import schema in briefcase 2
    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    sharedChannelAccess2.synchronizeWithCloud();
    b2.sharedChannelPull(channel2Uri);
    b2.importSchemaStrings([schema2], channel2Uri);

    sharedChannelAccess1.synchronizeWithCloud();
    b1.sharedChannelPull(channel1Uri);
    const b1Hashes = getSchemaHashes(b1);
    const b2Hashes = getSchemaHashes(b2);
    assert.deepEqual(b1Hashes, b2Hashes);

    const schema3 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.02" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
          <ECProperty propertyName="p5" typeName="int" />
          <ECProperty propertyName="p6" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    sharedChannelAccess1.synchronizeWithCloud();
    b1.importSchemaStrings([schema3], channel1Uri);

    b1.close();
    b2.close();
    sharedChannelAccess1.close();
    sharedChannelAccess2.close();
  });
});

