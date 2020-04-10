/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  Color,
  TestViewport,
  comparePixelData,
  createOnScreenTestViewport,
  testOffScreenViewport,
  testOnScreenViewport,
  testViewports,
} from "../TestViewport";
import {
  BeDuration,
  BeTimePoint,
} from "@bentley/bentleyjs-core";
import {
  ColorDef,
  Hilite,
  RenderMode,
  RgbColor,
  ViewFlags,
  ThematicDisplayProps,
  ThematicGradientColorScheme,
  ThematicDisplay,
} from "@bentley/imodeljs-common";
import {
  GraphicType,
  IModelApp,
  IModelConnection,
  IModelTileTree,
  FeatureOverrideProvider,
  FeatureSymbology,
  OffScreenViewport,
  Pixel,
  RenderMemory,
  RenderSystem,
  SpatialViewState,
  TileAdmin,
  TileLoadStatus,
  TileTree,
  TileTreeSet,
  Viewport,
  ViewRect,
  Decorator,
  DecorateContext,
  SnapshotConnection,
  ViewState3d,
} from "@bentley/imodeljs-frontend";
import { Point2d, Point3d, ClipVector } from "@bentley/geometry-core";
import { BuffersContainer, VAOContainer, VBOContainer } from "@bentley/imodeljs-frontend/lib/webgl";

describe("Test VAO creation", () => {
  before(async () => {
    const renderSysOpts: RenderSystem.Options = {};
    IModelApp.startup({ renderSys: renderSysOpts });
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("should create VAO BuffersContainer object", async () => {
    const buffers = BuffersContainer.create();
    expect(buffers instanceof VAOContainer).to.be.true;
  });
});

describe("Test VBO creation", () => {
  before(async () => {
    const renderSysOpts: RenderSystem.Options = {};
    renderSysOpts.disabledExtensions = ["OES_vertex_array_object"];
    IModelApp.startup({ renderSys: renderSysOpts });
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("should create VBO BuffersContainer object", async () => {
    const buffers = BuffersContainer.create();
    expect(buffers instanceof VBOContainer).to.be.true;
  });
});

async function testViewportsWithDpr(imodel: IModelConnection, rect: ViewRect, test: (vp: TestViewport) => Promise<void>): Promise<void> {
  const devicePixelRatios = [1.0, 1.25, 1.5, 2.0];
  for (const dpr of devicePixelRatios)
    await testViewports("0x24", imodel, rect.width, rect.height, test, dpr);
}

describe("Render mirukuru with VAOs disabled", () => {
  let imodel: IModelConnection;

  before(async () => {
    const renderSysOpts: RenderSystem.Options = {};
    renderSysOpts.disabledExtensions = ["OES_vertex_array_object"];

    IModelApp.startup({ renderSys: renderSysOpts });
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
  });

  it("should properly render the model (smooth shaded with visible edges)", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      const vf = vp.view.viewFlags;
      vf.visibleEdges = true;

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

describe("Properly render on- or off-screen", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
  });

  it("single viewport should render using system canvas", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testOnScreenViewport("0x24", imodel, rect.width, rect.height, async (vp) => {
      expect(vp.rendersToScreen).to.be.true;
    });
  });

  it("neither of dual viewports should render using system canvas", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    const vp0 = await createOnScreenTestViewport("0x24", imodel, rect.width, rect.height);
    expect(vp0.rendersToScreen).to.be.true; // when only one viewport is on the view manager, it should render using system canvas.
    const vp1 = await createOnScreenTestViewport("0x24", imodel, rect.width, rect.height);
    expect(vp0.rendersToScreen).to.be.false;
    expect(vp1.rendersToScreen).to.be.false;
  });
});

describe("Render mirukuru with single clip plane", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
  });

  it("should render the model", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      const vf = vp.view.viewFlags;
      vf.visibleEdges = false;

      const clip = ClipVector.fromJSON([{
        shape: {
          points: [[-58.57249751634662, -261.9870625343174, 0], [297.4029912650585, -261.9870625343174, 0], [297.4029912650585, 111.24234024435282, 0], [-58.57249751634662, 111.24234024435282, 0], [-58.57249751634662, -261.9870625343174, 0]],
          trans: [[1, 0, 0, 289076.52682419703], [0, 1, 0, 3803926.4450675533], [0, 0, 1, 0]],
        },
      }]);
      expect(clip).to.not.be.undefined;
      vp.view.setViewClip(clip);
      vp.outsideClipColor = ColorDef.red;
      vp.insideClipColor = ColorDef.green;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      vp.outsideClipColor = ColorDef.red;
      vp.insideClipColor = ColorDef.green;

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
});

