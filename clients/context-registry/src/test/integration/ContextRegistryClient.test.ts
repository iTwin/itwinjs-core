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

  it("should get a list of containers (#integration)", async () => {
    const containers: ContextContainerNTBD[] = await contextRegistry.getContextContainers(requestContext);

    // At least one container
    chai.expect(containers).to.not.be.empty;
  });

  it("should get a container by name (#integration)", async () => {
    const container: ContextContainerNTBD = await contextRegistry.getContextContainerByName(requestContext, TestConfig.containerName);

    // Returned container matches searched name
    chai.expect(container.name).equals(TestConfig.containerName);
  });

  it("should get a container by id (#integration)", async () => {
    const container: ContextContainerNTBD = await contextRegistry.getContextContainerById(requestContext, TestConfig.containerId);

    // Returned container matches searched id
    chai.expect(container.id).equals(TestConfig.containerId);
  });

  // it("should get a list of containers by name substring (#integration)", async () => {
  //   const searchString = TestConfig.containerName.substr(1,5);
  //   const containers: ContextContainerNTBD[] = await contextRegistry.getContextContainersByNameSubstring(requestContext, searchString);

  //   // At least one container
  //   chai.expect(containers).to.not.be.empty;
  //   // Every container's name contains the search string, case insensitive
  //   containers.forEach((container) => {
  //     chai.expect(container).to.have.property("name").that.matches(new RegExp(`${searchString}`, "i"));
  //   });
  // });

});
