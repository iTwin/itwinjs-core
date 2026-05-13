/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { match as sinonMatch, restore as sinonRestore, spy as sinonSpy, stub as sinonStub } from "sinon";
import { AccessToken, Guid, GuidString, Id64, Id64Arg, IModelStatus } from "@itwin/core-bentley";
import { Code, IModel, IModelError, LocalBriefcaseProps, LockState, PhysicalElementProps, RequestNewBriefcaseProps } from "@itwin/core-common";
import { BriefcaseManager } from "../../BriefcaseManager";
import { PhysicalObject } from "../../domains/GenericElements";
import { PhysicalElement } from "../../Element";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { ElementOwnsChildElements } from "../../NavigationRelationship";
import { ServerBasedLocks } from "../../internal/ServerBasedLocks";
import { HubMock } from "../../internal/HubMock";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ChannelControl, LockConflict, LockMap } from "../../core-backend";
import { _hubAccess, _releaseAllLocks } from "../../internal/Symbols";
import { EditTxn, withEditTxn } from "../../EditTxn";

const expect = chai.expect;
const assert = chai.assert;
chai.use(chaiAsPromised);

describe("Server-based locks", () => {
  const createVersion0 = async () => {
    const dbName = IModelTestUtils.prepareOutputFile("ServerBasedLocks", "ServerBasedLocks.bim");
    const sourceDb = SnapshotDb.createEmpty(dbName, { rootSubject: { name: "server lock test" } });
    assert.isFalse(sourceDb.locks.isServerBased);
    await ExtensiveTestScenario.prepareDb(sourceDb);
    await ExtensiveTestScenario.populateDb(sourceDb);
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
    const lockSpy = sinonSpy(IModelHost[_hubAccess], "acquireLocks");
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
    assert.throws(() => withEditTxn(bc1, (txn) => txn.insertElement(physicalProps)), IModelError, "shared lock"); // insert requires shared lock on model
    await bc1Locks.acquireLocks({ shared: parentId }); // also acquires shared lock on model
    const newElId = withEditTxn(bc1, (txn) => txn.insertElement(physicalProps));
    assertExclusiveLocks(bc1Locks, newElId);

    childElJson.userLabel = "new user label";
    assert.throws(() => withEditTxn(bc1, (txn) => txn.updateElement(childElJson)), "exclusive lock");
    await bc1Locks.acquireLocks({ exclusive: child1 });
    withEditTxn(bc1, (txn) => txn.updateElement(childElJson));

    {
      const txn = new EditTxn(bc1, "verify delete lock behavior");
      txn.start();
      txn.deleteElement(child1); // make sure delete now works
      txn.end("abandon");
    }

    assert.isTrue(bc1.locks.holdsSharedLock(IModel.repositoryModelId));

    await bc1.pushChanges({ accessToken: accessToken1, description: "my changes" });

    assert.isFalse(bc1.locks.holdsSharedLock(IModel.repositoryModelId));

    assert.throws(() => withEditTxn(bc2, (txn) => txn.deleteElement(child1)), "exclusive lock"); // bc2 can't delete because it doesn't hold lock
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

    function write(txn: EditTxn): void {
      const elem = bc.elements.getElement(elemId);
      elem.jsonProperties.testProp = Guid.createValue();
      elem.update(txn);
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
      withEditTxn(bc, (txn) => write(txn));
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
      withEditTxn(bc, (txn) => write(txn));
      await push(true);
      expectLocked();
      await locks.releaseAllLocks();
      expectUnlocked();
    });

    it("throws if briefcase has unpushed changes", async () => {
      expectUnlocked();
      await bc.acquireSchemaLock();
      expectLocked();
      withEditTxn(bc, (txn) => write(txn));
      await expect(locks.releaseAllLocks()).to.eventually.be.rejectedWith("local changes");
      await push();
      expectUnlocked();
    });

    it("throws if briefcase has unsaved changes", async () => {
      expectUnlocked();
      await bc.acquireSchemaLock();
      const txn = new EditTxn(bc, "releaseAllLocks unsaved changes");
      txn.start();
      write(txn);
      await expect(locks.releaseAllLocks()).to.eventually.be.rejectedWith("local changes");
      expectLocked();
      txn.end("abandon");
      await locks.releaseAllLocks();
      expectUnlocked();
    });
  });

  describe("abandonLocksForReversedTxn", () => {
    let bc: BriefcaseDb;
    let bc2: BriefcaseDb | undefined;
    let locks: ServerBasedLocks;

    beforeEach(async () => {
      bc = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
      expect(bc.locks.isServerBased).to.be.true;
      locks = bc.locks as ServerBasedLocks;
      bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    });

    afterEach(async () => {
      sinonRestore();

      await locks[_releaseAllLocks]();
      bc.close();

      if (bc2 !== undefined) {
        await bc2.locks.releaseAllLocks();
        bc2.close();
        bc2 = undefined;
      }
    });

    it("abandons locks acquired in the current, unsaved txn", async () => {
      const lockSpy = sinonSpy(IModelHost[_hubAccess], "abandonLocks");

      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ exclusive: childId });
      expect(locks.holdsExclusiveLock(childId)).to.be.true;
      expect(locks.getLockCount(LockState.Exclusive)).to.equal(1);
      expect(locks.getLockCount(LockState.Shared)).to.be.greaterThan(0);

      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;

      expect(lockSpy.callCount).to.equal(1);
      const releasedLocks = lockSpy.getCall(0).args[1] as Map<string, LockState>;
      expect(releasedLocks.size).to.be.greaterThan(0);
      for (const state of releasedLocks.values())
        expect(state).to.equal(LockState.None);

      expect(locks.holdsExclusiveLock(childId)).to.be.false;
      expect(locks.getLockCount(LockState.Exclusive)).to.equal(0);
      expect(locks.getLockCount(LockState.Shared)).to.equal(0);
    });

    it("abandons locks acquired in the most recent saved txn", async () => {
      const lockSpy = sinonSpy(IModelHost[_hubAccess], "abandonLocks");

      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await withEditTxn(bc, async txn => {
        await locks.acquireLocks({ exclusive: childId });
        const element = bc.elements.getElement<PhysicalElement>(childId);
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      expect(locks.holdsExclusiveLock(childId)).to.be.true;
      expect(locks.getLockCount(LockState.Exclusive)).to.equal(1);
      expect(locks.getLockCount(LockState.Shared)).to.be.greaterThan(0);

      bc.txns.reverseSingleTxn();
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;

      expect(lockSpy.callCount).to.equal(1);
      const releasedLocks = lockSpy.getCall(0).args[1] as Map<string, LockState>;
      expect(releasedLocks.size).to.be.greaterThan(0);
      for (const state of releasedLocks.values())
        expect(state).to.equal(LockState.None);

      expect(locks.holdsExclusiveLock(childId)).to.be.false;
      expect(locks.getLockCount(LockState.Exclusive)).to.equal(0);
      expect(locks.getLockCount(LockState.Shared)).to.equal(0);
    });

    it("does not release locks acquired by a different txn", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const txn1 = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1 });

      await withEditTxn(bc, async txn => {
        const element = bc.elements.getElement<PhysicalElement>(elementId1);
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      const txn2 = bc.txns.getCurrentTxnId();
      expect(txn2).not.to.equal(txn1);

      await withEditTxn(bc, async txn => {
        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        element2.setUserProperties("bar", Guid.createValue());
        element2.update(txn);
      });

      expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(txn2)).to.be.true;

      expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;
    });

    it("invalidates discovered locks", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const ownerModeltId = bc.elements.getElementProps(elementId).model;
      const ownersOwnerModelId = bc.elements.getElementProps(ownerModeltId).model;

      await locks.acquireLocks({ exclusive: ownersOwnerModelId });
      expect(locks.holdsExclusiveLock(ownerModeltId)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId)).to.be.true;

      const txnId = bc.txns.getCurrentTxnId();
      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;

      expect(locks.holdsExclusiveLock(ownerModeltId)).to.be.false;
      expect(locks.holdsExclusiveLock(elementId)).to.be.false;
    });

    it("restores lock to its previous state if it was upgraded by the reversed txn", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const firstTxnId = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1, shared: elementId2 });
      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

      // We must actually edit something in order to start a new Txn.
      await withEditTxn(bc, async txn => {
        const element = bc.elements.getElement<PhysicalElement>(elementId1);
        element.setUserProperties("foo", { test: true });
        element.update(txn);
      });

      const secondTxnId = bc.txns.getCurrentTxnId();
      expect(firstTxnId).not.to.equal(secondTxnId);

      await locks.acquireLocks({ exclusive: elementId2 }); // upgrade lock from shared to exclusive
      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

      expect(await locks.abandonLocksForReversedTxn(secondTxnId)).to.be.true;

      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;
    });

    it("does not update changesetid when releasing locks", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      // Make sure both briefcase initially have all changes.
      await bc.pullChanges({ accessToken: "token" });
      await bc2.pullChanges({ accessToken: "token" });

      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      // Edit an element in the first briefcase and push the change. This will
      // create a new changeset.
      await locks.acquireLocks({ exclusive: elementId1 });

      await withEditTxn(bc, async txn => {
        const element = bc.elements.getElement<PhysicalElement>(elementId1);
        element.setUserProperties("foo", { test: true });
        element.update(txn);
      });

      await bc.pushChanges({ accessToken: "token", description: "changes" });

      const secondTxnId = bc.txns.getCurrentTxnId();

      // In that same briefcase, lock and edit a different element, but then reverse
      // the change and release the lock.
      await bc.locks.acquireLocks({ exclusive: elementId2 });
      await withEditTxn(bc, async txn => {
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        element2.setUserProperties("bar", { test: true });
        element2.update(txn);
      });

      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(secondTxnId)).to.be.true;

      // Now, in a separate briefcase, which has not yet pulled the changes pushed by the first,
      // attempt to lock the same element whose lock was just released. This should work because
      // the lock release by releaseLocksForReversedTxn should not have updated the changeset
      // associated with that lock.
      await bc2.locks.acquireLocks({ exclusive: elementId2 });
    });

    it("does not release on the server an implicit lock held for a new element", async () => {
      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const childElement = bc.elements.getElement<PhysicalElement>(childId);
      const parentId = childElement.parent!.id;
      const modelId = childElement.model;

      const physicalProps: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: modelId,
        parent: new ElementOwnsChildElements(parentId),
        category: childElement.category,
        code: Code.createEmpty(),
      };

      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ shared: [modelId, parentId] });
      const newElementId = await withEditTxn(bc, async txn => {
        return txn.insertElement(physicalProps);
      });

      expect(locks.holdsExclusiveLock(newElementId)).to.be.true;

      const lockSpy = sinonSpy(IModelHost[_hubAccess], "acquireLocks");

      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;

      expect(lockSpy.calledWithMatch(sinonMatch.any, sinonMatch((lockMap: LockMap) => lockMap.has(newElementId)))).to.be.false;
    });

    it("releases locks for later txns, too", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const txn1 = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1 });

      const element1 = bc.elements.getElement<PhysicalElement>(elementId1);

      await withEditTxn(bc, async txn => {
        element1.setUserProperties("foo", Guid.createValue());
        element1.update(txn);
      });

      const txn2 = bc.txns.getCurrentTxnId();
      expect(txn2).not.to.equal(txn1);

      await locks.acquireLocks({ exclusive: elementId2 });
      const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
      await withEditTxn(bc, async txn => {
        element2.setUserProperties("bar", Guid.createValue());
        element2.update(txn);
      });

      expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

      // Reverse both txns, then abandon locks starting from the earlier one.
      // This will release locks for the later one, too.
      bc.txns.reverseTxns(2);
      expect(await locks.abandonLocksForReversedTxn(txn1)).to.be.true;

      expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;
    });

    it("throws if asked to abandon locks for a txn that has not been reversed", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const txnId = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId });

      const element = bc.elements.getElement<PhysicalElement>(elementId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      // The txn has not been reversed, so abandonLocksForReversedTxn should throw.
      await expect(locks.abandonLocksForReversedTxn(txnId)).to.eventually.be.rejectedWith("has not been reversed");

      expect(locks.holdsExclusiveLock(elementId)).to.be.true;
    });

    it("throws if asked to abandon locks for the current txn and there are unsaved changes", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      await locks.acquireLocks({ exclusive: elementId });

      const element = bc.elements.getElement<PhysicalElement>(elementId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);

        // The current txn has unsaved changes, so abandonLocksForReversedTxn should throw.
        const txnId = bc.txns.getCurrentTxnId();
        await expect(locks.abandonLocksForReversedTxn(txnId)).to.eventually.be.rejectedWith("unsaved changes");

        expect(locks.holdsExclusiveLock(elementId)).to.be.true;
      });
    });

    it("throws if asked to abandon locks for a nonexistent txn", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      await locks.acquireLocks({ exclusive: elementId });

      const element = bc.elements.getElement<PhysicalElement>(elementId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      bc.txns.reverseSingleTxn();

      // Use an ID that is not a valid txn.
      await expect(locks.abandonLocksForReversedTxn("0xffffffffffff")).to.eventually.be.rejectedWith("does not exist");

      // The lock should still be held.
      expect(locks.holdsExclusiveLock(elementId)).to.be.true;
    });

    it("returns false when called a second time for an already-abandoned txn", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ exclusive: elementId });

      const element = bc.elements.getElement<PhysicalElement>(elementId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      bc.txns.reverseSingleTxn();
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId)).to.be.false;

      // Calling again should be a no-op and return false because the locks are already abandoned.
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.false;
      expect(locks.holdsExclusiveLock(elementId)).to.be.false;
    });
  });

  describe("acquireLocksForReinstatingTxn", () => {
    let bc: BriefcaseDb;
    let bc2: BriefcaseDb | undefined;
    let locks: ServerBasedLocks;

    beforeEach(async () => {
      bc = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
      expect(bc.locks.isServerBased).to.be.true;
      locks = bc.locks as ServerBasedLocks;
      bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    });

    afterEach(async () => {
      await locks[_releaseAllLocks]();
      bc.close();

      if (bc2 !== undefined) {
        await (bc2.locks as ServerBasedLocks)[_releaseAllLocks]();
        bc2.close();
        bc2 = undefined;
      }
    });

    it("reacquires locks for reinstating a txn", async () => {
      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ exclusive: childId });
      expect(locks.holdsExclusiveLock(childId)).to.be.true;

      // We must actually edit something in order to start a new Txn.
      const element = bc.elements.getElement<PhysicalElement>(childId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", { test: true });
        element.update(txn);
      });

      bc.txns.reverseTxns(1);
      await locks.abandonLocksForReversedTxn(txnId);
      expect(locks.holdsExclusiveLock(childId)).to.be.false;

      expect(await locks.acquireLocksForReinstatingTxn(txnId)).to.be.true;
      bc.txns.reinstateTxn();
      expect(locks.holdsExclusiveLock(childId)).to.be.true;
    });

    it("reupgrades a shared lock to exclusive", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const firstTxnId = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1, shared: elementId2 });
      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

      // We must actually edit something in order to start a new Txn.
      const element = bc.elements.getElement<PhysicalElement>(elementId1);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", { test: true });
        element.update(txn);
      });

      const secondTxnId = bc.txns.getCurrentTxnId();
      expect(firstTxnId).not.to.equal(secondTxnId);

      await locks.acquireLocks({ exclusive: elementId2 }); // upgrade lock from shared to exclusive
      const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
      await withEditTxn(bc, async txn => {
        element2.setUserProperties("bar", { test: true });
        element2.update(txn);
      });

      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

      bc.txns.reverseSingleTxn();
      await locks.abandonLocksForReversedTxn(secondTxnId);

      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

      expect(await locks.acquireLocksForReinstatingTxn(secondTxnId)).to.be.true;
      bc.txns.reinstateTxn();

      expect(locks.holdsSharedLock(elementId2)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;
    });

    it("does not acquire on the server an implicit lock originally held for a new element", async () => {
      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const childElement = bc.elements.getElement<PhysicalElement>(childId);
      const parentId = childElement.parent!.id;
      const modelId = childElement.model;

      const physicalProps: PhysicalElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: modelId,
        parent: new ElementOwnsChildElements(parentId),
        category: childElement.category,
        code: Code.createEmpty(),
      };

      await locks.acquireLocks({ shared: [modelId, parentId] });
      const txnId = bc.txns.getCurrentTxnId();
      const newElementId = await withEditTxn(bc, async txn => {
        return txn.insertElement(physicalProps);
      });

      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;

      expect(await locks.acquireLocksForReinstatingTxn(txnId)).to.be.true;
      bc.txns.reinstateTxn();
      expect(locks.holdsExclusiveLock(newElementId)).to.be.true;
    });

    it("acquires locks for earlier txns, too", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const txn1 = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1 });

      const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
      await withEditTxn(bc, async txn => {
        element1.setUserProperties("foo", Guid.createValue());
        element1.update(txn);
      });

      const txn2 = bc.txns.getCurrentTxnId();
      expect(txn2).not.to.equal(txn1);

      await locks.acquireLocks({ exclusive: elementId2 });
      const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
      await withEditTxn(bc, async txn => {
        element2.setUserProperties("bar", Guid.createValue());
        element2.update(txn);
      });

      expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

      // Reverse both txns and abandon locks starting from the earlier one.
      bc.txns.reverseTxns(2);
      expect(await locks.abandonLocksForReversedTxn(txn1)).to.be.true;

      expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

      // Acquire locks for the later txn. This should also acquire locks for the earlier one.
      expect(await locks.acquireLocksForReinstatingTxn(txn2)).to.be.true;

      expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;
    });

    it("cannot acquire locks for a reversed txn after new changes are made", async () => {
      const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
      const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

      const txn1 = bc.txns.getCurrentTxnId();
      await locks.acquireLocks({ exclusive: elementId1 });

      const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
      await withEditTxn(bc, async txn => {
        element1.setUserProperties("foo", Guid.createValue());
        element1.update(txn);
      });

      bc.txns.reverseTxns(1);
      expect(await locks.abandonLocksForReversedTxn(txn1)).to.be.true;

      // Make other changes, making the reversed txn inaccessible.
      const txn2 = bc.txns.getCurrentTxnId();
      expect(txn1).to.equal(txn2);
      await locks.acquireLocks({ exclusive: elementId2 });
      const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
      await withEditTxn(bc, async txn => {
        element2.setUserProperties("bar", Guid.createValue());
        element2.update(txn);
      });

      // Attempting to reinstate the txn should not acquire any locks.
      expect(await locks.acquireLocksForReinstatingTxn(txn1)).to.be.false;

      // We should still not have a lock on elementId1, because txn1 is now a different txn after the original
      // was reversed and we started making further changes under the reused txn id.
      expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
      expect(locks.holdsExclusiveLock(elementId2)).to.be.true;
    });

    it("throws if another briefcase holds a conflicting lock", async () => {
      const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ exclusive: elementId });

      const element = bc.elements.getElement<PhysicalElement>(elementId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      // Reverse and abandon the lock so it's released on the server.
      bc.txns.reverseSingleTxn();
      expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;
      expect(locks.holdsExclusiveLock(elementId)).to.be.false;

      // Have a second briefcase acquire the same lock.
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc2.pullChanges();
      await bc2.locks.acquireLocks({ exclusive: elementId });

      // Attempting to reacquire the lock for reinstatement should fail because bc2 holds it.
      await expect(locks.acquireLocksForReinstatingTxn(txnId)).to.eventually.be.rejectedWith("lock is already held");
      expect(locks.holdsExclusiveLock(elementId)).to.be.false;
    });

    it("is a no-op when locks were never abandoned", async () => {
      const childId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
      const txnId = bc.txns.getCurrentTxnId();

      await locks.acquireLocks({ exclusive: childId });

      const element = bc.elements.getElement<PhysicalElement>(childId);
      await withEditTxn(bc, async txn => {
        element.setUserProperties("foo", Guid.createValue());
        element.update(txn);
      });

      // Reverse the txn but do NOT abandon locks.
      bc.txns.reverseSingleTxn();
      expect(locks.holdsExclusiveLock(childId)).to.be.true;

      // acquireLocksForReinstatingTxn should be a harmless no-op since locks were never abandoned.
      expect(await locks.acquireLocksForReinstatingTxn(txnId)).to.be.false;
      expect(locks.holdsExclusiveLock(childId)).to.be.true;
    });

    it("throws for an invalid txnId", async () => {
      await expect(locks.acquireLocksForReinstatingTxn("0xffffffffffff")).to.eventually.be.rejectedWith("does not exist");
    });
  });

  describe("TxnManager integration", () => {
    let bc: BriefcaseDb;
    let locks: ServerBasedLocks;

    beforeEach(async () => {
      bc = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
      expect(bc.locks.isServerBased).to.be.true;
      locks = bc.locks as ServerBasedLocks;
      bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    });

    afterEach(async () => {
      await locks[_releaseAllLocks]();
      bc.close();
    });

    describe("reverseTxnsAsync", () => {
      it("reverses a single txn and abandons its locks", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
        await locks.acquireLocks({ exclusive: elementId });

        const element = bc.elements.getElement<PhysicalElement>(elementId);
        const originalProps = element.getUserProperties("foo");
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", Guid.createValue());
          element.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId)).to.be.true;

        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // Verify the element change was actually reversed.
        const revertedElement = bc.elements.getElement<PhysicalElement>(elementId);
        expect(revertedElement.getUserProperties("foo")).to.deep.equal(originalProps);
      });

      it("reverses multiple txns and abandons all their locks", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const orig1 = bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo");
        const orig2 = bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        await bc.txns.reverseTxnsAsync(2);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

        // Verify the element changes were actually reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.deep.equal(orig1);
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(orig2);
      });

      it("when an earlier txn is reversed using reverseTxns, and a later one with reverseTxnsAsync, the latter call abandons the earlier locks, too", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        // Reverse the later txn using reverseTxns (no lock abandonment).
        bc.txns.reverseTxns(1);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        // Reverse the earlier txn using reverseTxnsAsync.
        // This should also abandon locks for the already-reversed later txn.
        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;
      });
    });

    describe("reverseSingleTxnAsync", () => {
      it("reverses a single txn and abandons its locks", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
        await locks.acquireLocks({ exclusive: elementId });

        const element = bc.elements.getElement<PhysicalElement>(elementId);
        const originalProps = element.getUserProperties("foo");
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", Guid.createValue());
          element.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId)).to.be.true;

        await bc.txns.reverseSingleTxnAsync();
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // Verify the element change was actually reversed.
        const revertedElement = bc.elements.getElement<PhysicalElement>(elementId);
        expect(revertedElement.getUserProperties("foo")).to.deep.equal(originalProps);
      });
    });

    describe("reverseAllTxnsAsync", () => {
      it("reverses all txns and abandons all their locks", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const orig1 = bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo");
        const orig2 = bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        await bc.txns.reverseAllTxnsAsync();
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

        // Verify the element changes were actually reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.deep.equal(orig1);
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(orig2);
      });
    });

    describe("reverseToTxnAsync", () => {
      it("reverses to a specific txn and abandons locks for all reversed txns", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const origProps2 = bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        const txnAfterFirst = bc.txns.getCurrentTxnId();

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        await bc.txns.reverseToTxnAsync(txnAfterFirst);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

        // Verify only the second element's changes were reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(origProps2);
      });
    });

    describe("cancelToTxnAsync", () => {
      it("cancels to a specific txn and abandons locks for all cancelled txns", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const origProps2 = bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        const txnAfterFirst = bc.txns.getCurrentTxnId();

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        await bc.txns.cancelToTxnAsync(txnAfterFirst);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

        // Verify the second element's changes were cancelled.
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(origProps2);

        // cancelTo should not allow redo
        expect(bc.txns.isRedoPossible).to.be.false;
      });

      it("after regular cancelTo, locks can be abandoned, but not re-acquired", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");

        const txnId = bc.txns.getCurrentTxnId();

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        // Use the regular cancelTo which does not abandon locks.
        bc.txns.cancelTo(txnId);

        // Now try to abandon the locks, which should work.
        expect(await locks.abandonLocksForReversedTxn(txnId)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;

        // However, it doesn't make sense to reacquire these locks because the Txn no longer exists.
        await expect(locks.acquireLocksForReinstatingTxn(txnId)).to.eventually.be.rejectedWith("does not exist");
      });

      it("canceling a txn prevents subsequent reacquisition of that txn's locks", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const txnBefore = bc.txns.getCurrentTxnId();

        await locks.acquireLocks({ exclusive: elementId });
        const element = bc.elements.getElement<PhysicalElement>(elementId);
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", Guid.createValue());
          element.update(txn);
        });

        await bc.txns.cancelToTxnAsync(txnBefore);
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // Attempting to acquire locks for the cancelled transaction should fail
        // because the transaction itself no longer exists and its lock records have been cleared.
        await expect(locks.acquireLocksForReinstatingTxn(txnBefore)).to.eventually.be.rejectedWith("does not exist");
      });

      it("reverses but does not cancel if lock abandonment fails", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
        const txnBefore = bc.txns.getCurrentTxnId();

        await locks.acquireLocks({ exclusive: elementId });
        const element = bc.elements.getElement<PhysicalElement>(elementId);
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", Guid.createValue());
          element.update(txn);
        });

        const error = new IModelError(IModelStatus.BadRequest, "Lock abandonment failed");
        sinonStub(locks, "abandonLocksForReversedTxn").rejects(error);

        await expect(bc.txns.cancelToTxnAsync(txnBefore)).to.eventually.be.rejectedWith(IModelError, "Lock abandonment failed");

        // The txn was reversed but not canceled, so we can reinstate. Locks are still held.
        expect(bc.txns.isRedoPossible).to.be.true;
        expect(locks.holdsExclusiveLock(elementId)).to.be.true;

        // And now we can try releasing the locks again.
        sinonRestore();
        await bc.locks.abandonLocksForReversedTxn(txnBefore);
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // And cancel the already-reversed txn.
        expect(bc.txns.cancelTo(txnBefore)).to.equal(IModelStatus.NothingToUndo);
        expect(bc.txns.isRedoPossible).to.be.false;
      });
    });

    describe("reinstateTxnAndAcquireLocks", () => {
      it("reinstates a reversed txn and reacquires its locks", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");
        await locks.acquireLocks({ exclusive: elementId });

        const element = bc.elements.getElement<PhysicalElement>(elementId);
        const originalProps = element.getUserProperties("foo");
        const newValue = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", newValue);
          element.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId)).to.be.true;

        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // Verify the element change was reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId).getUserProperties("foo")).to.deep.equal(originalProps);

        await bc.txns.reinstateTxnAsync();
        expect(locks.holdsExclusiveLock(elementId)).to.be.true;

        // Verify the element change was reinstated.
        expect(bc.elements.getElement<PhysicalElement>(elementId).getUserProperties("foo")).to.equal(newValue);
      });

      it("multiple txns reversed together are reinstated as one", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        const orig1 = bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo");
        const orig2 = bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar");

        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        const newValue1 = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", newValue1);
          element1.update(txn);
        });

        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        const newValue2 = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", newValue2);
          element2.update(txn);
        });

        await bc.txns.reverseTxnsAsync(2);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

        // Verify both element changes were reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.deep.equal(orig1);
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(orig2);

        // A single reinstate should bring back both txns and reacquire all locks.
        await bc.txns.reinstateTxnAsync();
        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(locks.holdsExclusiveLock(elementId2)).to.be.true;

        // Verify both element changes are reinstated.
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.equal(newValue1);
        expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.equal(newValue2);
      });

      it("abandons unsaved changes before reinstatement", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        // Make a change, save it, and reverse it.
        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        const originalProps1 = element1.getUserProperties("foo");
        const newValue1 = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", newValue1);
          element1.update(txn);
        });

        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;

        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;

        // Verify the element change was reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.deep.equal(originalProps1);

        // Now make an unsaved change to a different element.
        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        const originalProps2 = element2.getUserProperties("bar");
        const newValue2 = Guid.createValue();

        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", newValue2);
          element2.update(txn);

          // Verify the unsaved change is present and lock is held.
          expect(bc.txns.hasUnsavedChanges).to.be.true;
          expect(locks.holdsExclusiveLock(elementId2)).to.be.true;
          expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.equal(newValue2);

          // Reinstate the first txn. This should:
          // 1. Abandon the unsaved change to element2
          // 2. Abandon the lock on element2
          // 3. Reinstate the change to element1
          // 4. Reacquire the lock on element1
          await bc.txns.reinstateTxnAsync();

          // Verify the unsaved change was abandoned.
          expect(bc.txns.hasUnsavedChanges).to.be.false;
          expect(bc.elements.getElement<PhysicalElement>(elementId2).getUserProperties("bar")).to.deep.equal(originalProps2);
          expect(locks.holdsExclusiveLock(elementId2)).to.be.false;

          // Verify the first change was reinstated and its lock reacquired.
          expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.equal(newValue1);
          expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        });
      });

      describe("throws and leaves locks acquired if reinstateTxn fails", async () => {
        let elementId: string | undefined;
        let fooValue: string | undefined;

        beforeEach(async () => {
          elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

          await locks.acquireLocks({ exclusive: elementId });
          const element = bc.elements.getElement<PhysicalElement>(elementId);
          fooValue = Guid.createValue();
          await withEditTxn(bc, async txn => {
            element.setUserProperties("foo", fooValue);
            element.update(txn);
          });

          await bc.txns.reverseTxnsAsync(1);
          expect(locks.holdsExclusiveLock(elementId)).to.be.false;

          sinonStub(bc.txns, "reinstateTxn").returns(IModelStatus.BadRequest);

          await expect(bc.txns.reinstateTxnAsync()).to.eventually.be.rejectedWith(IModelError, "Bad Request");

          // Even though it failed to reinstate, it obtained the lock and did not release it.
          expect(locks.holdsExclusiveLock(elementId)).to.be.true;
        });

        it("and we can try reinstating again, without any problems caused by the locks already being acquired", async () => {
          sinonRestore();
          await bc.txns.reinstateTxnAsync();
          expect(locks.holdsExclusiveLock(elementId!)).to.be.true;
          expect(bc.elements.getElement<PhysicalElement>(elementId!).getUserProperties("foo")).to.equal(fooValue);
        });

        it("and we can then release the locks", async () => {
          await locks.abandonLocksForReversedTxn(bc.txns.getCurrentTxnId());
          expect(locks.holdsExclusiveLock(elementId!)).to.be.false;
        });
      });

      it("throws and does not reinstate if acquireLocksForReinstatingTxn fails", async () => {
        const elementId = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        await locks.acquireLocks({ exclusive: elementId });
        const element = bc.elements.getElement<PhysicalElement>(elementId);
        const originalProps = element.getUserProperties("foo");
        const newValue = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element.setUserProperties("foo", newValue);
          element.update(txn);
        });

        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId)).to.be.false;

        // Verify the element change was reversed.
        expect(bc.elements.getElement<PhysicalElement>(elementId).getUserProperties("foo")).to.deep.equal(originalProps);

        // Simulate acquireLocksForReinstatingTxn failing (e.g. because another briefcase holds the lock)
        const error = new LockConflict(0x12345, "other briefcase alias", "exclusive lock is already held");
        sinonStub(locks, "acquireLocksForReinstatingTxn").rejects(error);

        await expect(bc.txns.reinstateTxnAsync()).to.eventually.be.rejectedWith("exclusive lock is already held");

        // Verify it was NOT reinstated
        expect(bc.elements.getElement<PhysicalElement>(elementId).getUserProperties("foo")).to.deep.equal(originalProps);
      });

      it("new changes after reversal truncate the redo stack and clear reversible lock records", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        // 1. Make a change to element 1 and save it.
        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", Guid.createValue());
          element1.update(txn);
        });

        const txn1Id = bc.txns.getCurrentTxnId();

        // 2. Reverse the txn and abandon locks.
        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(bc.txns.isRedoPossible).to.be.true;

        // 3. Make a change to element 2 and save it. This truncates the redo stack.
        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
        });

        // The redo stack should now be truncated.
        expect(bc.txns.isRedoPossible).to.be.false;

        // 4. Try to reacquire locks for the truncated transaction.
        await expect(locks.acquireLocksForReinstatingTxn(txn1Id)).to.eventually.be.rejectedWith("does not exist");
      });

      it("abandoned changes after reversal do not prevent reinstatement", async () => {
        const elementId1 = IModelTestUtils.queryByUserLabel(bc, "PhysicalObject2");
        const elementId2 = IModelTestUtils.queryByUserLabel(bc, "ChildObject1B");

        // 1. Make a change to element 1 and save it.
        await locks.acquireLocks({ exclusive: elementId1 });
        const element1 = bc.elements.getElement<PhysicalElement>(elementId1);
        const newValue1 = Guid.createValue();
        await withEditTxn(bc, async txn => {
          element1.setUserProperties("foo", newValue1);
          element1.update(txn);
        });

        // 2. Reverse the txn and abandon locks.
        await bc.txns.reverseTxnsAsync(1);
        expect(locks.holdsExclusiveLock(elementId1)).to.be.false;
        expect(bc.txns.isRedoPossible).to.be.true;

        // 3. Make a change to element 2 and abandon it.
        await locks.acquireLocks({ exclusive: elementId2 });
        const element2 = bc.elements.getElement<PhysicalElement>(elementId2);
        await withEditTxn(bc, async txn => {
          element2.setUserProperties("bar", Guid.createValue());
          element2.update(txn);
          txn.abandonChanges();
        });

        expect(bc.txns.isRedoPossible).to.be.true;

        // 4. Reinstate should still work.
        await bc.txns.reinstateTxnAsync();
        expect(locks.holdsExclusiveLock(elementId1)).to.be.true;
        expect(bc.elements.getElement<PhysicalElement>(elementId1).getUserProperties("foo")).to.equal(newValue1);
      });
    });
  });
});
