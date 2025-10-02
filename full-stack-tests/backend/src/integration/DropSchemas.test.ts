/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, BriefcaseManager, IModelHost, SnapshotDb } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { expect } from "chai";

describe("Drop schemas", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("multi user workflow", async () => {
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "dropschemas" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "dropschemas", noLocks: true });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
        <ECEntityClass typeName="Pipe2">
            <BaseClass>Pipe1</BaseClass>
            <ECProperty propertyName="p3" typeName="int" />
            <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);
    b1.getJsClass("TestSchema1:Pipe1");
    b1.getJsClass("TestSchema1:Pipe2");
    b1.saveChanges();
    await b1.pushChanges({ description: "pushed TestSchema1" });
    await b1.dropSchemas(["TestSchema1"]);
    b1.saveChanges();
    await b1.pushChanges({ description: "drop TestSchema1" });

    b1.clearCaches();
    expect(() => b1.getJsClass("TestSchema1:Pipe1")).to.throw();
    expect(() => b1.getJsClass("TestSchema1:Pipe2")).to.throw();


    await b2.pullChanges();
    expect(() => b2.getJsClass("TestSchema1:Pipe1")).to.throw();
    expect(() => b2.getJsClass("TestSchema1:Pipe2")).to.throw();

    b1.close();
    b2.close();
    HubMock.shutdown();
  });
});