describe("Render mirukuru with thematic display applied", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
  });

  it("should render the model with proper thematic colors applied", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      const vf = vp.view.viewFlags;
      vf.visibleEdges = false;
      vf.lighting = false;
      vf.renderMode = RenderMode.SmoothShade;
      vf.thematicDisplay = true;

      // Create a ThematicDisplay object with the desired thematic settings
      const thematicProps: ThematicDisplayProps = {
        gradientSettings: {
          colorScheme: ThematicGradientColorScheme.Custom,
          customKeys: [{ value: 0.0, color: ColorDef.from(0, 0, 255) }, { value: 1.0, color: ColorDef.from(255, 0, 0) }],
        },
        range: { low: imodel.projectExtents.xLow, high: imodel.projectExtents.xHigh }, // grab imodel project extents to set range of thematic display
        axis: [1.0, 0.0, 0.0],
      };
      const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

      const displaySettings = (vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = thematicDisplay;

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      // White rectangle is centered in view with black background surrounding. Thematic display sets a blue/red gradient on the rectangle. Lighting is off.
      const colors = vp.readUniqueColors();
      const bgColor = Color.fromRgba(0, 0, 0, 0xff);
      expect(colors.length).least(3); // red, blue, and black - (actually way more colors!)
      expect(colors.contains(bgColor)).to.be.true; // black background

      const isReddish = (c: Color): boolean => {
        return c.r > c.g && c.g < 0xa && c.b < 0xa && c.a === 0xff;
      };

      const isBluish = (c: Color) => {
        return c.r < 0xa && c.g < 0xa && c.b > c.g && c.a === 0xff;
      };

      const isPurplish = (c: Color) => {
        return c.r > c.g && c.g < 0xa && c.b > c.g && c.a === 0xff;
      };

      for (const c of colors.array) {
        if (0 !== c.compare(bgColor)) {
          expect(isReddish(c) || isBluish(c) || isPurplish(c)).to.be.true;
        }
      }
    });
  });
});

