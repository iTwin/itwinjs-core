import { IModelApp } from "@itwin/core-frontend";
import { expect } from "chai";
import { TestContext } from "./TestContext";
import { obtainGraphicRepresentationUrl } from "../GraphicsProvider/GraphicRepresentationProvider";
// import "dotenv/config";

describe("obtainGraphicRepresentationUrlIntegrationTest", () => {
  let accessToken: any;
  let testArgs: any;

  before(async () => {
    const testContext = await TestContext.instance();
    console.log(testContext);
    accessToken = testContext.getAccessToken();
    // assert(accessToken !== undefined || accessToken !== "", "AccessToken is not available!");

    testArgs = {
      accessToken,
      sessionId:"testSession",
      dataSource: {
        iTwinId: "892aa2c9-5be8-4865-9f37-7d4c7e75ebbf",
        id: "1b641c41-b314-4519-a493-7a9aae74c672",
        changeId: "",
        type: "IMODEL",
      },
      format: "IMDL",
      urlPrefix: "qa-",
    };

    await IModelApp.startup();
  });

  after(async () => IModelApp.shutdown());

  it ("should obtain a graphic representation url", async () => {

    console.log("Test is running");
    expect(true).to.equal(true);
    const url = await obtainGraphicRepresentationUrl(testArgs);
    if (!url) {
      throw new Error("Url is undefined");
      return;
    }

    const result = JSON.stringify(await (await fetch(url)).json());
    const resObj = JSON.parse(result);
    console.log(resObj.asset.tilesetVersion);

    const frontendTileVersion = IModelApp.tileAdmin.maximumMajorTileFormatVersion;
    console.log(frontendTileVersion);

    expect(resObj.asset.tilesetVersion).to.lessThanOrEqual(frontendTileVersion);

  });

});
