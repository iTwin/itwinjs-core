/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { Frustum, ImageMapLayerSettings } from "@itwin/core-common";
import { expect } from "chai";
import { GoogleMapsImageryProvider } from "../../GoogleMaps/GoogleMapsImageryProvider";
import { _internal , CreateSessionOptions, GoogleMaps, GoogleMapsSession, ViewportInfoRequestParams } from "../../map-layers-formats";
import { fakeJsonFetch } from "../TestUtils";
import { LogoDecoration } from "../../GoogleMaps/GoogleMapDecorator";
import { DecorateContext, Decorations, IconSprites, IModelApp, MapCartoRectangle, MapTile, MapTileTree, QuadId, ScreenViewport, Sprite, TilePatch } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";

// eslint-disable-next-line @typescript-eslint/naming-convention
const GoogleMapsUtils = _internal;

class FakeMapTile extends MapTile  {
  public override depth: number;
  constructor(contentId: string) {
    super({contentId, range:Range3d.createNull(), maximumSize: 256},
    {} as MapTileTree,
    QuadId.createFromContentId(contentId),
   {} as TilePatch,
   MapCartoRectangle.createXY(0, 0),
   undefined,
   []);
   this.depth = this.quadId.level;
  }
}

// const getTestSettings = (properties?: MapLayerProviderProperties) => {
//   return GoogleMaps.createBaseLayerSettings({
//     name: "test",
//     url: "",
//     formatId: "GoogleMaps",
//     properties
//   });
// };

const createProvider = (settings: ImageMapLayerSettings) => {
  settings.accessKey = {key: "key", value: "dummyKey"};
  return new GoogleMapsImageryProvider(settings);
}

const stubCreateSession = (sandbox:sinon.SinonSandbox,  session: GoogleMapsSession) => sandbox.stub(GoogleMapsUtils, "createSession").callsFake(async function _(_apiKey: string, _opts: CreateSessionOptions) {
  return session;
});

const minCreateSessionOptions: CreateSessionOptions = {mapType: "satellite", language: "en-US", region: "US"}
const createSessionOptions2: CreateSessionOptions = {...minCreateSessionOptions, layerTypes: ["layerRoadmap"]};

