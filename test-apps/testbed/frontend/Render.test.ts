/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { WebGLTestContext } from "./WebGLTestContext";
import { testViewports, comparePixelData, Color } from "./TestViewport";
import { CONSTANTS } from "../common/Testbed";
import { RenderMode, ColorDef, RgbColor } from "@bentley/imodeljs-common";
import { RenderMemory, Pixel } from "@bentley/imodeljs-frontend/lib/rendering";
import {
  DepthRangeNpc,
  IModelConnection,
  SpatialViewState,
  ViewRect,
  FeatureSymbology,
} from "@bentley/imodeljs-frontend";

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
  });

  it("should render empty initial view", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewports("0x24", imodel, rect.width, rect.height, async (vp) => {
      await vp.drawFrame();

      // Should have all black background pixels
      let colors = vp.readUniqueColors();
      expect(colors.length).to.equal(1);
      expect(colors.contains(Color.fromRgba(0, 0, 0, 0xff))).to.be.true;

      // Change background color - expect pixel colors to match
      vp.view.displayStyle.backgroundColor = ColorDef.green;
      vp.invalidateRenderPlan();
      await vp.drawFrame();
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
    });
  });

  it("should render the model", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewports("0x24", imodel, rect.width, rect.height, async (vp) => {
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
      await vp.drawFrame();

      const white = Color.from(0xffffffff);
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(bgColor)).to.be.true;
      expect(colors.contains(white)).to.be.true;

      // In wireframe, same colors, but center pixel will be background color - only edges draw.
      vf.renderMode = RenderMode.Wireframe;
      vp.invalidateRenderPlan();
      await vp.drawFrame();

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
  });

  it("should override symbology", async () => {
    const rect = new ViewRect(0, 0, 200, 150);
    await testViewports("0x24", imodel, rect.width, rect.height, async (vp) => {
      const elemId = "0x29";
      const subcatId = "0x18";
      const vf = vp.view.viewFlags;
      vf.visibleEdges = vf.hiddenEdges = vf.sourceLights = vf.cameraLights = vf.solarLight = false;

      // Specify element is never drawn.
      vp.addFeatureOverrides = (ovrs, _) => ovrs.setNeverDrawn(elemId);
      await vp.waitForAllTilesToRender();

      const bgColor = Color.fromRgba(0, 0, 0, 0xff);
      let colors = vp.readUniqueColors();
      expect(colors.length).to.equal(1);
      expect(colors.contains(bgColor)).to.be.true;

      let pixels = vp.readUniquePixelData();
      expect(pixels.length).to.equal(1);

      // Specify element is drawn blue
      vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0xff, 0xff))).to.be.true;

      // Specify default overrides
      vp.addFeatureOverrides = (ovrs, _) => ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Specify default overrides, but also override element color
      vp.addFeatureOverrides = (ovrs, _) => {
        ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.green));
        ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(new ColorDef(0x7f0000))); // blue = 0x7f...
      };
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0x7f, 0xff))).to.be.true;
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.false;

      // Override by subcategory
      vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override color for element and subcategory - element wins
      vp.addFeatureOverrides = (ovrs, _) => {
        ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
        ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      };
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override to be fully transparent - element should not draw at all
      vp.addFeatureOverrides = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromTransparency(1.0));
      await vp.drawFrame();
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
      await vp.drawFrame();
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

  it("should determine visible depth range", async () => {
    const fullRect = new ViewRect(0, 0, 100, 100);
    await testViewports("0x24", imodel, fullRect.width, fullRect.height, async (vp) => {
      await vp.waitForAllTilesToRender();

      // Depth range for entire view should correspond to the face of the slab in the center of the view which is parallel to the camera's near+far planes.
      // i.e., min and max should be equal, and roughly half-way between the near and far planes.
      const fullRange = vp.determineVisibleDepthRange(fullRect);
      expect(fullRange).not.to.be.undefined;
      expect(fullRange!.minimum).least(0.45);
      expect(fullRange!.minimum).most(0.55);
      expect(fullRange!.minimum).to.equal(fullRange!.maximum);

      // If we pass in a DepthRangeNpc, the same object should be returned to us.
      const myRange = new DepthRangeNpc();
      let range = vp.determineVisibleDepthRange(fullRect, myRange);
      expect(range).to.equal(myRange);
      expect(range!.maximum).to.equal(fullRange!.maximum);
      expect(range!.minimum).to.equal(fullRange!.minimum);

      // Depth range in center of view should be same as above.
      const centerRect = new ViewRect(40, 40, 60, 60);
      range = vp.determineVisibleDepthRange(centerRect);
      expect(range!.maximum).to.equal(fullRange!.maximum);
      expect(range!.minimum).to.equal(fullRange!.minimum);

      // Depth range in empty portion of view should be null.
      const topLeftRect = new ViewRect(0, 0, 5, 5);
      range = vp.determineVisibleDepthRange(topLeftRect);
      expect(range).to.be.undefined;

      // If we pass in an output DepthRangeNpc, and read an empty portion of view, the output should be set to a null range but the reutnr value should still be undefined.
      range = vp.determineVisibleDepthRange(topLeftRect, myRange);
      expect(range).to.be.undefined;
      expect(myRange.minimum).to.equal(1);
      expect(myRange.maximum).to.equal(0);
    });
  });
});

function expectMemory(consumer: RenderMemory.Consumers, total: number, max: number, count: number) {
  expect(consumer.totalBytes).to.equal(total);
  expect(consumer.maxBytes).to.equal(max);
  expect(consumer.count).to.equal(count);
}

describe("RenderMemory", () => {
  it("should accumulate correctly", () => {
    const stats = new RenderMemory.Statistics();

    stats.addTexture(20);
    stats.addTexture(10);
    expect(stats.totalBytes).to.equal(30);
    expectMemory(stats.textures, 30, 20, 2);

    stats.addVertexTable(10);
    stats.addVertexTable(20);
    expect(stats.totalBytes).to.equal(60);
    expectMemory(stats.vertexTables, 30, 20, 2);

    expectMemory(stats.buffers, 0, 0, 0);

    stats.addSurface(20);
    stats.addPolyline(30);
    stats.addPolyline(10);
    expect(stats.totalBytes).to.equal(120);
    expectMemory(stats.buffers, 60, 30, 3);
    expectMemory(stats.buffers.surfaces, 20, 20, 1);
    expectMemory(stats.buffers.polylines, 40, 30, 2);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);

    stats.clear();
    expect(stats.totalBytes).to.equal(0);
    expectMemory(stats.textures, 0, 0, 0);
    expectMemory(stats.vertexTables, 0, 0, 0);
    expectMemory(stats.buffers, 0, 0, 0);
    expectMemory(stats.buffers.surfaces, 0, 0, 0);
    expectMemory(stats.buffers.polylines, 0, 0, 0);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);
  });
});
