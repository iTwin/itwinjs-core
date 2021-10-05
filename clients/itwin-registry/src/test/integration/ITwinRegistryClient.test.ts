/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AccessToken } from "@itwin/core-bentley";
import { ITwinAccessClient } from "../../ITwinRegistryClient";
import { ITwin, ITwinSearchableProperty } from "../../ITwinAccessProps";
import { TestConfig } from "../TestConfig";

chai.should();
describe("ITwinRegistryClient (#integration)", () => {
  const iTwinAccessClient: ITwinAccessClient = new ITwinAccessClient();
  let accessToken: AccessToken;

  before(async function () {
    this.timeout(0);
    accessToken = await TestConfig.getAccessToken();
  });

  it("should get a list of iTwins (#integration)", async () => {
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken);

    // At least one iTwin
    chai.expect(iTwinList).to.not.be.empty;
  });

  it("should get a paged list of iTwins using top (#integration)", async () => {
    const numberOfITwins = 3;

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken);
    chai.assert(fullITwinList.length >= numberOfITwins, "Unable to meaningfully run test since there are too few iTwins.");

    const partialITwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken,
      {
        pagination: {
          top: numberOfITwins,
        },
      });

    // Get the same number of iTwins as the top param
    chai.expect(partialITwinList).length(numberOfITwins, "Paged list length does not match top value.");
  });

  it("should get a paged list of iTwins using skip (#integration)", async () => {
    const numberSkipped = 4;

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken);
    chai.assert(fullITwinList.length >= numberSkipped, "Unable to meaningfully run test since there are too few iTwins.");

    const partialITwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken,
      {
        pagination: {
          skip: numberSkipped,
        },
      });

    // Get all but the skipped ones
    chai.expect(partialITwinList).length(fullITwinList.length - numberSkipped, "Paged list length does not match the expected number skipped.");
  });

  it("should get a continuous paged list of iTwins (#integration)", async () => {
    const numberOfITwins = 3;
    const numberSkipped = 2;

    // Verify the paging properties can be tested
    chai.assert(numberSkipped < numberOfITwins, "There must be overlap between the two pages to run test.");

    // Verify there are enough iTwins to test the paging
    const fullITwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken,
      {
        pagination: {
          top: numberOfITwins + numberSkipped,
        },
      });
    chai.assert(fullITwinList.length === numberOfITwins + numberSkipped, "Unable to meaningfully run test since there are too few iTwins.");

    const firstPageList: ITwin[] = await iTwinAccessClient.getAll(accessToken,
      {
        pagination: {
          top: numberOfITwins,
        },
      });

    const secondPageList: ITwin[] = await iTwinAccessClient.getAll(accessToken,
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
    chai.expect(firstPageList).length(numberOfITwins, "First page length does not match top value.");
    chai.expect(secondPageList).length(numberOfITwins, "Second page length does not match top value.");

    // The number of unique iTwins must match the number skipped
    chai.expect(uniqueFirstPageITwins).length(numberSkipped, "The number of first page specific items does not match the skip value.");
    chai.expect(uniqueSecondPageITwins).length(numberSkipped, "The number of second page specific items does not match the skip value.");

    // Both pages are contained within the larger full page
    // Reduce objects down to ITwin properties
    const mappedFullITwinList: ITwin[] = fullITwinList.map((iTwin) => {
      return {
        id: iTwin.id,
        name: iTwin.name,
        code: iTwin.code,
      };
    });

    chai.expect(mappedFullITwinList).to.deep.include.members(firstPageList.map((iTwin) => {
      return {
        id: iTwin.id,
        name: iTwin.name,
        code: iTwin.code,
      };
    }), "The first page contains items not present in the full page.");

    chai.expect(mappedFullITwinList).to.deep.include.members(secondPageList.map((iTwin) => {
      return {
        id: iTwin.id,
        name: iTwin.name,
        code: iTwin.code,
      };
    }), "The second page contains items not present in the full page.");
  });

  it("should get a list of iTwins by name (#integration)", async () => {
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken, {
      search: {
        searchString: TestConfig.iTwinName,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      },
    });

    // At least one iTwin
    chai.expect(iTwinList).to.not.be.empty;
    // All items match the name
    iTwinList.forEach((iTwin) => {
      chai.expect(iTwin).property("name").equal(TestConfig.iTwinName);
    });
  });
});
