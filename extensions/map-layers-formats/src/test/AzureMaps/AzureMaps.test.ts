/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { BackgroundMapType, BaseMapLayerSettings, ImageMapLayerSettings, type MapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerImageryProviderStatus, MapLayerSource, MapLayerSourceStatus } from "@itwin/core-frontend";
import { AzureMaps } from "../../AzureMaps/AzureMaps.js";
import { AzureMapsMapLayerFormat } from "../../AzureMaps/AzureMapsImageryFormat.js";
import { AzureMapsLayerImageryProvider } from "../../AzureMaps/AzureMapsImageryProvider.js";

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
  const registryConfig = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    AzureMaps: { key: "subscription-key", value: "dummyKey" },
  };

  beforeEach(() => {
    registryConfig.AzureMaps = { key: "subscription-key", value: "dummyKey" };
    sandbox.stub(IModelApp, "mapLayerFormatRegistry").get(() => ({
      isRegistered: () => true,
      configOptions: registryConfig,
    }));
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

  it("requires the subscription-key credential name during validation and tile loading", async () => {
    registryConfig.AzureMaps = { key: "wrong-key-name", value: "dummyKey" };

    const validation = await AzureMapsMapLayerFormat.validate({
      source: MapLayerSource.fromJSON({ name: "Azure", formatId: "AzureMaps", url: "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery" })!,
    });
    expect(validation.status).to.eq(MapLayerSourceStatus.RequireAuth);

    const settings = AzureMaps.createBaseLayerSettings(BackgroundMapType.Aerial);
    const provider = new AzureMapsLayerImageryProvider(settings);
    await provider.loadTile(0, 0, 0);
    expect(provider.status).to.eq(MapLayerImageryProviderStatus.RequireAuth);
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
