/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipStyle, ColorDef, FeatureAppearance, FeatureAppearanceProvider, Hilite, RenderMode, RgbColor } from "@itwin/core-common";
import {
  DecorateContext, Decorator, FeatureOverrideProvider, FeatureSymbology, GraphicBranch, GraphicBranchOptions, GraphicType, IModelApp,
  IModelConnection, OffScreenViewport, Pixel, RenderSystem, SnapshotConnection, SpatialViewState, Viewport, ViewRect,
} from "@itwin/core-frontend";
import { ClipVector, Point2d, Point3d, Transform } from "@itwin/core-geometry";
import { TestUtility } from "../TestUtility";
import {
  Color, comparePixelData, createOnScreenTestViewport, testOnScreenViewport, TestViewport, testViewports, testViewportsWithDpr,
} from "../TestViewport";

/* eslint-disable @typescript-eslint/unbound-method */

describe("Vertex buffer objects", () => {
  let imodel: IModelConnection;

  before(async () => {
    const renderSysOpts: RenderSystem.Options = { useWebGL2: false };
    renderSysOpts.disabledExtensions = ["OES_vertex_array_object"];

    await TestUtility.startFrontend({ renderSys: renderSysOpts });
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should render correctly", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      vp.view.viewFlags = vp.view.viewFlags.with("visibleEdges", true);

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      // White rectangle is centered in view with black background surrounding. Lighting is on so rectangle will not be pure white.
      const colors = vp.readUniqueColors();
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
      const pixels = vp.readUniquePixelData();
      expect(pixels.length).to.equal(3);
      expect(pixels.containsFeature(elemId, subcatId));
      expect(pixels.containsGeometry(Pixel.GeometryType.Surface, Pixel.Planarity.Planar));
      expect(pixels.containsGeometry(Pixel.GeometryType.Edge, Pixel.Planarity.Planar));
    });
  });
});

