/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { WebGLTestContext } from "./WebGLTestContext";
import { CONSTANTS } from "../common/Testbed";
import { Id64String, SortedArray } from "@bentley/bentleyjs-core";
import { GeometryClass, RenderMode, Feature, ColorDef, RgbColor } from "@bentley/imodeljs-common";
import { Pixel } from "@bentley/imodeljs-frontend/lib/rendering";
import {
  IModelConnection,
  SpatialViewState,
  OffScreenViewport,
  ViewRect,
  ViewState,
  FeatureSymbology,
  IModelApp,
} from "@bentley/imodeljs-frontend";

function compareFeatures(lhs?: Feature, rhs?: Feature): number {
  if (undefined === lhs && undefined === rhs)
    return 0;
  else if (undefined === lhs)
    return -1;
  else if (undefined === rhs)
    return 1;
  else
    return lhs.compare(rhs);
}

function comparePixelData(lhs: Pixel.Data, rhs: Pixel.Data): number {
  let diff = lhs.distanceFraction - rhs.distanceFraction;
  if (0 === diff) {
    diff = lhs.type - rhs.type;
    if (0 === diff) {
      diff = lhs.planarity - rhs.planarity;
      if (0 === diff) {
        diff = compareFeatures(lhs.feature, rhs.feature);
      }
    }
  }

  return diff;
}

class PixelDataSet extends SortedArray<Pixel.Data> {
  public constructor() {
    super((lhs: Pixel.Data, rhs: Pixel.Data) => comparePixelData(lhs, rhs));
  }

  public get array(): Pixel.Data[] { return this._array; }

  public containsFeature(elemId?: Id64String, subcatId?: Id64String, geomClass?: GeometryClass) {
    return this.containsWhere((pxl) =>
      (undefined === elemId || pxl.elementId === elemId) &&
      (undefined === subcatId || pxl.subCategoryId === subcatId) &&
      (undefined === geomClass || pxl.geometryClass === geomClass));
  }
  public containsElement(id: Id64String) { return this.containsWhere((pxl) => pxl.elementId === id); }
  public containsPlanarity(planarity: Pixel.Planarity) { return this.containsWhere((pxl) => pxl.planarity === planarity); }
  public containsGeometryType(type: Pixel.GeometryType) { return this.containsWhere((pxl) => pxl.type === type); }
  public containsGeometry(type: Pixel.GeometryType, planarity: Pixel.Planarity) { return this.containsWhere((pxl) => pxl.type === type && pxl.planarity === planarity); }
  public containsWhere(criterion: (pxl: Pixel.Data) => boolean) {
    for (const pixel of this.array)
      if (criterion(pixel))
        return true;

    return false;
  }
}

class Color {
  public readonly v: number;
  public readonly r: number;
  public readonly g: number;
  public readonly b: number;
  public readonly a: number;

  // val is uint32 repr as AABBGGRR
  public constructor(val: number) {
    this.v = val;

    // ">>> 0" required to force unsigned because javascript is a brilliantly-designed language.
    this.r = ((val & 0x000000ff) >>> 0x00) >>> 0;
    this.g = ((val & 0x0000ff00) >>> 0x08) >>> 0;
    this.b = ((val & 0x00ff0000) >>> 0x10) >>> 0;
    this.a = ((val & 0xff000000) >>> 0x18) >>> 0;
  }

  public static from(val: number) { return new Color(val); }
  public static fromRgba(r: number, g: number, b: number, a: number) {
    const v = (r | (g << 0x08) | (b << 0x10) | (a << 0x18)) >>> 0;
    return Color.from(v);
  }

  public compare(rhs: Color): number {
    return this.v - rhs.v;
  }
}

class ColorSet extends SortedArray<Color> {
  public constructor() { super((lhs: Color, rhs: Color) => lhs.compare(rhs)); }

  public get array(): Color[] { return this._array; }
}

