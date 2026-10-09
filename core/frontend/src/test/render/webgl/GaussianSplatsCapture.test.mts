/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
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
import { RealityDataSource } from "../../../RealityDataSource";
import { RealityDataSourceCesiumIonAssetImpl } from "../../../RealityDataSourceCesiumIonAssetImpl";
import { createBlankConnection } from "../../createBlankConnection";

// Keep this optional browser artifact in an ES module: vitest/browser uses package exports that the
// production package's legacy Node module resolution does not understand.
declare const ITWIN_GAUSSIAN_SCREENSHOT_ENABLED: boolean;
declare const ITWIN_GAUSSIAN_SCREENSHOT_URL: string;
declare const ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET: number;
declare const ITWIN_GAUSSIAN_SCREENSHOT_COMPARE: boolean;

// The reference SDK is loaded only in this optional browser validation, never in the native renderer.
async function compareCesium(viewport: ScreenViewport, native: HTMLCanvasElement): Promise<void> {
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
    contextOptions: { webgl: { preserveDrawingBuffer: true, antialias: false } },
  });
  try {
    const scene = viewer.scene;
    scene.globe.show = false;
    scene.skyBox.show = scene.skyAtmosphere.show = scene.sun.show = scene.moon.show = false;
    scene.fog.enabled = false;
    scene.backgroundColor = cesium.Color.fromBytes(12, 17, 24, 255);
    const ecef = viewport.iModel.getEcefTransform();
    const frustum = (viewport.target as Target).uniforms.frustum;
    const eyeToWorld = frustum.viewMatrix.inverse()!;
    const eye = ecef.multiplyPoint3d(eyeToWorld.origin);
    const direction = ecef.matrix.multiplyVector(eyeToWorld.matrix.multiplyVector(Vector3d.create(0, 0, -1)));
    const up = ecef.matrix.multiplyVector(eyeToWorld.matrix.multiplyVector(Vector3d.unitY()));
    scene.camera.setView({ destination: new cesium.Cartesian3(eye.x, eye.y, eye.z), orientation: {
      direction: new cesium.Cartesian3(direction.x, direction.y, direction.z), up: new cesium.Cartesian3(up.x, up.y, up.z),
    } });
    scene.camera.frustum.fov = 2 * Math.atan(1 / frustum.projectionMatrix32.data[0]);
    const tileset = await cesium.Cesium3DTileset.fromIonAssetId(ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET);
    scene.primitives.add(tileset);
    await expect.poll(() => { viewer.resize(); viewer.render(); return tileset.tilesLoaded; }, { timeout: 90000, interval: 100 }).toBe(true);
    const start = performance.now();
    do {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      viewer.render();
    } while (performance.now() - start < 500);
    expect(scene.canvas.width).toBe(native.width);
    expect(scene.canvas.height).toBe(native.height);
    const reference = document.createElement("canvas");
    reference.width = native.width;
    reference.height = native.height;
    reference.getContext("2d")!.drawImage(scene.canvas, 0, 0, reference.width, reference.height);
    document.body.appendChild(reference);
    try {
      const a = native.getContext("2d")!.getImageData(0, 0, native.width, native.height).data;
      const b = reference.getContext("2d")!.getImageData(0, 0, reference.width, reference.height).data;
      let intersection = 0, union = 0, squaredDifference = 0;
      const foreground = (pixels: Uint8ClampedArray, i: number) => Math.abs(pixels[i] - 12) + Math.abs(pixels[i + 1] - 17) + Math.abs(pixels[i + 2] - 24) > 30;
      for (let i = 0; i < a.length; i += 4) {
        const fa = foreground(a, i), fb = foreground(b, i);
        if (fa || fb) union++;
        if (fa && fb) {
          intersection++;
          for (let c = 0; c < 3; c++) squaredDifference += (a[i + c] - b[i + c]) ** 2;
        }
      }
      const overlap = intersection / union;
      const colorRms = Math.sqrt(squaredDifference / (intersection * 3));
      console.log("CesiumJS 1.146 live comparison", { asset: ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET, foregroundOverlap: overlap, colorRms, nativeSelectedTiles: viewport.numSelectedTiles, cesiumSelectedTiles: tileset._selectedTiles.length, nativeSize: [native.width, native.height], referenceSize: [scene.canvas.width, scene.canvas.height], fov: scene.camera.frustum.fov });
      await page.screenshot({ element: reference, path: "../../../../lib/gaussian-splats-reference.png" });
      expect(overlap).toBeGreaterThan(0.5);
      expect(colorRms).toBeLessThan(80);
    } finally {
      reference.remove();
    }
  } finally {
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
    if (ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET) {
      sourceKey = RealityDataSource.createCesiumIonAssetKey(ITWIN_GAUSSIAN_SCREENSHOT_ION_ASSET, "");
      const source = await RealityDataSourceCesiumIonAssetImpl.createFromKey(sourceKey, undefined);
      expect(source).toBeDefined();
      const root = (await source!.getRootDocument(undefined)).root;
      location = Cartographic.fromEcef(new Point3d(root.transform[12], root.transform[13], root.transform[14]));
      expect(location).toBeDefined();
    }
    const imodel = createBlankConnection("Gaussian capture", location);
    const div = document.createElement("div");
    div.style.width = "1024px";
    div.style.height = "768px";
    document.body.appendChild(div);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1,1,1));
    view.viewFlags = view.viewFlags.copy({ grid: false, acsTriad: false, lighting: false, renderMode: RenderMode.SmoothShade });
    view.displayStyle.backgroundColor = ColorDef.from(12,17,24);
    const viewport = ScreenViewport.create(div, view);
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
      if (sourceKey && ITWIN_GAUSSIAN_SCREENSHOT_COMPARE)
        await compareCesium(viewport, canvas);
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
  }, 150000);
});
