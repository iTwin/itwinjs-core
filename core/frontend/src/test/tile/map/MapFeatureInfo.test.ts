/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expectDefined, expectNotNull } from "@itwin/core-bentley";
import {
  ColorDef, EmptyLocalization, ImageMapLayerProps, ImageMapLayerSettings, ImageSource, ImageSourceFormat, MapImageryProps, MapLayerProviderProperties,
} from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { LocateOptions } from "../../../ElementLocateManager";
import { HitDetail } from "../../../HitDetail";
import { ScreenViewport } from "../../../Viewport";
import { MapLayerFeatureInfo } from "../../../tile/map/MapFeatureInfo";
import { ImageryMapLayerFormat } from "../../../tile/map/MapLayerImageryFormats";
import { MapLayerImageryProvider, MapLayerImageryProviderStatus } from "../../../tile/map/MapLayerImageryProvider";
import { testBlankViewportAsync } from "../../openBlankViewport";

let hollowTile: ImageSource;
let solidTile: ImageSource;

// Fake map service. A hollow layer draws only transparent pixels, like the inside of an unfilled polygon.
class TestProvider extends MapLayerImageryProvider {
  private get _properties() { return this._settings.properties ?? {}; }
  public override get supportsMapFeatureInfo() { return !this._properties.notCapable; }
  public override get minimumZoomLevel() { return this._properties.outOfRange ? this.maximumZoomLevel + 1 : this.defaultMinimumZoomLevel; }
  public override async initialize() {
    if (this._properties.requireAuth)
      this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
  }
  public override async constructUrl() { return ""; }
  public override async loadTile() { return this._properties.hollow ? hollowTile : solidTile; }
  public override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[]) {
    const features = this._properties.feature ? [{ attributes: [] }] : [];
    featureInfos.push({ layerName: this._settings.name, subLayerInfos: [{ subLayerName: this._settings.name, features }] });
  }
  public override async getToolTip(strings: string[]) {
    if (this._properties.feature)
      strings.push(`feature of ${this._settings.name}`);
  }
}

class TestFormat extends ImageryMapLayerFormat {
  public static override formatId = "MapFeatureInfoTest";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider {
    return new TestProvider(settings, true);
  }
}

async function createTile(alpha: number): Promise<ImageSource> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = expectNotNull(canvas.getContext("2d"));
  context.fillStyle = `rgba(255, 0, 0, ${alpha})`;
  context.fillRect(0, 0, 1, 1);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
  return new ImageSource(new Uint8Array(await expectNotNull(blob).arrayBuffer()), ImageSourceFormat.Png);
}

// Distinct urls, because layers with identical settings share a tile tree.
function layer(name: string, properties: MapLayerProviderProperties = {}, props: Partial<ImageMapLayerProps> = {}): ImageMapLayerProps {
  return { formatId: TestFormat.formatId, name, url: `https://test.invalid/${name}`, visible: true, subLayers: [{ name, visible: true }], properties, ...props };
}

async function pickCenter(vp: ScreenViewport): Promise<HitDetail> {
  // The blank view is 1 m wide, and map layers other than the base vanish past zoom level 22.
  vp.zoomToVolume(Range3d.createXYZXYZ(-500, -500, -10, 500, 500, 10));
  await vp.waitForSceneCompletion();
  const picker = IModelApp.locateManager.picker;
  picker.doPick(vp, vp.view.getCenter(), 1, new LocateOptions());
  return expectDefined(picker.getHit(0));
}

async function pickMap(vp: ScreenViewport, mapImagery: MapImageryProps): Promise<HitDetail> {
  vp.overrideDisplayStyle({ viewflags: { backgroundMap: true }, mapImagery });
  return pickCenter(vp);
}

async function getFeatureInfoLayerNames(vp: ScreenViewport, hit: HitDetail): Promise<string[] | undefined> {
  return (await vp.getMapFeatureInfo(hit)).layerInfos?.map((info) => info.layerName);
}

