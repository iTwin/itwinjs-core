/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { DefaultOgcSymbology, OgcFeaturesProvider } from "../../OgcFeatures/OgcFeaturesProvider";
import { ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import { expect } from "chai";
import { CountriesDataset } from "./CountriesDataset";
import { MapCartoRectangle } from "@itwin/core-frontend";

function stubFetchMetadata(sandbox: sinon.SinonSandbox, collectionJson: string, queryablesJson?: string) {

  sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchMetadata").callsFake(async function _(urlU: unknown) {
    const url = urlU as string;
    const test = {
      headers: { "content-type": "application/json" },
      json: async () => {
        if(url.includes("queryables"))
          return JSON.parse(queryablesJson ?? "");
        else
          return JSON.parse(collectionJson);
      },
      status: 200,
    } as unknown;   // By using unknown type, I can define parts of Response I really need
    return (test as Response);
  });
}

describe("OgcFeaturesProvider", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    // need to be mocked otherwise tests hangs
    sandbox.stub(HTMLImageElement.prototype, "addEventListener").callsFake(function _(_type: string, listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {
      (listener as any)();
    });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read polygon geometry", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "test",
      formatId: "test",
    });
    const provider = new OgcFeaturesProvider(settings);
    const transfo = provider.computeTileWorld2CanvasTransform(0,0,0);
    expect(transfo).to.not.be.undefined;
  });

  it("should initialize with valid collection metadata", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "test",
      formatId: "test",
    });
    stubFetchMetadata(sandbox, JSON.stringify(CountriesDataset.collection), JSON.stringify(CountriesDataset.queryables));
    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return true;
    });

    const symbInitSpy = sinon.spy(DefaultOgcSymbology.prototype, "initialize");
    const indexDataStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "indexStaticData").callsFake(async function _() {
      return true;
    });

    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();

    expect((provider as any)._queryables).to.not.undefined;

    expect((provider as any)._itemsUrl).to.be.equals(CountriesDataset.collection.links[1].href);

    // Check CartoRange is initialized
    const datasetBbox = CountriesDataset.collection.extent.spatial.bbox[0];
    expect(provider.cartoRange?.distanceToRange(MapCartoRectangle.fromDegrees(datasetBbox[0], datasetBbox[1], datasetBbox[2], datasetBbox[3]))).to.be.lessThan(0.000001);

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;

    expect(symbInitSpy.called).to.be.true;
    expect(indexDataStub.called).to.be.true;
  });

  it("should initialize with valid collection metadata", async () => {
    let settings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "test",
      formatId: "test",
      subLayers: [{id: "public.countries", name:"public.countries" }],
    });
    stubFetchMetadata(sandbox, JSON.stringify(CountriesDataset.collection), JSON.stringify(CountriesDataset.queryables));
    sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    let provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await provider.initialize();

    // Now test with an invalid sublayer Id
    settings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "test",
      formatId: "test",
      subLayers: [{id: "bad", name:"bad" }],
    });

    provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await expect(provider.initialize()).to.be.rejectedWith(Error, `Collection metadata and layer id ("bad") mismatch`);
  });

});
