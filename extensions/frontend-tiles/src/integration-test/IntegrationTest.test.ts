import { TileAdmin } from "@itwin/core-frontend";
import { expect } from "chai";
import { TestContext } from "./TestContext";
import { GraphicRepresentationStatus } from "../GraphicsProvider/GraphicRepresentationProvider";

async function getExport(exportId: string, accessToken: string, urlPrefix?: string): Promise<any> {
  const headers = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Authorization: accessToken,
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Accept: "application/vnd.bentley.itwin-platform.v1+json",
  };

  // obtain export for specified export id
  const url = `https://${urlPrefix}api.bentley.com/mesh-export/${exportId}`;
  try {
    const response = await fetch(url, { headers });
    return await response.json();
  } catch (err) {
    throw new Error(`Failed to get export: ${err}`);
  }
}

describe("MeshExportServiceIntegrationTest", () => {
  let accessToken: any;
  let urlPrefix: any;
  let exportId: any;

  before(async () => {

    // obtain access token
    const testContext = await TestContext.instance();
    accessToken = testContext.getAccessToken();

    const iModelId = process.env.MES_IMODEL_ID || "";
    urlPrefix = process.env.IMJS_URL_PREFIX || "";

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        /* eslint-disable-next-line @typescript-eslint/naming-convention */
        "Authorization": accessToken,
        /* eslint-disable-next-line @typescript-eslint/naming-convention */
        "Accept": "application/vnd.bentley.itwin-platform.v1+json",
         
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        iModelId,
        changesetId: "",
        exportType:"IMODEL",
      }),
    };

    // initiate mesh export
    const response = await fetch(`https://${urlPrefix}api.bentley.com/mesh-export/`, requestOptions);
    const result = await response.json();
    exportId = result.export.id;
  });

  it ("should obtain a tileset with a tile version supported by the frontend", async () => {
    let exportComplete = false;
    let tilesetUrl: any;

    // poll for export status
    while (!exportComplete) {
      const result = await getExport(exportId, accessToken, urlPrefix);
      const status = result.export.status;

      // once export is complete, obtain the tileset url
      if (status === GraphicRepresentationStatus.Complete) {
        tilesetUrl = new URL(result.export._links.mesh.href);
        tilesetUrl.pathname = `${tilesetUrl.pathname}/tileset.json`;
        exportComplete = true;
      }
    }

    if (!tilesetUrl) {
      throw new Error("Url is undefined");
    }

    // fetch tileset url and convert it to json
    const tileset = await (await fetch(tilesetUrl)).json();

    // obtain major tile version from the returned tileset (removing minor version from the string)
    const tilesetMajorTileVersion = tileset.asset.version.slice(0,4);

    // obtain frontend major tile version
    const tileAdmin = await TileAdmin.create();
    const frontendMajorTileVersion = tileAdmin.maximumMajorTileFormatVersion;

    // check if the frontend will support the tileset version
    // the version included in the tileset is in hex, so first convert it
    const decTilesetMajorTileVersion = parseInt(tilesetMajorTileVersion, 16);
    expect(decTilesetMajorTileVersion).to.lessThanOrEqual(frontendMajorTileVersion);

  });

});
