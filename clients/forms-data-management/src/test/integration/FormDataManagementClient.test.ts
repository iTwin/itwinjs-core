/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { FormDataManagementClient, FormDefinition } from "../../FormDataManagementClient";
import { TestConfig } from "../TestConfig";

/* eslint-disable @typescript-eslint/naming-convention */

chai.should();

describe("FormDataManagementClient", () => {
  let requestContext: AuthorizedClientRequestContext;
  const formDataManagementClient: FormDataManagementClient = new FormDataManagementClient();
  let projectId: string;

  before(async function () {
    if (TestConfig.enableMocks) return;
    this.enableTimeouts(false);

    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    const contextRegistry = new ContextRegistryClient();
    const project: Project | undefined = await contextRegistry.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${TestConfig.projectName}'`,
    });
    chai.assert(project, `Project ${TestConfig.projectName} not found for user.`);
    projectId = project.wsgId;
  });

  it("should be able to retrieve Form Definitions (#integration)", async () => {
    const formDefinitions: FormDefinition[] = await formDataManagementClient.getFormDefinitions(
      requestContext,
      projectId
    );
    chai.assert(formDefinitions);
  });
});