class TestViewport extends OffScreenViewport {
  // Read depth, geometry type, and feature for each pixel. Return only the unique ones.
  public readUniquePixelData(readRect?: ViewRect): PixelDataSet {
    const rect = undefined !== readRect ? readRect : this.viewRect;
    const set = new PixelDataSet();
    this.readPixels(rect, Pixel.Selector.All, (pixels: Pixel.Buffer | undefined) => {
      if (undefined === pixels)
        return;

      for (let x = rect.left; x < rect.right; x++)
        for (let y = rect.top; y < rect.bottom; y++)
          set.insert(pixels.getPixel(x, y));
    });

    return set;
  }

  // Read colors for each pixel; return the unique ones.
  public readUniqueColors(readRect?: ViewRect): ColorSet {
    const rect = undefined !== readRect ? readRect : this.viewRect;
    const buffer = this.readImage(rect)!;
    expect(buffer).not.to.be.undefined;
    const u32 = new Uint32Array(buffer.data.buffer);
    const colors = new ColorSet();
    for (const rgba of u32)
      colors.insert(Color.from(rgba));

    return colors;
  }

  public readPixel(x: number, y: number): Pixel.Data {
    let pixel = new Pixel.Data();
    this.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (pixels: Pixel.Buffer | undefined) => {
      if (undefined !== pixels)
        pixel = pixels.getPixel(x, y);
    });

    return pixel;
  }

  public readColor(x: number, y: number): Color {
    const colors = this.readUniqueColors(new ViewRect(x, y, x + 1, y + 1));
    expect(colors.length).to.equal(1);
    return colors.array[0];
  }

  public get areAllTilesLoaded(): boolean {
    return this.view.areAllTileTreesLoaded && this.numRequestedTiles === 0;
  }

  public async waitForAllTilesToRender(): Promise<void> {
    this.renderFrame();

    // NB: ToolAdmin loop is not turned on, and this vieport is not tracked by ViewManager - must manually pump tile request scheduler.
    IModelApp.tileRequests.process();

    if (this.areAllTilesLoaded)
      return Promise.resolve();

    await new Promise<void>((resolve: any) => setTimeout(resolve, 100));

    // This viewport isn't added to ViewManager, so it won't be notified (and have its scene invalidated) when new tiles become loaded.
    this.sync.invalidateScene();
    return this.waitForAllTilesToRender();
  }

  public static createTestViewport(view: ViewState, rect: ViewRect): TestViewport {
    // Viewport constructors are awkward because typescript is awkward. (First line of derived ctor must invoke super() if base contains any inline-initialized members).
    const vp = TestViewport.create(view, rect) as TestViewport;
    expect(vp).instanceof(TestViewport);
    return vp;
  }
}

async function createViewport(viewId: Id64String, imodel: IModelConnection, rect: ViewRect): Promise<TestViewport> {
  const viewState = await imodel.views.load(viewId);
  return TestViewport.createTestViewport(viewState, rect);
}

