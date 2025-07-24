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

    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    b3.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b3.saveChanges();

    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="a1">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="b1"> <BaseClass>a1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="b2"> <BaseClass>a1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="c1"> <BaseClass>b1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="c2"> <BaseClass>b1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="d1"> <BaseClass>b2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="d2"> <BaseClass>b2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="f1"> <BaseClass>d1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="f2"> <BaseClass>d1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="e1"> <BaseClass>d2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="e2"> <BaseClass>d2</BaseClass> </ECEntityClass>
    </ECSchema>`;

    await b1.importSchemaStrings([schema1]);
    b1.saveChanges("schema1");

    chai.expect(b1.txns.hasPendingTxns).to.be.true
    await b1.pushChanges({ description: "schema1" });
    chai.expect(b1.txns.hasPendingTxns).to.be.false

    chai.expect(b2.txns.hasPendingTxns).to.be.false
    await b2.pullChanges();
    chai.expect(b2.txns.hasPendingTxns).to.be.false;

    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain2" alias="ts1" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="a1">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="b1"> <BaseClass>a1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="b2"> <BaseClass>a1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="c1"> <BaseClass>b1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="c2"> <BaseClass>b1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="d1"> <BaseClass>b2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="d2"> <BaseClass>b2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="f1"> <BaseClass>d1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="f2"> <BaseClass>d1</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="e1"> <BaseClass>d2</BaseClass> </ECEntityClass>
        <ECEntityClass typeName="e2"> <BaseClass>d2</BaseClass> </ECEntityClass>
    </ECSchema>`;

    await b1.importSchemaStrings([schema2]);
    b1.saveChanges("schema2");

    chai.expect(b1.txns.hasPendingTxns).to.be.true
    await b1.pushChanges({ description: "schema2" });
    chai.expect(b1.txns.hasPendingTxns).to.be.false;


    chai.expect(b2.txns.hasPendingTxns).to.be.false
    await b2.pullChanges();
    chai.expect(b2.txns.hasPendingTxns).to.be.false;


    chai.expect(b3.txns.hasPendingTxns).to.be.false
    await b3.pullChanges();
    chai.expect(b3.txns.hasPendingTxns).to.be.false;


    b1.close();
    b2.close();
    b3.close();
    HubMock.shutdown();
  });
});
