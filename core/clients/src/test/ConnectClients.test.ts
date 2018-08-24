/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, IModelHubPermissions } from "../ConnectClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";

import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";

chai.should();

export class ConnectUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-wsg20-eus.cloudapp.net",
    QA: "https://qa-connect-wsg20.bentley.com",
    PROD: "https://connect-wsg20.bentley.com",
    PERF: "https://perf-wsg20-eus.cloudapp.net",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(ConnectClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("ConnectClient", () => {
  let accessToken: AccessToken;
  const connectClient: ConnectClient = new ConnectClient(TestConfig.deploymentEnv);

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    ConnectUrlMock.mockGetUrl("DEV");
    let url: string = await new ConnectClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-wsg20-eus.cloudapp.net");

    ConnectUrlMock.mockGetUrl("QA");
    url = await new ConnectClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PROD");
    url = await new ConnectClient("PROD").getUrl(true);
    chai.expect(url).equals("https://connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PERF");
    url = await new ConnectClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-wsg20-eus.cloudapp.net");
  });

  it("should get a list of projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(10);
  });

  it("should get a list of Most Recently Used (MRU) projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isMRU: true,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(5);
  });

  it("should get a list of Favorite projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isFavorite: true,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).to.be.greaterThan(0);
  });

  it("should get a project by name", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(accessToken, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const invitedProjects: Project[] = await connectClient.getInvitedProjects(accessToken);
    chai.expect(invitedProjects.length).greaterThan(5); // TODO: Setup a private test user where we can maintain a more strict control of invited projects.
  });

});

export class RbacUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-rbac-eus.cloudapp.net",
    QA: "https://qa-connect-rbac.bentley.com",
    PROD: "https://connect-rbac.bentley.com",
    PERF: "https://perf-rbac-eus.cloudapp.net",
  };

  public static getUrl(env: DeploymentEnv): string {
    return this._urlDescriptor[env];
  }

  public static mockGetUrl(env: DeploymentEnv) {
    UrlDiscoveryMock.mockGetUrl(RbacClient.searchKey, env, this._urlDescriptor[env]);
  }
}

describe("RbacClient", () => {
  let accessToken: AccessToken;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const rbacClient = new RbacClient(TestConfig.deploymentEnv);

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    RbacUrlMock.mockGetUrl("DEV");
    let url: string = await new RbacClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-rbac-eus.cloudapp.net");

    RbacUrlMock.mockGetUrl("QA");
    url = await new RbacClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PROD");
    url = await new RbacClient("PROD").getUrl(true);
    chai.expect(url).equals("https://connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PERF");
    url = await new RbacClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-rbac-eus.cloudapp.net");
  });

  it("should get the permissions relevant to the iModelHubService for the specified project", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(accessToken, queryOptions);
    chai.expect(!!project);

    // Round trip the access token to mimic its use
    const newAccessToken = AccessToken.fromTokenString(accessToken.toTokenString()!);

    const permissions: IModelHubPermissions = await rbacClient.getIModelHubPermissions(newAccessToken!, project.wsgId);

    chai.expect(permissions & IModelHubPermissions.CreateIModel);
    chai.expect(permissions & IModelHubPermissions.ReadIModel);
    chai.expect(permissions & IModelHubPermissions.ModifyIModel);
    chai.expect(permissions & IModelHubPermissions.ManageResources);
    chai.expect(permissions & IModelHubPermissions.ManageVersions);
  });

});