// Mirukuru contains a single view, looking at a single design model containing a single white rectangle (element ID 41 (0x29), subcategory ID = 24 (0x18)).
// (It also is supposed to contain a reality model but the URL is presumably wrong).
// The initial view is in top orientation, centered on the top of the rectangle, but not fitted to its extents (empty space on all sides of rectangle).
// Background color is black; ACS triad on; render mode smooth with lighting enabled and visible edges enabled.
describe("Render mirukuru", () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
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

      // Ensure reading out-of-bounds rects returns empty pixel array
      const coords = [[-1, -1, -2, -2], [rect.width + 1, rect.height + 1, rect.width + 2, rect.height + 2]];
      for (const coord of coords) {
        const readRect = new ViewRect(coord[0], coord[1], coord[2], coord[3]);
        const oob = vp.readUniquePixelData(readRect);
        expect(oob).to.not.be.undefined;
        expect(oob.array.length).to.equal(0);
      }

      // We run this test twice. The second time, the tiles will already be available so the view will NOT be empty. Purge them now.
      await imodel.tiles.purgeTileTrees(undefined);
      vp.refreshForModifiedModels(undefined);
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
      const vf = vp.view.viewFlags;
      vf.lighting = false;
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
      const vf = vp.view.viewFlags;
      vf.visibleEdges = vf.hiddenEdges = vf.lighting = false;

      type AddFeatureOverrides = (overrides: FeatureSymbology.Overrides, viewport: Viewport) => void;
      class RenderTestOverrideProvider implements FeatureOverrideProvider {
        public ovrFunc?: AddFeatureOverrides;
        public addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void {
          if (undefined !== this.ovrFunc)
            this.ovrFunc(overrides, viewport);
        }
      }
      const ovrProvider = new RenderTestOverrideProvider();
      vp.featureOverrideProvider = ovrProvider;

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
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromJSON({ nonLocatable: true }));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      pixels = vp.readUniquePixelData(undefined, true); // Exclude non-locatable elements
      expect(pixels.length).to.equal(1);
      expect(pixels.containsElement(elemId)).to.be.false;
      pixels = vp.readUniquePixelData(); // Include non-locatable elements
      expect(pixels.length).to.equal(2);
      expect(pixels.containsElement(elemId)).to.be.true;

      // Specify element is drawn blue
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0xff, 0xff))).to.be.true;

      // Specify default overrides
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Specify default overrides, but also override element color
      ovrProvider.ovrFunc = (ovrs, _) => {
        ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.green));
        ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(new ColorDef(0x7f0000))); // blue = 0x7f...
      };
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromRgba(0, 0, 0x7f, 0xff))).to.be.true;
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.false;

      // Override by subcategory
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override color for element and subcategory - element wins
      ovrProvider.ovrFunc = (ovrs, _) => {
        ovrs.overrideSubCategory(subcatId, FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
        ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromRgb(ColorDef.red));
      };
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.contains(Color.fromRgba(0xff, 0, 0, 0xff))).to.be.true;

      // Override to be fully transparent - element should not draw at all
      ovrProvider.ovrFunc = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromTransparency(1.0));
      vp.setFeatureOverrideProviderChanged();
      await vp.drawFrame();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(1);
      expect(colors.contains(bgColor)).to.be.true;

      pixels = vp.readUniquePixelData();
      expect(pixels.length).to.equal(1);
      expect(pixels.containsElement(elemId)).to.be.false;

      // ==================================================================================================
      // WIP: Comment off test so that we can move up on puppeteer to address high priority npm audit issue
      // ==================================================================================================
      if (false) {
        // Set bg color to red, elem color to 50% transparent blue => expect blending
        vp.view.displayStyle.backgroundColor = ColorDef.red;
        vp.invalidateRenderPlan();
        ovrProvider.ovrFunc = (ovrs, _) => ovrs.overrideElement(elemId, FeatureSymbology.Appearance.fromJSON({ rgb: new RgbColor(0, 0, 0xff), transparency: 0.5 }));
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
      }
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
      const vf = vp.view.viewFlags;
      vf.visibleEdges = vf.hiddenEdges = vf.lighting = false;
      vp.hilite = new Hilite.Settings(ColorDef.red.clone(), 1.0, 0.0, Hilite.Silhouette.Thin);

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
      const vf = vp.viewFlags.clone();
      vf.backgroundMap = true;
      vp.viewFlags = vf;

      await vp.waitForAllTilesToRender();
      const mapTreeRef = vp.displayStyle.backgroundMap;
      const mapTree = mapTreeRef.treeOwner.tileTree!;
      expect(mapTree).not.to.be.undefined;
    });
  });
});

