/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Issuer } from "openid-client";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { OidcAgentClient, OidcAgentClientConfiguration } from "../imodeljs-clients-backend";
import { HubAccessTestValidator } from "./HubAccessTestValidator";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

chai.should();

describe("OidcAgentClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  const requestContext = new ClientRequestContext();

  let agentConfiguration: OidcAgentClientConfiguration;

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    agentConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "context-registry-service imodelhub",
    };

  });

  it("should discover token end points correctly", async () => {
    const client = new OidcAgentClient(agentConfiguration);
    const url: string = await client.getUrl(requestContext);

    const issuer: Issuer = await client.discoverEndpoints(requestContext);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
  });

  it("should get valid OIDC tokens for agent applications", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt: AccessToken = await agentClient.getToken(requestContext);
    await validator.validateConnectAccess(jwt);
    // await validator.validateRbacAccess(jwt);
    await validator.validateIModelHubAccess(jwt);

    const refreshJwt: AccessToken = await agentClient.refreshToken(requestContext, jwt);
    await validator.validateConnectAccess(refreshJwt);
    // await validator.validateRbacAccess(jwt);
    await validator.validateIModelHubAccess(refreshJwt);
  });

});
