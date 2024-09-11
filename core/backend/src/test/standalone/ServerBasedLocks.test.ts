/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { restore as sinonRestore, spy as sinonSpy } from "sinon";
import { AccessToken, Guid, GuidString, Id64, Id64Arg } from "@itwin/core-bentley";
import { Code, IModel, IModelError, LocalBriefcaseProps, LockState, PhysicalElementProps, RequestNewBriefcaseProps } from "@itwin/core-common";
import { BriefcaseManager } from "../../BriefcaseManager";
import { PhysicalObject } from "../../domains/GenericElements";
import { PhysicalElement } from "../../Element";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { ElementOwnsChildElements } from "../../NavigationRelationship";
import { ServerBasedLocks } from "../../internal/ServerBasedLocks";
import { HubMock } from "../../HubMock";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ChannelControl } from "../../core-backend";
import { _releaseAllLocks } from "../../internal/Symbols";

const expect = chai.expect;
const assert = chai.assert;
chai.use(chaiAsPromised);

describe("Server-based locks", () => {
  const createVersion0 = async () => {
    const dbName = IModelTestUtils.prepareOutputFile("ServerBasedLocks", "ServerBasedLocks.bim");
    const sourceDb = SnapshotDb.createEmpty(dbName, { rootSubject: { name: "server lock test" } });
    assert.isFalse(sourceDb.locks.isServerBased);
    await ExtensiveTestScenario.prepareDb(sourceDb);
    ExtensiveTestScenario.populateDb(sourceDb);
    sourceDb.saveChanges();
    sourceDb.close();
    return dbName;
  };

  let iModelId: GuidString;
  let accessToken1: AccessToken;
  let accessToken2: AccessToken;
  let briefcase1Props: LocalBriefcaseProps;
  let briefcase2Props: LocalBriefcaseProps;

  afterEach(() => sinonRestore());
  before(async () => {
    HubMock.startup("ServerBasedLocks", KnownTestLocations.outputDir);

    const iModelProps = {
      iModelName: "server locks test",
      iTwinId: HubMock.iTwinId,
      version0: await createVersion0(),
    };

    iModelId = await HubMock.createNewIModel(iModelProps);
    const args: RequestNewBriefcaseProps = { iTwinId: iModelProps.iTwinId, iModelId };
    briefcase1Props = await BriefcaseManager.downloadBriefcase({ accessToken: "test token", ...args });
    briefcase2Props = await BriefcaseManager.downloadBriefcase({ accessToken: "test token2", ...args });
  });
  after(() => {
    HubMock.shutdown();
  });

  const assertSharedLocks = (locks: ServerBasedLocks, ids: Id64Arg) => {
    for (const id of Id64.iterable(ids))
      assert.isTrue(locks.holdsSharedLock(id));
  };
  const assertExclusiveLocks = (locks: ServerBasedLocks, ids: Id64Arg) => {
    assertSharedLocks(locks, ids);
    for (const id of Id64.iterable(ids))
      assert.isTrue(locks.holdsSharedLock(id));
  };
  const assertLockCounts = (locks: ServerBasedLocks, shared: number, exclusive: number) => {
    assert.equal(locks.getLockCount(LockState.Shared), shared);
    assert.equal(locks.getLockCount(LockState.Exclusive), exclusive);
  };

  it("Acquiring locks", async () => {
    const lockSpy = sinonSpy(IModelHost.hubAccess, "acquireLocks");
    let bc1 = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
    assert.isTrue(bc1.locks.isServerBased);
    bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    let bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
    assert.isTrue(bc2.locks.isServerBased);

    let bc1Locks = bc1.locks as ServerBasedLocks;
    let bc2Locks = bc2.locks as ServerBasedLocks;
    const child1 = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1A");
    const child2 = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1B");
    const childEl = bc1.elements.getElement<PhysicalElement>(child1);
    const parentId = childEl.parent!.id;
    const modelId = childEl.model;
    const modelProps = bc1.elements.getElementProps(modelId);
    const subjectId = modelProps.parent!.id;

    const sharedLockError = "shared lock is held";
    const exclusiveLockError = "lock is already held";

    await bc1.acquireSchemaLock();
    assert.equal(lockSpy.callCount, 1);
    assert.isTrue(bc1.holdsSchemaLock);
    assertLockCounts(bc1Locks, 0, 1);
    assertExclusiveLocks(bc1Locks, [IModel.dictionaryId, child1, parentId]); // even though we only hold 1 lock (the "schema" lock), every element should say it's locked

    await bc1Locks.acquireLocks({ exclusive: child1 }); // attempting to acquire exclusive lock on any element when schema lock is held shouldn't need a server request
    assert.equal(lockSpy.callCount, 1);

    assert.isFalse(bc2.holdsSchemaLock);
    await expect(bc2.acquireSchemaLock()).rejectedWith(IModelError, exclusiveLockError, "acquire schema exclusive");
    await expect(bc2Locks.acquireLocks({ shared: childEl.model })).rejectedWith(IModelError, exclusiveLockError);

    await bc1Locks[_releaseAllLocks]();
    await bc1Locks.acquireLocks({ exclusive: parentId, shared: parentId });
    assertLockCounts(bc1Locks, 3, 1);
    assertSharedLocks(bc1Locks, [modelId, IModel.rootSubjectId]);
    assertExclusiveLocks(bc1Locks, [parentId, child1, child2]); // acquiring exclusive lock on parent implicitly holds exclusive lock on children

    await bc1Locks[_releaseAllLocks]();
    await bc1Locks.acquireLocks({ exclusive: modelId });
    assertLockCounts(bc1Locks, 2, 1);
    assertSharedLocks(bc1Locks, [modelId, IModel.rootSubjectId]);
    assertExclusiveLocks(bc1Locks, [modelId, parentId, child1, child2]); // acquiring exclusive lock on model implicitly holds exclusive lock on members

    await bc1Locks[_releaseAllLocks]();
    lockSpy.resetHistory();
    await bc1Locks.acquireLocks({ shared: child1 });
    assert.equal(lockSpy.callCount, 1);
    assert.equal(lockSpy.getCall(0).args[1].size, 5);
    assertSharedLocks(bc1Locks, [child1, parentId, modelId, subjectId, IModel.rootSubjectId]);
    assertLockCounts(bc1Locks, 5, 0);
    await bc1Locks.acquireLocks({ exclusive: child1 }); // upgrade lock from shared to exclusive
    assert.equal(lockSpy.callCount, 2);
    assertLockCounts(bc1Locks, 4, 1);

    assertExclusiveLocks(bc1Locks, child1);
    assert.equal(lockSpy.callCount, 2); // should not need to call server on a lock already held

    await expect(bc2.acquireSchemaLock()).rejectedWith(IModelError, sharedLockError);
    assert.equal(lockSpy.callCount, 3);
    await expect(bc2Locks.acquireLocks({ exclusive: parentId })).rejectedWith(IModelError, sharedLockError);
    assert.equal(lockSpy.callCount, 4);
    await bc2Locks.acquireLocks({ shared: parentId });
    assert.equal(lockSpy.callCount, 5);
    assertSharedLocks(bc2Locks, [parentId, IModel.rootSubjectId]);
    await bc2Locks.acquireLocks({ shared: IModel.dictionaryId });
    assert.equal(lockSpy.callCount, 6);
    assertSharedLocks(bc2Locks, IModel.dictionaryId);

    assertLockCounts(bc1Locks, 4, 1);
    assertLockCounts(bc2Locks, 5, 0);

    const childElJson = childEl.toJSON();
    // if we close and reopen the briefcase, the local locks database should still be intact
    bc1.close();
    bc2.close();

    bc1 = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
    bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
    bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    bc1Locks = bc1.locks as ServerBasedLocks;
    bc2Locks = bc2.locks as ServerBasedLocks;

    assertLockCounts(bc1Locks, 4, 1);
    assertLockCounts(bc2Locks, 5, 0);

    assertSharedLocks(bc1Locks, [parentId, childEl.model, IModel.rootSubjectId]);
    assertSharedLocks(bc2Locks, [parentId, IModel.rootSubjectId, IModel.dictionaryId]);
    assertExclusiveLocks(bc1Locks, child1);
    assert.isFalse(bc2Locks.holdsExclusiveLock(child1));

    await bc2Locks[_releaseAllLocks](); // release all locks from bc2 so we can test expected failures below
    assertLockCounts(bc2Locks, 0, 0);

    await expect(bc2Locks.acquireLocks({ exclusive: [IModel.dictionaryId, parentId] })).rejectedWith(IModelError, sharedLockError);
    assertLockCounts(bc2Locks, 0, 0); // exclusive lock is available on dictionary, but not on parent - should get neither
    await bc2Locks.acquireLocks({ exclusive: IModel.dictionaryId }); // now attempt to get only dictionary
    assertExclusiveLocks(bc2Locks, IModel.dictionaryId); // that should work
    assertSharedLocks(bc2Locks, IModel.rootSubjectId); // it should also acquire the shared lock on the rootSubject
    assertLockCounts(bc2Locks, 1, 1);

    await bc1Locks[_releaseAllLocks]();
    await bc2Locks[_releaseAllLocks]();
    lockSpy.resetHistory();

    const physicalProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      parent: new ElementOwnsChildElements(parentId),
      category: childElJson.category,
      code: Code.createEmpty(),
    };
    assert.throws(() => bc1.elements.insertElement(physicalProps), IModelError, "shared lock"); // insert requires shared lock on model
    await bc1Locks.acquireLocks({ shared: parentId }); // also acquires shared lock on model
    const newElId = bc1.elements.insertElement(physicalProps);
    assertExclusiveLocks(bc1Locks, newElId);

    childElJson.userLabel = "new user label";
    assert.throws(() => bc1.elements.updateElement(childElJson), "exclusive lock");
    await bc1Locks.acquireLocks({ exclusive: child1 });
    bc1.elements.updateElement(childElJson);
    bc1.saveChanges();

    bc1.elements.deleteElement(child1); // make sure delete now works
    bc1.abandonChanges();

    assert.isTrue(bc1.locks.holdsSharedLock(IModel.repositoryModelId));

    await bc1.pushChanges({ accessToken: accessToken1, description: "my changes" });

    assert.isFalse(bc1.locks.holdsSharedLock(IModel.repositoryModelId));

    assert.throws(() => bc2.elements.deleteElement(child1), "exclusive lock"); // bc2 can't delete because it doesn't hold lock
    await expect(bc2Locks.acquireLocks({ exclusive: child1 })).rejectedWith(IModelError, "pull is required"); // can't get lock since other briefcase changed it

    await bc2.pullChanges({ accessToken: accessToken2 });
    await bc2Locks.acquireLocks({ exclusive: child1, shared: child1 });
    const child2El = bc2.elements.getElement<PhysicalElement>(child1);

    assert.equal(child2El.userLabel, childElJson.userLabel);
    await bc1.locks.releaseAllLocks();
    await bc2.locks.releaseAllLocks();
    bc1.close();
    bc2.close();
  });

  describe("releaseAllLocks", () => {
    let bc: BriefcaseDb;
    let locks: ServerBasedLocks;
    let elemId: string;

    beforeEach(async () => {
      bc = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
      expect(bc.locks.isServerBased).to.be.true;
      locks = bc.locks as ServerBasedLocks;
      bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      elemId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      expect(elemId).not.to.equal("0");
    });

    afterEach(() => bc.close());

    function expectLocked(): void {
      expect(locks.getLockCount(LockState.Exclusive)).least(1);
      expect(locks.getLockCount(LockState.Shared)).to.equal(0);
    }

    function expectUnlocked(): void {
      expect(locks.getLockCount(LockState.Exclusive)).to.equal(0);
      expect(locks.getLockCount(LockState.Shared)).to.equal(0);
    }

    function write(): void {
      const elem = bc.elements.getElement(elemId);
      elem.jsonProperties.testProp = Guid.createValue();
      elem.update();
    }

    async function push(retainLocks?: true): Promise<void> {
      return bc.pushChanges({ retainLocks, accessToken: "token", description: "changes" });
    }

    it("releases all locks", async () => {
      expectUnlocked();
      await bc.acquireSchemaLock();
      expectLocked();
      await locks.releaseAllLocks();
      expectUnlocked();
    });

    it("is called when pushChanges is called with no local changes", async () => {
      await bc.acquireSchemaLock();
      expectLocked();
      await push();
      expectUnlocked();
    });

    it("is called when pushing changes", async () => {
      await bc.acquireSchemaLock();
      expectLocked();
      write();
      bc.saveChanges();
      await push();
      expectUnlocked();
    });

    it("is not called when pushChanges is called with no local changes if retainLocks is specified", async () => {
      await bc.acquireSchemaLock();
      expectLocked();
      await push(true);
      expectLocked();
      await locks.releaseAllLocks();
      expectUnlocked();
    });

    it("is not called when pushing changes if retainLocks is specified", async () => {
      await bc.acquireSchemaLock();
      expectLocked();
      write();
      bc.saveChanges();
      await push(true);
      expectLocked();
      await locks.releaseAllLocks();
      expectUnlocked();
    });

    it("throws if briefcase has unpushed changes", async () => {
      expectUnlocked();
      await bc.acquireSchemaLock();
      expectLocked();
      write();
      bc.saveChanges();
      await expect(locks.releaseAllLocks()).to.eventually.be.rejectedWith("local changes");
      await push();
      expectUnlocked();
    });

    it("throws if briefcase has unsaved changes", async () => {
      expectUnlocked();
      await bc.acquireSchemaLock();
      write();
      await expect(locks.releaseAllLocks()).to.eventually.be.rejectedWith("local changes");
      expectLocked();
      bc.abandonChanges();
      await locks.releaseAllLocks();
      expectUnlocked();
    });
  });
});
