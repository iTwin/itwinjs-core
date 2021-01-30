/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { FormDataManagementClient, FormDefinition } from "../../FormDataManagementClient";

/* eslint-disable @typescript-eslint/naming-convention */

describe("FormDataManagementClient", () => {
  let requestContext: AuthorizedClientRequestContext;
  const formDataManagementClient: FormDataManagementClient = new FormDataManagementClient();
  let projectId: string;

  before(async function () {
    const accessToken = await getAccessTokenFromBackend(TestUsers.super);
    requestContext = new AuthorizedClientRequestContext((accessToken as any) as AccessToken);

    const contextRegistry = new ContextRegistryClient();
    const projectName = "iModelJsIntegrationTest";
    const project: Project | undefined = await contextRegistry.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    assert(project, `Project ${projectName} not found for user.`);
    projectId = project.wsgId;
  });

  it("should be able to retrieve Form Definitions (#integration)", async () => {
    const formDefinitions: FormDefinition[] = await formDataManagementClient.getFormDefinitions(
      requestContext,
      projectId
    );
    assert(formDefinitions);
  });
});
