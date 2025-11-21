/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DecorateContext, Decorations, IconSprites, IModelApp, LogoDecoration, MapCartoRectangle, MapTile, MapTileTree, QuadId, ScreenViewport, Sprite } from "@itwin/core-frontend";
import sinon from "sinon";
import { Frustum, ImageMapLayerSettings } from "@itwin/core-common";
import { TilePatch } from "@itwin/core-frontend/lib/cjs/tile/internal.js";
import { Range3d } from "@itwin/core-geometry";
import { GoogleMapsImageryProvider } from "../../GoogleMaps/GoogleMapsImageryProvider.js";
import { BaseGoogleMapsSession, GoogleMaps, GoogleMapsCreateSessionOptions, GoogleMapsRequest, GoogleMapsSession, GoogleMapsSessionData, GoogleMapsSessionManager } from "../../map-layers-formats.js";
import { GoogleMapsUtils } from "../../internal/GoogleMapsUtils.js";
import { expect } from "chai";
import { fakeJsonFetch } from "../TestUtils.js";
import { NativeGoogleMapsSession } from "../../internal/NativeGoogleMapsSession.js";

class FakeSession extends BaseGoogleMapsSession {

  protected getTileApiBaseUrl() {
    return "";
  }

  public getTileSize(): number {
      return 256;
  }

  public getTileRequest(): GoogleMapsRequest {
    return {url: new URL("https://fake.google.com/tile")};
  }

  public getViewportInfoRequest (): GoogleMapsRequest {
    return {url: new URL("https://fake.google.com/tile")};
  }
}

class FakeSessionManager extends GoogleMapsSessionManager {
    public async createSession(_sessionOptions: GoogleMapsCreateSessionOptions): Promise<GoogleMapsSession> {
      return new FakeSession();
    }
  }

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

const createProvider = (settings: ImageMapLayerSettings, sessionManager?: GoogleMapsSessionManager) => {
  settings.accessKey = {key: "key", value: "dummyKey"};
  return new GoogleMapsImageryProvider(settings, sessionManager);
}

const stubCreateSession = (sandbox:sinon.SinonSandbox,  session: GoogleMapsSessionData) => sandbox.stub(NativeGoogleMapsSession, "create").callsFake(async function _(_apiKey: string, _opts: GoogleMapsCreateSessionOptions) {
  return session;
});

const minCreateSessionOptions: GoogleMapsCreateSessionOptions = {mapType: "satellite", language: "en-US", region: "US"}
const createSessionOptions2: GoogleMapsCreateSessionOptions = {...minCreateSessionOptions, layerTypes: ["layerRoadmap"]};

const defaultPngSession = {tileWidth: 256, tileHeight: 256, imageFormat: "image/png", expiry: 0, session: "dummySession"};

describe("GoogleMapsProvider", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    sandbox.stub(IModelApp, "mapLayerFormatRegistry").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
    sandbox.stub(LogoDecoration.prototype, "activate").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
    sandbox.stub(GoogleMapsUtils, "checkFormatRegistered");
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

    const getViewportInfoStub = sandbox.stub(GoogleMapsImageryProvider.prototype, "fetchViewportInfo").callsFake(async function _(_rectangle: MapCartoRectangle, _zoomLevel: number) {
      return {copyright: "fake copyright", maxZoomRects: []};
    });

    sinon.stub(IModelApp, 'publicPath').get(() => 'public/');

    const provider = createProvider(settings);

    await provider.initialize();
    const table = document.createElement('table');
    await provider.addAttributions(table, {} as ScreenViewport);

    expect(getViewportInfoStub.called).to.be.true;
    expect(table.innerHTML).to.includes(`<img src="public/images/GoogleMaps_Logo_Gray.svg" style="padding: 10px 10px 5px 10px;">`);
    expect(table.innerHTML).to.includes(`<p class="logo-cards">fake copyright</p>`);
  });

  it("logo should be activated with the 'dark outline' logo", async () => {
    fakeJsonFetch(sandbox, defaultPngSession);
    const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
      return {} as Sprite;
    });
    const settings = GoogleMaps.createBaseLayerSettings({mapType: "satellite", language: "en-US", region: "US"});
    const provider = createProvider(settings);
    await provider.initialize();

    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/GoogleMaps_Logo_WithDarkOutline.svg");
  });

  it("logo should be activated with the 'white outline' logo", async () => {
    fakeJsonFetch(sandbox, defaultPngSession);
    const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
      return {} as Sprite;
    });
    const settings = GoogleMaps.createBaseLayerSettings({mapType: "roadmap", language: "en-US", region: "US"});
    const provider = createProvider(settings);
    await provider.initialize();

    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/GoogleMaps_Logo_WithLightOutline.svg");

    // Should also work with "terrain" map type
    const settingsTerrain = GoogleMaps.createBaseLayerSettings({mapType: "terrain", language: "en-US", region: "US"});
    const providerTerrain = createProvider(settingsTerrain);
    await providerTerrain.initialize();

    expect(getSpriteStub.secondCall.args[0]).to.eq("public/images/GoogleMaps_Logo_WithLightOutline.svg");
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

  it("should use custom session client", async () => {
    fakeJsonFetch(sandbox, defaultPngSession);
    const sessionManager = new FakeSessionManager();
    const createSessionSpy = sandbox.spy(sessionManager, "createSession");
    const settings = GoogleMaps.createBaseLayerSettings(minCreateSessionOptions);

    stubCreateSession(sandbox, defaultPngSession);
    const provider = createProvider(settings, sessionManager);

    await provider.initialize();
    expect(createSessionSpy.called).to.be.true;
  });
});
