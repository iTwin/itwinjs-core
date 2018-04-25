/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import chaiString = require("chai-string");
import { IModelWebNavigatorClient } from "../IModelWebNavigatorClient";

chai.use(chaiString);
chai.should();

describe("IModelWebNavigatorClient", () => {
  it("should setup its URLs", async () => {
    let url: string = await new IModelWebNavigatorClient("DEV").getUrl();
    chai.expect(url).equals("https://dev-connect-imodelweb.bentley.com");

    url = await new IModelWebNavigatorClient("QA").getUrl();
    chai.expect(url).equals("https://qa-connect-imodelweb.bentley.com");

    url = await new IModelWebNavigatorClient("PROD").getUrl();
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");

    url = await new IModelWebNavigatorClient("PERF").getUrl();
    chai.expect(url).equals("https://connect-imodelweb.bentley.com");
  });

});
