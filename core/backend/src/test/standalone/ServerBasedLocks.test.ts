/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { IModel, IModelError, LocalBriefcaseProps, RequestNewBriefcaseProps } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager } from "../../BriefcaseManager";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { HubMock } from "../HubMock";
import { ExtensiveTestScenario, IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { restore as sinonRestore, spy as sinonSpy } from "sinon";

describe.only("Server-based locks", () => {
  const createRev0 = async () => {
    const dbName = IModelTestUtils.prepareOutputFile("ServerBasedLocks", "ServerBasedLocks.bim");
    const sourceDb = SnapshotDb.createEmpty(dbName, { rootSubject: { name: "TestIModelTransformer-Source" } });
    assert.isFalse(sourceDb.locks.isServerBased);
    await ExtensiveTestScenario.prepareDb(sourceDb);
    ExtensiveTestScenario.populateDb(sourceDb);
    sourceDb.saveChanges();
    return dbName;
  };

  let iModelId: GuidString;
  let user1: AuthorizedClientRequestContext;
  let user2: AuthorizedClientRequestContext;
  let briefcase1Props: LocalBriefcaseProps;
  let briefcase2Props: LocalBriefcaseProps;

  afterEach(() => sinonRestore());
  before(async () => {
    HubMock.startup("ServerBasedLocks");

    const iModelProps = {
      iModelName: "server locks test",
      iTwinId: Guid.createValue(),
      revision0: await createRev0(),
    };

    iModelId = await IModelHost.hubAccess.createNewIModel(iModelProps);
    user1 = await IModelTestUtils.getUserContext(TestUserType.Regular);
    user2 = await IModelTestUtils.getUserContext(TestUserType.Regular);
    const args: RequestNewBriefcaseProps = { contextId: iModelProps.iTwinId, iModelId };
    briefcase1Props = await BriefcaseManager.downloadBriefcase(user1, args);
    briefcase2Props = await BriefcaseManager.downloadBriefcase(user2, args);

  });

  it("Acquiring locks", async () => {
    const lockSpy = sinonSpy(IModelHost.hubAccess, "acquireLocks");
    const bc1 = await BriefcaseDb.open(user1, { fileName: briefcase1Props.fileName });
    assert.isTrue(bc1.locks.isServerBased);
    const bc2 = await BriefcaseDb.open(user2, { fileName: briefcase2Props.fileName });
    assert.isTrue(bc2.locks.isServerBased);
    const child1 = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1A");
    const childProps = bc1.elements.getElementProps(child1);

    await bc1.acquireSchemaLock();
    assert.isTrue(bc1.holdsSchemaLock);
    assert.isTrue(bc1.locks.holdsExclusiveLock(IModel.dictionaryId));
    assert.isTrue(bc1.locks.holdsSharedLock(child1)); // if you hold the schema lock, all elements are implicitly locked
    assert.isTrue(bc1.locks.holdsExclusiveLock(child1));
    assert.equal(lockSpy.callCount, 1);

    assert.isFalse(bc2.holdsSchemaLock);
    await expect(bc2.acquireSchemaLock()).to.eventually.be.rejectedWith(IModelError, "lock is already held", "acquire schema exclusive");
    await expect(bc2.locks.acquireSharedLock(childProps.model)).to.eventually.be.rejectedWith(IModelError, "lock is already held");

    await bc1.locks.releaseAllLocks();
    lockSpy.resetHistory();

    await bc1.locks.acquireSharedLock(child1);
    assert.equal(lockSpy.callCount, 1);
    assert.equal(lockSpy.getCall(0).args[1].size, 5);

    assert.isTrue(bc1.locks.holdsSharedLock(child1));
    assert.isTrue(bc1.locks.holdsSharedLock(childProps.parent!.id));
    assert.isTrue(bc1.locks.holdsSharedLock(childProps.model));
    assert.isTrue(bc1.locks.holdsSharedLock(IModel.rootSubjectId));
    await bc1.locks.acquireExclusiveLock(child1);
    assert.equal(lockSpy.callCount, 2);
    await bc1.locks.acquireExclusiveLock(child1);
    assert.equal(lockSpy.callCount, 2); // should not need to call server on a lock already held
    assert.isTrue(bc1.locks.holdsSharedLock(childProps.model));
    assert.isTrue(bc1.locks.holdsSharedLock(IModel.rootSubjectId));

    await expect(bc2.acquireSchemaLock()).to.eventually.be.rejectedWith(IModelError, "element is locked with shared");
    assert.equal(lockSpy.callCount, 3);
    await expect(bc2.locks.acquireExclusiveLock(childProps.parent!.id)).to.eventually.be.rejectedWith(IModelError, "element is locked with shared");
    assert.equal(lockSpy.callCount, 4);
    await bc2.locks.acquireSharedLock(childProps.parent!.id);
    assert.equal(lockSpy.callCount, 5);
    assert.isTrue(bc2.locks.holdsSharedLock(IModel.rootSubjectId));
    await bc2.locks.acquireSharedLock(IModel.dictionaryId);
    assert.equal(lockSpy.callCount, 6);
    assert.isTrue(bc2.locks.holdsSharedLock(IModel.dictionaryId));
  });
});
