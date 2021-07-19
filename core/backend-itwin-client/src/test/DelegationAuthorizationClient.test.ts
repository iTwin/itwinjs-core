/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as path from "path";
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { AccessToken, SamlAccessToken } from "@bentley/itwin-client";
import {
  AgentAuthorizationClient, AgentAuthorizationClientConfiguration, DelegationAuthorizationClient, DelegationAuthorizationClientConfiguration,
} from "../backend-itwin-client";
import { HubAccessTestValidator } from "./HubAccessTestValidator";

loadEnv(path.join(__dirname, "..", "..", ".env"));

chai.should();

describe("DelegationAuthorizationClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  let jwt: AccessToken;
  const requestContext = new ClientRequestContext();

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    const agentConfiguration: AgentAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686",
    };

    const agentClient = new AgentAuthorizationClient(agentConfiguration);
    jwt = await agentClient.getAccessToken(requestContext);
  });

  it("should get valid SAML delegation tokens", async () => {

    const delegationConfiguration: DelegationAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_delegation_test_client_id"),
      clientSecret: Config.App.getString("imjs_delegation_test_client_secret"),
      scope: Config.App.getString("imjs_default_relying_party_uri"),
    };

    const delegationClient = new DelegationAuthorizationClient(delegationConfiguration);
    const saml: SamlAccessToken = await delegationClient.getSamlFromJwt(requestContext, jwt); // eslint-disable-line deprecation/deprecation
    const str = saml.toTokenString();
    chai.assert.isTrue(str.length > 10);
    // Note: No SAML support for existing clients anymore. Testing any further requires a new client that
    // only works with SAML.
  });

  it("should get valid OIDC delegation tokens", async () => {
    const delegationConfiguration: DelegationAuthorizationClientConfiguration = {
      clientId: Config.App.getString("imjs_delegation_test_client_id"),
      clientSecret: Config.App.getString("imjs_delegation_test_client_secret"),
      scope: "context-registry-service imodelhub rbac-service",
    };

    const delegationClient = new DelegationAuthorizationClient(delegationConfiguration);
    const delegationJwt = await delegationClient.getJwtFromJwt(requestContext, jwt);
    await validator.validateContextRegistryAccess(delegationJwt);
    await validator.validateIModelHubAccess(delegationJwt);
  });

});
