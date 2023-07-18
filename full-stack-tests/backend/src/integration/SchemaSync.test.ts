/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { CloudSqlite, HubMock, IModelHost, SchemaSync } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubWrappers, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { Guid } from "@itwin/core-bentley";

const containerId = "imodel-sync-itwin1";
const storageType = "azure" as const;

async function initializeContainer() {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props = { baseUri: AzuriteTest.baseUri, storageType, containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken({ baseUri: AzuriteTest.baseUri, storageType: "azure", containerId });
  await SchemaSync.CloudAccess.initializeDb({ ...props, accessToken });
}

async function makeSchemaSync(user: string) {
  const props = { baseUri: AzuriteTest.baseUri, storageType, containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const syncSchema = new SchemaSync.CloudAccess({ ...props, accessToken });
  syncSchema.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: user }));
  syncSchema.lockParams.user = user;
  return syncSchema;
}

describe("Schema synchronization", function (this: Suite) {
  this.timeout(0);

  let sds1: SchemaSync.CloudAccess;
  let sds2: SchemaSync.CloudAccess;
  let sds3: SchemaSync.CloudAccess;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer();

    sds1 = await makeSchemaSync("ss_b1");
    sds2 = await makeSchemaSync("ss_b2");
    sds3 = await makeSchemaSync("ss_b3");
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("multi user workflow", async () => {
    const iTwinId: string = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);

    const iModelName = "test iModel";
    const iModelId = await HubWrappers.createIModel(user1AccessToken, iTwinId, iModelName);

    const b1 = await HubWrappers.openBriefcaseUsingRpc({ accessToken: user1AccessToken, iTwinId, iModelId });
    const b2 = await HubWrappers.openBriefcaseUsingRpc({ accessToken: user2AccessToken, iTwinId, iModelId });
    const b3 = await HubWrappers.openBriefcaseUsingRpc({ accessToken: user3AccessToken, iTwinId, iModelId });

    b1.schemaSyncAccess = sds1;
    b2.schemaSyncAccess = sds2;
    b3.schemaSyncAccess = sds3;

    // initialize shared schema channel
    await b1.initSchemaSynchronization();
    b1.saveChanges();
    assert.isTrue(b1.isSchemaSyncEnabled);
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2.isSchemaSyncEnabled);

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
    b2.synchronizationSchemas();
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
    b1.synchronizationSchemas();
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
});