// Mirukuru contains a single view, looking at a single design model containing a single white rectangle (element ID 41 (0x29), subcategory ID = 24 (0x18)).
// (It also is supposed to contain a reality model but the URL is presumably wrong).
// The initial view is in top orientation, centered on the top of the rectangle, but not fitted to its extents (empty space on all sides of rectangle).
// Background color is black; ACS triad on; render mode smooth with lighting enabled and visible edges enabled.
describe("RenderTarget", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should have expected view definition", async () => {
    const viewState = await imodel.views.load("0x24");
    expect(viewState).instanceof(SpatialViewState);
  });

  it("should render empty view", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewports("0x24", imodel, rect.width, rect.height, async (vp) => {
      // Turn off all models so we're rendering an empty view.
      vp.changeViewedModels([]);
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

      // Ensure reading out-of-bounds rects returns empty pixel array
      const coords = [[-1, -1, -2, -2], [rect.width + 1, rect.height + 1, rect.width + 2, rect.height + 2]];
      for (const coord of coords) {
        const readRect = new ViewRect(coord[0], coord[1], coord[2], coord[3]);
        const oob = vp.readUniquePixelData(readRect);
        expect(oob).to.not.be.undefined;
        expect(oob.array.length).to.equal(0);
      }
    }, 1.0);
  });

  it("should render the model", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
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
      vp.viewFlags = vp.viewFlags.with("lighting", false);
      await vp.drawFrame();

      const white = Color.from(0xffffffff);
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(bgColor)).to.be.true;
      expect(colors.contains(white)).to.be.true;

      // In wireframe, same colors, but center pixel will be background color - only edges draw.
      vp.viewFlags = vp.viewFlags.withRenderMode(RenderMode.Wireframe);
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

  it("should read image at expected sizes", async () => {
    // NOTE: rect is in CSS pixels. ImageBuffer returned by readImage is in device pixels. vp.target.viewRect is in device pixels.
    const cssRect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, cssRect, async (vp) => {
      await vp.waitForAllTilesToRender();

      const expectImageDimensions = (readRect: ViewRect | undefined, targetSize: Point2d | undefined, expectedWidth: number, expectedHeight: number) => {
        const img = vp.readImage(readRect, targetSize)!;
        expect(img).not.to.be.undefined;
        expect(img.width).to.equal(Math.floor(expectedWidth));
        expect(img.height).to.equal(Math.floor(expectedHeight));
      };

      const devRect = vp.target.viewRect;

      // Read full image, no resize
      expectImageDimensions(undefined, undefined, devRect.width, devRect.height);
      expectImageDimensions(new ViewRect(0, 0, -1, -1), undefined, devRect.width, devRect.height);
      expectImageDimensions(undefined, new Point2d(devRect.width, devRect.height), devRect.width, devRect.height);

      // Read sub-image, no resize
      const cssHalfWidth = cssRect.width / 2;
      const cssQuarterHeight = cssRect.height / 4;
      const devHalfWidth = Math.floor(devRect.width / 2);
      const devQuarterHeight = Math.floor(devRect.height / 4);
      expectImageDimensions(new ViewRect(0, 0, cssHalfWidth, cssQuarterHeight), undefined, devHalfWidth, devQuarterHeight);
      expectImageDimensions(new ViewRect(cssHalfWidth, cssQuarterHeight, cssRect.right, cssRect.bottom), undefined, devRect.width - devHalfWidth, devRect.height - devQuarterHeight);
      expectImageDimensions(new ViewRect(0, 0, cssHalfWidth, cssRect.bottom), undefined, devHalfWidth, devRect.height);

      // Read full image and resize
      expectImageDimensions(undefined, new Point2d(256, 128), 256, 128);
      expectImageDimensions(new ViewRect(0, 0, -1, -1), new Point2d(50, 200), 50, 200);
      expectImageDimensions(cssRect, new Point2d(10, 10), 10, 10);
      expectImageDimensions(undefined, new Point2d(devRect.width, devRect.height), devRect.width, devRect.height);

      // Read sub-image and resize
      expectImageDimensions(new ViewRect(0, 0, cssHalfWidth, cssQuarterHeight), new Point2d(512, 768), 512, 768);
    });
  });

  it("should override symbology", async () => {
    const rect = new ViewRect(0, 0, 200, 150);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      const elemId = "0x29";
      const subcatId = "0x18";
      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, hiddenEdges: false, lighting: false });

      type AddFeatureOverrides = (overrides: FeatureSymbology.Overrides, viewport: Viewport) => void;
      class RenderTestOverrideProvider implements FeatureOverrideProvider {
        public ovrFunc?: AddFeatureOverrides;
        public addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void {
          if (undefined !== this.ovrFunc)
            this.ovrFunc(overrides, viewport);
        }
      }
      const ovrProvider = new RenderTestOverrideProvider();
      vp.addFeatureOverrideProvider(ovrProvider);

      // Specify element is never drawn.
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.setNeverDrawn(elemId);
      vp.setFeatureOverrideProviderChanged();
      await vp.waitForAllTilesToRender();

      const bgColor = Color.fromRgba(0, 0, 0, 0xff);
      let colors = vp.readUniqueColors();
      expect(colors.length).to.equal(1);
      expect(colors.contains(bgColor)).to.be.true;

      let pixels = vp.readUniquePixelData();
      expect(pixels.length).to.equal(1);

      // Specify element is nonLocatable
      ovrProvider.ovrFunc = (ovrs) => ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromJSON({ nonLocatable: true }) });
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      pixels = vp.readUniquePixelData(undefined, true); // Exclude non-locatable elements
      expect(pixels.length).to.equal(1);
      expect(pixels.containsElement(elemId)).to.be.false;
      pixels = vp.readUniquePixelData(); // Include non-locatable elements
      expect(pixels.length).to.equal(2);
      expect(pixels.containsElement(elemId)).to.be.true;

      // Specify element is drawn blue
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromRgb(ColorDef.blue) });
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0xff, 0xff))).to.be.true;

      // Specify default overrides
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.setDefaultOverrides(FeatureAppearance.fromRgb(ColorDef.red));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Specify default overrides, but also override element color
      ovrProvider.ovrFunc = (ovrs, _) => {
        ovrs.setDefaultOverrides(FeatureAppearance.fromRgb(ColorDef.green));
        ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromRgb(ColorDef.create(0x7f0000)) }); // blue = 0x7f...
      };
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0x7f, 0xff))).to.be.true;
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.false;

      // Override by subcategory
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.override({ subCategoryId: subcatId, appearance: FeatureAppearance.fromRgb(ColorDef.red) });
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override color for element and subcategory - element wins
      ovrProvider.ovrFunc = (ovrs, _) => {
        ovrs.override({ subCategoryId: subcatId, appearance: FeatureAppearance.fromRgb(ColorDef.blue) });
        ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromRgb(ColorDef.red) });
      };
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override to be fully transparent - element should not draw at all
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromTransparency(1.0) });
      vp.setFeatureOverrideProviderChanged();
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
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.override({ elementId: elemId, appearance: FeatureAppearance.fromJSON({ rgb: new RgbColor(0, 0, 0xff), transparency: 0.5 }) });
      vp.setFeatureOverrideProviderChanged();
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
          expect(c.b).least(0x70);
          expect(c.b).most(0x90);
          expect(c.a).to.equal(0xff); // The alpha is intentionally not preserved by Viewport.readImage()
        }
      }
    });
  });

  it("should augment symbology", async () => {
    await testOnScreenViewport("0x24", imodel, 200, 150, async (vp) => {
      // Draw unlit surfaces only - a white slab on a black background.
      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, hiddenEdges: false, lighting: false });

      const expectSurfaceColor = async (color: ColorDef) => {
        await vp.waitForAllTilesToRender();

        const colors = vp.readUniqueColors();
        expect(colors.length).to.equal(2);
        expect(colors.contains(Color.fromRgba(0, 0, 0, 0xff))).to.be.true;

        const expected = Color.fromRgba(color.colors.r, color.colors.g, color.colors.b, 0xff);
        expect(colors.contains(expected)).to.be.true;
      };

      // No overrides yet.
      await expectSurfaceColor(ColorDef.white);

      // Override System.createGraphicBranch to use an AppearanceProvider that always overrides color to red.
      const overrideColor = (color: ColorDef) => () => FeatureAppearance.fromRgb(color);
      const appearanceProvider: FeatureAppearanceProvider = { getFeatureAppearance: overrideColor(ColorDef.red) };
      const createGraphicBranch = IModelApp.renderSystem.createGraphicBranch;
      IModelApp.renderSystem.createGraphicBranch = (branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions) => {
        options = options ?? {};
        return createGraphicBranch.call(IModelApp.renderSystem, branch, transform, { ...options, appearanceProvider });
      };

      // The viewport doesn't yet know its overrides need updating.
      await expectSurfaceColor(ColorDef.white);

      // Update symbology overrides. The viewport doesn't yet know the scene has changed.
      IModelApp.viewManager.invalidateSymbologyOverridesAllViews();
      await expectSurfaceColor(ColorDef.white);

      // Invalidate scene. The viewport will create new graphic branch with our appearance provider, but doesn't know that it needs to recompute the symbology overrides.
      IModelApp.viewManager.invalidateViewportScenes();
      await expectSurfaceColor(ColorDef.white);

      // Invalidate both scene and overrides. The viewport will create new graphic branch with our appearance provider.
      IModelApp.viewManager.invalidateViewportScenes();
      IModelApp.viewManager.invalidateSymbologyOverridesAllViews();
      await expectSurfaceColor(ColorDef.red);

      // If a branch is nested in another branch, then:
      //  - If the child has no symbology overrides:
      //    - It uses its own AppearanceProvider, or its parents if it has none.
      //  - Otherwise, it uses its own AppearanceProvider, or none.
      interface OvrAug { ovr?: ColorDef, aug?: ColorDef }
      const testNestedBranch = async (parent: OvrAug | undefined, child: OvrAug | undefined, expected: ColorDef) => {
        const applyOvrs = (branch: GraphicBranch, ovraug?: OvrAug) => {
          if (ovraug?.ovr) {
            branch.symbologyOverrides = new FeatureSymbology.Overrides(vp);
            branch.symbologyOverrides.setDefaultOverrides(FeatureAppearance.fromRgb(ovraug.ovr));
          }
        };

        const getBranchOptions = (opts?: GraphicBranchOptions, ovraug?: OvrAug) => {
          if (ovraug?.aug)
            opts = { ...opts, appearanceProvider: { getFeatureAppearance: overrideColor(ovraug.aug) } };

          return opts;
        };

        // Nest the branch inside a parent branch.
        IModelApp.renderSystem.createGraphicBranch = (branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions) => {
          options = options ?? {};
          const childOptions = getBranchOptions(options, child);
          applyOvrs(branch, child);
          const childBranch = createGraphicBranch.call(IModelApp.renderSystem, branch, transform, childOptions);

          const childGraphics = new GraphicBranch();
          childGraphics.add(childBranch);
          applyOvrs(childGraphics, parent);
          const parentOptions = getBranchOptions(undefined, parent);
          return createGraphicBranch.call(IModelApp.renderSystem, childGraphics, Transform.createIdentity(), parentOptions);
        };

        vp.invalidateScene();
        vp.setFeatureOverrideProviderChanged();
        await expectSurfaceColor(expected);
      };

      interface TestCase {
        parent?: OvrAug;
        child?: OvrAug;
        color: ColorDef;
      }

      const testCases: TestCase[] = [
        // Nothing overridden.
        { color: ColorDef.white },

        // Child has overrides and/or appearance provider. Provider always wins if defined.
        { child: { ovr: ColorDef.blue }, color: ColorDef.blue },
        { child: { aug: ColorDef.green }, color: ColorDef.green },
        { child: { ovr: ColorDef.blue, aug: ColorDef.green }, color: ColorDef.green },

        // Parent has overrides and/or appearance provider. Child inherits them. Provider always wins if defined.
        { parent: { ovr: ColorDef.blue }, color: ColorDef.blue },
        { parent: { aug: ColorDef.green }, color: ColorDef.green },
        { parent: { ovr: ColorDef.blue, aug: ColorDef.green }, color: ColorDef.green },

        // If child has overrides, parent's overrides and/or provider have no effect on it.
        { child: { ovr: ColorDef.blue }, parent: { ovr: ColorDef.red, aug: ColorDef.green }, color: ColorDef.blue },

        // If child has provider, it wins over parent's overrides if defined.
        { child: { aug: ColorDef.red }, parent: { ovr: ColorDef.green, aug: ColorDef.blue }, color: ColorDef.red },
      ];

      for (const testCase of testCases)
        await testNestedBranch(testCase.parent, testCase.child, testCase.color);

      // Reset System.createGraphicBranch.
      IModelApp.renderSystem.createGraphicBranch = createGraphicBranch;
    });
  });

  it("should show transparency for polylines", async () => {
    const rect = new ViewRect(0, 0, 200, 150);
    await testOnScreenViewport("0x24", imodel, rect.width, rect.height, async (vp) => {

      class TestPolylineDecorator implements Decorator {
        public decorate(context: DecorateContext) {
          expect(context.viewport === vp);
          // draw semi-transparent polyline from top left to bottom right of vp
          const overlayBuilder = context.createGraphicBuilder(GraphicType.ViewOverlay);
          const polylineColor = ColorDef.from(0, 255, 0, 128);
          overlayBuilder.setSymbology(polylineColor, polylineColor, 4);
          overlayBuilder.addLineString([
            new Point3d(0, 0, 0),
            new Point3d(rect.width - 1, rect.height - 1, 0),
          ]);
          context.addDecorationFromBuilder(overlayBuilder);
        }
      }

      const decorator = new TestPolylineDecorator();
      IModelApp.viewManager.addDecorator(decorator);
      await vp.drawFrame();
      IModelApp.viewManager.dropDecorator(decorator);

      // expect green blended with black background
      const testColor = vp.readColor(0, 149); // top left pixel, test vp coords are flipped
      expect(testColor.r).equals(0);
      expect(testColor.g).approximately(128, 3);
      expect(testColor.b).equals(0);
    });
  });

  it("should render hilite", async () => {
    const rect = new ViewRect(0, 0, 200, 150);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, hiddenEdges: false, lighting: false });
      vp.hilite = new Hilite.Settings(ColorDef.red, 1.0, 0.0, Hilite.Silhouette.Thin);

      await vp.waitForAllTilesToRender();

      const hilites = imodel.hilited;
      const tests = [
        { id: "0x29", otherId: "0x30", set: hilites.elements },
        { id: "0x18", otherId: "0x19", set: hilites.subcategories },
        { id: "0x1c", otherId: "0x1d", set: hilites.models },
      ];

      // OffScreenViewports are not managed by ViewManager so not notified when hilite set changes.
      const update = (vp instanceof OffScreenViewport) ? (() => (vp as any)._selectionSetDirty = true) : (() => undefined);

      const white = Color.from(0xffffffff);
      const black = Color.from(0xff000000);
      const hilite = Color.from(0xff0000ff);
      for (const test of tests) {
        // Hilite some other entity
        test.set.addId(test.otherId);
        update();
        await vp.drawFrame();
        let colors = vp.readUniqueColors();
        expect(colors.length).to.equal(2);
        expect(colors.contains(white)).to.be.true;
        expect(colors.contains(black)).to.be.true;

        // Also hilite this entity
        test.set.addId(test.id);
        update();
        await vp.drawFrame();
        colors = vp.readUniqueColors();
        expect(colors.length).to.equal(2);
        expect(colors.contains(hilite)).to.be.true;
        expect(colors.contains(black)).to.be.true;

        // hilite nothing
        hilites.clear();
        update();
        await vp.drawFrame();
        colors = vp.readUniqueColors();
        expect(colors.length).to.equal(2);
        expect(colors.contains(white)).to.be.true;
        expect(colors.contains(black)).to.be.true;
      }
    });
  });

  it("should determine visible depth range", async () => {
    const fullRect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, fullRect, async (vp) => {
      await vp.waitForAllTilesToRender();

      // Depth range for entire view should correspond to the face of the slab in the center of the view which is parallel to the camera's near+far planes.
      // i.e., min and max should be equal, and roughly half-way between the near and far planes.
      const fullRange = vp.determineVisibleDepthRange(fullRect);
      expect(fullRange).not.to.be.undefined;
      expect(fullRange!.minimum).least(0.45);
      expect(fullRange!.minimum).most(0.55);
      expect(fullRange!.minimum).to.equal(fullRange!.maximum);

      // If we pass in a DepthRangeNpc, the same object should be returned to us.
      const myRange = { minimum: 0, maximum: 1 };
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

  it("should use GCS to transform map tiles", async () => {
    // Project extents must be large enough to prevent linear transform from being used.
    const extents = imodel.projectExtents.clone();
    const linearRangeSquared = extents.diagonal().magnitudeSquared();
    if (linearRangeSquared < 1000 * 1000) {
      extents.scaleAboutCenterInPlace(1000);
      imodel.projectExtents = extents;
    }

    expect(imodel.projectExtents.diagonal().magnitudeSquared()).least(1000 * 1000);

    const fullRect = new ViewRect(0, 0, 100, 100);
    await testViewports("0x24", imodel, fullRect.width, fullRect.height, async (vp) => {
      vp.viewFlags = vp.viewFlags.with("backgroundMap", true);

      await vp.waitForAllTilesToRender();
      const mapTreeRef = vp.backgroundMap!;
      const mapTree = mapTreeRef.treeOwner.tileTree!;
      expect(mapTree).not.to.be.undefined;
    });
  });

  it("should render to screen if only a single viewport exists", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testOnScreenViewport("0x24", imodel, rect.width, rect.height, async (vp) => {
      expect(vp.rendersToScreen).to.be.true;
    });
  });

  it("should render off-screen if multiple viewports exist", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    const vp0 = await createOnScreenTestViewport("0x24", imodel, rect.width, rect.height);
    expect(vp0.rendersToScreen).to.be.true; // when only one viewport is on the view manager, it should render using system canvas.
    const vp1 = await createOnScreenTestViewport("0x24", imodel, rect.width, rect.height);
    expect(vp0.rendersToScreen).to.be.false;
    expect(vp1.rendersToScreen).to.be.false;

    vp0.dispose();
    vp1.dispose();
  });

  it("should clip using a single plane", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      vp.viewFlags = vp.viewFlags.with("visibleEdges", false);

      const clip = ClipVector.fromJSON([{
        shape: {
          points: [[-58.57249751634662, -261.9870625343174, 0], [297.4029912650585, -261.9870625343174, 0], [297.4029912650585, 111.24234024435282, 0], [-58.57249751634662, 111.24234024435282, 0], [-58.57249751634662, -261.9870625343174, 0]],
          trans: [[1, 0, 0, 289076.52682419703], [0, 1, 0, 3803926.4450675533], [0, 0, 1, 0]],
        },
      }]);
      expect(clip).to.not.be.undefined;
      vp.view.setViewClip(clip);
      vp.displayStyle.settings.clipStyle = ClipStyle.fromJSON({
        ...vp.displayStyle.settings.clipStyle.toJSON(),
        outsideColor: { r: 255, g: 0, b: 0 },
        insideColor: { r: 0, g: 255, b: 0 },
      });

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      // White rectangle is centered in view with black background surrounding. Clipping shape and colors splits the shape into red and green halves. Lighting is on so rectangle will not be pure red and green.
      const colors = vp.readUniqueColors();
      const bgColor = Color.fromRgba(0, 0, 0, 0xff);
      expect(colors.length).least(3);
      expect(colors.contains(bgColor)).to.be.true; // black background

      const isReddish = (c: Color): boolean => {
        return c.r >= 0x50 && c.g < 0xa && c.b < 0xa && c.a === 0xff;
      };

      const isGreenish = (c: Color) => {
        return c.r < 0xa && c.g >= 0x50 && c.b < 0xa && c.a === 0xff;
      };

      for (const c of colors.array) {
        if (0 !== c.compare(bgColor)) {
          expect(isReddish(c) || isGreenish(c)).to.be.true;
        }
      }
    });
  });

  describe("Model appearance overrides", () => {
    function isReddish(c: Color): boolean {
      return c.r > c.g && c.g < 0xa && c.b < 0xa && c.a === 0xff;
    }

    const bgColor = Color.fromRgba(0, 0, 0, 0xff);
    function expectCorrectColors(vp: TestViewport) {
      const colors = vp.readUniqueColors();
      expect(colors.length === 2);
      expect(colors.contains(bgColor)).to.be.true; // black background
      colors.forEach((color) => expect(color === bgColor || isReddish(color)));
    }
    function expectAlmostTransparent(vp: TestViewport) {
      const colors = vp.readUniqueColors();
      expect(colors.length === 2);
      expect(colors.contains(bgColor)).to.be.true; // black background
      colors.forEach((color) => expect(color.r < 20 && color.b < 20 && color.g < 20));
    }

    it("should override color", async () => {
      const rect = new ViewRect(0, 0, 100, 100);
      await testViewportsWithDpr(imodel, rect, async (vp) => {
        expect(vp.view.is3d());
        const colorOverride = FeatureAppearance.fromJSON({ rgb: new RgbColor(0xff, 0, 0) });

        vp.view.forEachModel((model) => vp.overrideModelAppearance(model.id, colorOverride));

        await vp.waitForAllTilesToRender();
        expect(vp.numRequestedTiles).to.equal(0);
        expect(vp.numSelectedTiles).to.equal(1);

        expectCorrectColors(vp);
      });
    });

    it("should override tranparency", async () => {
      const rect = new ViewRect(0, 0, 100, 100);
      await testViewportsWithDpr(imodel, rect, async (vp) => {
        expect(vp.view.is3d());
        const colorOverride = FeatureAppearance.fromJSON({ transparency: .95 });

        vp.view.forEachModel((model) => vp.overrideModelAppearance(model.id, colorOverride));

        await vp.waitForAllTilesToRender();
        expect(vp.numRequestedTiles).to.equal(0);
        expect(vp.numSelectedTiles).to.equal(1);

        expectAlmostTransparent(vp);
      });
    });
  });
});
