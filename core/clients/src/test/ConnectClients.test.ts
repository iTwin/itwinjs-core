/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient, RbacClient, Project, ConnectRequestQueryOptions, IModelHubPermissions, RbacUser } from "../ConnectClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

chai.should();
describe("ConnectClient (#integration)", () => {
  let accessToken: AccessToken;
  const connectClient: ConnectClient = new ConnectClient();
  const actx = new ActivityLoggingContext("");
  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);
  });

  it("should get a list of projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(10);
  });

  it("should get a list of Most Recently Used (MRU) projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isMRU: true,
    };

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
    chai.expect(projects.length).greaterThan(5);
  });

  it("should get a list of Favorite projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isFavorite: true,
    };

    const projects: Project[] = await connectClient.getProjects(actx, accessToken, queryOptions);
    chai.expect(projects.length).to.be.greaterThan(0);
  });

  it("should get a project by name (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const invitedProjects: Project[] = await connectClient.getInvitedProjects(actx, accessToken);
    chai.expect(invitedProjects.length).greaterThan(5); // TODO: Setup a private test user where we can maintain a more strict control of invited projects.
  });

});

describe("RbacClient (#integration)", () => {
  let accessToken: AccessToken;
  const connectClient = new ConnectClient();
  const rbacClient = new RbacClient();
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);
  });

  it("should get the permissions relevant to the iModelHubService for the specified project (#integration)", async function (this: Mocha.ITestCallbackContext) {
    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(actx, accessToken, queryOptions);
    chai.expect(!!project);

    // Round trip the access token to mimic its use
    const newAccessToken = AccessToken.fromSamlTokenString(accessToken.toTokenString()!);

    const permissions: IModelHubPermissions = await rbacClient.getIModelHubPermissions(actx, newAccessToken!, project.wsgId);

    chai.expect(permissions & IModelHubPermissions.CreateIModel);
    chai.expect(permissions & IModelHubPermissions.ReadIModel);
    chai.expect(permissions & IModelHubPermissions.ModifyIModel);
    chai.expect(permissions & IModelHubPermissions.ManageResources);
    chai.expect(permissions & IModelHubPermissions.ManageVersions);
  });

  it("should get the users in the specified project (#integration)", async function (this: Mocha.ITestCallbackContext) {
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
