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

  it("should get a paged list of iTwins using top (#integration)", async () => {
    const numberOfITwins = 3;

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext);
    chai.assert(fullITwinList.length >= numberOfITwins, "Unable to meaningfully run test since there are too few iTwins.");

    const partialITwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext,
      {
        pagination: {
          top: numberOfITwins,
        },
      });

    // Get the same number of iTwins as the top param
    chai.expect(partialITwinList).length(numberOfITwins);
  });

  it("should get a paged list of iTwins using skip (#integration)", async () => {
    const numberSkipped = 3;

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext);
    chai.assert(fullITwinList.length >= numberSkipped, "Unable to meaningfully run test since there are too few iTwins.");

    const partialITwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext,
      {
        pagination: {
          skip: numberSkipped,
        },
      });

    // Get all but the skipped ones
    chai.expect(partialITwinList).length(fullITwinList.length - numberSkipped);
  });

  it("should get a continuous paged list of iTwins (#integration)", async () => {
    const numberOfITwins = 3;
    const numberSkipped = 1;

    // Verify the paging properties can be tested
    chai.assert(numberSkipped < numberOfITwins, "There must be overlap between the two pages to run test.");

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext);
    chai.assert(fullITwinList.length >= numberOfITwins + numberSkipped, "Unable to meaningfully run test since there are too few iTwins.");

    const firstPageList: ITwin[] = await iTwinAccessClient.getAll(requestContext,
      {
        pagination: {
          top: numberOfITwins,
        },
      });

    const secondPageList: ITwin[] = await iTwinAccessClient.getAll(requestContext,
      {
        pagination: {
          top: numberOfITwins,
          skip: numberSkipped,
        },
      });

    // Find all iTwins from the first page that are not in the second
    const uniqueFirstPageITwins: ITwin[] = firstPageList.filter((firstITwin) => {
      return !secondPageList.some((secondITwin) => secondITwin.id === firstITwin.id);
    });

    // Find all iTwins from the second page that are not in the first
    const uniqueSecondPageITwins: ITwin[] = secondPageList.filter((secondITwin) => {
      return !firstPageList.some((firstITwin) => secondITwin.id === firstITwin.id);
    });

    // Both pages should have a full page's worth of iTwins
    chai.expect(firstPageList).length(numberOfITwins);
    chai.expect(secondPageList).length(numberOfITwins);

    // The number of unique iTwins must match the number skipped
    chai.expect(uniqueFirstPageITwins).length(numberSkipped);
    chai.expect(uniqueSecondPageITwins).length(numberSkipped);
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
