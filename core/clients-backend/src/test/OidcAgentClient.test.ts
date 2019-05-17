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

// @todo: We are using the V1 version of this API for now.
// Migrate to V2 after the Connect + IMS team can support -
// * Setting up a way for the agent client's "user" ({client_id}@apps.imsoidc.bentley.com)
//   to access Connect projects without the need to accept EULA agreements.
// * Provide a friendly name for this "user" - it currently shows up in Connect
//   with the first and last names as the above email instead of the client's name

describe("OidcAgentClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  const requestContext = new ClientRequestContext();

  let agentConfiguration: OidcAgentClientConfiguration;

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    agentConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      serviceUserEmail: Config.App.getString("imjs_agent_test_service_user_email"),
      serviceUserPassword: Config.App.getString("imjs_agent_test_service_user_password"),
      scope: "openid email profile organization context-registry-service imodelhub",
    };

  });

  it("should discover token end points correctly", async () => {
    const client = new OidcAgentClient(agentConfiguration);
    const url: string = await client.getUrl(requestContext);

    const issuer: Issuer = await client.discoverEndpoints(requestContext);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
    chai.expect(issuer.userinfo_endpoint).equals(`${url}/connect/userinfo`);
  });

  it("should get valid OIDC tokens for agent applications", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const now = Date.now();
    const jwt: AccessToken = await agentClient.getToken(requestContext);

    const expiresAt = jwt.getExpiresAt();
    chai.assert.isDefined(expiresAt);
    chai.assert.isAbove(expiresAt!.getTime(), now);

    const startsAt = jwt.getStartsAt();
    chai.assert.isDefined(startsAt);
    chai.assert.isAtLeast(startsAt!.getTime(), expiresAt!.getTime() - 1 * 60 * 60 * 1000); // Starts atleast 1 hour before expiry

    await validator.validateConnectAccess(jwt);
    await validator.validateIModelHubAccess(jwt);
  });

});
