/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import * as sinon from "sinon";
import * as chai from "chai";
import {
  WmtsCapabilities,
  WmtsMapLayerImageryProvider,
} from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { RequestBasicCredentials } from "../../../request/Request";

const wmtsSampleSource = { formatId: "WMTS", url: "https://localhost/wmts", name: "Test WMTS" };
describe("WmtsMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmtsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmtsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("construct proper tile url", async () => {
    const tileMatrixLevel0Identifier = "0";
    const tileMatrixSetIdentifier = "default";
    sandbox.stub(WmtsMapLayerImageryProvider.prototype, "getDisplayedTileMatrixSetAndLimits" as any).callsFake(() => {
      const  tileMatrixSet = {
        tileMatrix: [{identifier: tileMatrixLevel0Identifier}],
        identifier: tileMatrixSetIdentifier,
      };
      return  {tileMatrixSet};
    });

    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    let provider = new WmtsMapLayerImageryProvider(settings);
    let url = await provider.constructUrl(0,0,0);
    const refUrl = `https://sub.service.com/service?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=&TileMatrixSet=${tileMatrixSetIdentifier}&TileMatrix=${tileMatrixLevel0Identifier}&TileCol=0&TileRow=0`;
    chai.expect(url).to.equals(refUrl);

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);

    provider = new WmtsMapLayerImageryProvider(settings);
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });
});
