/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, KnownTestLocations } from "..";
import { ChannelControl, IModelHost } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { Suite } from "mocha";
chai.use(chaiAsPromised);

describe("apply changesets", function (this: Suite) {
  before(async () => {
    await IModelHost.startup();
  });
  it("Apply changeset with no local changes, should not create new local changes", async () => {
    HubMock.startup("PullMergeMethod", KnownTestLocations.outputDir);

    const iModelId = await HubMock.createNewIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject" });

    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b1.saveChanges();
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b2.saveChanges();

    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="Test3dElement">
            <BaseClass>Test2dElement</BaseClass>
            <ECProperty propertyName="k" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;

    await b1.importSchemaStrings([schema]);
    b1.saveChanges("b1");
    await b1.pushChanges({ description: "b1" });
    await b2.pullChanges();
    chai.expect(b2.txns.hasPendingTxns).to.be.false;

    b1.close();
    b2.close();

    HubMock.shutdown();
  });
});
