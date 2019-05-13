/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { ConnectClient, Project, ConnectRequestQueryOptions } from "../ConnectClients";
import { AuthorizationToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

chai.should();
describe("ConnectClient (#integration)", () => {
  const connectClient: ConnectClient = new ConnectClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    const authToken: AuthorizationToken = await TestConfig.login();
    const accessToken = await connectClient.getAccessToken(new ClientRequestContext(), authToken);
    requestContext = new AuthorizedClientRequestContext(accessToken);
  });

  it("should get a list of projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).greaterThan(0);
  });

  it("should get a list of Most Recently Used (MRU) projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isMRU: true,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).greaterThan(0);
  });

  it("should get a list of Favorite projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isFavorite: true,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).to.be.greaterThan(0);
  });

  it("should get a project by name (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(requestContext, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects (#integration)", async function (this: Mocha.ITestCallbackContext) {
    const invitedProjects: Project[] = await connectClient.getInvitedProjects(requestContext);
    chai.expect(invitedProjects.length).greaterThan(0);
  });

});
