/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, IModelHubPermissions } from "../ConnectClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";

chai.should();

describe("ConnectClient", () => {
  let accessToken: AccessToken;
  const connectClient: ConnectClient = new ConnectClient(TestConfig.deploymentEnv);

  before(async function(this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    let url: string = await new ConnectClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-wsg20-eus.cloudapp.net");

    url = await new ConnectClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-connect-wsg20.bentley.com");

    url = await new ConnectClient("PROD").getUrl(true);
    chai.expect(url).equals("https://connect-wsg20.bentley.com");

    url = await new ConnectClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-wsg20-eus.cloudapp.net");
  });

  it("should get a list of projects", async () => {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(10);
  });

  it("should get a list of Most Recently Used (MRU) projects", async () => {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isMRU: true,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(5);
  });

  it("should get a list of Favorite projects", async () => {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isFavorite: true,
    };

    const projects: Project[] = await connectClient.getProjects(accessToken, queryOptions);
    chai.expect(projects.length).equals(1);
  });

  it("should get a project by name", async () => {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(accessToken, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects", async () => {
    const invitedProjects: Project[] = await connectClient.getInvitedProjects(accessToken);
    chai.expect(invitedProjects.length).greaterThan(5); // TODO: Setup a private test user where we can maintain a more strict control of invited projects.
  });

});

describe("RbacClient", () => {
  let accessToken: AccessToken;
  const connectClient = new ConnectClient(TestConfig.deploymentEnv);
  const rbacClient = new RbacClient(TestConfig.deploymentEnv);

  before(async function(this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(authToken);
  });

  it("should setup its URLs", async () => {
    let url: string = await new RbacClient("DEV").getUrl(true);
    chai.expect(url).equals("https://dev-rbac-eus.cloudapp.net");

    url = await new RbacClient("QA").getUrl(true);
    chai.expect(url).equals("https://qa-connect-rbac.bentley.com");

    url = await new RbacClient("PROD").getUrl(true);
    chai.expect(url).equals("https://connect-rbac.bentley.com");

    url = await new RbacClient("PERF").getUrl(true);
    chai.expect(url).equals("https://perf-rbac-eus.cloudapp.net");
  });

  it("should get the permissions relevant to the iModelHubService for the specified project", async () => {
    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(accessToken, queryOptions);
    chai.expect(!!project);

    // Round trip the access token to mimic it's use
    const newAccessToken = AccessToken.fromTokenString(accessToken.toTokenString()!);

    const permissions: IModelHubPermissions = await rbacClient.getIModelHubPermissions(newAccessToken!, project.wsgId);

    chai.expect(permissions & IModelHubPermissions.CreateIModel);
    chai.expect(permissions & IModelHubPermissions.ReadIModel);
    chai.expect(permissions & IModelHubPermissions.ModifyIModel);
    chai.expect(permissions & IModelHubPermissions.ManageResources);
    chai.expect(permissions & IModelHubPermissions.ManageVersions);
  });

});
