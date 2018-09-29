/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, IModelHubPermissions, RbacUser } from "../ConnectClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";

import { UrlDiscoveryMock } from "./ResponseBuilder";
import { DeploymentEnv, UrlDescriptor } from "../Client";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();

export class ConnectUrlMock {
  private static readonly _urlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-contextregistry.bentley.com",
    QA: "https://qa-connect-contextregistry.bentley.com",
    PROD: "https://connect-wsg20.bentley.com",
    PERF: "https://perf-connect-contextregistry.bentley.com",
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
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);
  });

  it("should setup its URLs", async () => {
    ConnectUrlMock.mockGetUrl("DEV");
    let url: string = await new ConnectClient("DEV").getUrl(actx, true);
    chai.expect(url).equals("https://dev-connect-contextregistry.bentley.com");

    ConnectUrlMock.mockGetUrl("QA");
    url = await new ConnectClient("QA").getUrl(actx, true);
    chai.expect(url).equals("https://qa-connect-contextregistry.bentley.com");

    ConnectUrlMock.mockGetUrl("PROD");
    url = await new ConnectClient("PROD").getUrl(actx, true);
    chai.expect(url).equals("https://connect-wsg20.bentley.com");

    ConnectUrlMock.mockGetUrl("PERF");
    url = await new ConnectClient("PERF").getUrl(actx, true);
    chai.expect(url).equals("https://perf-connect-contextregistry.bentley.com");
  });

  it("should get a list of projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
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

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
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

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
    chai.expect(projects.length).to.be.greaterThan(0);
  });

  it("should get a project by name", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const invitedProjects: Project[] = await connectClient.getInvitedProjects(actx, accessToken);
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
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);
  });

  it("should setup its URLs", async () => {
    RbacUrlMock.mockGetUrl("DEV");
    let url: string = await new RbacClient("DEV").getUrl(actx, true);
    chai.expect(url).equals("https://dev-rbac-eus.cloudapp.net");

    RbacUrlMock.mockGetUrl("QA");
    url = await new RbacClient("QA").getUrl(actx, true);
    chai.expect(url).equals("https://qa-connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PROD");
    url = await new RbacClient("PROD").getUrl(actx, true);
    chai.expect(url).equals("https://connect-rbac.bentley.com");

    RbacUrlMock.mockGetUrl("PERF");
    url = await new RbacClient("PERF").getUrl(actx, true);
    chai.expect(url).equals("https://perf-rbac-eus.cloudapp.net");
  });

  it("should get the permissions relevant to the iModelHubService for the specified project", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(!!project);

    // Round trip the access token to mimic its use
    const newAccessToken = AccessToken.fromTokenString(accessToken.toTokenString()!);

    const permissions: IModelHubPermissions = await rbacClient.getIModelHubPermissions(actx, newAccessToken!, project.wsgId);

    chai.expect(permissions & IModelHubPermissions.CreateIModel);
    chai.expect(permissions & IModelHubPermissions.ReadIModel);
    chai.expect(permissions & IModelHubPermissions.ModifyIModel);
    chai.expect(permissions & IModelHubPermissions.ManageResources);
    chai.expect(permissions & IModelHubPermissions.ManageVersions);
  });

  it("should get the users in the specified project", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(!!project);

    // Get the user ID we are using that should exist in the returned users
    const currentUserId = accessToken.getUserProfile()!.userId;
    // Get users
    const users: RbacUser[] = await rbacClient.getUsers(actx, accessToken!, project.wsgId);

    // We should have some valid users
    chai.expect(users.length !== 0);
    // Test that the user accessing this is existent in the users returned
    let foundUser = false;
    users.map((user: RbacUser) => { foundUser = foundUser || (user.wsgId === currentUserId); });
    chai.expect(foundUser);
  });
});
