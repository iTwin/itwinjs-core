/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Guid, GuidString, Id64, Id64String, IModelHubStatus } from "@bentley/bentleyjs-core";
import {
  AggregateResponseError, Briefcase, ChangeSet, ConflictingLocksError, IModelClient, IModelHubClientError, Lock, LockLevel, LockQuery, LockType,
} from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool";
import { ResponseBuilder } from "../ResponseBuilder";
import { TestConfig } from "../TestConfig";
import * as utils from "./TestUtils";

chai.should();

describe("iModelHubClient LockHandler (#iModelBank)", () => {
  let contextId: string;
  let imodelId: GuidString;
  let iModelClient: IModelClient;
  let briefcases: Briefcase[];
  let changeSet: ChangeSet;
  let lastObjectId: Id64String;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const conflictStrategyOption = { CustomOptions: { ConflictStrategy: "Continue" } };
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    const accessToken: AccessToken = TestConfig.enableMocks ? new utils.MockAccessToken() : await utils.login(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext(accessToken);

    contextId = await utils.getProjectId(requestContext);
    // Does not create an imodel right now, but should in the future
    await utils.createIModel(requestContext, utils.sharedimodelName, contextId, true, true);
    imodelId = await utils.getIModelId(requestContext, utils.sharedimodelName, contextId);
    iModelClient = utils.getDefaultClient();
    briefcases = (await utils.getBriefcases(requestContext, imodelId, 2));
    lastObjectId = await utils.getLastLockObjectId(requestContext, imodelId);
    changeSet = (await utils.createChangeSets(requestContext, imodelId, briefcases[0]))[0];
    if (changeSet === undefined) {
      changeSet = (await iModelClient.changeSets.get(requestContext, imodelId))[0];
    }

    // make sure there exists at least two locks
    if ((!TestConfig.enableMocks) && lastObjectId.toString() === "0") {
      lastObjectId = utils.incrementLockObjectId(lastObjectId);
      await iModelClient.locks.update(requestContext, imodelId,
        [utils.generateLock(briefcases[0].briefcaseId, lastObjectId, LockType.Model, LockLevel.Shared, briefcases[0].fileId,
          changeSet.id, changeSet.index)]);

      lastObjectId = utils.incrementLockObjectId(lastObjectId);
      await iModelClient.locks.update(requestContext, imodelId,
        [utils.generateLock(briefcases[1].briefcaseId, lastObjectId, LockType.Model, LockLevel.Shared, briefcases[1].fileId)]);
    }
  });

  after(async () => {
    if (TestConfig.enableIModelBank) {
      await utils.deleteIModelByName(requestContext, contextId, utils.sharedimodelName);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should acquire one Lock", async () => {
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock = utils.generateLock(briefcases[0].briefcaseId, lastObjectId, 1, 1, briefcases[0].fileId);
    utils.mockUpdateLocks(imodelId, [generatedLock]);
    const lock = (await iModelClient.locks.update(requestContext, imodelId, [generatedLock]))[0];

    chai.assert(lock);
    chai.expect(lock.briefcaseId).equal(briefcases[0].briefcaseId);
    chai.expect(lock.lockLevel).equal(generatedLock.lockLevel);
    chai.expect(lock.lockType).equal(generatedLock.lockType);
  });

  it("should acquire multiple Locks", async () => {
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock1 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId, 1, 1, briefcases[0].fileId);
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock2 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId, 1, 1, briefcases[0].fileId);

    utils.mockUpdateLocks(imodelId, [generatedLock1, generatedLock2]);
    const locks = (await iModelClient.locks.update(requestContext, imodelId, [generatedLock1, generatedLock2]));

    chai.assert(locks);
    chai.expect(locks.length).to.be.equal(2);
  });

  it("should update Lock multiple times", async () => {
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock = utils.generateLock(briefcases[0].briefcaseId, lastObjectId, 1, 1, briefcases[0].fileId);

    utils.mockUpdateLocks(imodelId, [generatedLock]);
    let lock = (await iModelClient.locks.update(requestContext, imodelId, [generatedLock]))[0];

    lock.lockLevel = LockLevel.None;
    utils.mockUpdateLocks(imodelId, [lock]);
    lock = (await iModelClient.locks.update(requestContext, imodelId, [lock]))[0];
    chai.assert(lock);
    chai.expect(lock.lockLevel).equals(LockLevel.None);

    lock.lockLevel = LockLevel.Shared;
    lock.releasedWithChangeSet = changeSet.id;
    utils.mockUpdateLocks(imodelId, [lock]);
    lock = (await iModelClient.locks.update(requestContext, imodelId, [lock]))[0];
    chai.assert(lock);
    chai.expect(lock.lockLevel).equals(LockLevel.Shared);
  });

  it("should get information on Locks", async () => {
    utils.mockGetLocks(imodelId, `?$top=${LockQuery.defaultPageSize}`, ResponseBuilder.generateObject<Lock>(Lock));
    // Needs to acquire before expecting more than 0.
    const locks: Lock[] = await iModelClient.locks.get(requestContext, imodelId);
    chai.expect(locks.length).to.be.greaterThan(0);
  });

  it("should get Locks in chunks", async () => {
    const mockedLocks = [
      utils.generateLock(briefcases[0].briefcaseId), utils.generateLock(briefcases[0].briefcaseId),
      utils.generateLock(briefcases[0].briefcaseId), utils.generateLock(briefcases[0].briefcaseId),
      utils.generateLock(briefcases[0].briefcaseId),
    ];

    utils.mockGetLocks(imodelId, `?$top=${LockQuery.defaultPageSize}`, ...mockedLocks);
    const locks: Lock[] = await iModelClient.locks.get(requestContext, imodelId);
    chai.expect(locks.length).to.be.greaterThan(0);

    if (locks.length > 20) {
      const locks2: Lock[] = await iModelClient.locks.get(requestContext, imodelId, new LockQuery().pageSize(10));
      chai.expect(locks2.length).to.be.equal(locks.length);
    } else {
      utils.mockGetLocks(imodelId, `?$top=2`, ...mockedLocks);
      const locks2: Lock[] = await iModelClient.locks.get(requestContext, imodelId, new LockQuery().pageSize(2));
      chai.expect(locks2.length).to.be.equal(locks.length);
    }
  });

  it("should get locks by briefcaseId", async () => {
    const filter = `?$filter=BriefcaseId+eq+${briefcases[0].briefcaseId}`;
    utils.mockGetLocks(imodelId, `${filter}&$top=${LockQuery.defaultPageSize}`, utils.generateLock(briefcases[0].briefcaseId));

    const query = new LockQuery().byBriefcaseId(briefcases[0].briefcaseId!);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks).length.to.be.greaterThan(0);
    locks.forEach((lock) => chai.expect(lock.briefcaseId).to.be.equal(briefcases[0].briefcaseId));
  });

  it("should get lock by objectId", async () => {
    const objectId = Id64.fromString("0x1");
    utils.mockGetLocks(imodelId, undefined, utils.generateLock(undefined, objectId));

    const query = new LockQuery().byObjectId(objectId);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks).length.to.be.greaterThan(0);
    locks.forEach((lock) => chai.expect(lock.objectId!.toString()).to.be.equal(objectId.toString()));
  });

  it("should get locks by releasedWithChangeset", async () => {
    const filter = `?$filter=ReleasedWithChangeSet+eq+%27${changeSet.id}%27`;
    const mockedLocks = [utils.generateLock(briefcases[0].briefcaseId, undefined, undefined,
      undefined, undefined, changeSet.id), utils.generateLock(briefcases[0].briefcaseId)];
    utils.mockGetLocks(imodelId, `?$top=${LockQuery.defaultPageSize}`, ...mockedLocks);
    utils.mockGetLocks(imodelId, `${filter}&$top=${LockQuery.defaultPageSize}`, mockedLocks[0]);

    const allLocks = await iModelClient.locks.get(requestContext, imodelId);
    const query = new LockQuery().byReleasedWithChangeSet(changeSet.id!);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks.length).to.be.greaterThan(0);
    chai.expect(locks.length).to.be.lessThan(allLocks.length);
  });

  it("should get locks by releasedWithChangeSetIndex", async () => {
    const filter = `?$filter=ReleasedWithChangeSetIndex+eq+${changeSet.index}`;
    const mockedLocks = [utils.generateLock(briefcases[0].briefcaseId, undefined, undefined,
      undefined, undefined, changeSet.id), utils.generateLock(briefcases[0].briefcaseId)];
    utils.mockGetLocks(imodelId, `?$top=${LockQuery.defaultPageSize}`, ...mockedLocks);
    utils.mockGetLocks(imodelId, `${filter}&$top=${LockQuery.defaultPageSize}`, mockedLocks[0]);

    const allLocks = await iModelClient.locks.get(requestContext, imodelId);
    const query = new LockQuery().byReleasedWithChangeSetIndex(Number.parseInt(changeSet.index!, 10));
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks).length.to.be.greaterThan(0);
    chai.expect(locks.length).to.be.lessThan(allLocks.length);
  });

  it("should get locks by lock level and lock type", async () => {
    const filter = `?$filter=LockLevel+eq+${LockLevel.Shared}+and+LockType+eq+${LockType.Model}`;
    utils.mockGetLocks(imodelId, `${filter}&$top=${LockQuery.defaultPageSize}`, utils.generateLock(briefcases[0].briefcaseId));

    const query = new LockQuery().byLockLevel(LockLevel.Shared).byLockType(LockType.Model);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks).length.to.be.greaterThan(0);
    locks.forEach((lock) => {
      chai.expect(lock.lockLevel).to.be.equal(LockLevel.Shared);
      chai.expect(lock.lockType).to.be.equal(LockType.Model);
    });
  });

  it("should get locks by instance ids", async () => {
    const fileId: GuidString = Guid.createValue();
    const mockedLocks = [
      utils.generateLock(briefcases[0].briefcaseId, undefined, LockType.Model, LockLevel.Shared, fileId, "", "0"),
      utils.generateLock(briefcases[1].briefcaseId, undefined, LockType.Model, LockLevel.Shared, fileId, "", "0"),
    ];
    utils.mockGetLocks(imodelId, `?$filter=BriefcaseId+eq+2&$top=${LockQuery.defaultPageSize}`, ...mockedLocks);

    let existingLocks = await iModelClient.locks.get(requestContext, imodelId, new LockQuery().byBriefcaseId(briefcases[0].briefcaseId!));
    existingLocks = existingLocks.slice(0, 2);

    utils.mockGetLocks(imodelId, undefined, ...mockedLocks);

    const query = new LockQuery().byLocks(existingLocks);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks.length).to.be.equal(existingLocks.length);
    for (let i = 0; i < locks.length; ++i) {
      chai.expect(locks[i].lockLevel).to.be.equal(existingLocks[i].lockLevel);
      chai.expect(locks[i].lockType).to.be.equal(existingLocks[i].lockType);
      chai.expect(locks[i].briefcaseId).to.be.equal(existingLocks[i].briefcaseId);
      chai.expect(locks[i].objectId!.toString()).to.be.equal(existingLocks[i].objectId!.toString());
    }
  });

  it("should get unavailable locks", async () => {
    if (TestConfig.enableMocks) {
      const mockedLocks = [
        utils.generateLock(briefcases[0].briefcaseId, undefined, LockType.Model, LockLevel.Shared),
        utils.generateLock(briefcases[1].briefcaseId, undefined, LockType.Model, LockLevel.None),
        utils.generateLock(briefcases[1].briefcaseId, undefined, LockType.Model, LockLevel.None),
      ];
      utils.mockGetLocks(imodelId, undefined, ...mockedLocks);

      const filter = `?$filter=BriefcaseId+ne+${briefcases[0].briefcaseId}+and+(LockLevel+gt+0+or+ReleasedWithChangeSetIndex+gt+${changeSet.index!})`;
      utils.mockGetLocks(imodelId, `${filter}&$top=${LockQuery.defaultPageSize}`, ...mockedLocks);
    }
    const query = new LockQuery().unavailableLocks(briefcases[0].briefcaseId!, changeSet.index!);
    const locks = await iModelClient.locks.get(requestContext, imodelId, query);
    chai.assert(locks);
    chai.expect(locks.length).to.be.greaterThan(0);
    locks.forEach((lock: Lock) => {
      chai.expect(lock.lockLevel).to.be.not.equal(LockLevel.None);
    });
  });

  it("should fail on conflicting locks", async () => {
    const lock1 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock2 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock3 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock4 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);

    utils.mockUpdateLocks(imodelId, [lock1, lock2, lock3]);

    const result = await iModelClient.locks.update(requestContext, imodelId, [lock1, lock2, lock3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);

    lock2.briefcaseId = briefcases[1].briefcaseId;
    lock3.briefcaseId = briefcases[1].briefcaseId;
    lock4.briefcaseId = briefcases[1].briefcaseId;

    utils.mockDeniedLocks(imodelId, [lock2]);
    utils.mockDeniedLocks(imodelId, [lock3]);
    utils.mockUpdateLocks(imodelId, [lock4]);

    let receivedError: Error | undefined;
    try {
      await iModelClient.locks.update(requestContext, imodelId, [lock2, lock3, lock4],
        { deniedLocks: false, locksPerRequest: 1 });
    } catch (error) {
      receivedError = error;
    }

    chai.assert(receivedError);
    chai.expect(receivedError).to.be.instanceof(AggregateResponseError);
  });

  it("should fail updating and return conflicting lock", async () => {
    const lock1 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock2 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock3 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);

    utils.mockUpdateLocks(imodelId, [lock1, lock2, lock3]);

    const result = await iModelClient.locks.update(requestContext, imodelId, [lock1, lock2, lock3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);

    lock2.briefcaseId = briefcases[1].briefcaseId;
    lock3.briefcaseId = briefcases[1].briefcaseId;

    utils.mockDeniedLocks(imodelId, [lock2]);
    utils.mockDeniedLocks(imodelId, [lock3]);

    let receivedError: ConflictingLocksError | undefined;
    try {
      await iModelClient.locks.update(requestContext, imodelId, [lock2, lock3],
        { deniedLocks: true, locksPerRequest: 1 });
    } catch (error) {
      chai.expect(error).to.be.instanceof(ConflictingLocksError);
      receivedError = error;
    }
    chai.assert(receivedError);
    chai.assert(receivedError!.conflictingLocks);
    chai.expect(receivedError!.conflictingLocks!.length).to.be.equal(1);
    chai.expect(receivedError!.conflictingLocks![0].lockLevel).to.be.equal(lock2.lockLevel);
    chai.expect(receivedError!.conflictingLocks![0].lockType).to.be.equal(lock2.lockType);
  });

  it("should return conflicting locks", async () => {
    const lock1 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock2 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock3 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock4 = utils.generateLock(briefcases[0].briefcaseId, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);

    utils.mockUpdateLocks(imodelId, [lock1, lock2, lock3]);

    const result = await iModelClient.locks.update(requestContext, imodelId, [lock1, lock2, lock3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);

    lock2.briefcaseId = briefcases[1].briefcaseId;
    lock3.briefcaseId = briefcases[1].briefcaseId;
    lock4.briefcaseId = briefcases[1].briefcaseId;

    utils.mockDeniedLocks(imodelId, [lock2], conflictStrategyOption);
    utils.mockDeniedLocks(imodelId, [lock3], conflictStrategyOption);
    utils.mockUpdateLocks(imodelId, [lock4], conflictStrategyOption);

    let receivedError: ConflictingLocksError | undefined;
    try {
      await iModelClient.locks.update(requestContext, imodelId, [lock2, lock3, lock4],
        { deniedLocks: true, locksPerRequest: 1, continueOnConflict: true });
    } catch (error) {
      chai.expect(error).to.be.instanceof(ConflictingLocksError);
      receivedError = error;
    }
    chai.assert(receivedError);
    chai.assert(receivedError!.conflictingLocks);
    chai.expect(receivedError!.conflictingLocks!.length).to.be.equal(2);
    chai.expect(receivedError!.conflictingLocks![0].lockLevel).to.be.equal(lock2.lockLevel);
    chai.expect(receivedError!.conflictingLocks![0].lockType).to.be.equal(lock2.lockType);
    chai.expect(receivedError!.conflictingLocks![1].lockLevel).to.be.equal(lock3.lockLevel);
    chai.expect(receivedError!.conflictingLocks![1].lockType).to.be.equal(lock3.lockType);
  });

  it("should delete all locks", async () => {
    for (const briefcase of briefcases) {
      utils.mockDeleteAllLocks(imodelId, briefcase.briefcaseId!);
      await iModelClient.locks.deleteAll(requestContext, imodelId, briefcase.briefcaseId!);
    }
  });

  it("should not create a query by locks with empty array", () => {
    let error: IModelHubClientError | undefined;
    try {
      new LockQuery().byLocks([]);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should not create a query by locks with no object id", () => {
    let error: IModelHubClientError | undefined;
    try {
      const lock = new Lock();
      lock.briefcaseId = 0; lock.lockType = LockType.Model;
      new LockQuery().byLocks([lock]);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });

  it("should fail deleting all locks with invalid briefcase id", async () => {
    let error: IModelHubClientError | undefined;
    try {
      await iModelClient.locks.deleteAll(requestContext, imodelId, 0);
    } catch (err) {
      if (err instanceof IModelHubClientError)
        error = err;
    }
    chai.assert(error);
    chai.expect(error!.errorNumber).to.be.equal(IModelHubStatus.InvalidArgumentError);
  });
});
