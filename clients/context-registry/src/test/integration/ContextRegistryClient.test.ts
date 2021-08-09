/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ContextRegistryClient } from "../../ContextRegistryClient";
import { ContextContainerNTBD } from "../../ContextAccessProps";
import { TestConfig } from "../TestConfig";

chai.should();
describe("ContextRegistryClient (#integration)", () => {
  const contextRegistry: ContextRegistryClient = new ContextRegistryClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.timeout(0);
    requestContext = await TestConfig.getAuthorizedClientRequestContext();
  });

  it("should get a list of projects (#integration)", async () => {
    const containers: ContextContainerNTBD[] = await contextRegistry.getContextContainers(requestContext);
    chai.expect(containers.length).greaterThan(0);
  });

  it("should get a project by name (#integration)", async () => {
    const container: ContextContainerNTBD = await contextRegistry.getContextContainerByName(requestContext, TestConfig.projectName);
    chai.expect(container.name).equals(TestConfig.projectName);
  });

});
