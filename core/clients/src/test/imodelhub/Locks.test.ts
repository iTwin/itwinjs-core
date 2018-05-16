/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { Lock, Briefcase, LockType, LockLevel, AggregateResponseError, ConflictingLocksError } from "../../imodelhub";
import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

chai.should();

function mockDeleteAllLocks(imodelId: string, briefcaseId: number) {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.iModel, imodelId, "Lock", `DeleteAll-${briefcaseId}`);
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Delete, requestPath);
}

describe("iModelHubClient LockHandler", () => {
  let accessToken: AccessToken;
  let iModelId: string;
  const imodelName = "imodeljs-clients Locks test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();
  let briefcases: Briefcase[];
  let lastObjectId: string;

  before(async function (this: Mocha.IHookCallbackContext) {
    accessToken = await utils.login();
    // Doesn't create an imodel right now, but should in the future
    await utils.createIModel(accessToken, imodelName);
    iModelId = await utils.getIModelId(accessToken, imodelName);
    briefcases = (await utils.getBriefcases(accessToken, iModelId, 2));
    lastObjectId = await utils.getLastLockObjectId(accessToken, iModelId);

    // make sure there exists at least one lock
    if ((!TestConfig.enableMocks) && lastObjectId === "0x0") {
      lastObjectId = utils.incrementLockObjectId(lastObjectId);
      await imodelHubClient.Locks().update(accessToken, iModelId,
        [utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId, 1, 1, briefcases[0].fileId)]);
    }
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should acquire one Lock", async function (this: Mocha.ITestCallbackContext) {
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId, 1, 1, briefcases[0].fileId);
    utils.mockUpdateLocks(iModelId, generatedLock);
    const lock = (await imodelHubClient.Locks().update(accessToken, iModelId, [generatedLock]))[0];

    chai.assert(lock);
    chai.expect(lock.briefcaseId).equal(briefcases[0].briefcaseId);
    chai.expect(lock.lockLevel).equal(generatedLock.lockLevel);
    chai.expect(lock.lockType).equal(generatedLock.lockType);
  });

  it("should acquire multiple Locks", async function (this: Mocha.ITestCallbackContext) {
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock1 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId, 1, 1, briefcases[0].fileId);
    lastObjectId = utils.incrementLockObjectId(lastObjectId);
    const generatedLock2 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId, 1, 1, briefcases[0].fileId);

    utils.mockUpdateLocks(iModelId, generatedLock1, generatedLock2);
    const locks = (await imodelHubClient.Locks().update(accessToken, iModelId, [generatedLock1, generatedLock2]));

    chai.assert(locks);
    chai.expect(locks.length).to.be.equal(2);
  });

  it("should update Lock multiple times", async function (this: Mocha.ITestCallbackContext) {
    utils.mockGetLocks(iModelId, utils.generateLock(false, briefcases[0].briefcaseId, undefined, LockType.Model, LockLevel.Shared));
    let lock: Lock = (await imodelHubClient.Locks().get(accessToken, iModelId))[0];
    chai.assert(lock);

    lock.seedFileId = briefcases[0].fileId!;
    lock.lockLevel = LockLevel.None;
    utils.mockUpdateLocks(iModelId, lock);
    lock = (await imodelHubClient.Locks().update(accessToken, iModelId, [lock]))[0];
    chai.assert(lock);
    chai.expect(lock.lockLevel).equals(LockLevel.None);

    lock.lockLevel = LockLevel.Shared;
    utils.mockUpdateLocks(iModelId, lock);
    lock = (await imodelHubClient.Locks().update(accessToken, iModelId, [lock]))[0];
    chai.assert(lock);
    chai.expect(lock.lockLevel).equals(LockLevel.Shared);
  });

  it("should get information on Locks", async function (this: Mocha.ITestCallbackContext) {

    utils.mockGetLocks(iModelId, ResponseBuilder.generateObject<Lock>(Lock));
    // Needs to acquire before expecting more than 0.
    const locks: Lock[] = await imodelHubClient.Locks().get(accessToken, iModelId);
    chai.expect(locks.length).to.be.greaterThan(0);
  });

  it("should fail on conflicting locks", async () => {
    const lock1 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock2 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock3 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock4 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);

    utils.mockUpdateLocks(iModelId, lock1, lock2, lock3);

    const result = await imodelHubClient.Locks().update(accessToken, iModelId, [lock1, lock2, lock3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);

    lock2.briefcaseId = briefcases[1].briefcaseId;
    lock3.briefcaseId = briefcases[1].briefcaseId;
    lock4.briefcaseId = briefcases[1].briefcaseId;

    utils.mockDeniedLocks(iModelId, lock2);
    utils.mockDeniedLocks(iModelId, lock3);
    utils.mockUpdateLocks(iModelId, lock4);

    let receivedError: Error | undefined;
    try {
      await imodelHubClient.Locks().update(accessToken, iModelId, [lock2, lock3, lock4],
        { locksPerRequest: 1 });
    } catch (error) {
      receivedError = error;
    }

    chai.assert(receivedError);
    chai.expect(receivedError).to.be.instanceof(AggregateResponseError);
  });

  it("should return conflicting locks", async () => {
    const lock1 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock2 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock3 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);
    const lock4 = utils.generateLock(false, briefcases[0].briefcaseId!, lastObjectId = utils.incrementLockObjectId(lastObjectId), 1, 2, briefcases[0].fileId);

    utils.mockUpdateLocks(iModelId, lock1, lock2, lock3);

    const result = await imodelHubClient.Locks().update(accessToken, iModelId, [lock1, lock2, lock3]);
    chai.assert(result);
    chai.expect(result.length).to.be.equal(3);

    lock2.briefcaseId = briefcases[1].briefcaseId;
    lock3.briefcaseId = briefcases[1].briefcaseId;
    lock4.briefcaseId = briefcases[1].briefcaseId;

    utils.mockDeniedLocks(iModelId, lock2);
    utils.mockDeniedLocks(iModelId, lock3);
    utils.mockUpdateLocks(iModelId, lock4);

    let receivedError: ConflictingLocksError | undefined;
    try {
      await imodelHubClient.Locks().update(accessToken, iModelId, [lock2, lock3, lock4],
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
      mockDeleteAllLocks(iModelId, briefcase.briefcaseId!);
      await imodelHubClient.Locks().deleteAll(accessToken, iModelId, briefcase.briefcaseId!);
    }
  });
});
