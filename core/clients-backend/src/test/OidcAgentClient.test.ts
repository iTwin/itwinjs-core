/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Issuer } from "openid-client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { OidcAgentClient, OidcAgentClientConfiguration, OidcAgentClientV2, OidcAgentClientConfigurationV2 } from "../imodeljs-clients-backend";
import { HubAccessTestValidator } from "./HubAccessTestValidator";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

chai.should();

// @todo: We are using the V1 version of this API for now.
// Migrate to V2 after the Connect + IMS team can support -
// * Setting up a way for the agent client's "user" ({client_id}@apps.imsoidc.bentley.com)
//   to access Connect projects without the need to accept EULA agreements.
// * Provide a friendly name for this "user" - it currently shows up in Connect
//   with the first and last names as the above email instead of the client's name

describe("OidcAgentClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  const actx = new ActivityLoggingContext("");

  let agentConfiguration: OidcAgentClientConfiguration;
  let agentConfigurationV2: OidcAgentClientConfigurationV2;

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    agentConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      serviceUserEmail: Config.App.getString("imjs_agent_test_service_user_email"),
      serviceUserPassword: Config.App.getString("imjs_agent_test_service_user_password"),
      scope: "openid email profile organization context-registry-service imodelhub",
    };

    agentConfigurationV2 = {
      clientId: Config.App.getString("imjs_agent_test_client_id_v2"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret_v2"),
      scope: "context-registry-service imodelhub",
    };

  });

  it("should discover token end points correctly", async () => {
    const client = new OidcAgentClient(agentConfiguration);
    const url: string = await client.getUrl(actx);

    const issuer: Issuer = await client.discoverEndpoints(actx);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
    chai.expect(issuer.userinfo_endpoint).equals(`${url}/connect/userinfo`);
  });

  it("should get valid OIDC tokens for agent applications", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt: AccessToken = await agentClient.getToken(actx);
    await validator.validateConnectAccess(jwt);
    await validator.validateIModelHubAccess(jwt);
  });

  it("should discover token end points correctly (V2)", async () => {
    const client = new OidcAgentClientV2(agentConfigurationV2);
    const url: string = await client.getUrl(actx);

    const issuer: Issuer = await client.discoverEndpoints(actx);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
  });

  // @todo: see note above. waiting for Connect support
  it.skip("should get valid OIDC tokens for agent applications (V2)", async () => {
    const agentClient = new OidcAgentClientV2(agentConfigurationV2);
    const jwt: AccessToken = await agentClient.getToken(actx);
    await validator.validateConnectAccess(jwt);
    await validator.validateIModelHubAccess(jwt);

    const refreshJwt: AccessToken = await agentClient.refreshToken(actx, jwt);
    await validator.validateConnectAccess(refreshJwt);
    await validator.validateIModelHubAccess(refreshJwt);
  });

});
