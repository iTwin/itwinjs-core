/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { IModelHubBaseHandler } from "../../imodelhub/BaseHandler";
import { TestConfig } from "../TestConfig";

describe("iModelHub Client", () => {
  before(function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();
  });

  it("should setup its URLs correctly", async () => {
    let url = await new IModelHubBaseHandler("DEV").getUrl();
    chai.expect(url).equals("https://dev-imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("QA").getUrl();
    chai.expect(url).equals("https://qa-imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("PROD").getUrl();
    chai.expect(url).equals("https://imodelhubapi.bentley.com/v2.5");

    url = await new IModelHubBaseHandler("PERF").getUrl();
    chai.expect(url).equals("https://perf-imodelhubapi.bentley.com/v2.5");
  });
});
