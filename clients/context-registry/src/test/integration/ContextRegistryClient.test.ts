/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ITwinAccessClient } from "../../ContextRegistryClient";
import { ITwin } from "../../ITwinAccessProps";
import { TestConfig } from "../TestConfig";

chai.should();
describe("ContextRegistryClient (#integration)", () => {
  const iTwinAccessClient: ITwinAccessClient = new ITwinAccessClient();
  let requestContext: AuthorizedClientRequestContext;

  before(async function () {
    this.timeout(0);
    requestContext = await TestConfig.getAuthorizedClientRequestContext();
  });

  it("should get a list of iTwins (#integration)", async () => {
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext);

    // At least one iTwin
    chai.expect(iTwinList).to.not.be.empty;
  });

  it("should get a list of iTwins by name (#integration)", async () => {
    const iTwinList: ITwin[] = await iTwinAccessClient.getAllByName(requestContext, TestConfig.iTwinName);

    // At least one iTwin
    chai.expect(iTwinList).to.not.be.empty;
    // All items match the name
    iTwinList.forEach((iTwin) => {
      chai.expect(iTwin).property("name").equal(TestConfig.iTwinName);
    });
  });

  it("should get an iTwin by id (#integration)", async () => {
    const iTwin: ITwin = await iTwinAccessClient.getById(requestContext, TestConfig.iTwinId);

    // Returned iTwin matches searched id
    chai.expect(iTwin.id).equals(TestConfig.iTwinId);
  });
});