// Mirukuru contains a single view, looking at a single design model containing a single white rectangle (element ID 41 (0x29), subcategory ID = 24 (0x18)).
// (It also is supposed to contain a reality model but the URL is presumably wrong).
// The initial view is in top orientation, centered on the top of the rectangle, but not fitted to its extents (empty space on all sides of rectangle).
// Background color is black; ACS triad on; render mode smooth with lighting enabled and visible edges enabled.
describe("Render mirukuru", () => {
  let imodel: IModelConnection;

  before(async () => {
    const imodelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/mirukuru.ibim");
    imodel = await IModelConnection.openStandalone(imodelLocation);
    WebGLTestContext.startup();
  });

  after(async () => {
    if (imodel) await imodel.closeStandalone();
    WebGLTestContext.shutdown();
  });

  it("should have expected view definition", async () => {
    const viewState = await imodel.views.load("0x24");
    expect(viewState).instanceof(SpatialViewState);
    if (!WebGLTestContext.isInitialized)
      return;
  });

  it("should render empty initial view", async () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const rect = new ViewRect(0, 0, 100, 100);
    const vp = await createViewport("0x24", imodel, rect);

    vp.renderFrame();

    // Should have all black background pixels
    let colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    expect(colors.contains(Color.fromRgba(0, 0, 0, 0xff))).to.be.true;

    // Change background color - expect pixel colors to match
    vp.view.displayStyle.backgroundColor = ColorDef.green;
    vp.invalidateRenderPlan();
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    expect(colors.contains(Color.fromRgba(0, 0x80, 0, 0xff))).to.be.true;

    // Should have no features, depth, or geometry - only background pixels
    const pixels = vp.readUniquePixelData();
    expect(pixels.length).to.equal(1);

    // Background pixels have distanceFraction = 0 indicating far plane.
    const backgroundPixel = new Pixel.Data(undefined, 0, Pixel.GeometryType.None, Pixel.Planarity.None);
    expect(comparePixelData(backgroundPixel, pixels.array[0])).to.equal(0);

    // Can read a single pixel
    const pixel = vp.readPixel(rect.width / 2, rect.height / 2);
    expect(comparePixelData(backgroundPixel, pixel)).to.equal(0);

    // Out-of-bounds pixels are in "unknown" state
    const unknownPixel = new Pixel.Data();
    const coords = [ [ -1, -1 ], [0, -1], [rect.width, 0], [rect.width - 1, rect.height * 2] ];
    for (const coord of coords) {
      const oob = vp.readPixel(coord[0], coord[1]);
      expect(comparePixelData(unknownPixel, oob)).to.equal(0);
    }

    vp.dispose();
  });

  it("should render the model", async () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const rect = new ViewRect(0, 0, 100, 100);
    const vp = await createViewport("0x24", imodel, rect);
    await vp.waitForAllTilesToRender();
    expect(vp.numRequestedTiles).to.equal(0);
    expect(vp.numSelectedTiles).to.equal(1);

    // White rectangle is centered in view with black background surrounding. Lighting is on so rectangle will not be pure white.
    let colors = vp.readUniqueColors();
    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    expect(colors.length).least(2);
    expect(colors.contains(bgColor)).to.be.true; // black background

    const expectWhitish = (c: Color) => {
      expect(c.r).least(0x7f);
      expect(c.g).least(0x7f);
      expect(c.b).least(0x7f);
      expect(c.a).to.equal(0xff);
    };

    for (const c of colors.array) {
      if (0 !== c.compare(bgColor))
        expectWhitish(c);
    }

    let color = vp.readColor(rect.left, rect.top);
    expect(color.compare(bgColor)).to.equal(0);
    color = vp.readColor(rect.right - 1, rect.top);
    expect(color.compare(bgColor)).to.equal(0);
    color = vp.readColor(rect.right - 1, rect.bottom - 1);
    expect(color.compare(bgColor)).to.equal(0);
    color = vp.readColor(rect.left, rect.bottom - 1);
    expect(color.compare(bgColor)).to.equal(0);

    color = vp.readColor(rect.width / 2, rect.height / 2);
    expectWhitish(color);

    // Confirm we drew the rectangular element as a planar surface and its edges.
    const elemId = "0x29";
    const subcatId = "0x18";
    let pixels = vp.readUniquePixelData();
    expect(pixels.length).to.equal(3);
    expect(pixels.containsFeature(elemId, subcatId));
    expect(pixels.containsGeometry(Pixel.GeometryType.Surface, Pixel.Planarity.Planar));
    expect(pixels.containsGeometry(Pixel.GeometryType.Edge, Pixel.Planarity.Planar));

    // With lighting off, pixels should be either pure black (background) or pure white (rectangle)
    // NB: Shouldn't really modify view flags in place but meh.
    const vf = vp.view.viewFlags;
    vf.sourceLights = vf.cameraLights = vf.solarLight = false;
    vp.invalidateRenderPlan();
    vp.renderFrame();

    const white = Color.from(0xffffffff);
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    expect(colors.contains(bgColor)).to.be.true;
    expect(colors.contains(white)).to.be.true;

    // In wireframe, same colors, but center pixel will be background color - only edges draw.
    vf.renderMode = RenderMode.Wireframe;
    vp.invalidateRenderPlan();
    vp.renderFrame();

    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    expect(colors.contains(bgColor)).to.be.true;
    expect(colors.contains(white)).to.be.true;

    color = vp.readColor(rect.width / 2, rect.height / 2);
    expect(color.compare(bgColor)).to.equal(0);

    pixels = vp.readUniquePixelData();
    expect(pixels.length).to.equal(2);
    expect(pixels.containsFeature(elemId, subcatId));
    expect(pixels.containsGeometry(Pixel.GeometryType.Edge, Pixel.Planarity.Planar));
  });

  it("should override symbology", async () => {
    if (!WebGLTestContext.isInitialized)
      return;

    const rect = new ViewRect(0, 0, 200, 150);
    const vp = await createViewport("0x24", imodel, rect);

    const elemId = "0x29";
    const subcatId = "0x18";
    const vf = vp.view.viewFlags;
    vf.visibleEdges = vf.hiddenEdges = vf.sourceLights = vf.cameraLights = vf.solarLight = false;

    // Specify element is never drawn.
    vp.addFeatureOverrides = (ovrs, _) => ovrs.neverDrawn.add(elemId);
    await vp.waitForAllTilesToRender();

    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    let colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    expect(colors.contains(bgColor)).to.be.true;

    let pixels = vp.readUniquePixelData();
    expect(pixels.length).to.equal(1);

    // Specify element is drawn blue
    vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    expect(colors.contains(Color.fromRgba(0, 0, 0xff, 0xff))).to.be.true;

    // Specify default overrides
    vp.addFeatureOverrides = (ovrs, _) => ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.red));
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

    // Specify default overrides, but also override element color
    vp.addFeatureOverrides = (ovrs, _) => {
      ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.green));
      ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(new ColorDef(0x7f0000))); // blue = 0x7f...
    };
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    expect(colors.contains(Color.fromRgba(0, 0, 0x7f, 0xff))).to.be.true;
    expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.false;

    // Override by subcategory
    vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

    // Override color for element and subcategory - element wins
    vp.addFeatureOverrides = (ovrs, _) => {
      ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
      ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
    };
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

    // Override to be fully transparent - element should not draw at all
    vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromTransparency(1.0));
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    expect(colors.contains(bgColor)).to.be.true;

    pixels = vp.readUniquePixelData();
    expect(pixels.length).to.equal(1);
    expect(pixels.containsElement(elemId)).to.be.false;

    // Set bg color to red, elem color to 50% transparent blue => expect blending
    vp.view.displayStyle.backgroundColor = ColorDef.red;
    vp.invalidateRenderPlan();
    vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromJSON({ rgb: new RgbColor(0, 0, 1), transparency: 0.5 }));
    vp.renderFrame();
    colors = vp.readUniqueColors();
    expect(colors.length).to.equal(2);
    const red = Color.fromRgba(0xff, 0, 0, 0xff);
    expect(colors.contains(red)).to.be.true;
    for (const c of colors.array) {
      if (0 !== c.compare(red)) {
        expect(c.r).least(0x70);
        expect(c.r).most(0x90);
        expect(c.g).to.equal(0);
        /* ###TODO determine why blue is zero? No repro in display-test-app...
        expect(c.b).least(0x70);
        expect(c.b).most(0x90);
        */
        expect(c.a).to.equal(0xff); // The alpha is intentionally not preserved by Viewport.readImage()
      }
    }
  });
});
