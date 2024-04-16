/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { DefaultOgcSymbology, OgcFeaturesProvider } from "../../OgcFeatures/OgcFeaturesProvider";
import { ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { expect } from "chai";
import { CountriesDataset } from "./CountriesDataset";
import { MapCartoRectangle } from "@itwin/core-frontend";
import { base64StringToUint8Array } from "@itwin/core-bentley";

function stubFetchMetadata(sandbox: sinon.SinonSandbox, urlContent: { [url: string]: string }  ) {

  return sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchMetadata").callsFake(async function _(url: unknown): Promise<any> {
    return Promise.resolve(JSON.parse(urlContent[url as string]));
  });
}

const getTestSettings = (url: string, subLayers = [{id: "public.countries", name:"public.countries" }]) => {
  return ImageMapLayerSettings.fromJSON({
    name: "test",
    url,
    formatId: "OgcFeatures",
    subLayers,
  });
};

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

  it("should initialize with valid collection metadata", async () => {

    const settings = getTestSettings(CountriesDataset.collectionUrl, undefined);
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

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

  it("should initialize when a specific collection URL is passed and a single subLayer id is specified", async () => {
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);
    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    const provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
  });

  it("should initialize when a specific collection URL is passed and multiple subLayer ids are specified", async () => {
    const settings = getTestSettings(CountriesDataset.collectionUrl, [{id: "public.countries", name:"public.countries" }, {id: "public.countries2", name:"public.countries2" }]);
    const urlContent: { [key: string]: string } = {};
    urlContent[CountriesDataset.collectionUrl] = JSON.stringify(CountriesDataset.collection);
    urlContent[CountriesDataset.queryablesUrl] = JSON.stringify(CountriesDataset.queryables);
    stubFetchMetadata(sandbox,  urlContent);
    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
  });

  it("should not initialize when a specific collection URL is passed and an invalid subLayer id is specified", async () => {
    const urlContent: { [key: string]: string } = {};
    urlContent[CountriesDataset.collectionUrl] = JSON.stringify(CountriesDataset.collection);
    urlContent[CountriesDataset.queryablesUrl] = JSON.stringify(CountriesDataset.queryables);
    stubFetchMetadata(sandbox,  urlContent);
    sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl, [{id: "bad", name:"bad" }]);
    const provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id != collection Id
    await expect(provider.initialize()).to.be.rejectedWith(Error, `Collection metadata and sub-layers id mismatch`);
  });

  it("should initialize with layer url  set to items url", async () => {

    const stubMetadata = stubFetchMetadata(sandbox,  CountriesDataset.urlsContent);

    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionItemsUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
    expect(stubMetadata.getCalls().length).to.equals(3);
    expect(stubMetadata.getCall(0).args[0]).to.equals(CountriesDataset.collectionItemsUrl);
    expect(stubMetadata.getCall(1).args[0]).to.equals(CountriesDataset.collectionUrl);
    expect(stubMetadata.getCall(2).args[0]).to.equals(CountriesDataset.queryablesUrl);
  });

  it("should initialize with layer url set to collections url", async () => {

    const stubMetadata = stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionsUrl);
    const provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
    expect(stubMetadata.getCalls().length).to.equals(3);
    expect(stubMetadata.getCall(0).args[0]).to.equals(CountriesDataset.collectionsUrl);
    expect(stubMetadata.getCall(1).args[0]).to.equals(CountriesDataset.collectionUrl);
    expect(stubMetadata.getCall(2).args[0]).to.equals(CountriesDataset.queryablesUrl);
  });

  it("should not initialize with layer url set to a collection url but invalid sub-layer", async () => {

    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl, [{id: "bad", name:"bad" }]);
    const provider = new OgcFeaturesProvider(settings);

    await expect(provider.initialize()).to.be.rejectedWith(Error, `Collection metadata and sub-layers id mismatch`);
  });

  it("should initialize with layer url set to a collection url but no sub-layers", async () => {

    const stubMetadata = stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });
    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl, undefined);
    const provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
    expect(stubMetadata.getCalls().length).to.equals(2);
    expect(stubMetadata.getCall(0).args[0]).to.equals(CountriesDataset.collectionUrl);
    expect(stubMetadata.getCall(1).args[0]).to.equals(CountriesDataset.queryablesUrl);
  });

  it("should initialize with layer url set to a collection url and single valid sub-layer", async () => {

    const stubMetadata = stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });
    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);

    // Initialize should not throw since subLayer.Id = collection Id
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
    expect(stubMetadata.getCalls().length).to.equals(2);
    expect(stubMetadata.getCall(0).args[0]).to.equals(CountriesDataset.collectionUrl);
    expect(stubMetadata.getCall(1).args[0]).to.equals(CountriesDataset.queryablesUrl);
  });

  it("should initialize with layer url set to landingPage url", async () => {

    const stubMetadata = stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const fetchAllItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.landingPageUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();

    // FetchAllItems should have been called
    expect(fetchAllItemsStub.called).to.be.true;
    expect(stubMetadata.getCalls().length).to.equals(4);
    expect(stubMetadata.getCall(0).args[0]).to.equals(CountriesDataset.landingPageUrl);
    expect(stubMetadata.getCall(1).args[0]).to.equals(CountriesDataset.collectionsUrl);
    expect(stubMetadata.getCall(2).args[0]).to.equals(CountriesDataset.collectionUrl);
    expect(stubMetadata.getCall(3).args[0]).to.equals(CountriesDataset.queryablesUrl);
  });

  it("should fetch all items and follow next page links on initialize" , async () => {
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const tileRequestStub = sandbox.stub(OgcFeaturesProvider.prototype, "makeTileRequest").callsFake(async function _(url: string, _timeoutMs?: number ) {
      const obj = {
        headers: { "content-type": "application/json" },
        json: async () => {
          if (url.includes("offset"))
            return undefined ;
          else
            return CountriesDataset.singleItem;
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (obj as Response);
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();
    expect(tileRequestStub.getCalls().length).to.equals(2);
    expect(tileRequestStub.getCall(0).args[0]).to.equals(`${CountriesDataset.collectionUrl}/items?limit=10000`);
    expect(tileRequestStub.getCall(1).args[0]).to.equals(CountriesDataset.singleItem.links[2].href);
  });

  it("should not make tile request in static mode" , async () => {
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return true;
    });
    sandbox.stub(OgcFeaturesProvider.prototype as any, "indexStaticData").callsFake(async function _() {
      return true;
    });
    sandbox.stub(OgcFeaturesProvider.prototype, "staticMode").get(() => true);
    const tileRequestStub = sandbox.stub(OgcFeaturesProvider.prototype, "makeTileRequest").callsFake(async function _(url: string, _timeoutMs?: number ) {
      const obj = {
        headers: { "content-type": "application/json" },
        json: async () => {
          if (url.includes("offset"))
            return undefined ;
          else
            return CountriesDataset.singleItem;
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (obj as Response);
    });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });
    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return "data:image/png;base64,iVBORw0KGgo";
    });
    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();
    await provider.loadTile(0, 0, 0);

    // Since we forced static mode, there should not be any further request.
    expect(tileRequestStub.called).to.be.false;
  });

  it("should not make request while loading tile in static mode" , async () => {
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return true;
    });
    const indexStaticData = sandbox.stub(OgcFeaturesProvider.prototype as any, "indexStaticData").callsFake(async function _() {
      return true;
    });
    sandbox.stub(OgcFeaturesProvider.prototype, "staticMode").get(() => true);
    const tileRequestStub = sandbox.stub(OgcFeaturesProvider.prototype, "makeTileRequest").callsFake(async function _(url: string, _timeoutMs?: number ) {
      const obj = {
        headers: { "content-type": "application/json" },
        json: async () => {
          if (url.includes("offset"))
            return undefined ;
          else
            return CountriesDataset.singleItem;
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (obj as Response);
    });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });
    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return "data:image/png;base64,iVBORw0KGgo";
    });

    // Now test with an invalid sublayer Id
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();
    await provider.loadTile(0, 0, 0);

    // Since we forced static mode, there should not be any further request.
    expect(tileRequestStub.called).to.be.false;
    expect(indexStaticData.called).to.be.true;
  });

  it("should not make request while loading tile in non-static mode" , async () => {
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    // By returning false we force the non-static mode
    sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchAllItems").callsFake(async function _() {
      return false;
    });

    const fetchItemsStub = sandbox.stub(OgcFeaturesProvider.prototype as any, "fetchItems").callsFake(async function _(_url: unknown, _timeoutMs?: unknown ) {
      return CountriesDataset.singleItem;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return "";
    });

    // Now test with an invalid sublayer Ida
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();
    await provider.loadTile(0, 0, 0);

    // Since we forced static mode, there should not be any further request.

    expect(fetchItemsStub.called).to.be.true;
    expect(fetchItemsStub.getCalls().length).to.equals(1);
    expect(fetchItemsStub.getCall(0).args[0]).to.includes("collections/public.countries/items?bbox");
  });

  it("should handle exceptions from makeTileRequest" , async () => {
    stubFetchMetadata(sandbox, CountriesDataset.urlsContent);

    const makeTileRequestStub = sandbox.stub(OgcFeaturesProvider.prototype, "makeTileRequest").callsFake(async function _() {
      throw new Error();
    });

    // Now test with an invalid sublayer Ida
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    await provider.initialize();
    const success = await (provider as any).fetchAllItems();

    expect(success).to.be.false;
    expect(makeTileRequestStub.getCalls().length).to.equals(2);
  });

  it("should create image source from data url" , async () => {
    // Now test with an invalid sublayer Ida
    const settings = getTestSettings(CountriesDataset.collectionUrl);
    const provider = new OgcFeaturesProvider(settings);
    const base64Png = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsEAAA7BAbiRa+0AAAAiSURBVDhPY2RgYPgPxGQDJihNNhg1YNQAEBg1YOANYGAAAE1AAR90Oy6aAAAAAElFTkSuQmCC";
    const sampleDataUrl = `data:image/png;base64,${base64Png}`;
    const imageSource: ImageSource = (provider as any).createImageSourceFromDataURL(sampleDataUrl, ImageSourceFormat.Png);
    expect(imageSource.data).to.eql(base64StringToUint8Array(base64Png));
  });

});
