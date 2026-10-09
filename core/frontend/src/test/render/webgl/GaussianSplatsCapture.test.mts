/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import { Cartographic, ColorDef, EmptyLocalization, RealityDataSourceKey, RenderMode } from "@itwin/core-common";
import { Angle, Point3d, Range3d, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { ScreenViewport } from "../../../Viewport";
import { DecorateContext } from "../../../ViewContext";
import { ViewStatus } from "../../../ViewStatus";
import { GraphicType } from "../../../common/render/GraphicType";
import { Target } from "../../../internal/render/webgl/Target";
import { readGltf } from "../../../tile/internal";
import { GaussianSplatFrameState, observeGaussianSplats } from "../../../internal/render/GaussianSplatDiagnostics";
import { System } from "../../../internal/render/webgl/System";
import { RealityDataSource } from "../../../RealityDataSource";
import { RealityDataSourceCesiumIonAssetImpl } from "../../../RealityDataSourceCesiumIonAssetImpl";
import { createBlankConnection } from "../../createBlankConnection";
import { createGaussianComparisonReport } from "./GaussianComparisonReport.mjs";

// Keep this optional browser artifact in an ES module: vitest/browser uses package exports that the
// production package's legacy Node module resolution does not understand.
declare const ITWIN_GAUSSIAN_SCREENSHOT_ENABLED: boolean;
declare const ITWIN_GAUSSIAN_SCREENSHOT_URL: string;
declare const ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET: number;
declare const ITWIN_GAUSSIAN_SCREENSHOT_COMPARE: boolean;
declare const ITWIN_GAUSSIAN_SCREENSHOT_CESIUM_SSE: number;
declare const ITWIN_GAUSSIAN_SCREENSHOT_NATIVE_MODIFIER: number;

// The reference SDK is loaded only in this optional browser validation, never in the native renderer.
async function compareCesium(viewport: ScreenViewport, native: HTMLCanvasElement, bounds: Range3d, detail?: Point3d): Promise<void> {
  const base = "https://cesium.com/downloads/cesiumjs/releases/1.146/Build/Cesium/";
  Object.assign(window, { CESIUM_BASE_URL: base });
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `${base}Widgets/widgets.css`;
  await new Promise<void>((resolve, reject) => {
    style.onload = () => resolve();
    style.onerror = () => reject(new Error("Could not load CesiumJS reference styles"));
    document.head.appendChild(style);
  });
  const script = document.createElement("script");
  script.src = `${base}Cesium.js`;
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load CesiumJS reference SDK"));
    document.head.appendChild(script);
  });
  const cesium = (window as unknown as { Cesium: any }).Cesium;
  const div = document.createElement("div");
  div.style.width = `${native.width}px`;
  div.style.height = `${native.height}px`;
  document.body.appendChild(div);
  const viewer = new cesium.Viewer(div, {
    animation: false, baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    navigationHelpButton: false, sceneModePicker: false, timeline: false, infoBox: false, selectionIndicator: false,
    fullscreenButton: false, useDefaultRenderLoop: false,
    contextOptions: { webgl: { preserveDrawingBuffer: true, antialias: false } },
  });
  let draw: Readonly<GaussianSplatFrameState> | undefined;
  const removeObserver = observeGaussianSplats(viewport.target, (state) => { draw = state; });
  try {
    const scene = viewer.scene;
    scene.globe.show = false;
    scene.skyBox.show = scene.skyAtmosphere.show = scene.sun.show = scene.moon.show = false;
    scene.fog.enabled = false;
    scene.backgroundColor = cesium.Color.fromBytes(12, 17, 24, 255);
    scene.postProcessStages.fxaa.enabled = false;
    viewer.resolutionScale = 1;
    const ecef = viewport.iModel.getEcefTransform();
    const m = ecef.matrix.coffs, o = ecef.origin, center = bounds.center, half = bounds.diagonal().scale(0.5);
    // One leaf with exactly the same GLB isolates the renderer from streaming/LOD differences.
    const leaf = {
      asset: { version: "1.1", gltfUpAxis: "Y" }, geometricError: bounds.diagonal().magnitude(),
      extensionsUsed: ["3DTILES_content_gltf"],
      extensions: { "3DTILES_content_gltf": { extensionsUsed: ["KHR_gaussian_splatting", "KHR_gaussian_splatting_compression_spz_2"], extensionsRequired: ["KHR_gaussian_splatting", "KHR_gaussian_splatting_compression_spz_2"] } },
      root: { geometricError: 0, refine: "REPLACE", boundingVolume: { box: [center.x, center.y, center.z, half.x, 0, 0, 0, half.y, 0, 0, 0, half.z] },
        transform: [m[0],m[3],m[6],0,m[1],m[4],m[7],0,m[2],m[5],m[8],0,o.x,o.y,o.z,1],
        content: { uri: new URL(ITWIN_GAUSSIAN_SCREENSHOT_URL, window.location.href).href } },
    };
    const options = { maximumScreenSpaceError: ITWIN_GAUSSIAN_SCREENSHOT_CESIUM_SSE, dynamicScreenSpaceError: false, foveatedScreenSpaceError: false, skipLevelOfDetail: false };
    const tileset = ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET
      ? await cesium.Cesium3DTileset.fromIonAssetId(ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET, options)
      : await cesium.Cesium3DTileset.fromUrl(`data:application/json,${encodeURIComponent(JSON.stringify(leaf))}`, options);
    scene.primitives.add(tileset);
    let referenceFailures = 0;
    tileset.tileFailed.addEventListener(() => { referenceFailures++; });
    const results = [];
    const diagonal = bounds.diagonal().magnitude();
    const poses = [
      { name: "overview", target: center, direction: Vector3d.create(1, 1, 0.65), distance: diagonal * 1.25 },
      { name: "oblique", target: center, direction: Vector3d.create(-1, 1, 0.8), distance: diagonal * 1.25 },
      { name: "detail", target: detail ?? center, direction: Vector3d.create(1, 1, 0.65), distance: diagonal * (detail ? 0.18 : 0.45) },
    ];
    const nextFrame = async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const renderNative = () => { viewport.requestRedraw(); viewport.renderFrame(); };
    const renderReference = () => { scene.requestRender(); viewer.render(); };
    const referenceSettled = () => {
      const primitive = tileset.gaussianSplatPrimitive;
      const selected = tileset._selectedTiles;
      return !!(tileset.tilesLoaded && tileset.statistics.numberOfPendingRequests === 0 && tileset.statistics.numberOfTilesProcessing === 0
        && primitive?._drawCommand?.instanceCount > 0 && !primitive._pendingSnapshot && !primitive._needsSnapshotRebuild && primitive._sorterState === 0
        && primitive._selectedTileSet?.size === selected.length && selected.every((tile: any) => primitive._selectedTileSet.has(tile))
        && primitive._numSplats === selected.reduce((count: number, tile: any) => count + tile.content.pointsLength, 0));
    };
    const summary = (samples: number[]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maxMs: sorted[sorted.length - 1], samplesMs: samples };
    };
    // Read one pixel after finish to verify GPU completion on both presentation paths.
    // Native renderFrame can wait during its canvas copy; submission time is not pure CPU time.
    const measure = async (render: () => void, gl: WebGL2RenderingContext, settled?: () => boolean) => {
      const cpu: number[] = [], completed: number[] = [], afterFinish: number[] = [], gpu: number[] = [], submittedInstances: number[] = [];
      const pixel = new Uint8Array(4);
      const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      const queries: WebGLQuery[] = [];
      const originalDraw = gl.drawArraysInstanced;
      let instances = 0;
      gl.drawArraysInstanced = function (...args) { instances += args[3]; originalDraw.apply(this, args); };
      try {
        for (let frame = 0; frame < 70; frame++) {
          await nextFrame();
          const query = timer ? gl.createQuery() : null;
          if (query) gl.beginQuery(timer!.TIME_ELAPSED_EXT, query);
          instances = 0;
          const start = performance.now();
          render();
          const submitted = performance.now();
          if (query) gl.endQuery(timer!.TIME_ELAPSED_EXT);
          gl.finish();
          const finished = performance.now();
          const framebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
          if (frame >= 10) {
            cpu.push(submitted - start);
            afterFinish.push(finished - start);
            completed.push(performance.now() - start);
            submittedInstances.push(instances);
            if (query) queries.push(query);
          } else if (query) {
            gl.deleteQuery(query);
          }
          if (settled) expect(settled()).toBe(true);
        }
        if (queries.length) {
          await expect.poll(() => queries.every((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)), { timeout: 5000 }).toBe(true);
          if (!gl.getParameter(timer!.GPU_DISJOINT_EXT))
            for (const query of queries) gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        }
        expect(gl.getError()).toBe(gl.NO_ERROR);
        expect(submittedInstances.every((count) => count > 0)).toBe(true);
        return { cpu: summary(cpu), afterFinish: summary(afterFinish), completed: summary(completed), gpu: gpu.length ? summary(gpu) : undefined,
          submittedInstances, completionPixel: [...pixel] };
      } finally {
        gl.drawArraysInstanced = originalDraw;
        for (const query of queries) gl.deleteQuery(query);
      }
    };
    const profileNative = async () => {
      const target = viewport.target as Target;
      const renderer = (target.compositor as any)._gaussianSplats;
      const phases: Record<string, number[]> = {};
      const restore: Array<() => void> = [];
      let frame: Record<string, number>;
      for (const [object, names] of [[renderer, ["gather", "prepare", "updateResidency", "remapCompleted", "upload", "drawContent", "drawInstances", "drawComposite"]],
        [target, ["_endPaint"]]] as const) {
        for (const name of names) {
          const original = (object as any)[name];
          (object as any)[name] = function (...args: any[]) {
            const start = performance.now();
            try { return original.apply(this, args); }
            finally { frame[name] = (frame[name] ?? 0) + performance.now() - start; }
          };
          restore.push(() => { (object as any)[name] = original; });
          phases[name] = [];
        }
      }
      try {
        for (let i = 0; i < 20; i++) {
          await nextFrame();
          frame = {};
          renderNative();
          System.instance.context.finish();
          if (i >= 5)
            for (const name of Object.keys(phases)) phases[name].push(frame[name] ?? 0);
        }
        return Object.fromEntries(Object.entries(phases).map(([name, samples]) => [name, summary(samples)]));
      } finally {
        for (const reset of restore) reset();
      }
    };
    for (const pose of poses) {
      expect((viewport.view as SpatialViewState).lookAt({ eyePoint: pose.target.plusScaled(pose.direction.normalize()!, pose.distance), targetPoint: pose.target,
        upVector: Vector3d.unitZ(), lensAngle: Angle.createDegrees(50), frontDistance: 0.1, backDistance: Math.max(1000, diagonal * 6) })).toBe(ViewStatus.Success);
      expect(viewport.setupFromView()).toBe(ViewStatus.Success);
      IModelApp.startEventLoop();
      await viewport.waitForSceneCompletion();
      IModelApp.stopEventLoop();
      await expect.poll(() => {
        renderNative();
        return !!draw && draw.drawnInstances > 0 && !draw.awaitingCandidate && !draw.sorting && !draw.failed;
      }, { timeout: 60000, interval: 50 }).toBe(true);
      const frustum = (viewport.target as Target).uniforms.frustum;
      const eyeToWorld = frustum.viewMatrix.inverse()!;
      const eye = ecef.multiplyPoint3d(eyeToWorld.origin);
      const direction = ecef.matrix.multiplyVector(eyeToWorld.matrix.multiplyVector(Vector3d.create(0, 0, -1)));
      const up = ecef.matrix.multiplyVector(eyeToWorld.matrix.multiplyVector(Vector3d.unitY()));
      scene.camera.setView({ destination: new cesium.Cartesian3(eye.x, eye.y, eye.z), orientation: {
        direction: new cesium.Cartesian3(direction.x, direction.y, direction.z), up: new cesium.Cartesian3(up.x, up.y, up.z),
      } });
      scene.camera.frustum.aspectRatio = native.width / native.height;
      scene.camera.frustum.fov = 2 * Math.atan(1 / frustum.projectionMatrix32.data[0]);
      scene.camera.frustum.near = frustum.nearPlane;
      scene.camera.frustum.far = frustum.farPlane;
      let stableFrames = 0;
      await expect.poll(async () => {
        await nextFrame();
        viewer.resize(); viewer.render();
        stableFrames = referenceSettled() ? stableFrames + 1 : 0;
        return stableFrames;
      }, { timeout: ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET ? 90000 : 10000, interval: 50 }).toBeGreaterThanOrEqual(12);
      expect(referenceFailures).toBe(0);
      expect(scene.canvas.width).toBe(native.width);
      expect(scene.canvas.height).toBe(native.height);
      const nativeTiming = await measure(renderNative, System.instance.context);
      const referenceTiming = await measure(renderReference, scene.context._gl, referenceSettled);
      expect(referenceSettled()).toBe(true);
      expect(referenceFailures).toBe(0);
      const a = viewport.readImageToCanvas({ omitCanvasDecorations: true });
      const b = document.createElement("canvas");
      b.width = a.width; b.height = a.height;
      b.getContext("2d")!.drawImage(scene.canvas, 0, 0);
      const ap = a.getContext("2d")!.getImageData(0, 0, a.width, a.height).data;
      const bp = b.getContext("2d")!.getImageData(0, 0, b.width, b.height).data;
      let intersection = 0, union = 0, squaredDifference = 0, difference = 0;
      const foreground = (pixels: Uint8ClampedArray, i: number) => Math.abs(pixels[i] - 12) + Math.abs(pixels[i + 1] - 17) + Math.abs(pixels[i + 2] - 24) > 30;
      for (let i = 0; i < ap.length; i += 4) {
        const fa = foreground(ap, i), fb = foreground(bp, i);
        if (fa || fb) union++;
        if (fa && fb) {
          intersection++;
          for (let c = 0; c < 3; c++) {
            squaredDifference += (ap[i + c] - bp[i + c]) ** 2;
            difference += ap[i + c] - bp[i + c];
          }
        }
      }
      expect(intersection).toBeGreaterThan(100);
      const colorField = ((viewport.target as Target).compositor as any)._gaussianSplats?._field;
      const hardware = System.instance.context.getExtension("WEBGL_debug_renderer_info");
      const result = {
        name: pose.name, width: a.width, height: a.height, cameraEcef: { eye: eye.toJSON(), direction: direction.toJSON(), up: up.toJSON(), fov: scene.camera.frustum.fov, near: frustum.nearPlane, far: frustum.farPlane },
        foregroundOverlap: intersection / union, colorRms: Math.sqrt(squaredDifference / (intersection * 3)), meanNativeMinusReference: difference / (intersection * 3),
        native: { timing: nativeTiming, selectedTiles: viewport.numSelectedTiles, draw, phases: await profileNative(),
          colorField: colorField ? { format: colorField.dataType === System.instance.context.HALF_FLOAT ? "RGBA16F" : colorField.dataType === System.instance.context.FLOAT ? "RGBA32F" : "RGBA8", bytes: colorField.bytesUsed } : undefined },
        cesium: { timing: referenceTiming, selectedTiles: tileset._selectedTiles.length, splats: tileset.gaussianSplatPrimitive?._numSplats,
          submittedInstances: tileset.gaussianSplatPrimitive?._drawCommand?.instanceCount,
          totalMemoryBytes: tileset.totalMemoryUsageInBytes, sse: tileset.maximumScreenSpaceError, highDynamicRange: scene.highDynamicRange,
          memoryAdjustedSse: tileset.memoryAdjustedScreenSpaceError, splatBudgetSseScale: tileset.gaussianSplatPrimitive?._splatBudgetSSEScale,
          failedTiles: referenceFailures, pendingRequests: tileset.statistics.numberOfPendingRequests, processingTiles: tileset.statistics.numberOfTilesProcessing,
          selected: tileset._selectedTiles.map((tile: any) => ({ depth: tile._depth, geometricError: tile.geometricError, screenSpaceError: tile._screenSpaceError,
            distance: tile._distanceToCamera, children: tile.children.length, points: tile.content.pointsLength, external: tile.hasTilesetContent })),
          root: { geometricError: tileset.root.geometricError, screenSpaceError: tileset.root._screenSpaceError, children: tileset.root.children.length } },
        nativeImage: a.toDataURL(), referenceImage: b.toDataURL(),
        gpu: System.instance.context.getParameter(hardware?.UNMASKED_RENDERER_WEBGL ?? System.instance.context.RENDERER),
      };
      results.push(result);
      const sheet = document.createElement("canvas");
      sheet.width = a.width * 2; sheet.height = a.height + 40;
      const context = sheet.getContext("2d")!;
      context.fillStyle = "#0c1118"; context.fillRect(0, 0, sheet.width, sheet.height);
      context.fillStyle = "white"; context.font = "22px sans-serif";
      context.fillText(`iTwin.js · ${pose.name}`, 20, 28); context.fillText(`CesiumJS 1.146 · ${pose.name}`, a.width + 20, 28);
      context.drawImage(a, 0, 40); context.drawImage(b, a.width, 40);
      await commands.writeFile(`lib/gaussian-parity-${pose.name}.png`, sheet.toDataURL().split(",")[1], "base64");
    }
    const report = { version: 2, asset: ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET || ITWIN_GAUSSIAN_SCREENSHOT_URL,
      userAgent: navigator.userAgent, dpr: window.devicePixelRatio, cesiumVersion: cesium.VERSION, cesiumOptions: options, nativeTileSizeModifier: viewport.tileSizeModifier,
      method: "60 sequential warm settled frames per renderer/pose after 10 warmup frames; submission wall time, gl.finish wall time, and completion verified by one-pixel readback; GPU timer queries when available; actual GL instance counts; nested native phase wall timings recorded separately; streaming policies may differ",
      results };
    await commands.writeFile("lib/gaussian-parity.json", JSON.stringify(report, undefined, 2));
    await commands.writeFile("lib/gaussian-parity.html", createGaussianComparisonReport(report));
  } finally {
    IModelApp.stopEventLoop();
    removeObserver();
    viewer.destroy();
    div.remove();
    script.remove();
    style.remove();
  }
}