describe("Tile unloading", async () => {
  let imodel: IModelConnection;
  const expirationSeconds = 0.1;
  const waitSeconds = 4 * expirationSeconds;
  const tileOpts = {
    ignoreMinimumExpirationTimes: true,
    tileExpirationTime: expirationSeconds,
    realityTileExpirationTime: expirationSeconds,
    tileTreeExpirationTime: expirationSeconds,
    disableMagnification: true,
    useProjectExtents: false,
  };

  before(async () => {
    IModelApp.startup({ tileAdmin: TileAdmin.create(tileOpts) });
    imodel = await SnapshotConnection.openFile("CompatibilityTestSeed.bim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    IModelApp.shutdown();
  });

  function getTileTree(vp: Viewport): TileTree {
    const trees = new TileTreeSet();
    vp.discloseTileTrees(trees);
    expect(trees.size).to.equal(1);
    let tree: TileTree | undefined;
    for (const t of trees.trees)
      tree = t;

    return tree!;
  }

  async function waitForExpiration(vp: TestViewport): Promise<void> {
    const expiration = BeDuration.fromSeconds(waitSeconds);
    await expiration.wait();
    await vp.drawFrame(); // needed for off-screen viewports which don't participate in render loop
  }

  it("should not dispose of displayed tiles", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      (tree as IModelTileTree).debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      const expectLoadedChildren = () => {
        const children = tree.rootTile.children!;
        expect(children).not.to.be.undefined;
        expect(children.length).to.equal(8);
        for (const child of children)
          expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

        expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
      };

      expectLoadedChildren();

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expectLoadedChildren();
    });
  });

  // This test sporadically fails on Linux during CI job, with no useful output.
  it.skip("should dispose of undisplayed tiles", async () => {
    await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      (tree as IModelTileTree).debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;

      const children = tree.rootTile.children!;
      expect(children).not.to.be.undefined;
      expect(children.length).to.equal(8);
      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

      vp.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expect(tree.rootTile.children).to.be.undefined;

      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Abandoned);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.true;
    });

    await testOffScreenViewport("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      (tree as IModelTileTree).debugMaxDepth = 1;
      expect(tree.isDisposed).to.be.false;

      vp.invalidateScene();
      await vp.waitForAllTilesToRender();

      const children = tree.rootTile.children!;
      expect(children).not.to.be.undefined;
      expect(children.length).to.equal(8);
      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;

      vp.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
      expect(tree.rootTile.children).to.be.undefined;

      for (const child of children)
        expect(child.loadStatus).to.equal(TileLoadStatus.Abandoned);

      expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.true;
    });
  });

  it("should not dispose of displayed tile trees", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      expect(tree.isDisposed).to.be.false;

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.false;
    });
  });

  it("should dispose of undisplayed tile trees", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp) => {
      await vp.waitForAllTilesToRender();

      const tree = getTileTree(vp);
      expect(tree.isDisposed).to.be.false;

      vp.changeViewedModels([]);

      await waitForExpiration(vp);

      expect(tree.isDisposed).to.be.true;
    });
  });

  it("should not dispose of tile trees displayed in second viewport", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp1: TestViewport) => {
      // vp1 loads+renders all tiles, then sits idle.
      await vp1.waitForAllTilesToRender();
      const tree = getTileTree(vp1);
      expect(tree.isDisposed).to.be.false;

      // vp2 renders continuously.
      await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp2) => {
        await vp2.waitForAllTilesToRender();

        vp2.changeViewedModels([]);

        await waitForExpiration(vp2);

        // vp2 no longers views this tile tree, but vp1 still does.
        expect(tree.isDisposed).to.be.false;
        expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
      });
    });
  });

  it("should not dispose of tiles displayed in second viewport", async () => {
    await testViewports("0x41", imodel, 1854, 931, async (vp1: TestViewport) => {
      // vp1 loads+renders all tiles, then sits idle.
      await vp1.waitForAllTilesToRender();
      const tree = getTileTree(vp1);
      (tree as IModelTileTree).debugMaxDepth = 1;

      // After changing max depth we must re-select tiles...
      vp1.invalidateScene();
      await vp1.waitForAllTilesToRender();

      // vp2 renders continuously, selecting tiles each frame.
      await testOnScreenViewport("0x41", imodel, 1854, 931, async (vp2) => {
        vp2.onRender.addListener((_) => vp2.invalidateScene());
        await vp2.waitForAllTilesToRender();

        const expectLoadedChildren = () => {
          const children = tree.rootTile.children!;
          expect(children).not.to.be.undefined;
          expect(children.length).to.equal(8);
          for (const child of children)
            expect(child.loadStatus).to.equal(TileLoadStatus.Ready);

          expect(tree.rootTile.usageMarker.isExpired(BeTimePoint.now())).to.be.false;
        };

        expectLoadedChildren();

        vp2.scroll({ x: -9999, y: -9999 }, { animateFrustumChange: false });

        await waitForExpiration(vp2);

        expectLoadedChildren();
      });
    });
  });
});

