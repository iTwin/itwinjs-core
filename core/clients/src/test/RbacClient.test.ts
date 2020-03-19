/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { ConnectClient, Project, ConnectRequestQueryOptions } from "../ConnectClient";
import { RbacClient, IModelHubPermission, Permission } from "../RbacClient";
import { TestConfig } from "./TestConfig";
import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";

// VSTS#291161: Re-enable tests after oidc-signin-tool fixes
describe.skip("RbacClient (#integration)", () => {
  const connectClient = new ConnectClient();
  const rbacClient = new RbacClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    requestContext = await TestConfig.getAuthorizedClientRequestContext(TestUsers.super);
  });

  it("should get the permissions for any service for the specified project (#integration)", async function (this: Mocha.ITestCallbackContext) {
    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };

    const project: Project = await connectClient.getProject(requestContext, queryOptions);
    expect(!!project);

    const iModelHubServiceGPRId = 2485;
    const permissions: Permission[] = await rbacClient.getPermissions(requestContext, project.wsgId, iModelHubServiceGPRId);
    expect(permissions.length).equals(6);
  });

  it("should get the permissions relevant to the iModelHubService for the specified project (#integration)", async function (this: Mocha.ITestCallbackContext) {
    // Get test project
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*",
      $filter: "Name+eq+'" + TestConfig.projectName + "'",
    };

    const project: Project = await connectClient.getProject(requestContext, queryOptions);
    expect(!!project);

    const permissions: IModelHubPermission = await rbacClient.getIModelHubPermissions(requestContext, project.wsgId);

    expect(permissions & IModelHubPermission.Create);
    expect(permissions & IModelHubPermission.Read);
    expect(permissions & IModelHubPermission.Modify);
    expect(permissions & IModelHubPermission.Delete);
    expect(permissions & IModelHubPermission.ManageResources);
    expect(permissions & IModelHubPermission.ManageVersions);
  });

});
