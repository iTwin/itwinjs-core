
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Issuer, ClientConfiguration } from "openid-client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import {
  ImsActiveSecureTokenClient, AuthorizationToken, AccessToken, ImsDelegationSecureTokenClient,
  ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, RbacUser,
} from "@bentley/imodeljs-clients";
import { IModelHubClient, HubIModel, IModelQuery } from "@bentley/imodeljs-clients";
import { OidcClient } from "../OidcClient";

chai.should();

describe("OidcClient (#integration)", () => {
  const actx = new ActivityLoggingContext("");

  const testUser = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };

  const samlDelegationConfiguration: ClientConfiguration = {
    client_id: "imodeljs-saml-delegation-test-2686",
    client_secret: "u0BIrrWGOwJLAzAQ+8DlG+JWcHqxKVJ2xJd2SMhcNMv/L/Mzvn6YF4Dez2rFE/xYr7mRbND/9noIqc8mXRarQw==",
  };

  const oauthDelegationConfiguration: ClientConfiguration = {
    client_id: "imodeljs-oauth-delegation-test-2686",
    client_secret: "kxvBWZODa5sgsszAymDWCwhFgp5BGbbtqbK/iY9EhxbW+d2SmAoHPW9fOnPWtXtk5Kpsu0MxJNS7Kvd81gpLkA==",
  };

  const validateToken = async (accessToken: AccessToken) => {
    const testProjectName = "iModelJsTest";
    const connectClient = new ConnectClient("QA");
    const rbacClient = new RbacClient("QA");
    const testIModelName = "ReadOnlyTest";
    const hubClient = new IModelHubClient("QA");

    // Validate access to Connect
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + testProjectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(!!project);

    // Validate access to RBAC
    const users: RbacUser[] = await rbacClient.getUsers(actx, accessToken, project.wsgId);
    chai.expect(users.length !== 0);

    // Validate access to IModelHub
    const imodel: HubIModel = (await hubClient.IModels().get(actx, accessToken, project.wsgId, new IModelQuery().byName(testIModelName)))[0];
    chai.expect(imodel.name).to.be.equal(testIModelName);
  };

  it("should setup its URLs correctly", async () => {
    let url: string = await new OidcClient(samlDelegationConfiguration, "DEV").getUrl(actx);
    chai.expect(url).equals("https://qa-imsoidc.bentley.com");

    url = await new OidcClient(samlDelegationConfiguration, "QA").getUrl(actx);
    chai.expect(url).equals("https://qa-imsoidc.bentley.com");

    url = await new OidcClient(samlDelegationConfiguration, "PROD").getUrl(actx);
    chai.expect(url).equals("https://imsoidc.bentley.com");

    url = await new OidcClient(samlDelegationConfiguration, "PERF").getUrl(actx);
    chai.expect(url).equals("https://qa-imsoidc.bentley.com");
  });

  it("should discover token end points correctly", async () => {
    const client = new OidcClient(samlDelegationConfiguration, "QA");
    const url: string = await client.getUrl(actx);

    const issuer: Issuer = await client.discoverEndpoints(actx);
    chai.expect(issuer.token_endpoint).equals(`${url}/connect/token`);
    chai.expect(issuer.authorization_endpoint).equals(`${url}/connect/authorize`);
    chai.expect(issuer.introspection_endpoint).equals(`${url}/connect/introspect`);
    chai.expect(issuer.userinfo_endpoint).equals(`${url}/connect/userinfo`);
  });

  it("should exchange SAML tokens for OIDC tokens", async () => {
    // Test that the SAML token works
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient("QA")).getToken(actx, testUser.email, testUser.password);
    const samlToken: AccessToken = await (new ImsDelegationSecureTokenClient("QA")).getToken(actx, authToken);
    await validateToken(samlToken);

    // Test that the OIDC tokens exchanged from SAML tokens work
    const client = new OidcClient(samlDelegationConfiguration, "QA");
    const scope = "openid email profile organization context-registry-service imodelhub rbac-service";
    const jwt = await client.getJwtForImsUser(actx, testUser.email, testUser.password, scope);
    await validateToken(jwt);
  });

  it.skip("should exchange OIDC tokens for SAML tokens", async () => {
    const clientSamlToOAuth = new OidcClient(samlDelegationConfiguration, "QA");
    const scopeSamlToOAuth = "openid email profile organization";
    const jwt = await clientSamlToOAuth.getJwtForImsUser(actx, testUser.email, testUser.password, scopeSamlToOAuth);

    const clientOAuthToSaml = new OidcClient(oauthDelegationConfiguration, "QA");
    const scopeOAuthToSaml = "context-registry-service"; // Will this work for imodelhub, rbac-service?
    const saml = await clientOAuthToSaml.getSamlFromJwt(actx, jwt, scopeOAuthToSaml);

    await validateToken(saml);
  });

  it.skip("should get OIDC delegation tokens", async () => {
    const clientSamlToOAuth = new OidcClient(samlDelegationConfiguration, "QA");
    const scopeSamlToOAuth = "openid email profile organization";
    const jwt = await clientSamlToOAuth.getJwtForImsUser(actx, testUser.email, testUser.password, scopeSamlToOAuth);

    const clientOAuthDelegation = new OidcClient(oauthDelegationConfiguration, "QA");
    const scopeOAuthDelegation = "context-registry-service imodelhub rbac-service"; // Can I get a delegation token for multiple services?
    const saml = await clientOAuthDelegation.getDelegationJwt(actx, jwt, scopeOAuthDelegation);

    await validateToken(saml);
  });

});
