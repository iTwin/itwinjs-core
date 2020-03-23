/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, Config } from "@bentley/imodeljs-clients";
import { OidcAgentClientConfigurationV1, OidcAgentClientV1 } from "@bentley/imodeljs-clients-backend";
import { IModelVersion, MobileRpcConfiguration } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { AuthorizedBackendRequestContext, BriefcaseDb, OpenParams } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubUtility } from "./HubUtility";

// NEEDS_WORK: Commented out since this workflow is not supported after ping migration - issue reported to OIDC team.
describe.skip("AgentV1 (#integration)", () => {
  // Agent test is not supported on ios
  if (!MobileRpcConfiguration.isMobileBackend) {
    let testProjectId: string;

    let testReadIModelId: string;
    let testWriteIModelId: string;
    let requestContext: AuthorizedBackendRequestContext;

    before(async () => {
      IModelTestUtils.setupLogging();
      // IModelTestUtils.setupDebugLogLevels();

      const agentConfiguration: OidcAgentClientConfigurationV1 = {
        clientId: Config.App.getString("imjs_agent_v1_test_client_id"),
        clientSecret: Config.App.getString("imjs_agent_v1_test_client_secret"),
        serviceUserEmail: Config.App.getString("imjs_agent_v1_test_service_user_email"),
        serviceUserPassword: Config.App.getString("imjs_agent_v1_test_service_user_password"),
        scope: "openid email profile organization context-registry-service imodelhub",
      };

      const agentClient = new OidcAgentClientV1(agentConfiguration);
      const jwt: AccessToken = await agentClient.getToken(new ClientRequestContext());
      requestContext = new AuthorizedBackendRequestContext(jwt);

      testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
      testReadIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadOnlyTest");
      testWriteIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadWriteTest");
    });

    after(async () => {
      // Purge briefcases that are close to reaching the aquire limit
      await HubUtility.purgeAcquiredBriefcases(requestContext, "iModelJsIntegrationTest", "ReadOnlyTest");
      await HubUtility.purgeAcquiredBriefcases(requestContext, "iModelJsIntegrationTest", "ReadWriteTest");
    });

    it("Agent should be able to open an iModel Readonly", async () => {
      const iModelDb = await BriefcaseDb.open(requestContext, testProjectId, testReadIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
      assert.isDefined(iModelDb);
    });

    it("Agent should be able to open an iModel ReadWrite", async () => {
      const iModelDb = await BriefcaseDb.open(requestContext, testProjectId, testWriteIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.isDefined(iModelDb);
    });
  } else {
    it("AgentV1 (#integration) is not supported on iOS", () => { });
  }
});
