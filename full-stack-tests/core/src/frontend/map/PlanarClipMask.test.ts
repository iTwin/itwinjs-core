/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { assert, CompressedId64Set, Guid, Id64, Id64String } from "@itwin/core-bentley";
import { BackgroundMapSettings, ColorDef, PlanarClipMaskMode, PlanarClipMaskPriority, PlanarClipMaskProps } from "@itwin/core-common";
import { GraphicType, IModelApp, IModelConnection, Pixel, readElementGraphics, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { createOnScreenTestViewport, ScreenTestViewport } from "../TestViewport";
import { Point2d } from "@itwin/core-geometry";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

// The view used by these tests consists of a white rectangle in the center of a top view - smooth-shaded mode.
// Map initially off. Map is coplanar with top of rectangle.
// #graphics: tags this suite as graphics-heavy (shader compilation + pixel readback can take
// minutes per test on software renderers). Node-compatibility CI lanes exclude #graphics suites.
describe("Planar clip mask (#integration #graphics)", () => {
  let imodel: IModelConnection;
  let viewport: ScreenTestViewport;
  let originalModelIds: Id64String[];

  before(async () => {
    await TestUtility.startFrontend({
      ...TestUtility.iModelAppOptions,
      renderSys: {
        // Test wants to read the color of exactly one pixel, specified in CSS pixels. Ignore device pixel ratio.
        dpiAwareViewports: false,
      },
    });

    // Inspect the active test renderer without depending on the internal WebGL System type.
    const gl = (IModelApp.renderSystem as unknown as { context?: WebGL2RenderingContext }).context;
    // A lost context (e.g. the Electron GPU process died under xvfb) never renders; fail now rather than per-test timeouts.
    assert(gl !== undefined && !gl.isContextLost(), "WebGL context is unavailable or lost");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    const text = (value: unknown) => typeof value === "string" ? value.slice(0, 256) : "unavailable";
    const vendor = gl ? text(gl.getParameter(gl.VENDOR)) : "unavailable";
    const renderer = gl ? text(gl.getParameter(gl.RENDERER)) : "unavailable";
    const unmaskedVendor = gl && debugInfo ? text(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : "unavailable";
    const unmaskedRenderer = gl && debugInfo ? text(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : "unavailable";
    // eslint-disable-next-line no-console -- One renderer summary per suite for CI performance diagnostics.
    console.log(`PlanarClipMask renderer: ${JSON.stringify({
      vendor, renderer, unmaskedVendor, unmaskedRenderer,
      version: gl ? text(gl.getParameter(gl.VERSION)) : "unavailable",
      maxTextureSize: gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : "unavailable",
      software: /swiftshader|llvmpipe|softpipe|software/i.test(`${renderer} ${unmaskedRenderer}`) ? true : debugInfo ? false : null,
      userAgent: text(navigator.userAgent),
    })}`);

    imodel = await TestSnapshotConnection.openFile("mirukuru.ibim");
    const view = await imodel.views.load("0x24");
    assert(view.isSpatialView());
    originalModelIds = Array.from(view.modelSelector.models);
    // Map tile trees are viewport-specific; retain their loaded quadtree across cases.
    viewport = await createOnScreenTestViewport(view, imodel, 100, 100);
    // Re-assigning the base purges loaded map tiles; no case changes this color.
    viewport.displayStyle.backgroundMapBase = ColorDef.red;
    viewport.continuousRendering = true;
    const { backgroundLayers, overlayLayers } = viewport.displayStyle.settings.mapImagery;
    // eslint-disable-next-line no-console -- Confirm the fixture does not require external imagery.
    console.log(`PlanarClipMask imagery: ${JSON.stringify({ backgroundLayers: backgroundLayers.length, overlayLayers: overlayLayers.length })}`);
  });

  after(async () => {
    try {
      if (viewport) {
        viewport.continuousRendering = false;
        try {
          viewport[Symbol.dispose]();
        } finally {
          await IModelApp.viewManager.waitForSelectedViewportChange();
        }
      }
    } finally {
      if (imodel)
        await imodel.close();

      await TestUtility.shutdownFrontend();
    }
  });

  // map and dynamic have transient Ids. model has Id 0x1c. background has invalid Id.
  // dynamic is blue. model is white. background is black. map is solid red (no imagery credentials required).
  type PixelType = "map" | "model" | "bg" | "dynamic";

  async function expectPixels(label: string, planarClipMask: PlanarClipMaskProps | undefined, expectedCenter: PixelType, setup?: (vp: Viewport) => void): Promise<void> {
    const start = performance.now();
    const vp = viewport;
    const ms = { setup: 0, firstWait: 0, colorReads: 0, pickReads: 0, total: 0 };
    const frames = { firstWait: 0 };
    const requestedTiles = { start: 0, end: 0 };
    try {
      let phaseStart = performance.now();
      requestedTiles.start = vp.numRequestedTiles;
      vp.changeViewedModels(originalModelIds);
      vp.viewFlags = vp.viewFlags.copy({ backgroundMap: true, lighting: false });
      vp.backgroundMapSettings = BackgroundMapSettings.fromJSON({
        planarClipMask,
        // Put the model under the map with depth enabled so that it is obscured by the map when not masked.
        useDepthBuffer: true,
        groundBias: 10,
      });

      if (setup) {
        setup(vp);
      }

      // Dynamic trees must be ready before the first frame, not just when the render wait returns.
      for (const provider of vp.tiledGraphicsProviders) {
        assert(undefined !== provider.getReferences);
        for (const ref of provider.getReferences(vp))
          await ref.treeOwner.loadTree();
      }

      ms.setup = performance.now() - phaseStart;
      phaseStart = performance.now();
      const removeOnRender = vp.onRender.addListener(() => ++frames.firstWait);
      try {
        await vp.waitForAllTilesToRender();
        ms.firstWait = performance.now() - phaseStart;
      } finally {
        requestedTiles.end = vp.numRequestedTiles;
        removeOnRender();
      }

      phaseStart = performance.now();
      const cx = Math.floor(vp.viewRect.width / 2);
      const cy = Math.floor(vp.viewRect.height / 2);

      // Test what's rendered to the screen.
      const expectColor = (x: number, y: number, expectedPixel: PixelType) => {
        const color = vp.readColor(x, y);
        const lookup: Array<[PixelType, ColorDef]> = [
          ["map", ColorDef.red],
          ["model", ColorDef.white],
          ["dynamic", ColorDef.blue],
          ["bg", ColorDef.black],
        ];

        const match = lookup.find((entry) => color.equalsColorDef(entry[1]))!;
        expect(match).not.to.be.undefined;
        expect(match[0]).to.equal(expectedPixel);
      };

      expectColor(cx, cy, expectedCenter);
      expectColor(1, 1, "map");

      ms.colorReads = performance.now() - phaseStart;
      phaseStart = performance.now();

      // Test what's rendered to the pick buffers.
      const expectFeature = (x: number, y: number, expectedFeature: PixelType) => {
        const px = vp.readPixel(x, y, true);
        if ("bg" === expectedFeature) {
          expect(px.type).to.equal(Pixel.GeometryType.None);
          expect(px.modelId).to.be.undefined;
          return;
        }

        expect(px.type).to.equal(Pixel.GeometryType.Surface);
        expect(px.modelId).not.to.be.undefined;
        expect(Id64.isValidId64(px.modelId!)).to.be.true;
        expect(!Id64.isTransient(px.modelId!)).to.equal(expectedFeature === "model");
      };

      expectFeature(cx, cy, expectedCenter);
      expectFeature(1, 1, "map");
      ms.pickReads = performance.now() - phaseStart;
    } finally {
      for (const provider of vp.tiledGraphicsProviders)
        vp.dropTiledGraphicsProvider(provider);

      ms.total = performance.now() - start;
      for (const phase of Object.keys(ms) as Array<keyof typeof ms>)
        ms[phase] = Math.round(ms[phase]);

      // eslint-disable-next-line no-console -- One timing summary per invocation, never per frame.
      console.log(`PlanarClipMask timing: ${JSON.stringify({ label, ms, frames, requestedTiles })}`);
    }
  }

  it("is not masked by default", async () => {
    await expectPixels("default", undefined, "map");
  });

  it("is masked by specific model", async function () {
    // These tests can exceed the default timeout due to shader compilation for draping.
    this.timeout(480000);
    const mask: PlanarClipMaskProps = { mode: PlanarClipMaskMode.Models, modelIds: CompressedId64Set.compressArray(["0x1c"]) };

    // If the model is visible, it fills the masked region of the mask.
    await expectPixels("models visible", mask, "model");

    // If the model is not visible, it makes a hole in the map revealing the background color.
    await expectPixels("models invisible", mask, "bg", (vp) => vp.changeViewedModels([]));
  });

  it("is masked by DesignModel priority",  async function () {
    // These tests can exceed the default timeout due to shader compilation for draping.
    this.timeout(480000);
    const mask: PlanarClipMaskProps = { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap };

    // Models only contribute to the mask in priority mode if they are visible.
    await expectPixels("priority visible", mask, "model");
    await expectPixels("priority invisible", mask, "map", (vp) => vp.changeViewedModels([]));
  });

  it("is not masked if priority threshold > DesignModel", async () => {
    // This just proves that the next test doesn't just *look* like it passed because the dynamic geometry is naturally drawing
    // in front of the map.
    await expectPixels("priority above DesignModel", { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.DesignModel }, "map");
  });

  function addDynamicGeometry(vp: Viewport): void {
    const modelId = imodel.transientIds.getNext();
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => 0,
      pickable: {
        modelId,
        id: modelId,
      },
    });
    builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);

    const minX = 288874;
    const minY = 3803761;
    const maxX = 289160;
    const maxY = 3803959;
    builder.addShape2d([
      new Point2d(minX, minY), new Point2d(maxX, minY), new Point2d(maxX, maxY), new Point2d(minX, maxY), new Point2d(minX, minY),
    ], 10); // put it under the map

    const treeRef = TileTreeReference.createFromRenderGraphic({
      iModel: imodel,
      graphic: builder.finish(),
      modelId,
    });

    vp.addTiledGraphicsProvider({
      forEachTileTreeRef: (_, func) => func(treeRef),
      getReferences: () => [treeRef],
    });

    vp.changeViewedModels([]);
  }

  it("is not masked by dynamic geometry by default", async () => {
    await expectPixels("dynamic default", undefined, "map", addDynamicGeometry);
  });

  it("is masked by dynamic element geometry",  async function () {
    // These tests can exceed the default timeout due to shader compilation for draping.
    this.timeout(480000);
    const bytes = (await IModelApp.tileAdmin.requestElementGraphics(imodel, {
      elementId: "0x29",
      id: Guid.createValue(),
      toleranceLog10: -3,
    }))!;

    const graphic = (await readElementGraphics(bytes, imodel, "0x1c", true, { tileId: "dynamic-clip" }))!;
    const treeRef = TileTreeReference.createFromRenderGraphic({
      iModel: imodel,
      graphic,
      modelId: "0x1c",
    });

    await expectPixels("dynamic element", {
      mode: PlanarClipMaskMode.Priority,
      priority: PlanarClipMaskPriority.BackgroundMap,
    }, "model", (vp) => {
      vp.changeViewedModels([]);
      vp.addTiledGraphicsProvider({
        forEachTileTreeRef: (_, func) => func(treeRef),
        getReferences: () => [treeRef],
      });
    });
  });

  it("is masked by priority by dynamic geometry", async function () {
    // These tests can exceed the default timeout due to shader compilation for draping.
    this.timeout(480000);
    await expectPixels("dynamic priority", {
      mode: PlanarClipMaskMode.Priority,
      priority: PlanarClipMaskPriority.BackgroundMap,
    }, "dynamic", addDynamicGeometry);
  });
});