describe("White-on-white reversal", async () => {
  let imodel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
  });

  after(async () => {
    if (imodel) await imodel.close();
    IModelApp.shutdown();
  });

  async function test(expectedColors: Color[], setup: (vp: Viewport, vf: ViewFlags) => void, cleanup?: (vp: Viewport) => void): Promise<void> {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      const vf = vp.viewFlags.clone();
      vf.renderMode = RenderMode.Wireframe;
      vf.acsTriad = false;
      setup(vp, vf);

      vp.viewFlags = vf;
      vp.invalidateRenderPlan();

      await vp.waitForAllTilesToRender();
      if (undefined !== cleanup)
        cleanup(vp);

      const colors = vp.readUniqueColors();
      expect(colors.length).to.equal(expectedColors.length);
      for (const color of expectedColors)
        expect(colors.contains(color)).to.be.true;
    });
  }

  const white = Color.fromRgba(255, 255, 255, 255);
  const black = Color.fromRgba(0, 0, 0, 255);
  const red = Color.fromRgba(255, 0, 0, 255);
  const blue = Color.fromRgba(0, 0, 255, 255);

  it("should not apply if background is not white", async () => {
    await test([red, white], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.red;
    });
  });

  it("should apply if background is white and geometry is white", async () => {
    await test([black, white], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.white;
    });
  });

  it("should not apply if explicitly disabled", async () => {
    await test([white], (vp, vf) => {
      vf.whiteOnWhiteReversal = false;
      vp.displayStyle.backgroundColor = ColorDef.white;
    });
  });

  it("should not apply if geometry is not white", async () => {
    await test([white, blue], (vp, _vf) => {
      class ColorOverride {
        public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _viewport: Viewport): void {
          ovrs.setDefaultOverrides(FeatureSymbology.Appearance.fromRgb(ColorDef.blue));
        }
      }

      vp.displayStyle.backgroundColor = ColorDef.white;
      vp.featureOverrideProvider = new ColorOverride();
    });
  });

  it("should not apply to decorations", async () => {
    class TestDecorator {
      public decorate(context: DecorateContext) {
        const vp = context.viewport;
        const rect = vp.viewRect;

        const viewOverlay = context.createGraphicBuilder(GraphicType.ViewOverlay);
        viewOverlay.setSymbology(ColorDef.white, ColorDef.white, 4);
        viewOverlay.addLineString([
          new Point3d(0, rect.height / 2, 0),
          new Point3d(rect.width / 2, rect.height / 2, 0),
        ]);
        viewOverlay.setSymbology(ColorDef.blue, ColorDef.blue, 4);
        viewOverlay.addLineString([
          new Point3d(rect.width / 2, rect.height / 2, 0),
          new Point3d(rect.width, rect.height / 2, 0),
        ]);
        context.addDecorationFromBuilder(viewOverlay);

        const viewBG = context.createGraphicBuilder(GraphicType.ViewBackground);
        viewBG.setSymbology(ColorDef.white, ColorDef.white, 4);
        viewBG.addLineString([
          new Point3d(rect.width / 2, 0, 0),
          new Point3d(rect.width / 2, rect.height / 2, 0),
        ]);
        viewBG.setSymbology(ColorDef.red, ColorDef.red, 4);
        viewBG.addLineString([
          new Point3d(rect.width / 2, rect.height / 2, 0),
          new Point3d(rect.width / 2, rect.height, 0),
        ]);
        context.addDecorationFromBuilder(viewBG);

        const worldOverlay = context.createGraphicBuilder(GraphicType.WorldOverlay);
        worldOverlay.setSymbology(ColorDef.white, ColorDef.white, 4);
        worldOverlay.addLineString([
          vp.npcToWorld({ x: 0, y: 0, z: 0.5 }),
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
        ]);

        const greenDef = new ColorDef(0x00ff00);
        worldOverlay.setSymbology(greenDef, greenDef, 4);
        worldOverlay.addLineString([
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
          vp.npcToWorld({ x: 1, y: 1, z: 0.5 }),
        ]);
        context.addDecorationFromBuilder(worldOverlay);

        const yellowDef = new ColorDef(0x00ffff);
        const world = context.createGraphicBuilder(GraphicType.WorldDecoration);
        world.setSymbology(ColorDef.white, ColorDef.white, 4);
        world.addLineString([
          vp.npcToWorld({ x: 0, y: 1, z: 0.5 }),
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
        ]);
        world.setSymbology(yellowDef, yellowDef, 4);
        world.addLineString([
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
          vp.npcToWorld({ x: 1, y: 0, z: 0.5 }),
        ]);
        context.addDecorationFromBuilder(world);
      }
    }

    const decorator = new TestDecorator();
    const yellow = Color.fromRgba(255, 255, 0, 255);
    const green = Color.fromRgba(0, 255, 0, 255);

    await test([white, red, blue, green, yellow], (vp, _vf) => {
      IModelApp.viewManager.addDecorator(decorator);
      vp.changeViewedModels([]);
      vp.displayStyle.backgroundColor = ColorDef.white;
    }, (_vp) => {
      IModelApp.viewManager.dropDecorator(decorator);
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
