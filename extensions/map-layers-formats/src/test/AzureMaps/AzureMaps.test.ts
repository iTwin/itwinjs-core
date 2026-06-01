/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BackgroundMapType, BaseMapLayerSettings, ImageMapLayerSettings, type MapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerFormatRegistry, MapLayerImageryProviderStatus, type MapLayerOptions, MapLayerSource, MapLayerSourceStatus } from "@itwin/core-frontend";
import { AzureMaps } from "../../AzureMaps/AzureMaps.js";
import { AzureMapsMapLayerFormat } from "../../AzureMaps/AzureMapsImageryFormat.js";
import { AzureMapsLayerImageryProvider } from "../../AzureMaps/AzureMapsImageryProvider.js";
import { MapLayersFormats } from "../../mapLayersFormats.js";

class FakeDisplayStyle {
  public settings = { mapImagery: { backgroundLayers: [] as MapLayerSettings[] } };
  private _backgroundMapBase = BaseMapLayerSettings.fromJSON({
    formatId: "ArcGIS",
    url: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
    name: "ESRI World Imagery",
  });

  public get backgroundMapBase() {
    return this._backgroundMapBase;
  }

  public set backgroundMapBase(baseLayer: BaseMapLayerSettings) {
    this._backgroundMapBase = baseLayer;
  }

  public attachMapLayer(options: { settings: MapLayerSettings; mapLayerIndex: { index: number, isOverlay: boolean } }) {
    if (options.mapLayerIndex.isOverlay)
      throw new Error("Overlay layers are not expected in this test");

    if (options.mapLayerIndex.index < 0 || options.mapLayerIndex.index > (this.settings.mapImagery.backgroundLayers.length - 1))
      this.settings.mapImagery.backgroundLayers.push(options.settings);
    else
      this.settings.mapImagery.backgroundLayers.splice(options.mapLayerIndex.index, 0, options.settings);
  }

  public detachMapLayerByIndex(options: { index: number, isOverlay: boolean }) {
    if (options.isOverlay)
      throw new Error("Overlay layers are not expected in this test");

    if (options.index < 0)
      this.settings.mapImagery.backgroundLayers.length = 0;
    else
      this.settings.mapImagery.backgroundLayers.splice(options.index, 1);
  }
}

