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

describe("Agent (#integration)", () => {
  // iOS does not support agent test
  let testProjectId: string;
  let testReadIModelId: string;
  let testWriteIModelId: string;
  let requestContext: AuthorizedBackendRequestContext;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    const jwt = await agentClient.getAccessToken(new ClientRequestContext());
    requestContext = new AuthorizedBackendRequestContext(jwt);

    testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    testReadIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadOnlyTest");
    testWriteIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadWriteTest");
  });

  after(async () => {
    // Purge briefcases that are close to reaching the acquire limit
    await HubUtility.purgeAcquiredBriefcases(requestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
    await HubUtility.purgeAcquiredBriefcases(requestContext, "iModelJsIntegrationTest", "ReadWriteTest");
  });

  it("Agent should be able to open a checkpoint", async () => {
    const iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: testProjectId, iModelId: testReadIModelId });
    assert.isDefined(iModelDb);
  });

  it("Agent should be able to open a briefcase", async () => {
    const iModelDb = await IModelTestUtils.downloadAndOpenBriefcase({ requestContext, contextId: testProjectId, iModelId: testWriteIModelId });
    assert.isDefined(iModelDb);
  });
});
