/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Config, AccessToken } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { OidcDelegationClient, OidcDelegationClientConfiguration, OidcAgentClient, OidcAgentClientConfiguration } from "../imodeljs-clients-backend";
import { HubAccessTestValidator } from "./HubAccessTestValidator";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

chai.should();

// @todo: Work with OIDC team to get these tests working
describe("OidcDelegationClient (#integration)", () => {

  let validator: HubAccessTestValidator;
  let jwt: AccessToken;
  const actx = new ActivityLoggingContext("");

  before(async () => {
    validator = await HubAccessTestValidator.getInstance();

    const agentConfiguration: OidcAgentClientConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      serviceUserEmail: Config.App.getString("imjs_agent_test_service_user_email"),
      serviceUserPassword: Config.App.getString("imjs_agent_test_service_user_password"),
      scope: "openid email profile organization imodeljs-backend-2686",
    };

    const agentClient = new OidcAgentClient(agentConfiguration);
    jwt = await agentClient.getToken(actx);
  });

  it("should get valid SAML delegation tokens", async () => {

    const delegationConfiguration: OidcDelegationClientConfiguration = {
      clientId: Config.App.getString("imjs_delegation_test_client_id"),
      clientSecret: Config.App.getString("imjs_delegation_test_client_secret"),
      scope: Config.App.getString("imjs_default_relying_party_uri"),
    };

    const delegationClient = new OidcDelegationClient(delegationConfiguration);
    const saml = await delegationClient.getSamlFromJwt(actx, jwt);
    await validator.validateConnectAccess(saml);
    await validator.validateRbacAccess(saml);
    await validator.validateIModelHubAccess(saml);
  });

  it("should get valid OIDC delegation tokens", async () => {
    const delegationConfiguration: OidcDelegationClientConfiguration = {
      clientId: Config.App.getString("imjs_delegation_test_client_id"),
      clientSecret: Config.App.getString("imjs_delegation_test_client_secret"),
      scope: "context-registry-service imodelhub rbac-service",
    };

    const delegationClient = new OidcDelegationClient(delegationConfiguration);
    const delegationJwt = await delegationClient.getJwtFromJwt(actx, jwt);
    await validator.validateConnectAccess(delegationJwt);
    await validator.validateRbacAccess(delegationJwt);
    await validator.validateIModelHubAccess(delegationJwt);
  });

});
