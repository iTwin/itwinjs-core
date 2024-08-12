import { IModelApp } from "@itwin/core-frontend";
import { expect } from "chai";
import { TestContext } from "./TestContext";
import { obtainGraphicRepresentationUrl } from "../GraphicsProvider/GraphicRepresentationProvider";

describe("MeshExportServiceIntegrationTest", () => {
  let accessToken: any;
  let testArgs: any;

  before(async () => {
    const testContext = await TestContext.instance();
    accessToken = testContext.getAccessToken();

    const iTwinId = process.env.TEST_ITWINID || "";
    const iModelId = process.env.TEST_IMODELID || "";

    testArgs = {
      accessToken,
      sessionId:"testSession",
      dataSource: {
        iTwinId,
        id: iModelId,
        changeId: "",
        type: "IMODEL",
      },
      format: "IMDL",
      urlPrefix: "qa-",
    };

    await IModelApp.startup();
  });

  after(async () => IModelApp.shutdown());

  it ("should obtain a tileset with a tile version supported by the frontend", async () => {

    // obtain graphic representation url for the model specified in the test args
    const url = await obtainGraphicRepresentationUrl(testArgs);
    if (!url) {
      throw new Error("Url is undefined");
      return;
    }

    // obtain tileset from returned graphic representation url
    const result = JSON.stringify(await (await fetch(url)).json());
    const resObj = JSON.parse(result);

    // obtain major tile version from the returned tileset (removing minor version from the string)
    const tilesetMajorTileVersion = resObj.asset.version.slice(0,4);

    // obtain frontend major tile version
    const frontendMajorTileVersion = IModelApp.tileAdmin.maximumMajorTileFormatVersion;

    // check if the frontend will support the tileset version
    expect(+tilesetMajorTileVersion).to.lessThanOrEqual(frontendMajorTileVersion);

  });

});
