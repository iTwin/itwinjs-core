/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, BriefcaseManager, CloudSqlite, HubMock, IModelDb, IModelHost, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid, OpenMode } from "@itwin/core-bentley";
const storageType = "azure" as const;

async function initializeContainer(containerProps: { containerId: string, isPublic?: boolean, baseUri: string }) {
  await AzuriteTest.Sqlite.createAzContainer(containerProps);
  const accessToken = await CloudSqlite.requestToken({ ...containerProps });
  await SchemaSync.CloudAccess.initializeDb({ ...containerProps, accessToken, storageType });
  return { ...containerProps, accessToken, storageType };
}

describe("Schema synchronization", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  const synchronizeSchemas = async (iModel: IModelDb) => {
    await SchemaSync.withLockedAccess(iModel, { openMode: OpenMode.Readonly, operationName: "schemaSync" }, async (syncAccess) => {
      const uri = syncAccess.getUri();
      iModel.nativeDb.schemaSyncPull(uri);
      iModel.clearCaches();
    });
  };

  it("multi user workflow", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1.nativeDb.schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2.nativeDb.schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b2 from shared schema channel
    await synchronizeSchemas(b2);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // add new properties in b2
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
    await b2.importSchemaStrings([schema2]);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b1 from shared schema channel
    await synchronizeSchemas(b1);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();

    HubMock.shutdown();
  });
  it("import same schema from different briefcase", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1a");
    SchemaSync.setTestCache(b2, "briefcase2a");
    SchemaSync.setTestCache(b3, "briefcase3a");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1.nativeDb.schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2.nativeDb.schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b2 from shared schema channel
    await synchronizeSchemas(b2);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // import same schema from another briefcase
    await b2.importSchemaStrings([schema1]);
    b2.saveChanges();

    // ensure b2 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // pull schema change into b1 from shared schema channel
    await synchronizeSchemas(b1);
    b1.saveChanges();

    // ensure b1 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();

    HubMock.shutdown();
  });
});

