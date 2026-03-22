/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "..";
import { _nativeDb, BriefcaseDb, BriefcaseManager, ChannelControl, IModelHost, Subject, SubjectOwnsSubjects } from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { Suite } from "mocha";
import { IModel, SchemaState, SubjectProps } from "@itwin/core-common";
import { Guid } from "@itwin/core-bentley";
import { TestEditTxn } from "../TestEditTxn";
chai.use(chaiAsPromised);

describe("apply changesets", function (this: Suite) {
  before(async () => {
    await IModelHost.startup();
  });

  it("Apply changeset with no local changes, should not create new local changes", async () => {
    HubMock.startup("PullMergeMethod", KnownTestLocations.outputDir);

    const iModelId = await HubMock.createNewIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject" });

    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    const b1Txn = new TestEditTxn(b1);
    b1Txn.start();
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b1Txn.saveChanges();

    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    const b2Txn = new TestEditTxn(b2);
    b2Txn.start();
    b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b2Txn.saveChanges();

    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId, noLock: true });
    const b3Txn = new TestEditTxn(b3);
    b3Txn.start();
    b3.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b3Txn.saveChanges();

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

    await b1Txn.importSchemaStrings([schema1]);
    b1Txn.saveChanges("schema1");

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

    await b1Txn.importSchemaStrings([schema2]);
    b1Txn.saveChanges("schema2");

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

  it("Pulling profile upgrade before inserting element should pass", async () => {
    // startup
    HubMock.startup("ProfileUpgradeBeforeInsertElement", KnownTestLocations.outputDir);

    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const iModelId = await HubWrappers.pushIModel("user1", HubMock.iTwinId, pathname, "Test", true);

    // inserting and updating elements in one briefcase
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    const b1Txn = new TestEditTxn(b1);
    b1Txn.start();
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b1Txn.saveChanges();

    // upgrading schemas in second briefcase
    const props = await BriefcaseManager.downloadBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    const schemaState = BriefcaseDb.validateSchemas(props.fileName, true);
    chai.assert(schemaState === SchemaState.UpgradeRecommended);
    await BriefcaseDb.upgradeSchemas({ fileName: props.fileName });
    await b1.pullChanges();

    await b1.locks.acquireLocks({
      shared: IModel.repositoryModelId,
    });
    const subjectProps: SubjectProps = {
      classFullName: Subject.classFullName,
      code: Subject.createCode(b1, IModel.rootSubjectId, "code value 1"),
      federationGuid: Guid.createValue(),
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsSubjects(IModel.rootSubjectId),
    };
    const subjectId = b1Txn.insertElement(subjectProps);
    b1Txn.saveChanges();
    await b1.pushChanges({ description: "Inserted Subject", retainLocks: true })

    const existingCode = b1.elements.getElementProps(subjectId).code;
    b1Txn.updateElement({
      id: subjectId,
      code: { ...existingCode, value: "code value 2" },
    });
    b1Txn.saveChanges();
    await b1.pushChanges({ description: "Updated Subject" });
    await b1.locks.releaseAllLocks();

    //cleanup
    b1.close();
    await HubMock.deleteIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    HubMock.shutdown()
  });

  it("Pulling profile upgrade after inserting element should pass", async () => {
    // startup
    HubMock.startup("ProfileUpgradeAfterInsertElement", KnownTestLocations.outputDir);

    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const iModelId = await HubWrappers.pushIModel("user1", HubMock.iTwinId, pathname, "Test", true);

    // inserting and updating elements in one briefcase
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    const b1Txn = new TestEditTxn(b1);
    b1Txn.start();
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    b1Txn.saveChanges();

    await b1.locks.acquireLocks({
      shared: IModel.repositoryModelId,
    });
    const subjectProps: SubjectProps = {
      classFullName: Subject.classFullName,
      code: Subject.createCode(b1, IModel.rootSubjectId, "code value 1"),
      federationGuid: Guid.createValue(),
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsSubjects(IModel.rootSubjectId),
    };
    const subjectId = b1Txn.insertElement(subjectProps);
    b1Txn.saveChanges();
    await b1.pushChanges({ description: "Inserted Subject", retainLocks: true })

    const existingCode = b1.elements.getElementProps(subjectId).code;
    b1Txn.updateElement({
      id: subjectId,
      code: { ...existingCode, value: "code value 2" },
    });
    b1Txn.saveChanges();
    await b1.pushChanges({ description: "Updated Subject" });
    await b1.locks.releaseAllLocks();

    // upgrading schemas in second briefcase
    const props = await BriefcaseManager.downloadBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    const schemaState = BriefcaseDb.validateSchemas(props.fileName, true);
    chai.assert(schemaState === SchemaState.UpgradeRecommended);
    await BriefcaseDb.upgradeSchemas({ fileName: props.fileName });
    await b1.pullChanges();

    await b1.locks.acquireLocks({
      shared: IModel.repositoryModelId,
    });
    const subjectProps2: SubjectProps = {
      classFullName: Subject.classFullName,
      code: Subject.createCode(b1, IModel.rootSubjectId, "code value 3"),
      federationGuid: Guid.createValue(),
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsSubjects(IModel.rootSubjectId),
    };
    b1Txn.insertElement(subjectProps2);
    b1Txn.saveChanges();
    await b1.pushChanges({ description: "Inserted Subject 2", retainLocks: true });
    await b1.locks.releaseAllLocks();

    //cleanup
    b1.close();
    await HubMock.deleteIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    HubMock.shutdown()
  });
});