const defaultPngSession = {tileWidth: 256, tileHeight: 256, imageFormat: "image/png", expiry: 0, session: "dummySession"};
describe.only("GoogleMapsProvider", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    sandbox.stub(LogoDecoration.prototype, "activate").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
    sandbox.stub(GoogleMapsUtils, "registerFormatIfNeeded");
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("Provider properties round-trips through JSON", async () => {
    const settings = GoogleMaps.createMapLayerSettings("", createSessionOptions2);
    const json = settings.toJSON();
    const deserializedSettings = ImageMapLayerSettings.fromJSON(json);
    expect(deserializedSettings.properties).to.deep.eq(settings.properties);
  });

  it("should not initialize with no properties provided", async () => {
    const settings = ImageMapLayerSettings.fromJSON({name: "test", formatId: "GoogleMaps", url: ""});
    const createSessionSub = stubCreateSession(sandbox, defaultPngSession);
    const provider = createProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith("Missing session options");
    expect(createSessionSub.called).to.be.false;
  });

  it("should initialize with required properties", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const settings = GoogleMaps.createBaseLayerSettings(minCreateSessionOptions);

    const createSessionSub = stubCreateSession(sandbox, defaultPngSession);
    const provider = createProvider(settings);

    await expect(provider.initialize()).to.be.fulfilled;
    expect(createSessionSub.called).to.be.true;
    expect(createSessionSub.firstCall.args[1]).to.deep.eq(minCreateSessionOptions);
  });

  it("should initialize with properties", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const settings = GoogleMaps.createBaseLayerSettings(createSessionOptions2);
    const createSessionSub = stubCreateSession(sandbox, defaultPngSession);
    const provider = createProvider(settings);

    await expect(provider.initialize()).to.be.fulfilled;
    expect(createSessionSub.called).to.be.true;
    expect(createSessionSub.firstCall.args[1]).to.deep.eq(createSessionOptions2);
    expect(provider.tileSize).to.eq(256);
    expect(settings.unsavedQueryParams).to.deep.eq({session: "dummySession"});
  });

  it("should create proper tile url", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const settings = GoogleMaps.createBaseLayerSettings(createSessionOptions2);

    const makeTileRequestStub = sandbox.stub(GoogleMapsImageryProvider.prototype, "makeTileRequest").callsFake(async function _(_url: string, _timeoutMs?: number ) {
      const obj = {
        headers: { "content-type": "image/jpeg" },
        arrayBuffer: async () => {
          return Promise.resolve(new Uint8Array(100));
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (obj as Response);
    });

    stubCreateSession(sandbox, defaultPngSession);
    const provider = createProvider(settings);

    await provider.initialize();
    await provider.loadTile(49592, 37981, 17);
    expect(makeTileRequestStub.called).to.be.true;
    expect(makeTileRequestStub.firstCall.args[0]).to.eq("https://tile.googleapis.com/v1/2dtiles/17/37981/49592?key=dummyKey&session=dummySession");
  });

  it("should add attributions", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const settings = GoogleMaps.createBaseLayerSettings(createSessionOptions2);

    sandbox.stub(GoogleMapsImageryProvider.prototype as any, "getSelectedTiles").callsFake(function _(_vp: unknown) {
      const set = new Set<MapTile>();
      set.add(new FakeMapTile("17_37981_49592"));
      return set;
    });

    const getViewportInfoStub = sandbox.stub(GoogleMapsUtils, "getViewportInfo").callsFake(async function _(_params: ViewportInfoRequestParams) {
      return {copyright: "fake copyright", maxZoomRects: []};
    });

    sinon.stub(IModelApp, 'publicPath').get(() => 'public/');

    const provider = createProvider(settings);

    await provider.initialize();
    const table = document.createElement('table');
    await provider.addAttributions(table, {} as ScreenViewport);

    expect(getViewportInfoStub.called).to.be.true;
    // Important : When satellite base layer is used, the logo should be white
    expect(table.innerHTML).to.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
    expect(table.innerHTML).to.includes(`<p class="logo-cards">fake copyright</p>`);

    // Now re-do the test with roadmap base layer
    const settings2 = GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en-US", region: "US"});
    const provider2 = createProvider(settings2);
    await provider2.initialize();
    const table2 = document.createElement('table');
    await provider2.addAttributions(table2, {} as ScreenViewport);
    expect(table2.innerHTML).to.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
    expect(table2.innerHTML).to.includes(`<p class="logo-cards">fake copyright</p>`);
  });

  it("logo should be activated with the 'on non-white' logo", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
      return {} as Sprite;
    });
    const settings = GoogleMaps.createBaseLayerSettings({mapType: "satellite", language: "en-US", region: "US"});
    const provider = createProvider(settings);
    await provider.initialize();

    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/google_on_non_white_hdpi.png");
  });

  it("logo should be activated with the 'on white' logo", async () => {

    fakeJsonFetch(sandbox, defaultPngSession);
    const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
      return {} as Sprite;
    });
    const settings = GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en-US", region: "US"});
    const provider = createProvider(settings);
    await provider.initialize();

    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/google_on_white_hdpi.png");
  });

  it("should decorate", async () => {
    fakeJsonFetch(sandbox, defaultPngSession);
    const settings = GoogleMaps.createBaseLayerSettings(minCreateSessionOptions);

    const provider = createProvider(settings);

    await provider.initialize();

    const addCanvasDecorationStub = sinon.stub(DecorateContext.prototype, "addCanvasDecoration");
    sinon.stub(LogoDecoration.prototype, "isLoaded").get(() => true);
    const context =  DecorateContext.create({ viewport: {getFrustum: ()=>new Frustum()} as ScreenViewport, output: new Decorations() });

    provider.decorate(context);

    expect(addCanvasDecorationStub.called).to.be.true;
  });

});