describe("Map feature info", () => {
  const white = ColorDef.white.tbgr;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.register(TestFormat);
    hollowTile = await createTile(0);
    solidTile = await createTile(1);
  });

  afterAll(async () => IModelApp.shutdown());

  it("returns only the topmost layer with a feature", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: white, backgroundLayers: [layer("B", { hollow: true, feature: true }), layer("A", { hollow: true, feature: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["A"]);
    });
  });

  it("skips layers above that have no feature at the hit", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: layer("Base"), backgroundLayers: [layer("B", { hollow: true, feature: true }), layer("A", { hollow: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["B"]);
    });
  });

  it("returns the picked layer's result when no layer above has a feature", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: layer("Base"), backgroundLayers: [layer("A", { hollow: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["Base"]);
    });
  });

  it("prefers a hollow layer over an opaque layer drawn below it", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: white, backgroundLayers: [layer("B", { feature: true }), layer("A", { hollow: true, feature: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["A"]);
    });
  });

  it("ignores layers that are hidden, fully transparent, invalid or cannot supply feature info", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, {
        backgroundBase: white,
        backgroundLayers: [
          layer("Hidden", { hollow: true, feature: true }, { visible: false }),
          layer("NoSubLayer", { hollow: true, feature: true }, { subLayers: [{ name: "NoSubLayer", visible: false }] }),
          layer("Transparent", { hollow: true, feature: true }, { transparency: 1 }),
          layer("RequireAuth", { hollow: true, feature: true, requireAuth: true }),
          layer("NotCapable", { hollow: true, feature: true, notCapable: true }),
        ],
      });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual([]);
      expect(vp.mapFeatureInfoLayersFromHit(hit)).toEqual([]);
    });
  });

  it("ignores a layer outside its zoom range", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: white, backgroundLayers: [layer("A", { feature: true, outOfRange: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual([]);
    });
  });

  it("queries the layers above the visible one of layers that share a tile tree", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, {
        backgroundBase: white,
        backgroundLayers: [layer("A", { feature: true }), layer("H", { hollow: true, feature: true }), layer("A", { feature: true }, { visible: false })],
      });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["H"]);
    });
  });

  it("queries overlay layers above the background map", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: white, overlayLayers: [layer("O", { hollow: true, feature: true })] });
      expect(await getFeatureInfoLayerNames(vp, hit)).toEqual(["O"]);
    });
  });

  it("shows the tooltip of the topmost layer with tooltip text", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, { backgroundBase: white, backgroundLayers: [layer("B", { hollow: true, feature: true }), layer("A", { hollow: true })] });
      const tooltip = await vp.getToolTip(hit);
      expect(tooltip).toBeInstanceOf(HTMLElement);
      expect((tooltip as HTMLElement).innerHTML.split("<br>")).toEqual([
        "MapLayers.ImageryLayer: B",
        "feature of B",
        expect.stringMatching(/^MapLayers\.Latitude: /),
        expect.stringMatching(/^MapLayers\.Longitude: /),
      ]);
    });
  });

  it("lists the layers to query for feature info, topmost first", async () => {
    await testBlankViewportAsync(async (vp) => {
      const hit = await pickMap(vp, {
        backgroundBase: layer("Base"),
        backgroundLayers: [layer("B", { hollow: true }), layer("NotCapable", { hollow: true, notCapable: true })],
        overlayLayers: [layer("O", { hollow: true })],
      });
      expect(vp.mapFeatureInfoLayersFromHit(hit).map((info) => ({ name: info.settings.name, isBaseLayer: info.isBaseLayer, index: info.index }))).toEqual([
        { name: "O", isBaseLayer: false, index: { isOverlay: true, index: 0 } },
        { name: "B", isBaseLayer: false, index: { isOverlay: false, index: 0 } },
        { name: "Base", isBaseLayer: true, index: undefined },
      ]);
    });
  });

  it("reports the display style index of a layer that existed when the view was attached", async () => {
    await testBlankViewportAsync(async (vp) => {
      const style = vp.displayStyle.clone();
      style.settings.applyOverrides({ viewflags: { backgroundMap: true }, mapImagery: { backgroundBase: white, backgroundLayers: [layer("A")] } });
      vp.displayStyle = style;
      const hit = await pickCenter(vp);
      expect(vp.mapLayerFromHit(hit).map((info) => info.index)).toEqual([{ isOverlay: false, index: 0 }]);
    });
  });
});
