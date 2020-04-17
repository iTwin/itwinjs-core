/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import * as chai from "chai";
import { ContextRegistryClient, ContextRegistryRequestQueryOptions, Project } from "../../ContextRegistryClient";
import { TestConfig } from "../TestConfig";

chai.should();
describe("ConnectClient (#integration)", () => {
  const connectClient: ContextRegistryClient = new ContextRegistryClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.enableTimeouts(false);
    requestContext = await TestConfig.getAuthorizedClientRequestContext();
  });

  it("should get a list of projects (#integration)", async () => {
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $top: 20,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).greaterThan(0);
  });

  it("should get a list of Most Recently Used (MRU) projects (#integration)", async () => {
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isMRU: true,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).greaterThan(0);
  });

  it("should get a list of Favorite projects (#integration)", async () => {
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $top: 20,
      isFavorite: true,
    };

    const projects: Project[] = await connectClient.getProjects(requestContext, queryOptions);
    chai.expect(projects.length).to.be.greaterThan(0);
  });

  it("should get a project by name (#integration)", async () => {
    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };
    const project: Project = await connectClient.getProject(requestContext, queryOptions);
    chai.expect(project.name).equals(TestConfig.projectName);
  });

  it("should get a list of invited projects (#integration)", async () => {
    const invitedProjects: Project[] = await connectClient.getInvitedProjects(requestContext);
    chai.expect(invitedProjects.length).greaterThan(0);
  });

});
