/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { OidcAgentClientConfiguration, OidcAgentClient } from "@bentley/imodeljs-clients-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelDb, OpenParams, AuthorizedBackendRequestContext } from "../../imodeljs-backend";
import { HubUtility } from "./HubUtility";

describe("Agent (#integration)", () => {

  let agentConfiguration: OidcAgentClientConfiguration;

  before(async () => {
    IModelTestUtils.setupLogging();
    // IModelTestUtils.setupDebugLogLevels();

    agentConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "context-registry-service imodelhub",
    };
  });

  it("Agent should be able to open an iModel Readonly", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt: AccessToken = await agentClient.getToken(new ClientRequestContext());
    const requestContext = new AuthorizedBackendRequestContext(jwt);

    const testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadOnlyTest");

    const iModelDb = await IModelDb.open(requestContext, testProjectId, testIModelId, OpenParams.fixedVersion(), IModelVersion.latest());
    assert.isDefined(iModelDb);
  });

  it("Agent should be able to open an iModel ReadWrite", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt: AccessToken = await agentClient.getToken(new ClientRequestContext());
    const requestContext = new AuthorizedBackendRequestContext(jwt);

    const testProjectId = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const testIModelId = await HubUtility.queryIModelIdByName(requestContext, testProjectId, "ReadWriteTest");

    const iModelDb = await IModelDb.open(requestContext, testProjectId, testIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
    assert.isDefined(iModelDb);
  });

});