describe.skipIf(!ITWIN_GAUSSIAN_SCREENSHOT_ENABLED)("Native Gaussian screenshot", () => {
  beforeAll(async () => {
    let cesiumIonKey: string | undefined;
    if (ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET) {
      // Explicit opt-in uses the SDK's public evaluation token; never save credentials in the fixture.
      const sdk = await (await fetch("https://raw.githubusercontent.com/CesiumGS/cesium/1.146/packages/engine/Source/Core/Ion.js")).text();
      cesiumIonKey = sdk.match(/(?:defaultAccessToken|defaultToken)\s*=\s*["']([^"']+)/)?.[1];
      expect(cesiumIonKey).toBeDefined();
    }
    await IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true }, tileAdmin: { cesiumIonKey } });
  });
  afterAll(async () => IModelApp.shutdown());

  it("captures Gaussian glTF through the native renderer", async () => {
    await page.viewport(1024, 768);
    let sourceKey: RealityDataSourceKey | undefined;
    let location: Cartographic | undefined;
    let detailEcef: Point3d | undefined;
    if (ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET) {
      sourceKey = RealityDataSource.createCesiumIonAssetKey(ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET, "");
      const source = await RealityDataSourceCesiumIonAssetImpl.createFromKey(sourceKey, undefined);
      expect(source).toBeDefined();
      const root = (await source!.getRootDocument(undefined)).root;
      location = Cartographic.fromEcef(new Point3d(root.transform[12], root.transform[13], root.transform[14]));
      expect(location).toBeDefined();
      const box = root.children?.find((child: any) => child.boundingVolume?.box)?.boundingVolume.box;
      if (box) {
        const t = root.transform;
        detailEcef = Point3d.create(t[0]*box[0]+t[4]*box[1]+t[8]*box[2]+t[12], t[1]*box[0]+t[5]*box[1]+t[9]*box[2]+t[13], t[2]*box[0]+t[6]*box[1]+t[10]*box[2]+t[14]);
      }
    }
    const imodel = createBlankConnection("Gaussian capture", location);
    const div = document.createElement("div");
    div.style.width = "1024px";
    div.style.height = "768px";
    div.style.position = "fixed";
    div.style.inset = "0";
    document.body.appendChild(div);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1,1,1));
    view.viewFlags = view.viewFlags.copy({ grid: false, acsTriad: false, lighting: false, renderMode: RenderMode.SmoothShade });
    view.displayStyle.backgroundColor = ColorDef.from(12,17,24);
    const viewport = ScreenViewport.create(div, view);
    viewport.setTileSizeModifier(ITWIN_GAUSSIAN_SCREENSHOT_NATIVE_MODIFIER);
    IModelApp.viewManager.addViewport(viewport);
    let decorator: { decorate: (context: DecorateContext) => void } | undefined;
    let graphic: Disposable | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      viewport.renderFrame();
      let bounds: Range3d;
      if (sourceKey) {
        view.displayStyle.attachRealityModel({ tilesetUrl: sourceKey.id, name: "Gaussian ion capture" });
        const trees = await Promise.all(Array.from(view.getTileTreeRefs(), (ref) => ref.treeOwner.loadTree()));
        expect(trees.length).toBeGreaterThan(0);
        expect(trees.every((tree) => tree !== undefined)).toBe(true);
        bounds = Range3d.fromJSON(view.computeFitRange());
      } else {
        const url = new URL(ITWIN_GAUSSIAN_SCREENSHOT_URL, window.location.href);
        const response = await fetch(url);
        expect(response.ok).toBe(true);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const result = await readGltf({ gltf: bytes, baseUrl: url, iModel: imodel, pickableOptions: { id: "0x456" } });
        expect(result).toBeDefined();
        graphic = result!.graphic;
        const owner = IModelApp.renderSystem.createGraphicOwner(result!.graphic);
        decorator = { decorate: (context) => context.addDecoration(GraphicType.Scene, owner) };
        IModelApp.viewManager.addDecorator(decorator);
        bounds = Range3d.fromJSON(result!.boundingBox);
        // Decorators do not supply a tile-tree fit range for automatic depth-plane expansion.
        imodel.projectExtents = bounds;
      }
      const direction = new Vector3d(1,1,0.65).normalize()!;
      const diagonal = bounds.diagonal().magnitude();
      expect(view.lookAt({ eyePoint: bounds.center.plusScaled(direction, diagonal * 1.25), targetPoint: bounds.center, upVector: Vector3d.unitZ(), lensAngle: Angle.createDegrees(50), frontDistance: 0.1, backDistance: Math.max(1000, diagonal * 6) })).toBe(ViewStatus.Success);
      expect(viewport.setupFromView()).toBe(ViewStatus.Success);
      if (sourceKey) {
        IModelApp.startEventLoop();
        await viewport.waitForSceneCompletion();
        expect(viewport.numSelectedTiles).toBeGreaterThan(0);
        console.log("Native ion capture", { asset: ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET, selectedTiles: viewport.numSelectedTiles, readyTiles: viewport.numReadyTiles });
      }
      // The screenshot reads native framebuffer pixels, then presents that canvas to the browser's
      // screenshot API. It is not limited by the test iframe's viewport-element CSS dimensions.
      const start = performance.now();
      do {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        viewport.requestRedraw();
        viewport.renderFrame();
      } while (performance.now() - start < 500);
      canvas = viewport.readImageToCanvas({ omitCanvasDecorations: true });
      document.body.appendChild(canvas);
      expect(canvas.width).toBeGreaterThan(100);
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<number>();
      for (let i = 0; i < pixels.length; i += 4)
        colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
      expect(colors.size).toBeGreaterThan(100);
      expect(Array.from(pixels.subarray(0, 3))).toEqual([12, 17, 24]);
      await page.screenshot({ element: canvas, path: "../../../../lib/gaussian-splats-cesium.png" });
      if (ITWIN_GAUSSIAN_SCREENSHOT_COMPARE)
        await compareCesium(viewport, canvas, bounds, detailEcef ? imodel.getEcefTransform().inverse()!.multiplyPoint3d(detailEcef) : undefined);
    } finally {
      if (decorator)
        IModelApp.viewManager.dropDecorator(decorator);
      IModelApp.viewManager.dropViewport(viewport, false);
      viewport[Symbol.dispose]();
      graphic?.[Symbol.dispose]();
      canvas?.remove();
      div.remove();
      await imodel.close();
    }
  }, 300000);
});
