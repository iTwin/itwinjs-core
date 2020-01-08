/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelVersion, MobileRpcConfiguration } from "@bentley/imodeljs-common";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { OidcAgentClientConfiguration, OidcAgentClient } from "@bentley/imodeljs-clients-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelDb, OpenParams, AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { HubUtility } from "./HubUtility";

describe("Agent (#integration)", () => {
  // iOS does not support agent test
  if (!MobileRpcConfiguration.isMobileBackend) {
    let testProjectId: string;
    let testReadIModelId: string;
    let testWriteIModelId: string;
    let requestContext: AuthorizedBackendRequestContext;

    before(async () => {
      IModelTestUtils.setupLogging();
      // IModelTestUtils.setupDebugLogLevels();

      const agentConfiguration: OidcAgentClientConfiguration = {
        clientId: Config.App.getString("imjs_agent_test_client_id"),
        clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
        scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686",
      };

      const agentClient = new OidcAgentClient(agentConfiguration);
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
      const iModelDb = await IModelDb.open(requestContext, testProjectId, testReadIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
      assert.isDefined(iModelDb);
    });

    it("Agent should be able to open an iModel ReadWrite", async () => {
      const iModelDb = await IModelDb.open(requestContext, testProjectId, testWriteIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.isDefined(iModelDb);
    });
  } else {
    it("Agent (#integration) is not supported on iOS", () => { });
  }
});
