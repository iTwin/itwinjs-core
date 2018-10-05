/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { Issuer } from "openid-client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import {
  ImsActiveSecureTokenClient, AuthorizationToken, AccessToken, ImsDelegationSecureTokenClient,
  ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, RbacUser,
} from "@bentley/imodeljs-clients";
import { IModelHubClient, HubIModel, IModelQuery, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { OidcBackendClientConfiguration, OidcAgentClient, OidcAgentClientConfiguration, OidcDelegationClient } from "../index";

IModelJsConfig.init(true, Config.App);

chai.should();

describe("OidcBackendClient (#integration)", () => {
  const actx = new ActivityLoggingContext("");

  let testUser: { email: string, password: string };
  let agentConfiguration: OidcAgentClientConfiguration;
  let delegationConfiguration: OidcBackendClientConfiguration;

  const testProjectName = "iModelJsTest";
  const testIModelName = "ReadOnlyTest";
  let testProjectId: string;
  let testIModelId: string;

  const getProjectId = async (accessToken: AccessToken, projectName: string): Promise<string> => {
    const connectClient = new ConnectClient();
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(!!project);
    return project.wsgId;
  };

  const getIModelId = async (accessToken: AccessToken, iModelName: string, projectId: string): Promise<string> => {
    const hubClient = new IModelHubClient();
    const imodel: HubIModel = (await hubClient.IModels().get(actx, accessToken, projectId, new IModelQuery().byName(testIModelName)))[0];
    chai.expect(imodel.name).to.be.equal(iModelName);
    return imodel.wsgId;
  };

  const validateConnectAccess = async (accessToken: AccessToken) => {
    const projectId = await getProjectId(accessToken, testProjectName);
    chai.expect(projectId).to.be.equal(testProjectId);
  };

  const validateRbacAccess = async (accessToken: AccessToken) => {
    const rbacClient = new RbacClient();
    const users: RbacUser[] = await rbacClient.getUsers(actx, accessToken, testProjectId);
    chai.expect(users.length !== 0);
  };

  const validateIModelHubAccess = async (accessToken: AccessToken) => {
    const iModelId = await getIModelId(accessToken, testIModelName, testProjectId);
    chai.expect(iModelId).to.be.equal(testIModelId);
  };

  before(async () => {

    testUser = {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };

    agentConfiguration = {
      clientId: Config.App.getString("agent_test_oidc_client_id"),
      clientSecret: Config.App.getString("agent_test_oidc_client_secret"),
      serviceUserEmail: Config.App.getString("agent_test_oidc_service_user_name"),
      serviceUserPassword: Config.App.getString("agent_test_oidc_service_password"),
    };

    delegationConfiguration = {
      clientId: Config.App.getString("oauth_delegation_test_client_id"),
      clientSecret: Config.App.getString("oauth_delegation_test_client_secret"),
    };

    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(actx, testUser.email, testUser.password);
    const samlToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(actx, authToken);
    testProjectId = await getProjectId(samlToken, testProjectName);
    testIModelId = await getIModelId(samlToken, testIModelName, testProjectId);
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
    await validateConnectAccess(jwt);
    await validateIModelHubAccess(jwt);
  });

  it.skip("should get valid SAML delegation tokens", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt = await agentClient.getToken(actx);

    const delegationClient = new OidcDelegationClient(delegationConfiguration);
    const scope = Config.App.getString("imjs_default_relying_party_uri");
    const saml = await delegationClient.getSamlFromJwt(actx, jwt, scope);
    await validateConnectAccess(saml);
    await validateRbacAccess(saml);
    await validateIModelHubAccess(saml);
  });

  it.skip("should get valid OIDC delegation tokens", async () => {
    const agentClient = new OidcAgentClient(agentConfiguration);
    const jwt = await agentClient.getToken(actx, "openid email profile organization");

    const delegationClient = new OidcDelegationClient(delegationConfiguration);
    const scope = "context-registry-service imodelhub rbac-service";
    const delegationJwt = await delegationClient.getJwtFromJwt(actx, jwt, scope);
    await validateConnectAccess(delegationJwt);
    await validateRbacAccess(delegationJwt);
    await validateIModelHubAccess(delegationJwt);
  });

});
