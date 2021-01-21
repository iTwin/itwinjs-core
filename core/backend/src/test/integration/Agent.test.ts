/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AgentAuthorizationClient, AgentAuthorizationClientConfiguration } from "@bentley/backend-itwin-client";
import { Config } from "@bentley/bentleyjs-core";
import { MobileRpcConfiguration } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// iOS and other mobile platform do not support Agent workflow.
if (!MobileRpcConfiguration.isMobileBackend) {
  describe("Agent (#integration)", () => {
    let testProjectId: string;
    let testReadIModelId: string;
    let testWriteIModelId: string;
    let requestContext: AuthorizedBackendRequestContext;

    before(async () => {
      // IModelTestUtils.setupDebugLogLevels();

      const agentConfiguration: AgentAuthorizationClientConfiguration = {
        clientId: Config.App.getString("imjs_agent_test_client_id"),
        clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
        scope: "imodelhub rbac-user:external-client context-registry-service:read-only ",
      };

      const agentClient = new AgentAuthorizationClient(agentConfiguration);
      const jwt = await agentClient.getAccessToken();
      requestContext = new AuthorizedBackendRequestContext(jwt);
      requestContext.enter();

      testProjectId = await HubUtility.getTestContextId(requestContext);
      requestContext.enter();

      testReadIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.TestIModelNames.readOnly);
      requestContext.enter();

      testWriteIModelId = await HubUtility.getTestIModelId(requestContext, HubUtility.TestIModelNames.readWrite);
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
}
