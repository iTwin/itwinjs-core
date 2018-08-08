// /*---------------------------------------------------------------------------------------------
// |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
//  *--------------------------------------------------------------------------------------------*/
// import * as chai from "chai";

// import { IModelBaseHandler } from "../..";
// import { IModelHubUrlMock } from "./TestUtils";

// describe("iModelHub Client", () => {
//   it("should setup its URLs correctly", async () => {
//     IModelHubUrlMock.mockGetUrl("DEV");
//     let url = await new IModelBaseHandler("DEV").getUrl();
//     chai.expect(url).to.be.equal("https://dev-imodelhubapi.bentley.com/sv1.1");

//     IModelHubUrlMock.mockGetUrl("QA");
//     url = await new IModelBaseHandler("QA").getUrl();
//     chai.expect(url).to.be.equal("https://qa-imodelhubapi.bentley.com/sv1.1");

//     IModelHubUrlMock.mockGetUrl("PROD");
//     url = await new IModelBaseHandler("PROD").getUrl();
//     chai.expect(url).to.be.equal("https://imodelhubapi.bentley.com/sv1.1");

//     IModelHubUrlMock.mockGetUrl("PERF");
//     url = await new IModelBaseHandler("PERF").getUrl();
//     chai.expect(url).to.be.equal("https://perf-imodelhubapi.bentley.com/sv1.1");
//   });
// });
