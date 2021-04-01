/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AgentAuthorizationClient, AgentAuthorizationClientConfiguration } from "@bentley/backend-itwin-client";
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { assert } from "chai";
import { AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// Configuration needed
//    imjs_agent_test_client_id
//    imjs_agent_test_client_secret

describe("Agent iModel Download (#integration)", () => {
  let testProjectId: string;
  let testReadIModelId: string;
  let testWriteIModelId: string;
  let requestContext: AuthorizedBackendRequestContext;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "imodelhub context-registry-service:read-only",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    const jwt = await agentClient.getAccessToken(new ClientRequestContext());
    requestContext = new AuthorizedBackendRequestContext(jwt);
    requestContext.enter();

    testProjectId = await HubUtility.getTestContextId(requestContext);
    requestContext.enter();

    testReadIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readOnly);
    requestContext.enter();

    testWriteIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.testIModelNames.readWrite);
    requestContext.enter();
  });

  after(async () => {
    requestContext.enter();

    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcasesById(requestContext, testReadIModelId);
    requestContext.enter();
    await HubUtility.purgeAcquiredBriefcasesById(requestContext, testWriteIModelId);
    requestContext.enter();
  });

  it("Agent should be able to open a checkpoint", async () => {
    requestContext.enter();
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testReadIModelId });
    assert.isDefined(iModelDb);
  });

  it("Agent should be able to open a briefcase", async () => {
    requestContext.enter();
    const iModelDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: testProjectId, iModelId: testWriteIModelId });
    assert.isDefined(iModelDb);
  });
});
