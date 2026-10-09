/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import { EmptyLocalization, RealityDataSourceKey, RenderMode } from "@itwin/core-common";
import { Angle, ClipShape, ClipVector, Point3d, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { RealityDataSource } from "../../../RealityDataSource";
import { SpatialViewState } from "../../../SpatialViewState";
import { ScreenViewport } from "../../../Viewport";
import { ViewStatus } from "../../../ViewStatus";
import { ViewRect } from "../../../common/ViewRect";
import { Pixel } from "../../../render/Pixel";
import { createRealityTileTreeReference, RealityModelTileTree } from "../../../tile/internal";
import { RealityTile } from "../../../tile/RealityTile";
import { TiledGraphicsProvider } from "../../../tile/TiledGraphicsProvider";
import { GaussianSplatWorker } from "../../../internal/render/GaussianSplatWorker";
import { GaussianSplatSortRequest, gaussianSplatsPerPage, sortGaussianSplats } from "../../../internal/render/GaussianSplatSort";
import { GaussianSplatValidationRecorder, GaussianSplatValidationTrace, gaussianSplatValidationHtml } from "../../../internal/render/GaussianSplatValidation";
import { GaussianSplatRenderer } from "../../../internal/render/webgl/GaussianSplatRenderer";
import { getGaussianSplatAtlas } from "../../../internal/render/webgl/GaussianSplatAtlas";
import { System } from "../../../internal/render/webgl/System";
import { createBlankConnection } from "../../createBlankConnection";
import { gaussianSplatFixture, gaussianSplatGlb } from "../GaussianSplatFixtures";

declare const ITWIN_GAUSSIAN_VALIDATION_ENABLED: boolean;

/** Real native tree selection/decoding with frame-scheduled transport and sorter completion.
 * The production worker itself is exercised by GaussianSplats.test.ts; only delivery timing is controlled here.
 */
describe("Gaussian continuous-zoom validation", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;
  let div: HTMLDivElement;
  let ref: RealityModelTileTree.Reference;
  let provider: TiledGraphicsProvider;
  let recorder: GaussianSplatValidationRecorder;
  let frame = 0;
  let delay = 0;
  let seed = 0;
  let sourceOrder = false;
  let visible = true;
  const positions = new Map<number, Float32Array>();
  const pending: Array<{ due: number, result: Uint32Array, resolve: (result: Uint32Array) => void }> = [];
  const patches: Point3d[] = [];
  const bytes = new Map<string, Uint8Array>();
  let run = 0;
  let root: RealityTile;
  let children: RealityTile[];
  let contents: Awaited<ReturnType<RealityModelTileTree["loader"]["loadTileContent"]>>[];

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true } });
    IModelApp.stopEventLoop();
    imodel = createBlankConnection();
    imodel.ecefLocation = undefined;
  });

  // Resolve promised completions at deterministic frame boundaries; never wait for scene quiescence during the route.
  async function microtasks(): Promise<void> {
    for (let i = 0; i < 8; i++)
      await Promise.resolve();
  }

  async function draw(extent?: number): Promise<void> {
    frame++;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].due <= frame) {
        const task = pending.splice(i, 1)[0];
        task.resolve(task.result);
      }
    }
    await microtasks();
    if (extent !== undefined) {
      viewport.view.setOrigin(new Point3d(0.5 - extent / 2, 0.5 - extent / 2, 0));
      viewport.view.setExtents(new Vector3d(extent, extent, 1));
      viewport.setupFromView();
    }
    viewport.invalidateScene();
    viewport.requestRedraw();
    viewport.renderFrame();
    await microtasks();
  }

  function makeContent(which: number[]): Uint8Array {
    const source = gaussianSplatFixture(which.length * 2);
    source.scales.fill(0.06);
    for (let p = 0; p < which.length; p++) {
      for (let i = 0; i < 2; i++) {
        const point = patches[which[p]].clone();
        point.z = i === 0 ? 0.75 : 0.25;
        const index = p * 2 + i;
        source.positions.set([point.x, point.z, -point.y], index * 3);
        // Deliberately put the near blue splat first: source order produces the opposite blended color.
        source.sh.set(i === 0 ? [-0.5 / 0.2820947917738781, -0.5 / 0.2820947917738781, 0.5 / 0.2820947917738781]
          : [0.5 / 0.2820947917738781, -0.5 / 0.2820947917738781, -0.5 / 0.2820947917738781], index * 48);
      }
    }
    return gaussianSplatGlb(source);
  }

  async function initialize(includeParent = true, totalChildren = 2, initialChildren = 2, additive = false): Promise<void> {
    frame = delay = seed = 0;
    sourceOrder = false;
    visible = true;
    pending.length = 0;
    positions.clear();
    patches.length = 0;
    bytes.clear();
    div = document.createElement("div");
    div.style.width = div.style.height = "128px";
    document.body.appendChild(div);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    view.viewFlags = view.viewFlags.copy({ acsTriad: false, grid: false, lighting: false, renderMode: RenderMode.SmoothShade });
    viewport = ScreenViewport.create(div, view);
    IModelApp.viewManager.addViewport(viewport);
    // addViewport starts the application loop again. Stop it after registration so only our frame schedule delivers content.
    IModelApp.stopEventLoop();
    viewport.renderFrame();
    for (let i = 0; i < totalChildren; i++)
      patches.push(viewport.npcToWorld(new Point3d(totalChildren === 2 ? 0.32 + i * 0.36 : (i + 0.5) / totalChildren, 0.5, 0.75)));
    if (additive)
      patches.push(viewport.npcToWorld(new Point3d(0.5, 0.5, 0.75)));
    bytes.set("parent.glb", makeContent(additive ? [totalChildren] : patches.map((_point, i) => i)));
    const childNames = totalChildren === 2 ? ["left.glb", "right.glb"] : ["left.glb", "middle.glb", "right.glb"];
    childNames.forEach((name, i) => bytes.set(name, makeContent([i])));
    const geometricError = 14 * viewport.getPixelSizeAtPoint(new Point3d(0.5, 0.5, 0.5));
    const box = (x: number, halfX: number) => ({ box: [x, 0.5, 0.5, halfX, 0, 0, 0, 0.5, 0, 0, 0, 0.5] });
    const tileset = {
      asset: { version: "1.1", extras: { maximumScreenSpaceError: 16 } },
      extensionsUsed: ["3DTILES_content_gltf"],
      extensions: { "3DTILES_content_gltf": { extensionsUsed: ["KHR_gaussian_splatting"], extensionsRequired: ["KHR_gaussian_splatting"] } },
      geometricError,
      root: {
        boundingVolume: box(0.5, 0.5), geometricError, refine: additive ? "ADD" : "REPLACE", ...(includeParent ? { content: { uri: "parent.glb" } } : {}),
        children: childNames.map((name, i) => ({ boundingVolume: box((i + 0.5) / totalChildren, 0.5 / totalChildren), geometricError: 0, content: { uri: name } })),
      },
    };
    const name = `GaussianValidation${++run}`;
    bytes.set("tileset.json", new TextEncoder().encode(JSON.stringify(tileset)));
    const key: RealityDataSourceKey = { provider: name, format: "ThreeDTile", id: "offline" };
    const source: RealityDataSource = {
      key, isContextShare: false, realityDataId: undefined, realityData: undefined, realityDataType: "ThreeDTile",
      usesGeometricError: true, maximumScreenSpaceError: 16,
      getServiceUrl: async () => undefined, getSpatialLocationAndExtents: async () => undefined, getPublisherProductInfo: async () => undefined,
      getTileContentType: () => "tile", getRootDocument: async () => tileset, getTileJson: async () => tileset,
      getTileContent: async (id) => {
        const content = bytes.get(id);
        if (!content)
          throw new Error(`Unknown offline content ${id}`);
        return content.slice().buffer;
      },
    };
    IModelApp.realityDataSourceProviders.register(name, { createRealityDataSource: async () => source });
    ref = createRealityTileTreeReference({ iModel: imodel, source: viewport.displayStyle, rdSourceKey: key,
      modelId: imodel.transientIds.getNext(), getDisplaySettings: () => viewport.displayStyle.settings.realityModelDisplay });
    provider = { forEachTileTreeRef: (_vp, callback) => { if (visible) callback(ref); }, getReferences: () => visible ? [ref] : [] };
    viewport.addTiledGraphicsProvider(provider);
    const tree = await ref.treeOwner.loadTree() as RealityModelTileTree;
    expect(tree).toBeDefined();
    root = tree.rootTile;
    // Selection requests the native child metadata; the normal Tile callback attaches the children.
    await draw(0.6);
    await expect.poll(() => root.realityChildren, { timeout: 5000 }).toHaveLength(totalChildren);
    children = root.realityChildren!;
    const tiles = [root, ...children];
    contents = await Promise.all(tiles.map((tile) => tile.contentUrl ? tree.loader.loadTileContent(tile, bytes.get(tile.contentUrl)!.slice(), System.instance, () => false) : {}));
    expect(children.every((tile) => !tile.isReady)).toBe(true);
    vi.spyOn(GaussianSplatWorker.prototype, "register").mockImplementation(async (id, values) => { positions.set(id, values.slice()); });
    vi.spyOn(GaussianSplatWorker.prototype, "release").mockImplementation(async (ids) => { ids.forEach((id) => positions.delete(id)); });
    vi.spyOn(GaussianSplatWorker.prototype, "sort").mockImplementation(async (request: GaussianSplatSortRequest) => {
      let result = sortGaussianSplats(request, positions);
      if (sourceOrder) {
        const pairs: number[] = [];
        request.tiles.forEach((tile, t) => {
          for (let i = 0; i < tile.count; i++)
            pairs.push(tile.pages[Math.floor(i / gaussianSplatsPerPage)] * gaussianSplatsPerPage + i % gaussianSplatsPerPage, t);
        });
        result = new Uint32Array(pairs);
      }
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return new Promise<Uint32Array>((resolve) => pending.push({ due: frame + delay + (delay ? seed % 3 : 0), result, resolve }));
    });
    if (includeParent) {
      root.setContent(contents[0]);
    }
    if (!includeParent || additive) {
      for (let i = 0; i < initialChildren; i++)
        children[i].setContent(contents[i + 1]);
    }
    for (let i = 0; i < 5; i++)
      await draw(1.4);
    recorder = new GaussianSplatValidationRecorder(viewport, "offline REPLACE tileset · seed 0 · native continuous zoom", "visual");
    recorder.expectedVisible = true;
    recorder.probes = patches.map((point, index) => ({ name: `overlap-${index}`, point: point.toJSON(), rgb: [41, 0, 204], tolerance: 12 }));
  }

  beforeEach(async () => initialize());

  async function cleanup(): Promise<void> {
    recorder?.stop();
    // Release preparation-only graphics if a route did not deliver them into the native tree.
    for (let i = 1; i < contents.length; i++)
      if (!children[i - 1].isReady)
        contents[i].graphic?.[Symbol.dispose]();
    viewport.dropTiledGraphicsProvider(provider);
    IModelApp.viewManager.dropViewport(viewport, false);
    viewport[Symbol.dispose]();
    ref.treeOwner.tileTree?.[Symbol.dispose]();
    ref.detachLayerListeners();
    div.remove();
    pending.splice(0).forEach((task) => task.resolve(task.result));
    await microtasks();
    vi.restoreAllMocks();
    expect(getGaussianSplatAtlas().numPages).toBe(0);
  }

  afterEach(cleanup);

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  async function save(trace: GaussianSplatValidationTrace, name: string, expectedFailure = false): Promise<void> {
    const unexpected = !expectedFailure && (trace.issues.some((issue) => issue.severity === "failure")
      || ((name === "offline" || name === "staggered") && trace.summary.fidelity !== "observed-refinement"));
    if (!ITWIN_GAUSSIAN_VALIDATION_ENABLED && !unexpected)
      return;
    trace.configuration.label = `offline ${name} · deterministic native tile/sort schedule · seed 0`;
    trace.configuration.contentHashes = await Promise.all([...bytes].map(async ([id, content]) => {
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", content));
      return { name: id, sha256: [...hash].map((b) => b.toString(16).padStart(2, "0")).join("") };
    }));
    trace.configuration.replay = { seed: 0, sortDelayFrames: delay, staggeredChildren: name === "staggered" };
    await commands.writeFile(`lib/gaussian-validation-${name}.json`, JSON.stringify(trace, undefined, 2));
    await commands.writeFile(`lib/gaussian-validation-${name}.html`, gaussianSplatValidationHtml(trace));
  }

  async function zoomRoute(stagger = false, checkPicks = false): Promise<GaussianSplatValidationTrace> {
    delay = 4;
    const picks: NonNullable<GaussianSplatValidationTrace["pickEvidence"]> = [];
    for (let i = 0; i < 40; i++) {
      if (i === 5) {
        children[0].setContent(contents[1]);
        if (!stagger)
          children[1].setContent(contents[2]);
      }
      if (stagger && i === 8)
        children[1].setContent(contents[2]);
      // Inward, pause near, outward, pause far; 40 continuously drawn frames with no settled waits.
      const extent = i < 8 ? 1.4 - i * 0.1 : i < 25 ? 0.6 : i < 33 ? 0.6 + (i - 25) * 0.1 : 1.4;
      await draw(extent);
      if (checkPicks) {
        const point = viewport.worldToNpc(patches[0]);
        const x = Math.floor(point.x * viewport.viewRect.width), y = Math.floor((1 - point.y) * viewport.viewRect.height);
        const evidence: (typeof picks)[number] = { frame: recorder.frames.length - 1 };
        viewport.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (buffer) => {
          const pixel = buffer?.getPixel(x, y);
          evidence.modelId = pixel?.modelId;
          evidence.elementId = pixel?.elementId;
        });
        picks.push(evidence);
        if (evidence.modelId !== ref.modelId)
          recorder.issues.push({ frame: evidence.frame, severity: "failure", code: "pick-mismatch", detail: "Known-visible fixture did not produce its native model pick ID" });
      }
    }
    const trace = recorder.trace();
    trace.pickEvidence = picks;
    return trace;
  }

  it.each([false, true])("keeps every frame blended and pickable through real native refinement (staggered=%s)", async (stagger) => {
    const trace = await zoomRoute(stagger, true);
    await save(trace, stagger ? "staggered" : "offline");
    expect(trace.summary.nativeFrames).toBe(40);
    expect(trace.summary.pendingCandidateFrames).toBeGreaterThan(2);
    expect(trace.summary.completedSelections).toBeGreaterThan(1);
    expect(trace.summary.deepestSelectedTile).toBeGreaterThan(0);
    expect(trace.summary.settledReplacementFrames).toBeGreaterThan(2);
    expect(trace.summary.fidelity).toBe("observed-refinement");
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
    expect(trace.frames.some((f) => f.selected.length === 2 && f.draw?.drawnGeometryIds.length === 2 && !f.draw.awaitingCandidate)).toBe(true);
    const point = viewport.worldToNpc(patches[0]);
    const x = Math.floor(point.x * viewport.viewRect.width), y = Math.floor((1 - point.y) * viewport.viewRect.height);
    let model: string | undefined;
    viewport.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (buffer) => { model = buffer?.getPixel(x, y).modelId; });
    expect(model).toBe(ref.modelId);
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it.each([true, false])("retains native coverage after eviction until every replacement region is ready and sorted (parent content=%s)", async (includeParent) => {
    if (!includeParent) {
      await cleanup();
      await initialize(false);
    }
    delay = 2;
    children[0].setContent(contents[1]);
    children[1].setContent(contents[2]);
    for (let i = 0; i < 10; i++)
      await draw(0.6);
    const completed = recorder.frames.at(-1)!.draw!.completedGeometryIds;
    expect(completed).toHaveLength(2);

    // Evict all native fallback content, then return only one newly decoded child.
    // The retained completed field has both world patches, whereas this sorted subset cannot.
    const tree = ref.treeOwner.tileTree! as RealityModelTileTree;
    const tiles = [root, ...children];
    tiles.forEach((tile) => tile.disposeContents());
    contents = await Promise.all(tiles.map((tile) => tile.contentUrl ? tree.loader.loadTileContent(tile, bytes.get(tile.contentUrl)!.slice(), System.instance, () => false) : {}));
    children[0].setContent(contents[1]);
    const partialStart = recorder.frames.length;
    const picks: NonNullable<GaussianSplatValidationTrace["pickEvidence"]> = [];
    for (let i = 0; i < 12; i++) {
      await draw(0.6);
      for (const patch of patches) {
        const point = viewport.worldToNpc(patch);
        const x = Math.floor(point.x * viewport.viewRect.width), y = Math.floor((1 - point.y) * viewport.viewRect.height);
        const evidence: (typeof picks)[number] = { frame: recorder.frames.length - 1 };
        viewport.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (buffer) => {
          const pixel = buffer?.getPixel(x, y);
          evidence.modelId = pixel?.modelId;
          evidence.elementId = pixel?.elementId;
        });
        picks.push(evidence);
        if (evidence.modelId !== ref.modelId)
          recorder.issues.push({ frame: evidence.frame, severity: "failure", code: "pick-mismatch", detail: "Evicted world patch lost its retained native model pick" });
      }
    }
    const partialEnd = recorder.frames.length;
    if (includeParent)
      root.setContent(contents[0]);
    children[1].setContent(contents[2]);
    for (let i = 0; i < 12; i++)
      await draw(0.6);

    const trace = recorder.trace();
    trace.pickEvidence = picks;
    await save(trace, includeParent ? "eviction" : "structural-eviction");
    const partial = trace.frames.slice(partialStart, partialEnd);
    expect(partial.every((f) => f.draw?.selectedGeometryIds.length === 1)).toBe(true);
    expect(partial.every((f) => f.draw?.awaitingCoverage === true)).toBe(true);
    expect(partial.every((f) => JSON.stringify(f.draw?.completedGeometryIds) === JSON.stringify(completed))).toBe(true);
    expect(partial.some((f) => f.draw?.sorting === false && f.draw.awaitingCandidate)).toBe(true);
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
    const last = trace.frames.at(-1)!.draw!;
    expect(last.completedGeometryIds).toHaveLength(2);
    expect(last.completedGeometryIds.some((id) => completed.includes(id))).toBe(false);
    expect(last.awaitingCandidate).toBe(false);
  });

  it("continues progressive initial loading before its first complete native selection", async () => {
    await cleanup();
    await initialize(false, 3, 1);
    delay = 2;
    recorder.probes = [{ name: "first patch", point: patches[0].toJSON(), rgb: [41, 0, 204], tolerance: 12 }];
    const first = recorder.frames.length;
    children[1].setContent(contents[2]);
    for (let i = 0; i < 12; i++)
      await draw(1.4);
    expect(recorder.frames.at(-1)!.draw!.completedGeometryIds).toHaveLength(2);
    expect(recorder.frames.slice(first).every((f) => !f.draw?.awaitingCoverage)).toBe(true);
    children[2].setContent(contents[3]);
    for (let i = 0; i < 12; i++)
      await draw(1.4);
    recorder.probes = patches.map((point, i) => ({ name: `complete-${i}`, point: point.toJSON(), rgb: [41, 0, 204], tolerance: 12 }));
    await draw(1.4);
    const trace = recorder.trace();
    await save(trace, "progressive");
    expect(trace.frames.at(-1)!.draw!.completedGeometryIds).toHaveLength(3);
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
  });

  it("accepts complete ready-child fallback coverage while desired parent content is missing", async () => {
    delay = 2;
    root.disposeContents();
    children[0].setContent(contents[1]);
    children[1].setContent(contents[2]);
    for (let i = 0; i < 12; i++)
      await draw(1.4);
    const trace = recorder.trace();
    await save(trace, "child-fallback");
    expect(root.isReady).toBe(false);
    expect(trace.frames.at(-1)!.draw!.completedGeometryIds).toHaveLength(2);
    expect(trace.frames.every((f) => !f.draw?.awaitingCoverage)).toBe(true);
    expect(trace.frames.at(-1)!.draw!.awaitingCandidate).toBe(false);
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
  });

  it.each(["child", "parent"])("retains all required ADD coverage when its %s is evicted", async (evicted) => {
    await cleanup();
    await initialize(true, 2, 2, true);
    delay = 2;
    // The far view legitimately selects only the additive parent. Establish the full
    // near selection before starting the known-visible three-patch eviction oracle.
    recorder.stop();
    for (let i = 0; i < 8; i++)
      await draw(0.6);
    recorder = new GaussianSplatValidationRecorder(viewport, "offline ADD eviction", "visual");
    recorder.expectedVisible = true;
    recorder.probes = patches.map((point, i) => ({ name: `ADD region ${i}`, point: point.toJSON(), rgb: [41, 0, 204], tolerance: 12 }));
    await draw(0.6);
    const complete = recorder.frames.at(-1)!.draw!.completedGeometryIds;
    expect(complete).toHaveLength(3);
    const tile = evicted === "child" ? children[0] : root;
    const contentIndex = evicted === "child" ? 1 : 0;
    tile.disposeContents();
    const tree = ref.treeOwner.tileTree! as RealityModelTileTree;
    contents[contentIndex] = await tree.loader.loadTileContent(tile, bytes.get(tile.contentUrl!)!.slice(), System.instance, () => false);
    const start = recorder.frames.length;
    for (let i = 0; i < 12; i++)
      await draw(0.6);
    const incomplete = recorder.frames.slice(start);
    tile.setContent(contents[contentIndex]);
    for (let i = 0; i < 12; i++)
      await draw(0.6);
    const trace = recorder.trace();
    await save(trace, `additive-${evicted}-eviction`);
    expect(root.isReady).toBe(true);
    expect(incomplete.every((f) => f.draw?.awaitingCoverage && !f.draw.coverageComplete)).toBe(true);
    expect(incomplete.every((f) => JSON.stringify(f.draw?.completedGeometryIds) === JSON.stringify(complete))).toBe(true);
    expect(trace.frames.at(-1)!.draw!.completedGeometryIds).toHaveLength(3);
    expect(trace.frames.at(-1)!.draw!.coverageComplete).toBe(true);
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
  });

  it("accepts camera-only sorts for the completed field while a newly visible region is missing", async () => {
    await cleanup();
    await initialize(false, 3, 2);
    delay = 2;
    // Both loaded children cover this frustum. The third child is wholly outside it.
    viewport.view.setOrigin(new Point3d(0, -0.2, 0));
    viewport.view.setExtents(new Vector3d(0.6, 1.4, 1));
    viewport.setupFromView();
    recorder.probes = [];
    for (let i = 0; i < 8; i++)
      await draw();
    expect(recorder.frames.at(-1)!.draw!.awaitingCoverage).toBe(false);
    const complete = recorder.frames.at(-1)!.draw!.completedGeometryIds;
    expect(complete).toHaveLength(2);

    // Look from below: red is now nearer. The wide frustum also requires the missing third child.
    expect((viewport.view as SpatialViewState).lookAt({ eyePoint: new Point3d(0.5, 0.5, -3), targetPoint: new Point3d(0.5, 0.5, 0.5),
      upVector: Vector3d.unitY(), lensAngle: Angle.createDegrees(50), frontDistance: 0.1, backDistance: 10 })).toBe(ViewStatus.Success);
    expect(viewport.setupFromView()).toBe(ViewStatus.Success);
    for (let i = 0; i < 12; i++)
      await draw();
    recorder.probes = [{ name: "reordered center patch", point: patches[1].toJSON(), rgb: [204, 0, 41], tolerance: 12 }];
    await draw();
    const trace = recorder.trace();
    await save(trace, "camera-during-coverage-wait");
    const last = trace.frames.at(-1)!.draw!;
    expect(last.completedGeometryIds).toEqual(complete);
    expect(last.selectedGeometryIds).toEqual(complete);
    expect(last.awaitingCoverage).toBe(true);
    expect(children[2].isReady).toBe(false);
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
  });

  it("detects a sorted partial-coverage handoff despite nonzero native submissions", async () => {
    delay = 2;
    root.disposeContents();
    children[0].setContent(contents[1]);
    const prototype = GaussianSplatRenderer.prototype as unknown as { prepare: (...args: unknown[]) => unknown, _completed: Array<{ coverageComplete: boolean }> };
    const prepare = prototype.prepare;
    const omitCoverage = vi.spyOn(prototype, "prepare").mockImplementation(function (this: typeof prototype, ...args) {
      this._completed.forEach((tile) => tile.coverageComplete = false);
      return prepare.apply(this, args);
    });
    for (let i = 0; i < 12; i++)
      await draw(0.6);
    omitCoverage.mockRestore();
    const trace = recorder.trace();
    await save(trace, "partial-coverage", true);
    expect(trace.frames.every((f) => (f.draw?.drawnInstances ?? 0) > 0)).toBe(true);
    expect(trace.frames.some((f) => f.draw?.drawnGeometryIds.length === 1 && f.draw.drawnInstances === 2)).toBe(true);
    expect(trace.issues.some((issue) => issue.code === "pixel-mismatch")).toBe(true);
    expect(trace.summary.continuity).toBe("fail");
  });

  it("detects a dropped native submission independently of pixel mismatch", async () => {
    await draw(1.4);
    const drawInstances = vi.spyOn(GaussianSplatRenderer.prototype as unknown as { drawInstances: (...args: unknown[]) => void }, "drawInstances").mockImplementationOnce(() => undefined);
    await draw(1.4);
    drawInstances.mockRestore();
    await draw(1.4);
    const trace = recorder.trace();
    await save(trace, "dropped-draw", true);
    expect(trace.frames[1].draw?.drawCalls).toBe(0);
    expect(trace.frames[1].draw?.drawnInstances).toBe(0);
    expect(trace.issues.some((issue) => issue.frame === 1 && issue.code === "missing-field")).toBe(true);
    expect(trace.issues.some((issue) => issue.frame === 1 && issue.code === "pixel-mismatch")).toBe(true);
    expect(trace.frames[2].draw?.drawnInstances).toBe(4);
    expect(trace.summary.continuity).toBe("fail");
  });

  it("detects source-order flashes even with nonzero draw counts", async () => {
    sourceOrder = true;
    const trace = await zoomRoute();
    await save(trace, "source-order", true);
    expect(trace.frames.every((f) => (f.draw?.drawnInstances ?? 0) > 0)).toBe(true);
    expect(trace.issues.some((issue) => issue.code === "pixel-mismatch")).toBe(true);
    expect(trace.summary.continuity).toBe("fail");
  });

  it("detects prematurely retired completed content while its replacement sorts", async () => {
    delay = 8;
    await draw(1.4);
    children[0].setContent(contents[1]);
    children[1].setContent(contents[2]);
    await draw(0.6);
    const prototype = GaussianSplatRenderer.prototype as unknown as { completedTiles: () => unknown[], releaseCompleted: () => void };
    const retire = vi.spyOn(prototype, "completedTiles").mockImplementationOnce(function (this: typeof prototype) {
      this.releaseCompleted();
      return [];
    });
    await draw(0.6);
    retire.mockRestore();
    const trace = recorder.trace();
    await save(trace, "premature-retirement", true);
    expect(trace.frames[2].draw?.awaitingCandidate).toBe(true);
    expect(trace.issues.some((issue) => issue.frame === 2 && issue.code === "missing-field")).toBe(true);
    expect(trace.issues.some((issue) => issue.frame === 2 && issue.code === "pixel-mismatch")).toBe(true);
    expect(trace.summary.continuity).toBe("fail");
  });

  it("keeps evidence around late failures after earlier milestones and later clean frames", async () => {
    await zoomRoute();
    const failure = recorder.frames.length;
    vi.spyOn(GaussianSplatRenderer.prototype as unknown as { drawInstances: (...args: unknown[]) => void }, "drawInstances").mockImplementationOnce(() => undefined);
    await draw(1.4);
    for (let i = 0; i < 20; i++)
      await draw(1.4);
    const trace = recorder.trace();
    await save(trace, "failure-window", true);
    expect(trace.issues.some((issue) => issue.frame === failure && issue.code === "missing-field")).toBe(true);
    for (let i = failure - 2; i <= failure + 2; i++)
      expect(trace.images.some((image) => image.frame === i)).toBe(true);
  });

  it("does not claim fidelity from selected children that never complete", async () => {
    delay = 20;
    await draw(1.4);
    children[0].setContent(contents[1]);
    children[1].setContent(contents[2]);
    for (let i = 0; i < 4; i++)
      await draw(0.6);
    for (let i = 0; i < 25; i++)
      await draw(1.4);
    const trace = recorder.trace();
    expect(trace.summary.deepestSelectedTile).toBeGreaterThan(0);
    expect(trace.summary.continuity).toBe("pass");
    expect(trace.summary.fidelity).toBe("unverified");
  });

  it("measures input until a native render and keeps timing free of GPU readbacks", async () => {
    recorder.stop();
    recorder = new GaussianSplatValidationRecorder(viewport, "offline native input timing", "timing");
    const readback = vi.spyOn(viewport, "readImageBuffer");
    viewport.parentDiv.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(recorder.trace().timings.inputToNextFrameMs).toHaveLength(0);
    expect(recorder.trace().timings.pendingInputs).toBe(1);
    await draw(1.4);
    expect(recorder.trace().timings.inputToNextFrameMs).toHaveLength(1);
    expect(recorder.trace().timings.pendingInputs).toBe(0);
    expect(readback).not.toHaveBeenCalled();
    recorder.stop();
    viewport.parentDiv.dispatchEvent(new WheelEvent("wheel", { deltaY: 10 }));
    await draw(1.4);
    expect(recorder.trace().summary.nativeFrames).toBe(1);
    expect(recorder.trace().timings.pendingInputs).toBe(0);
  });

  it("does not fail intentional hiding, clipping, and camera movement", async () => {
    await draw(1.4);
    recorder.expectedVisible = false;
    recorder.probes = [];
    visible = false;
    await draw(1.4);
    visible = true;
    const shape = ClipShape.createShape([new Point3d(2, 2), new Point3d(3, 2), new Point3d(3, 3), new Point3d(2, 3), new Point3d(2, 2)])!;
    viewport.view.setViewClip(ClipVector.create([shape]));
    viewport.viewFlags = viewport.viewFlags.with("clipVolume", true);
    viewport.invalidateRenderPlan();
    await draw(1.4);
    viewport.view.setViewClip(undefined);
    viewport.view.setOrigin(new Point3d(4, 4, 0));
    viewport.setupFromView();
    await draw();
    for (let i = 0; i < 5; i++)
      await draw(1.4);
    recorder.expectedVisible = true;
    recorder.probes = patches.map((point, index) => ({ name: `returned-${index}`, point: point.toJSON(), rgb: [41, 0, 204], tolerance: 12 }));
    await draw(1.4);
    const trace = recorder.trace();
    await save(trace, "negative-controls");
    expect(trace.issues.filter((issue) => issue.severity === "failure")).toEqual([]);
    expect(trace.summary.continuity).toBe("pass");
  });
});
