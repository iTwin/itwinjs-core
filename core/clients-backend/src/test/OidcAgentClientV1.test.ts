/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Issuer } from "openid-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { OidcAgentClientV1, OidcAgentClientConfigurationV1 } from "../imodeljs-clients-backend";
import { HubAccessTestValidator } from "./HubAccessTestValidator";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

chai.should();
/**
 * Note that we have kept this old AgentClient only because some of our clients are still
 * using it, and we want to ensure it's in a working state.
 */
describe("OidcAgentClientV1 (#integration)", () => {

  let validator: HubAccessTestValidator;
  const requestContext = new ClientRequestContext();

  let agentConfiguration: OidcAgentClientConfigurationV1;

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    agentConfiguration = {
      clientId: Config.App.getString("imjs_agent_v1_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_v1_test_client_secret"),
      serviceUserEmail: Config.App.getString("imjs_agent_v1_test_service_user_email"),
      serviceUserPassword: Config.App.getString("imjs_agent_v1_test_service_user_password"),
      scope: "openid email profile organization context-registry-service imodelhub",
    };

  });

  it("should discover token end points correctly", async () => {
    const client = new OidcAgentClientV1(agentConfiguration);
    const url: string = await client.getUrl(requestContext);

    const issuer: Issuer = await client.discoverEndpoints(requestContext);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
    chai.expect(issuer.userinfo_endpoint).equals(`${url}/connect/userinfo`);
  });

  it("should get valid OIDC tokens for agent applications", async () => {
    const agentClient = new OidcAgentClientV1(agentConfiguration);
    const jwt: AccessToken = await agentClient.getToken(requestContext);
    await validator.validateConnectAccess(jwt);
    await validator.validateIModelHubAccess(jwt);
  });

});
