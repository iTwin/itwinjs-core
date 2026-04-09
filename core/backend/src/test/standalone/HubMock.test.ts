/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { join } from "path";
import { AccessToken, Guid, GuidString, Mutable } from "@itwin/core-bentley";
import { ChangesetFileProps, ChangesetType, LocalBriefcaseProps, LockState, RequestNewBriefcaseProps } from "@itwin/core-common";
import { LockProps } from "../../BackendHubAccess";
import { BriefcaseManager } from "../../BriefcaseManager";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { HubMock } from "../../internal/HubMock";
import { ExtensiveTestScenario, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { LockStatusExclusive, LockStatusShared } from "../../LocalHub";
import { ProgressFunction, ProgressStatus } from "../../CheckpointManager";
import { _hubAccess } from "../../internal/Symbols";
import { BriefcaseDb, SnapshotDb } from "../../IModelDb";
import { ChannelControl } from "../../ChannelControl";
import { PhysicalElement } from "../../Element";
import { withEditTxn } from "../../EditTxn";

describe("HubMock", () => {
  const tmpDir = join(KnownTestLocations.outputDir, "HubMockTest");
  const iTwinId = Guid.createValue();
  const version0 = IModelTestUtils.resolveAssetFile("test.bim");
  const accessToken: AccessToken = "fake token";

  before(() => {
    HubMock.startup("HubMockTest", KnownTestLocations.outputDir);
  });
  after(() => {
    HubMock.shutdown();
  });

  it("should be able to create HubMock", async () => {
    const iModelId = await IModelHost[_hubAccess].createNewIModel({ iTwinId, iModelName: "test imodel", version0 });
    const localHub = HubMock.findLocalHub(iModelId);
    let checkpoints = localHub.getCheckpoints();
    assert.equal(checkpoints.length, 1);
    assert.equal(checkpoints[0], 0);

    const cp1 = join(tmpDir, "cp-1.bim");
    localHub.downloadCheckpoint({ changeset: { index: 0 }, targetFile: cp1 });
    const stat1 = IModelJsFs.lstatSync(cp1);
    const statRev0 = IModelJsFs.lstatSync(version0);
    assert.equal(stat1?.size, statRev0?.size);

    assert.equal(2, localHub.acquireNewBriefcaseId("user1", "user1 briefcase 1"));
    assert.equal(3, localHub.acquireNewBriefcaseId("user2", "user2 briefcase 1"));
    assert.equal(4, localHub.acquireNewBriefcaseId("user3", "user3 briefcase 1"));

    let briefcases = localHub.getBriefcases();
    assert.equal(briefcases.length, 3);
    assert.deepEqual(briefcases[0], { id: 2, user: "user1", alias: "user1 briefcase 1", assigned: true });
    assert.deepEqual(briefcases[1], { id: 3, user: "user2", alias: "user2 briefcase 1", assigned: true });
    assert.deepEqual(briefcases[2], { id: 4, user: "user3", alias: "user3 briefcase 1", assigned: true });

    // releasing a briefcaseId should mark it as unassigned
    localHub.releaseBriefcaseId(2);
    briefcases = localHub.getBriefcases(false);
    assert.equal(briefcases.length, 3);
    assert.deepEqual(briefcases[0], { id: 2, user: "user1", alias: "user1 briefcase 1", assigned: false });
    assert.deepEqual(briefcases[1], { id: 3, user: "user2", alias: "user2 briefcase 1", assigned: true });
    assert.deepEqual(briefcases[2], { id: 4, user: "user3", alias: "user3 briefcase 1", assigned: true });

    localHub.releaseBriefcaseId(4);
    briefcases = localHub.getBriefcases();
    assert.equal(briefcases.length, 1);
    assert.deepEqual(briefcases[0], { id: 3, user: "user2", alias: "user2 briefcase 1", assigned: true });

    assert.equal(5, localHub.acquireNewBriefcaseId("user4"));
    briefcases = localHub.getBriefcases();
    assert.equal(briefcases.length, 2);
    assert.deepEqual(briefcases[0], { id: 3, user: "user2", alias: "user2 briefcase 1", assigned: true });
    assert.deepEqual(briefcases[1], { id: 5, user: "user4", alias: "user4 (5)", assigned: true });

    let pathname = IModelTestUtils.resolveAssetFile("CloneTest.01.00.00.ecschema.xml");
    let fileSize = IModelJsFs.lstatSync(pathname)!.size;

    // try pushing changesets
    const cs1: ChangesetFileProps = {
      id: "changeset0", description: "first changeset", changesType: ChangesetType.Regular, parentId: "", briefcaseId: 5, pushDate: "", index: 0,
      userCreated: "user1", pathname, size: fileSize,
    };
    cs1.index = localHub.addChangeset(cs1); // first changeset
    const changesets1 = localHub.queryChangesets();
    assert.equal(changesets1.length, 1);
    assert.equal(changesets1[0].id, cs1.id);
    assert.equal(changesets1[0].description, cs1.description);
    assert.equal(changesets1[0].changesType, cs1.changesType);
    assert.equal(changesets1[0].index, 1);
    assert.equal(changesets1[0].briefcaseId, 5);
    assert.isAtLeast(changesets1[0].size, 1);
    assert.equal(changesets1[0].parentId, "");
    assert.isDefined(changesets1[0].pushDate);
    assert.equal(cs1.id, localHub.getLatestChangeset().id);

    pathname = IModelTestUtils.resolveAssetFile("CloneTest.01.00.01.ecschema.xml");
    fileSize = IModelJsFs.lstatSync(pathname)!.size;

    const cs2: ChangesetFileProps = {
      id: "changeset1", parentId: cs1.id, description: "second changeset", changesType: ChangesetType.Schema, briefcaseId: 5, pushDate: "", index: 0,
      userCreated: "user2", pathname: IModelTestUtils.resolveAssetFile("CloneTest.01.00.01.ecschema.xml"),
      size: fileSize,
    };
    cs2.index = localHub.addChangeset(cs2); // second changeset, parent = cs1
    const changesets2 = localHub.queryChangesets();
    assert.equal(changesets2.length, 2);
    assert.deepEqual(changesets1[0], changesets2[0]);
    assert.equal(changesets2[1].id, cs2.id);
    assert.equal(changesets2[1].parentId, cs2.parentId);
    assert.equal(changesets2[1].description, cs2.description);
    assert.equal(changesets2[1].changesType, cs2.changesType);
    assert.equal(changesets2[1].index, 2);
    assert.equal(changesets2[1].briefcaseId, 5);
    assert.isAtLeast(changesets2[1].size, 1);
    assert.isDefined(changesets2[1].pushDate);
    assert.equal(cs2.id, localHub.getLatestChangeset().id);

    localHub.uploadCheckpoint({ changesetIndex: cs2.index, localFile: version0 });
    checkpoints = localHub.getCheckpoints();
    assert.equal(checkpoints.length, 2);
    assert.equal(checkpoints[1], 2);

    // test named versions
    const version1 = "release 1";
    const version2 = "release 2";
    localHub.addNamedVersion({ versionName: version1, csIndex: cs1.index });
    localHub.addNamedVersion({ versionName: version2, csIndex: cs2.index });
    assert.equal(localHub.findNamedVersion(version1).index, cs1.index);
    expect(() => localHub.findNamedVersion("not there")).throws("not found");
    expect(() => localHub.addNamedVersion({ versionName: version2, csIndex: cs2.index })).throws("insert");
    localHub.deleteNamedVersion(version1);
    expect(() => localHub.findNamedVersion(version1)).throws("not found");

    // test for duplicate changeset id fails
    const cs3: ChangesetFileProps = {
      id: "changeset0", parentId: "changeset1",
      description: "third changeset", changesType: ChangesetType.Regular, pathname: cs1.pathname, briefcaseId: 500, userCreated: "", pushDate: "", index: 0,
      size: fileSize,
    };
    expect(() => localHub.addChangeset(cs3)).throws("no briefcase with that id");
    cs3.briefcaseId = 5;
    expect(() => localHub.addChangeset(cs3)).throws("can't insert");
    // now test for valid changeset id, but bad parentId
    const cs4 = { ...cs3, id: "changeset4", parentId: "bad", description: "fourth changeset" };
    expect(() => localHub.addChangeset(cs4)).throws("bad not found");

    cs3.id = "changeset3";
    cs3.parentId = cs2.id;
    cs3.index = localHub.addChangeset(cs3);
    assert.equal(0, localHub.queryPreviousCheckpoint(0));
    assert.equal(0, localHub.queryPreviousCheckpoint(cs1.index));
    assert.equal(cs2.index, localHub.queryPreviousCheckpoint(cs2.index));
    assert.equal(cs2.index, localHub.queryPreviousCheckpoint(cs3.index));

    // downloading changesets
    const cSets = localHub.downloadChangesets({ range: { first: cs1.index, end: cs2.index }, targetDir: tmpDir });
    assert.equal(cSets.length, 2);
    assert.equal(cSets[0].id, cs1.id);
    assert.equal(cSets[0].changesType, cs1.changesType);
    assert.equal(cSets[0].userCreated, cs1.userCreated);
    assert.equal(cSets[0].parentId, cs1.parentId);
    assert.equal(cSets[0].description, cs1.description);

    assert.equal(cSets[1].id, cs2.id);
    assert.equal(cSets[1].changesType, cs2.changesType);
    assert.equal(cSets[1].userCreated, cs2.userCreated);
    assert.equal(cSets[1].parentId, cs2.parentId);
    assert.equal(cSets[1].description, cs2.description);

    const orig1 = IModelJsFs.readFileSync(cs1.pathname);
    const downloaded1 = IModelJsFs.readFileSync(cSets[0].pathname);
    assert.deepEqual(orig1, downloaded1);

    const orig2 = IModelJsFs.readFileSync(cs2.pathname);
    const downloaded2 = IModelJsFs.readFileSync(cSets[1].pathname);
    assert.deepEqual(orig2, downloaded2);
    assert.notDeepEqual(orig1, orig2);

    const latest = await BriefcaseManager.getLatestChangeset({ iModelId });
    expect(latest.index).to.equal(cs3.index);
    expect(latest.id).to.equal(cs3.id);
    expect(latest.parentId).to.equal(cs3.parentId);

    const cs1q = await BriefcaseManager.queryChangeset({ changeset: { index: cs1.index }, iModelId });
    expect(cs1q.description).to.equal(cs1.description);

    const changes = await BriefcaseManager.queryChangesets({ range: { first: cs1.index }, iModelId });
    expect(changes.length).to.equal(3);

    // test locks
    const lock1: Mutable<LockProps> = {
      state: LockState.Shared,
      id: "0x12",
    };
    // get a new briefcaseId for some locks
    assert.equal(6, localHub.acquireNewBriefcaseId("user5", "alias for 5"));

    localHub.acquireLock(lock1, { briefcaseId: 3, changeset: cs1 });
    assert.equal(localHub.countSharedLocks(), 1);
    assert.equal(localHub.countLocks(), 1);

    let lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal(lockStat.state, LockState.Shared);
    assert.equal((lockStat as LockStatusShared).sharedBy.size, 1);
    assert.isTrue((lockStat as LockStatusShared).sharedBy.has(3));

    assert.isUndefined(lockStat.lastExclusiveReleaseChangesetIndex);
    assert.isUndefined(lockStat.lastSharedReleaseChangesetIndex);
    localHub.acquireLock(lock1, { briefcaseId: 5, changeset: cs1 });
    assert.equal(localHub.countSharedLocks(), 2);
    assert.equal(localHub.countLocks(), 1);
    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal((lockStat as LockStatusShared).sharedBy.size, 2);
    assert.isTrue((lockStat as LockStatusShared).sharedBy.has(3));
    assert.isTrue((lockStat as LockStatusShared).sharedBy.has(5));

    expect(() => localHub.acquireLock({ ...lock1, state: LockState.Exclusive }, { briefcaseId: 6, changeset: { id: "cs1" } })).to.throw("shared lock is held").include({ briefcaseId: 3, briefcaseAlias: "user2 briefcase 1" });
    expect(() => localHub.releaseLocks([lock1], { briefcaseId: 9, changesetIndex: cs1.index })).to.throw("shared lock not held");

    localHub.releaseLocks([lock1], { briefcaseId: 3, changesetIndex: cs1.index });
    assert.equal(localHub.countSharedLocks(), 1);
    assert.equal(localHub.countLocks(), 1);

    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal((lockStat as LockStatusShared).sharedBy.size, 1);

    localHub.releaseLocks([lock1], { briefcaseId: 5, changesetIndex: cs1.index });
    assert.equal(localHub.countSharedLocks(), 0);
    assert.equal(localHub.countLocks(), 1);
    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal(lockStat.state, LockState.None);

    lock1.state = LockState.Exclusive;
    localHub.acquireLock(lock1, { briefcaseId: 6, changeset: cs1 });
    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal(lockStat.state, LockState.Exclusive);
    localHub.acquireLock(lock1, { briefcaseId: 6, changeset: cs1 });
    assert.equal(localHub.countSharedLocks(), 0);
    assert.equal(localHub.countLocks(), 1);
    expect(() => localHub.acquireLock(lock1, { briefcaseId: 5, changeset: cs1 })).to.throw("exclusive lock is already held").include({ briefcaseId: 6, briefcaseAlias: "alias for 5" });
    expect(() => localHub.acquireLock({ ...lock1, state: LockState.Shared }, { briefcaseId: 5, changeset: cs1 })).to.throw("exclusive lock is already held").include({ briefcaseId: 6, briefcaseAlias: "alias for 5" });
    localHub.releaseLocks([lock1], { briefcaseId: 6, changesetIndex: cs2.index });
    assert.equal(localHub.countLocks(), 1);
    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal(lockStat.state, LockState.None);
    assert.equal(lockStat.lastExclusiveReleaseChangesetIndex, cs2.index);

    expect(() => localHub.acquireLock(lock1, { briefcaseId: 5, changeset: cs1 })).to.throw("pull is required");
    localHub.acquireLock(lock1, { briefcaseId: 5, changeset: cs2 });
    lockStat = localHub.queryLockStatus(lock1.id);
    assert.equal(lockStat.state, LockState.Exclusive);
    assert.equal((lockStat as LockStatusExclusive).briefcaseId, 5);
    assert.equal(lockStat.lastExclusiveReleaseChangesetIndex, cs2.index);

    localHub.acquireLock({ state: LockState.Exclusive, id: "0x22" }, { briefcaseId: 5, changeset: cs1 });
    lockStat = localHub.queryLockStatus("0x22");
    assert.equal(lockStat.state, LockState.Exclusive);
    assert.equal((lockStat as LockStatusExclusive).briefcaseId, 5);
    assert.isUndefined(lockStat.lastExclusiveReleaseChangesetIndex);
    assert.isUndefined(lockStat.lastSharedReleaseChangesetIndex);

    localHub.acquireLock({ state: LockState.Exclusive, id: "0x23" }, { briefcaseId: 6, changeset: cs1 });
    localHub.acquireLock({ state: LockState.Shared, id: "0x24" }, { briefcaseId: 6, changeset: cs1 });
    localHub.acquireLock({ state: LockState.Shared, id: "0x24" }, { briefcaseId: 5, changeset: cs1 });

    let locks = localHub.queryAllLocks(5);
    assert.equal(locks.length, 3);

    localHub.releaseBriefcaseId(5); // releasing a briefcaseId with held locks should release them
    lockStat = localHub.queryLockStatus("0x22");
    locks = localHub.queryAllLocks(5);
    assert.equal(locks.length, 0);
    assert.equal(localHub.countSharedLocks(), 1);

    localHub.releaseAllLocks({ briefcaseId: 6, changesetIndex: 3 });
    assert.equal(localHub.countSharedLocks(), 0);
    assert.equal(localHub.countLocks(), 4);

    lockStat = localHub.queryLockStatus("0x23");
    assert.equal(lockStat.lastExclusiveReleaseChangesetIndex, 3);
    assert.equal(lockStat.state, 0);

    lockStat = localHub.queryLockStatus("0x24");
    assert.equal(lockStat.lastExclusiveReleaseChangesetIndex, undefined);
    assert.equal(lockStat.lastSharedReleaseChangesetIndex, 3);
    assert.equal(lockStat.state, 0);

    await IModelHost[_hubAccess].deleteIModel({ iTwinId, iModelId });
  });

  it("HubMock report progress of changesets 'downloads'", async () => {
    const iModelId = await IModelHost[_hubAccess].createNewIModel({ iTwinId, iModelName: "test imodel", version0 });
    const localHub = HubMock.findLocalHub(iModelId);
    const briefcaseId = await HubMock.acquireNewBriefcaseId({ iModelId });

    const pathname = IModelTestUtils.resolveAssetFile("CloneTest.01.00.00.ecschema.xml");
    const fileSize = IModelJsFs.lstatSync(pathname)!.size;

    const cs1: ChangesetFileProps = {
      id: "changeset0", description: "first changeset", changesType: ChangesetType.Regular, parentId: "", briefcaseId, pushDate: "", index: 0,
      size: fileSize,
      userCreated: "user1", pathname,
    };
    const cs2: ChangesetFileProps = {
      id: "changeset1", parentId: cs1.id, description: "second changeset", changesType: ChangesetType.Schema, briefcaseId, pushDate: "", index: 0,
      size: fileSize,
      userCreated: "user2", pathname: IModelTestUtils.resolveAssetFile("CloneTest.01.00.01.ecschema.xml"),
    };
    cs1.index = localHub.addChangeset(cs1);
    cs2.index = localHub.addChangeset(cs2);

    // Progress reporting of single changeset "download"
    let progressReports: { downloaded: number, total: number }[] = [];
    let progressCallback: ProgressFunction = (downloaded, total) => {
      progressReports.push({ downloaded, total });
      return ProgressStatus.Continue;
    };
    let cProps = await HubMock.downloadChangeset({
      iModelId,
      changeset: {
        index: cs1.index,
      },
      targetDir: tmpDir,
      progressCallback,
    });
    let previousReport = { downloaded: 0, total: 0 };
    for (const report of progressReports) {
      assert.isTrue(report.downloaded > previousReport.downloaded);
      assert.equal(report.total, cProps.size);
    }

    // Progress reporting of multiple changesets "download"
    progressReports = [];
    let cPropsSet = await HubMock.downloadChangesets({
      iModelId,
      targetDir: tmpDir,
      progressCallback,
    });
    previousReport = { downloaded: 0, total: 0 };
    const totalSize = cPropsSet.reduce((sum, props) => sum + (props.size ?? 0), 0);
    for (const report of progressReports) {
      assert.isTrue(report.downloaded > previousReport.downloaded);
      assert.equal(report.total, totalSize);
    }

    // Cancel single changeset "download"
    progressReports = [];
    progressCallback = (downloaded, total) => {
      progressReports.push({ downloaded, total });
      return downloaded > total / 2 ? ProgressStatus.Abort : ProgressStatus.Continue;
    };
    let errorThrown: boolean = false;
    try {
      cProps = await HubMock.downloadChangeset({
        iModelId,
        changeset: {
          index: cs1.index,
        },
        targetDir: tmpDir,
        progressCallback,
      });
    } catch {
      errorThrown = true;
    }
    assert.isTrue(errorThrown);
    let lastReport = progressReports[progressReports.length - 1];
    assert.isBelow(lastReport.downloaded, lastReport.total);

    // Cancel multiple changesets "download"
    progressReports = [];
    errorThrown = false;
    try {
      cPropsSet = await HubMock.downloadChangesets({
        iModelId,
        targetDir: tmpDir,
        progressCallback,
      });
    } catch {
      errorThrown = true;
    }
    assert.isTrue(errorThrown);
    lastReport = progressReports[progressReports.length - 1];
    assert.isBelow(lastReport.downloaded, lastReport.total);
  });

  it("use HubMock with BriefcaseManager", async () => {
    const iModelId = await IModelHost[_hubAccess].createNewIModel({ iTwinId, iModelName: "test imodel", version0 });
    const briefcase = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });
    assert.equal(briefcase.briefcaseId, 2);
    assert.equal(briefcase.changeset.id, "");
    assert.equal(briefcase.iModelId, iModelId);
    assert.equal(briefcase.iTwinId, iTwinId);
    await IModelHost[_hubAccess].deleteIModel({ iTwinId, iModelId });
  });

  describe("locking behavior", () => {
    const createVersion0 = async () => {
      const dbName = IModelTestUtils.prepareOutputFile("ServerBasedLocks", "ServerBasedLocks.bim");
      const sourceDb = SnapshotDb.createEmpty(dbName, { rootSubject: { name: "server lock test" } });
      assert.isFalse(sourceDb.locks.isServerBased);
      await ExtensiveTestScenario.prepareDb(sourceDb);
      await ExtensiveTestScenario.populateDb(sourceDb);
      sourceDb.close();
      return dbName;
    };

    const accessToken1: AccessToken = "user1";
    const accessToken2: AccessToken = "user2";
    let iModelId: GuidString;
    let briefcase1Props: LocalBriefcaseProps;
    let briefcase2Props: LocalBriefcaseProps;

    //afterEach(() => sinonRestore());
    before(async () => {
      const iModelProps = {
        iModelName: "HubMock locks test",
        iTwinId: HubMock.iTwinId,
        version0: await createVersion0(),
      };

      iModelId = await HubMock.createNewIModel(iModelProps);
      const args: RequestNewBriefcaseProps = { iTwinId: iModelProps.iTwinId, iModelId };
      briefcase1Props = await BriefcaseManager.downloadBriefcase({ accessToken: accessToken1, ...args });
      briefcase2Props = await BriefcaseManager.downloadBriefcase({ accessToken: accessToken2, ...args });
    });

    let bc1: BriefcaseDb;
    let bc2: BriefcaseDb | undefined;

    beforeEach(async () => {
      bc1 = await BriefcaseDb.open({ fileName: briefcase1Props.fileName });
      expect(bc1.locks.isServerBased).to.be.true;
      bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc1.pullChanges();
    });

    afterEach(async () => {
      await bc1.discardChanges();
      bc1.close();

      if (bc2 !== undefined) {
        await bc2.discardChanges();
        bc2.close();
        bc2 = undefined;
      }
    });

    it("a pushed change to an element prevents acquiring an exclusive lock on the same element without pulling first", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc2.pullChanges();

      const childId = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1B");

      await bc1.locks.acquireLocks({ exclusive: childId });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(childId);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // bc2 should not be able to acquire an exclusive lock because bc1 still holds it.
      await expect(bc2.locks.acquireLocks({ exclusive: childId })).to.be.rejectedWith("exclusive lock is already held");

      // Pushing bc1's changes will release the lock, but bc2 still won't be able to acquire it yet.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });
      await expect(bc2.locks.acquireLocks({ exclusive: childId })).to.be.rejectedWith("pull is required to obtain lock");

      // Once bc2 pulls, it can successfully acquire the lock.
      await bc2.pullChanges({ accessToken: accessToken2 });
      await bc2.locks.acquireLocks({ exclusive: childId });
    });

    it("parent lock prevents acquiring a child lock without pulling first", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      const parentId = IModelTestUtils.queryByUserLabel(bc1, "PhysicalObject1");
      const childId = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1B");

      await bc1.locks.acquireLocks({ exclusive: parentId });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(childId);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // bc2 should not be able to acquire an exclusive lock on the child because bc1 holds a lock on the parent.
      await expect(bc2.locks.acquireLocks({ exclusive: childId })).to.be.rejectedWith("exclusive lock is already held");

      // Pushing bc1's changes will release the lock, but bc2 still won't be able to acquire the child lock yet.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });
      await expect(bc2.locks.acquireLocks({ exclusive: childId })).to.be.rejectedWith("pull is required to obtain lock");

      // Once bc2 pulls, it can successfully acquire the child lock.
      await bc2.pullChanges({ accessToken: accessToken2 });
      await bc2.locks.acquireLocks({ exclusive: childId });
    });

    it("model lock prevents acquiring a child lock without pulling first", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc2.pullChanges();

      const elementId = IModelTestUtils.queryByUserLabel(bc1, "PhysicalObject1");
      const modelId = bc1.elements.getElementProps(elementId).model;

      await bc1.locks.acquireLocks({ exclusive: modelId });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(elementId);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // bc2 should not be able to acquire an exclusive lock on the sub-model because bc1 holds a lock on the model.
      await expect(bc2.locks.acquireLocks({ exclusive: elementId })).to.be.rejectedWith("exclusive lock is already held");

      // Pushing bc1's changes will release the lock, but bc2 still won't be able to acquire the sub-model lock yet.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });
      await expect(bc2.locks.acquireLocks({ exclusive: elementId })).to.be.rejectedWith("pull is required to obtain lock");

      // Once bc2 pulls, it can successfully acquire the sub-model lock.
      await bc2.pullChanges({ accessToken: accessToken2 });
      await bc2.locks.acquireLocks({ exclusive: elementId });
    });

    it("a pushed change to sibling element should not prevent acquiring an exclusive lock", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc2.pullChanges();

      const child1Id = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1A");
      const child2Id = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1B");

      await bc1.locks.acquireLocks({ exclusive: child1Id });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(child1Id);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // Pushing bc1's changes will release the lock.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });

      // bc2 should be able to acquire an exclusive lock on a sibling element without pulling.
      await bc2.locks.acquireLocks({ exclusive: child2Id });
    });

    it("edited child prevents acquiring parent lock without pulling first", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

      const parentId = IModelTestUtils.queryByUserLabel(bc1, "PhysicalObject1");
      const childId = IModelTestUtils.queryByUserLabel(bc1, "ChildObject1B");

      await bc1.locks.acquireLocks({ exclusive: childId });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(childId);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // bc2 should not be able to acquire an exclusive lock on the parent because bc1 holds a lock on the child.
      await expect(bc2.locks.acquireLocks({ exclusive: parentId })).to.be.rejectedWith("shared lock is held");

      // Pushing bc1's changes will release the lock, but bc2 still won't be able to acquire the parent lock yet.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });
      await expect(bc2.locks.acquireLocks({ exclusive: parentId })).to.be.rejectedWith("pull is required to obtain lock");

      // Once bc2 pulls, it can successfully acquire the parent lock.
      await bc2.pullChanges({ accessToken: accessToken2 });
      await bc2.locks.acquireLocks({ exclusive: parentId });
    });

    it("edited sub-model prevents acquiring model lock without pulling first", async () => {
      bc2 = await BriefcaseDb.open({ fileName: briefcase2Props.fileName });
      expect(bc2.locks.isServerBased).to.be.true;
      bc2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await bc2.pullChanges();

      const elementId = IModelTestUtils.queryByUserLabel(bc1, "PhysicalObject1");
      const modelId = bc1.elements.getElementProps(elementId).model;

      await bc1.locks.acquireLocks({ exclusive: elementId });
      withEditTxn(bc1, (txn) => {
        const element = bc1.elements.getElement<PhysicalElement>(elementId);
        element.setUserProperties("foo", Guid.createValue());
        txn.updateElement(element.toJSON());
      });

      // bc2 should not be able to acquire an exclusive lock on the model because bc1 holds a lock on the sub-model.
      await expect(bc2.locks.acquireLocks({ exclusive: modelId })).to.be.rejectedWith("shared lock is held");

      // Pushing bc1's changes will release the lock, but bc2 still won't be able to acquire the model lock yet.
      await bc1.pushChanges({ accessToken: accessToken1, description: "test change" });
      await expect(bc2.locks.acquireLocks({ exclusive: modelId })).to.be.rejectedWith("pull is required to obtain lock");

      // Once bc2 pulls, it can successfully acquire the model lock.
      await bc2.pullChanges({ accessToken: accessToken2 });
      await bc2.locks.acquireLocks({ exclusive: modelId });
    });
  });
});
