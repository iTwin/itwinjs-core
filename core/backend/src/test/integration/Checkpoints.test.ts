/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ClientRequestContext, GuidString } from "@bentley/bentleyjs-core";
import { CheckpointV2Query } from "@bentley/imodelhub-client";
import { ChangesetProps } from "@bentley/imodeljs-common";
import { BlobDaemon } from "@bentley/imodeljs-native";
import { AccessToken, AuthorizedClientRequestContext, IncludePrefix } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { assert } from "chai";
import { ChildProcess } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import { V1CheckpointManager } from "../../CheckpointManager";
import { IModelHubBackend } from "../../IModelHubBackend";
import { AuthorizedBackendRequestContext, IModelHost, IModelJsFs, SnapshotDb } from "../../imodeljs-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubUtility } from "./HubUtility";
import { TestChangeSetUtility } from "./TestChangeSetUtility";

describe("Checkpoints V2 (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;
  let testIModelId: GuidString;
  let testContextId: GuidString;
  let testChangeSet: ChangesetProps;

  const blockcacheDir = path.join(KnownTestLocations.outputDir, "blockcachevfs");
  let daemonProc: ChildProcess;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };
    process.env.BLOCKCACHE_DIR = blockcacheDir;
    // IModelTestUtils.setupDebugLogLevels();

    requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    testContextId = await HubUtility.getTestContextId(requestContext);
    testIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.stadium);
    testChangeSet = await IModelHost.hubAccess.getLatestChangeset({ requestContext, iModelId: testIModelId });

    const checkpointQuery = new CheckpointV2Query().byChangeSetId(testChangeSet.id).selectContainerAccessKey();
    const checkpoints = await IModelHubBackend.iModelClient.checkpointsV2.get(requestContext, testIModelId, checkpointQuery);
    assert.equal(checkpoints.length, 1, "checkpoint missing");
    assert.isDefined(checkpoints[0].containerAccessKeyAccount, "checkpoint storage account is invalid");

    // Start daemon process and wait for it to be ready
    fs.chmodSync((BlobDaemon as any).exeName({}), 744);  // FIXME: This probably needs to be an imodeljs-native postinstall step...
    daemonProc = BlobDaemon.start({
      daemonDir: blockcacheDir,
      storageType: "azure?sas=1",
      user: checkpoints[0].containerAccessKeyAccount!,
    });
    while (!IModelJsFs.existsSync(path.join(blockcacheDir, "portnumber.bcv"))) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  });

  after(async () => {
    process.env = originalEnv;

    if (daemonProc) {
      const onDaemonExit = new Promise((resolve) => daemonProc.once("exit", resolve));
      daemonProc.kill();
      await onDaemonExit;
    }
    fs.removeSync(blockcacheDir);
  });

  it("should be able to open and read V2 checkpoint", async () => {
    const iModel = await SnapshotDb.openCheckpointV2({
      requestContext,
      contextId: testContextId,
      iModelId: testIModelId,
      changeSetId: testChangeSet.id,
    });
    assert.equal(iModel.getGuid(), testIModelId);
    assert.equal(iModel.changeset.id, testChangeSet.id);
    assert.equal(iModel.contextId, testContextId);
    assert.equal(iModel.rootSubject.name, "Stadium Dataset 1");
    let numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    await iModel.reattachDaemon(requestContext);
    numModels = await iModel.queryRowCount("SELECT * FROM bis.model");
    assert.equal(numModels, 32);

    iModel.close();
  }).timeout(120000);
});

describe("Checkpoints V1 (#integration)", () => {
  let requestContext: AuthorizedBackendRequestContext;

  before(async () => {
    HubMock.startup("V1CheckpointsTest");
    requestContext = await IModelTestUtils.getUserContext(TestUserType.Regular);
  });

  after(() => {
    HubMock.shutdown();
  });

  it("should be able to refresh access token when preparing a V1 checkpoint", async () => {
    // Setup iModel with a single change set
    const managerRequestContext = await IModelTestUtils.getUserContext(TestUserType.Manager); // User1 is just used to create and update the iModel
    const testUtility = new TestChangeSetUtility(managerRequestContext, "V1CheckpointsTest");
    const briefcase = await testUtility.createTestIModel();
    const iModelId = briefcase.iModelId;
    await testUtility.pushTestChangeSet();
    briefcase.close();

    // Validate the test setup - checkpoint at index 0, and latest change set at index 2
    const localHub = HubMock.findLocalHub(iModelId);
    const checkpoints = localHub.getCheckpoints();
    assert.equal(checkpoints.length, 1);
    assert.equal(checkpoints[0], 0);
    const changeSetProps = localHub.getLatestChangeset();
    assert.equal(changeSetProps.index, 2);

    /// Setup host to supply the access token from the test user's requestContext
    IModelHost.authorizationClient = {
      isAuthorized: true,
      getAccessToken: async (_requestContext?: ClientRequestContext) => requestContext.accessToken,
    };

    // Setup a context with a token that's about to expire
    const jwt = requestContext.accessToken;
    const fourMinFromNow = new Date(Date.now() + 2 * 60 * 1000);
    const expiringToken = new AccessToken(jwt.toTokenString(IncludePrefix.No), jwt.getStartsAt(), fourMinFromNow, jwt.getUserInfo());
    const expiringContext = new AuthorizedClientRequestContext(expiringToken);

    // Download checkpoint for latest change set, and validate the access token gets refreshed
    const tmpDir = path.join(KnownTestLocations.outputDir, "V1CheckpointsTest");
    const localFile = path.join(tmpDir, "TestModel.bim");
    const request = { localFile, checkpoint: { requestContext: expiringContext, contextId: testUtility.projectId, iModelId: testUtility.iModelId, changeSetId: changeSetProps.id } };

    const db = await V1CheckpointManager.getCheckpointDb(request);
    db.close();

    assert.notStrictEqual(expiringContext.accessToken.getExpiresAt(), expiringToken.getExpiresAt());
    assert.strictEqual(expiringContext.accessToken.getExpiresAt(), requestContext.accessToken.getExpiresAt());
  });
});
