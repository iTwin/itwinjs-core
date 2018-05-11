/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { IModelHubBaseHandler } from "../../imodelhub/BaseHandler";
import { IModelHubUrlMock } from "./TestUtils";

describe("iModelHub Client", () => {
  it("should setup its URLs correctly", async () => {
    IModelHubUrlMock.mockGetUrl("DEV");
    let url = await new IModelHubBaseHandler("DEV").getUrl();
    chai.expect(url).to.be.equal("https://dev-imodelhubapi.bentley.com/v2.5");

    IModelHubUrlMock.mockGetUrl("QA");
    url = await new IModelHubBaseHandler("QA").getUrl();
    chai.expect(url).to.be.equal("https://qa-imodelhubapi.bentley.com/v2.5");

    IModelHubUrlMock.mockGetUrl("PROD");
    url = await new IModelHubBaseHandler("PROD").getUrl();
    chai.expect(url).to.be.equal("https://imodelhubapi.bentley.com/v2.5");

    IModelHubUrlMock.mockGetUrl("PERF");
    url = await new IModelHubBaseHandler("PERF").getUrl();
    chai.expect(url).to.be.equal("https://perf-imodelhubapi.bentley.com/v2.5");
  });
});