describe("AzureMaps", () => {
  const sandbox = sinon.createSandbox();
  let registryConfig: MapLayerOptions;

  beforeEach(() => {
    registryConfig = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      AzureMaps: { key: "subscription-key", value: "dummyKey" },
    };

    const registry = new MapLayerFormatRegistry(registryConfig);
    registry.register(AzureMapsMapLayerFormat);
    sandbox.stub(IModelApp, "mapLayerFormatRegistry").get(() => registry);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("creates Street, Aerial, and Hybrid basemap settings", () => {
    const street = AzureMaps.createBaseLayerSettings(BackgroundMapType.Street);
    const aerial = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const hybrid = AzureMaps.createBaseLayerSettings(BackgroundMapType.Hybrid);

    expect(street.formatId).to.eq("AzureMaps");
    expect(street.url).to.eq("https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.road");
    expect(aerial.url).to.eq("https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery");
    expect(hybrid.url).to.eq("https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery");
  });

  it("creates and cleans up the Hybrid road-labels helper layer", () => {
    const style = new FakeDisplayStyle() as unknown as Parameters<typeof AzureMaps.applyBackgroundMap>[0];

    AzureMaps.applyBackgroundMap(style, BackgroundMapType.Hybrid);
    expect(style.backgroundMapBase.name).to.eq("Azure Maps: Hybrid");
    expect(style.settings.mapImagery.backgroundLayers).to.have.lengthOf(1);
    expect(AzureMaps.getBackgroundMapType(style)).to.eq(BackgroundMapType.Hybrid);

    AzureMaps.applyBackgroundMap(style, BackgroundMapType.Aerial);
    expect(style.backgroundMapBase.name).to.eq("Azure Maps: Aerial Imagery");
    expect(style.settings.mapImagery.backgroundLayers).to.have.lengthOf(0);
    expect(AzureMaps.getBackgroundMapType(style)).to.eq(BackgroundMapType.Aerial);
  });

  it("preserves existing base-layer display state when applying an Azure basemap", () => {
    const style = new FakeDisplayStyle() as unknown as Parameters<typeof AzureMaps.applyBackgroundMap>[0];
    style.backgroundMapBase = BaseMapLayerSettings.fromJSON({
      formatId: "ArcGIS",
      url: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
      name: "ESRI World Imagery",
      visible: false,
      transparency: 0.35,
      transparentBackground: false,
    });

    AzureMaps.applyBackgroundMap(style, BackgroundMapType.Hybrid);

    expect(style.backgroundMapBase.visible).to.eq(false);
    expect(style.backgroundMapBase.transparency).to.eq(0.35);
    expect(style.backgroundMapBase.transparentBackground).to.eq(false);
  });

  it("does not remove manually attached equivalent Azure road-label layers", () => {
    const style = new FakeDisplayStyle() as unknown as Parameters<typeof AzureMaps.applyBackgroundMap>[0];
    const manualRoadLabels = ImageMapLayerSettings.fromJSON({
      formatId: "AzureMaps",
      name: "Azure Maps: Road labels",
      url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.labels.road",
      transparentBackground: true,
    });

    style.attachMapLayer({ mapLayerIndex: { index: -1, isOverlay: false }, settings: manualRoadLabels });
    AzureMaps.applyBackgroundMap(style, BackgroundMapType.Hybrid);
    expect(style.settings.mapImagery.backgroundLayers).to.have.lengthOf(2);

    AzureMaps.clearBackgroundLayers(style);
    expect(style.settings.mapImagery.backgroundLayers).to.have.lengthOf(1);
    expect(style.settings.mapImagery.backgroundLayers[0]).to.eq(manualRoadLabels);
  });

  it("uses the configured Azure Maps access-key value without requiring a specific key name", async () => {
    registryConfig.AzureMaps = { key: "custom-key-name", value: "dummyKey" };

    const validation = await AzureMapsMapLayerFormat.validate({
      source: MapLayerSource.fromJSON({ name: "Azure", formatId: "AzureMaps", url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery" })!,
    });
    expect(validation.status).to.eq(MapLayerSourceStatus.Valid);

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = IModelApp.mapLayerFormatRegistry.createImageryProvider(settings);

    expect(provider).to.be.instanceOf(AzureMapsLayerImageryProvider);
    if (undefined === provider)
      throw new Error("Expected Azure Maps provider to be created");

    expect(await provider.constructUrl(1, 2, 3)).to.contain("subscription-key=dummyKey");
  });

  it("requires an Azure Maps credential during validation and tile loading", async () => {
    delete registryConfig.AzureMaps;

    const validation = await AzureMapsMapLayerFormat.validate({
      source: MapLayerSource.fromJSON({ name: "Azure", formatId: "AzureMaps", url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery" })!,
    });
    expect(validation.status).to.eq(MapLayerSourceStatus.RequireAuth);

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = new AzureMapsLayerImageryProvider(settings);
    await provider.loadTile(0, 0, 0);
    expect(provider.status).to.eq(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("creates providers through the registry with the configured subscription key", async () => {
    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = IModelApp.mapLayerFormatRegistry.createImageryProvider(settings);

    expect(provider).to.be.instanceOf(AzureMapsLayerImageryProvider);
    if (undefined === provider)
      throw new Error("Expected Azure Maps provider to be created");

    expect(await provider.constructUrl(1, 2, 3)).to.contain("subscription-key=dummyKey");
  });

  it("can use the MapLayersFormats Azure Maps subscription key option", async () => {
    delete registryConfig.AzureMaps;
    sandbox.stub(MapLayersFormats, "azureMapsOpts").get(() => ({ subscriptionKey: "dummyKey" }));

    const validation = await AzureMapsMapLayerFormat.validate({
      source: MapLayerSource.fromJSON({ name: "Azure", formatId: "AzureMaps", url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery" })!,
    });
    expect(validation.status).to.eq(MapLayerSourceStatus.Valid);

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = IModelApp.mapLayerFormatRegistry.createImageryProvider(settings);

    expect(provider).to.be.instanceOf(AzureMapsLayerImageryProvider);
    if (undefined === provider)
      throw new Error("Expected Azure Maps provider to be created");

    expect(await provider.constructUrl(1, 2, 3)).to.contain("subscription-key=dummyKey");
  });

  it("prefers configured layer credentials over MapLayersFormats Azure Maps options", async () => {
    registryConfig.AzureMaps = { key: "custom-key-name", value: "dummyKey" };
    sandbox.stub(MapLayersFormats, "azureMapsOpts").get(() => ({ subscriptionKey: "fallbackKey" }));

    const validation = await AzureMapsMapLayerFormat.validate({
      source: MapLayerSource.fromJSON({ name: "Azure", formatId: "AzureMaps", url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery" })!,
    });
    expect(validation.status).to.eq(MapLayerSourceStatus.Valid);

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = IModelApp.mapLayerFormatRegistry.createImageryProvider(settings);

    expect(provider).to.be.instanceOf(AzureMapsLayerImageryProvider);
    if (undefined === provider)
      throw new Error("Expected Azure Maps provider to be created");

    const url = await provider.constructUrl(1, 2, 3);
    expect(url).to.contain("subscription-key=dummyKey");
    expect(url).not.to.contain("subscription-key=fallbackKey");
  });

  it("falls back to the MapLayersFormats subscription key when the layer access key is empty", async () => {
    registryConfig.AzureMaps = { key: "subscription-key", value: "" };
    sandbox.stub(MapLayersFormats, "azureMapsOpts").get(() => ({ subscriptionKey: "fallbackKey" }));

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = IModelApp.mapLayerFormatRegistry.createImageryProvider(settings);

    expect(provider).to.be.instanceOf(AzureMapsLayerImageryProvider);
    if (undefined === provider)
      throw new Error("Expected Azure Maps provider to be created");

    expect(await provider.constructUrl(1, 2, 3)).to.contain("subscription-key=fallbackKey");
  });

  it("maps Azure 401/403 tile responses to RequireAuth", async () => {
    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    settings.accessKey = { key: "subscription-key", value: "dummyKey" };
    const provider = new AzureMapsLayerImageryProvider(settings);

    const makeTileRequest = sandbox.stub(provider, "makeTileRequest");
    makeTileRequest.onFirstCall().resolves({ status: 401 } as Response);
    await provider.loadTile(0, 0, 0);
    expect(provider.status).to.eq(MapLayerImageryProviderStatus.RequireAuth);

    provider.resetStatus();
    makeTileRequest.reset();
    makeTileRequest.onFirstCall().resolves({ status: 403 } as Response);
    await provider.loadTile(0, 0, 0);
    expect(provider.status).to.eq(MapLayerImageryProviderStatus.RequireAuth);
  });
});
