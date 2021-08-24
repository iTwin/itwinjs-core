/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ITwinAccessClient } from "../../ContextRegistryClient";
import { ITwin, ITwinSearchableProperty } from "../../ITwinAccessProps";
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
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext, {
      search: {
        searchString: TestConfig.iTwinName,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      }});

    // At least one iTwin
    chai.expect(iTwinList).to.not.be.empty;
    // All items match the name
    iTwinList.forEach((iTwin) => {
      chai.expect(iTwin).property("name").equal(TestConfig.iTwinName);
    });
  });
});
