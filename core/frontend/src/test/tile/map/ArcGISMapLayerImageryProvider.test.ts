/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { IModelApp } from "../../../IModelApp";
import {
  ArcGISMapLayerImageryProvider,
  ArcGisUtilities,

} from "../../../tile/internal";
import { ArcGISMapLayerDataset } from "./ArcGISMapLayerDataset";

chai.use(chaiAsPromised);

const sampleSource = { formatId: "ArcGUS", url: "https://localhost/Mapserver", name: "Test" };

describe("ArcGISMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });
  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("initialize() should throw coordinate system error", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean) {
      return ArcGISMapLayerDataset.TilesOnlyDataset26918;
    });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError, "Invalid coordinate system");
  });

  it("initialize() should turn ON use of tiles", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean) {
      return ArcGISMapLayerDataset.UsaTopoMaps;
    });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect((provider as any)._tilesOnly).to.equals(false);
    chai.expect((provider as any)._mapSupported).to.equals(true);
    chai.expect((provider as any)._tileMapSupported).to.equals(true);
    chai.expect((provider as any)._tileMap).to.be.not.undefined;
    chai.expect((provider as any)._usesCachedTiles).to.be.true;
  });

  it("initialize() should fallback to 'Export' queries instead of tiles when invalid CS ", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean) {
      const dataset = JSON.parse(JSON.stringify(ArcGISMapLayerDataset.UsaTopoMaps));

      // Fake an unknown CS
      dataset.tileInfo.spatialReference.latestWkid = 1234;
      return dataset;
    });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect((provider as any)._tilesOnly).to.equals(false);
    chai.expect((provider as any)._mapSupported).to.equals(true);
    chai.expect((provider as any)._tileMapSupported).to.equals(true);
    chai.expect((provider as any)._tileMap).to.be.undefined;
    chai.expect((provider as any)._usesCachedTiles).to.be.false;
  });
});
