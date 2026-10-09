/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Angle, ClipShape, ClipVector, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, Feature, FeatureTable, RealityDataProvider, RenderMode, RenderSchedule } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { SpatialViewState } from "../../../SpatialViewState";
import { ScreenViewport } from "../../../Viewport";
import { DecorateContext } from "../../../ViewContext";
import { ViewStatus } from "../../../ViewStatus";
import { GraphicType } from "../../../common/render/GraphicType";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { Pixel } from "../../../render/Pixel";
import { ViewRect } from "../../../common/ViewRect";
import { GltfGraphicsReader, GltfReaderProps, readGltf, readGltfGraphics, RealityModelTileTreeProps, tileTreeReferenceFromRenderGraphic } from "../../../tile/internal";
import { TiledGraphicsProvider } from "../../../tile/TiledGraphicsProvider";
import { RealityDataSourceTilesetUrlImpl } from "../../../RealityDataSourceTilesetUrlImpl";
import { NullRenderSystem } from "../../../NoRenderApp";
import { getGaussianSplatAtlas } from "../../../internal/render/webgl/GaussianSplatAtlas";
import { GaussianSplatGeometry } from "../../../internal/render/webgl/GaussianSplatGeometry";
import { Batch, Branch } from "../../../internal/render/webgl/Graphic";
import { packGaussianSplats } from "../../../internal/render/GaussianSplatData";
import { observeGaussianSplats } from "../../../internal/render/GaussianSplatDiagnostics";
import { GaussianSplatWorker } from "../../../internal/render/GaussianSplatWorker";
import { System } from "../../../internal/render/webgl/System";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator, TestDecorator } from "../../TestDecorators";
import { gaussianSplatFixture, gaussianSplatGlb } from "../GaussianSplatFixtures";

describe("Native Gaussian splats", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport;
  let div: HTMLDivElement;
  const graphics: RenderGraphic[] = [];

  class Splats extends TestDecorator {
    private readonly _graphic: RenderGraphic;
    public constructor(graphic: RenderGraphic) {
      super();
      this._graphic = IModelApp.renderSystem.createGraphicOwner(graphic);
      IModelApp.viewManager.addDecorator(this);
    }

    public decorate(context: DecorateContext): void {
      context.addDecoration(GraphicType.Scene, this._graphic);
    }
  }

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true } });
    imodel = createBlankConnection();
  });
  beforeEach(() => {
    div = document.createElement("div");
    div.style.width = div.style.height = "64px";
    document.body.appendChild(div);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    view.viewFlags = view.viewFlags.copy({ acsTriad: false, grid: false, lighting: false, renderMode: RenderMode.SmoothShade });
    viewport = ScreenViewport.create(div, view);
    IModelApp.viewManager.addViewport(viewport);
    viewport.renderFrame();
  });
  afterEach(() => {
    TestDecorator.dropAll();
    IModelApp.viewManager.dropViewport(viewport, false);
    viewport[Symbol.dispose]();
    for (const graphic of graphics)
      graphic[Symbol.dispose]();

    graphics.length = 0;
    div.remove();
  });
  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  async function addSplat(options: { id?: string, modelId?: string, opacity?: number, depth?: number, xFraction?: number, linear?: boolean, blue?: boolean, red?: number, decorate?: boolean, center?: Point3d, scale?: number } = {}): Promise<RenderGraphic> {
    const source = gaussianSplatFixture();
    const center = options.center ?? viewport.npcToWorld(new Point3d(options.xFraction ?? 0.5, 0.5, options.depth ?? 0.5));
    source.positions.set([center.x, center.z, -center.y]); // inverse of glTF y-up -> iModel z-up
    source.scales.fill(options.scale ?? 0.08);
    source.opacities.fill(options.opacity ?? 0.8);
    if (options.red !== undefined)
      source.sh[0] = (options.red - 0.5)/0.2820947917738781;
    if (options.linear) {
      source.colorSpace = "lin_rec709_display";
      source.sh.set([-0.25/0.2820947917738781, -0.5/0.2820947917738781, -0.5/0.2820947917738781]);
    }
    if (options.blue)
      source.sh.set([-0.5/0.2820947917738781, -0.5/0.2820947917738781, 0.5/0.2820947917738781]);

    const graphic = await readGltfGraphics({ gltf: gaussianSplatGlb(source), iModel: imodel, pickableOptions: { id: options.id ?? "0x123", modelId: options.modelId } });
    expect(graphic).toBeDefined();
    graphics.push(graphic!);
    if (options.decorate !== false)
      new Splats(graphic!);
    viewport.invalidateScene();
    return graphic!;
  }

  function color(xFraction = 0.5): number[] {
    viewport.requestRedraw();
    viewport.renderFrame();
    const x = Math.floor(viewport.viewRect.width * xFraction), y = Math.floor(viewport.viewRect.height / 2);
    const image = viewport.readImageBuffer({ rect: new ViewRect(x, y, x + 1, y + 1) })!;
    expect(image).toBeDefined();
    return Array.from(image.data.subarray(0, 3));
  }

  function pick(xFraction = 0.5, yFraction = 0.5): string | undefined {
    viewport.renderFrame();
    const x = Math.floor(viewport.viewRect.width * xFraction), y = Math.floor(viewport.viewRect.height * yFraction);
    let id: string | undefined;
    viewport.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (buffer) => { id = buffer?.getPixel(x, y).feature?.elementId; });
    return id;
  }

  function deferSort() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    // The original method is invoked below with its worker receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const sort = GaussianSplatWorker.prototype.sort;
    const pending = vi.spyOn(GaussianSplatWorker.prototype, "sort");
    pending.mockImplementation(async function (this: GaussianSplatWorker, request) {
      const instances = await sort.call(this, request);
      await gate;
      return instances;
    });
    return {
      pending,
      resume: async () => {
        const tasks = pending.mock.results.map((result) => result.value);
        pending.mockRestore();
        release();
        await Promise.all(tasks);
      },
    };
  }

  it("draws an ellipse in an orthographic view and writes native model pick IDs", async () => {
    await addSplat();
    expect(color()[0]).toBeGreaterThan(150);
    expect(color().slice(1)).toEqual([0,0]);
    expect(pick()).toBe("0x123");
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("projects and picks in a perspective view", async () => {
    expect((viewport.view as SpatialViewState).lookAt({ eyePoint: new Point3d(0.5, 0.5, 3), targetPoint: new Point3d(0.5, 0.5, 0.5), upVector: Vector3d.unitY(), frontDistance: 0.1, backDistance: 10 })).toBe(ViewStatus.Success);
    expect(viewport.setupFromView()).toBe(ViewStatus.Success);
    viewport.renderFrame();
    await addSplat();
    expect(color()[0]).toBeGreaterThan(150);
    expect(pick()).toBe("0x123");
  });

  it("rejects off-screen splats near the camera in color and pick passes", async () => {
    expect((viewport.view as SpatialViewState).lookAt({ eyePoint: new Point3d(0.5, 0.5, 3), targetPoint: new Point3d(0.5, 0.5, 0.5), upVector: Vector3d.unitY(), frontDistance: 0.1, backDistance: 10 })).toBe(ViewStatus.Success);
    viewport.setupFromView();
    viewport.renderFrame();
    await addSplat({ blue: true });
    const background = color();
    expect(pick()).toBe("0x123");
    // The center is far to the side, but its depth variance produces a huge
    // projected ellipse that used to cover (and be picked across) the view.
    await addSplat({ id: "0x456", center: new Point3d(2, 0.5, 2.8), scale: 1 });
    let submitted = 0;
    const stop = observeGaussianSplats(viewport.target, (frame) => submitted = frame.drawnInstances);
    try {
      await expect.poll(() => { color(); return submitted; }, { timeout: 5000 }).toBe(2);
      expect(color()).toEqual(background);
      expect(pick()).toBe("0x123");
    } finally {
      stop();
    }
  });

  it("bounds oversized projected splats in color and pick passes", async () => {
    div.style.position = "relative";
    div.style.width = "1200px";
    viewport.renderFrame();
    await addSplat({ scale: 100 });
    expect(color()[0]).toBeGreaterThan(150);
    expect(pick()).toBe("0x123");
    // Beyond the 512-pixel semi-axis limit, neither color nor picking may
    // receive the splat even though its unbounded projection fills the view.
    expect(viewport.viewRect.width).toBe(1200);
    expect(color(0.99)).toEqual([0, 0, 0]);
    expect(pick(0.99)).toBeUndefined();
  });

  it("loads, draws and picks Cesium's official compressed degree-three fixture", async () => {
    const gltf = new Uint8Array(await (await fetch("/GaussianSplats/cesium-cube.glb")).arrayBuffer());
    const result = await readGltf({ gltf, iModel: imodel, pickableOptions: { id: "0x456" } });
    expect(result).toBeDefined();
    const bounds = Range3d.fromJSON(result!.boundingBox);
    const center = bounds.center;
    expect(center.isAlmostEqual(new Point3d(50, -50, -50))).toBe(true);
    expect((viewport.view as SpatialViewState).lookAt({ eyePoint: center.plusScaled(Vector3d.unitY(), bounds.diagonal().magnitude() * 2), targetPoint: center, upVector: Vector3d.unitZ(), lensAngle: Angle.createDegrees(50), frontDistance: 1, backDistance: 1000 })).toBe(ViewStatus.Success);
    expect(viewport.setupFromView()).toBe(ViewStatus.Success);
    graphics.push(result!.graphic);
    new Splats(result!.graphic);
    viewport.invalidateScene();
    await expect.poll(() => color().some((channel) => channel > 10), { timeout: 5000 }).toBe(true);
    expect(pick()).toBe("0x456");
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("computes native world bounds for transformed Gaussian graphics", async () => {
    const source = gaussianSplatFixture();
    source.positions.set([1, 2, 3]);
    const props = GltfReaderProps.create(gaussianSplatGlb(source), true)!;
    props.glTF.nodes![0]!.translation = [4, 5, 6];
    const reader = new GltfGraphicsReader(props, { gltf: props.glTF, iModel: imodel, transform: Transform.createTranslationXYZ(10, 20, 30) });
    const result = await reader.read();
    expect(result.graphic).toBeDefined();
    graphics.push(result.graphic!);
    expect(Range3d.fromJSON(result.range).center.isAlmostEqual(new Point3d(15, 11, 37))).toBe(true);
    expect(Range3d.fromJSON(result.contentRange).center.isAlmostEqual(new Point3d(5, 7, 9))).toBe(true);
  });

  it("requires opt-in and cancels loading before committing geometry", async () => {
    const gltf = gaussianSplatGlb();
    const props = GltfReaderProps.create(gltf, true)!;
    const disabled = new GltfGraphicsReader(props, { gltf, iModel: imodel, system: new NullRenderSystem() });
    await expect(disabled.read()).rejects.toThrow(/disabled/);
    const canceled = new GltfGraphicsReader(props, { gltf, iModel: imodel, shouldAbort: () => true });
    expect((await canceled.read()).graphic).toBeUndefined();
  });

  it("resolves a relative external buffer through the supplied reality-data transport", async () => {
    const props = GltfReaderProps.create(gaussianSplatGlb(), true)!;
    const buffer = props.binaryData!;
    props.glTF.buffers![0]!.uri = "../content/splats.bin";
    const external = GltfReaderProps.create(props.glTF, true)!;
    let resource: string | undefined;
    const reader = new GltfGraphicsReader(external, { gltf: props.glTF, iModel: imodel, resolveBuffer: async (uri) => { resource = uri; return buffer; } });
    const result = await reader.read();
    expect(resource).toBe("../content/splats.bin");
    expect(result.graphic).toBeDefined();
    graphics.push(result.graphic!);
  });

  it("reports failed external-buffer transport instead of suppressing the cause", async () => {
    const props = GltfReaderProps.create(gaussianSplatGlb(), true)!;
    props.glTF.buffers![0]!.uri = "splats.bin";
    const external = GltfReaderProps.create(props.glTF, true)!;
    const reader = new GltfGraphicsReader(external, { gltf: props.glTF, iModel: imodel, resolveBuffer: async () => { throw new Error("Fixture HTTP 403"); } });
    await expect(reader.read()).rejects.toThrow("Fixture HTTP 403");
  });

  it("diagnoses unsupported declared splat tile layouts without changing ordinary trees", async () => {
    const source = await RealityDataSourceTilesetUrlImpl.createFromKey({ provider: RealityDataProvider.TilesetUrl, format: "", id: "https://example.com/tileset.json" }, undefined);
    expect(source).toBeDefined();
    const json = { asset: { version: "1.1" }, root: { boundingVolume: { sphere: [0,0,0,1] }, geometricError: 0, children: [{ contents: [{ uri: "tile.glb" }] }] } };
    expect(() => new RealityModelTileTreeProps(json, json.root, source!, Transform.createIdentity())).not.toThrow();
    const splats = { ...json, extensions: { "3DTILES_content_gltf": { extensionsRequired: ["KHR_gaussian_splatting"] } } };
    expect(() => new RealityModelTileTreeProps(splats, splats.root, source!, Transform.createIdentity())).toThrow(/multiple contents/);
    const implicit = { ...splats, root: { ...json.root, children: [], implicitTiling: {} } };
    expect(() => new RealityModelTileTreeProps(implicit, implicit.root, source!, Transform.createIdentity())).toThrow(/implicit tiling/);
  });

  it("shares GPU pages across views and shrinks resident capacity after refinement", () => {
    const atlas = getGaussianSplatAtlas();
    const a = {}, b = {};
    const geometry = new GaussianSplatGeometry(packGaussianSplats(gaussianSplatFixture()));
    const others = Array.from({ length: 4 }, () => new GaussianSplatGeometry(packGaussianSplats(gaussianSplatFixture())));
    try {
      atlas.update(a, [geometry, ...others]);
      atlas.update(b, [geometry]);
      expect(atlas.numPages).toBe(5);
      const capacity = atlas.bytesUsed;
      atlas.update(a, []);
      expect(atlas.numPages).toBe(1);
      expect(atlas.bytesUsed).toBeLessThan(capacity);
      atlas.release(a);
      expect(atlas.texture).toBeDefined();
      atlas.release(b);
      expect(atlas.texture).toBeUndefined();
      expect(atlas.bytesUsed).toBe(0);
    } finally {
      atlas.release(a); atlas.release(b);
      geometry[Symbol.dispose]();
      for (const other of others)
        other[Symbol.dispose]();
    }
  });

  it("keeps a working viewport's atlas when another allocation fails, then retries", async () => {
    await addSplat();
    expect(color()[0]).toBeGreaterThan(150);
    const atlas = getGaussianSplatAtlas();
    const texture = atlas.texture;
    const bytes = atlas.bytesUsed;
    const pages = atlas.numPages;
    const user = {};
    const others = Array.from({ length: 2 }, () => new GaussianSplatGeometry(packGaussianSplats(gaussianSplatFixture())));
    const gl = System.instance.context;
    const error = vi.spyOn(gl, "getError").mockReturnValueOnce(gl.OUT_OF_MEMORY);
    try {
      expect(() => atlas.update(user, others)).toThrow(/GPU atlas allocation failed/);
      error.mockRestore();
      expect(atlas.texture).toBe(texture);
      expect(atlas.bytesUsed).toBe(bytes);
      expect(atlas.numPages).toBe(pages);
      viewport.requestRedraw();
      expect(color()[0]).toBeGreaterThan(150);
      atlas.update(user, others);
      expect(atlas.numPages).toBe(pages + others.length);
      viewport.requestRedraw();
      expect(color()[0]).toBeGreaterThan(150);
      expect(gl.getError()).toBe(gl.NO_ERROR);
    } finally {
      error.mockRestore();
      atlas.release(user);
      for (const geometry of others)
        geometry[Symbol.dispose]();
    }
  });

  it("preserves opaque geometry when splats exceed atlas capacity and recovers at lower detail", () => {
    const source = gaussianSplatFixture();
    const center = viewport.npcToWorld(new Point3d(0.5, 0.5, 0.75));
    source.positions.set([center.x, center.y, center.z]);
    source.scales.fill(0.08);
    const data = packGaussianSplats(source);
    const count = data.count;
    // Exercise the capacity preflight without allocating an oversized CPU fixture.
    const gl = System.instance.context;
    data.count = (gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) + 1) * 16384;
    const geometry = new GaussianSplatGeometry(data);
    const graphic = IModelApp.renderSystem.createRenderGraphic(geometry)!;
    graphics.push(graphic);
    new Splats(graphic);
    const points = [new Point3d(0,0,0.25),new Point3d(1,0,0.25),new Point3d(1,1,0.25),new Point3d(0,1,0.25),new Point3d(0,0,0.25)];
    viewport.npcToWorldArray(points);
    new BoxDecorator({ viewport, color: ColorDef.blue, pickable: { id: "0x789" }, points });
    viewport.invalidateScene();
    expect(color()).toEqual([0,0,255]);
    expect(pick()).toBe("0x789");
    expect(getGaussianSplatAtlas().bytesUsed).toBe(0);
    data.count = count;
    viewport.invalidateScene();
    expect(color()[0]).toBeGreaterThan(150);
    expect(getGaussianSplatAtlas().bytesUsed).toBeGreaterThan(0);
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });

  it("uses Gaussian alpha threshold for picking", async () => {
    await addSplat({ opacity: 0.09 });
    expect(color()[0]).toBeGreaterThan(10);
    expect(pick()).toBeUndefined();
  });

  it("sorts overlapping tiles globally and picks the nearest eligible mean plane", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    expect(color()[0]).toBeLessThan(60);
    expect(pick()).toBe("0x1");
  });

  it("preserves the blended field after native picking", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    expect(pick()).toBe("0x1");
    viewport.requestRedraw();
    expect(color()).toEqual([41,0,204]);
  });

  it("refreshes native pick features when unchanged geometry is rebatched", async () => {
    const near = await addSplat({ id: "0x1", depth: 0.75, blue: true });
    const far = await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    expect(near).toBeInstanceOf(Branch);
    const outer = near as Branch;
    const original = outer.branch.entries[0] as Batch;
    expect(original).toBeInstanceOf(Batch);
    const table = new FeatureTable(1, original.featureTable.batchModelId);
    table.insert(new Feature("0x3"));
    const branch = new GraphicBranch(true);
    branch.setViewFlagOverrides(outer.branch.viewFlagOverrides);
    branch.add(IModelApp.renderSystem.createBatch(IModelApp.renderSystem.createGraphicOwner(original.graphic), table.pack(), original.range, original.options));
    const replacement = IModelApp.renderSystem.createBranch(branch, outer.localToWorldTransform);
    graphics.push(replacement);
    const delayed = deferSort();
    try {
      TestDecorator.dropAll();
      new Splats(replacement);
      new Splats(far);
      viewport.invalidateScene();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x3");
      expect(delayed.pending).not.toHaveBeenCalled();
    } finally {
      await delayed.resume();
    }
  });

  it("keeps the color field resident when a native BIM pick culls all splats", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const points = [new Point3d(0,0,0.75),new Point3d(0.12,0,0.75),new Point3d(0.12,0.12,0.75),new Point3d(0,0.12,0.75),new Point3d(0,0,0.75)];
    viewport.npcToWorldArray(points);
    new BoxDecorator({ viewport, color: ColorDef.blue, pickable: { id: "0x789" }, points });
    viewport.invalidateScene();
    expect(color()).toEqual([41,0,204]);
    const capacity = getGaussianSplatAtlas().bytesUsed;
    const delayed = deferSort();
    try {
      expect(pick(0.03, 0.97)).toBe("0x789");
      expect(getGaussianSplatAtlas().bytesUsed).toBe(capacity);
      expect(color()).toEqual([41,0,204]);
      expect(delayed.pending).not.toHaveBeenCalled();
      expect(pick()).toBe("0x1");
    } finally {
      await delayed.resume();
    }
  });

  it("keeps a complete LOD field until its replacement sort is ready", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const near = await addSplat({ id: "0x3", depth: 0.75, blue: true, decorate: false });
    const far = await addSplat({ id: "0x4", depth: 0.25, decorate: false });
    const delayed = deferSort();
    try {
      TestDecorator.dropAll();
      new Splats(near);
      new Splats(far);
      viewport.invalidateScene();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x1");
      expect(getGaussianSplatAtlas().numPages).toBe(4);
      // Tile-cache disposal must not invalidate the displayed field during the handoff.
      graphics[0][Symbol.dispose]();
      graphics[1][Symbol.dispose]();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x1");
      const origin = viewport.view.getOrigin().clone();
      viewport.view.setOrigin(origin.plusXYZ(0.3,0,0));
      viewport.setupFromView();
      expect(color()).toEqual([0,0,0]);
      expect(pick(0.2,0.5)).toBe("0x1");
      viewport.view.setOrigin(origin);
      viewport.setupFromView();
      expect(color()).toEqual([41,0,204]);
      // Replayed clipping must use the current view rather than cached eye-space planes.
      const shape = ClipShape.createShape([new Point3d(0.52,0),new Point3d(1,0),new Point3d(1,1),new Point3d(0.52,1),new Point3d(0.52,0)])!;
      viewport.view.setViewClip(ClipVector.create([shape]));
      viewport.viewFlags = viewport.viewFlags.with("clipVolume", true);
      viewport.invalidateRenderPlan();
      expect(color()).toEqual([0,0,0]);
      expect(pick()).toBeUndefined();
      viewport.view.setViewClip(undefined);
      viewport.invalidateRenderPlan();
      expect(color()).toEqual([41,0,204]);
      await delayed.resume();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x3");
      expect(getGaussianSplatAtlas().numPages).toBe(2);
      expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
    } finally {
      await delayed.resume();
    }
  });

  it("retains the completed LOD field when staging its replacement fails", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const near = await addSplat({ id: "0x3", depth: 0.75, blue: true, decorate: false });
    const far = await addSplat({ id: "0x4", depth: 0.25, decorate: false });
    const atlas = getGaussianSplatAtlas();
    const texture = atlas.texture;
    const gl = System.instance.context;
    TestDecorator.dropAll();
    new Splats(near);
    new Splats(far);
    viewport.invalidateScene();
    const error = vi.spyOn(gl, "getError").mockReturnValueOnce(gl.OUT_OF_MEMORY);
    try {
      expect(color()).toEqual([41,0,204]);
      expect(atlas.texture).toBe(texture);
      expect(atlas.numPages).toBe(2);
      expect(pick()).toBe("0x1");
      error.mockRestore();
      await expect.poll(() => { color(); return pick(); }, { timeout: 5000 }).toBe("0x3");
      expect(color()).toEqual([41,0,204]);
      expect(atlas.numPages).toBe(2);
      expect(gl.getError()).toBe(gl.NO_ERROR);
    } finally {
      error.mockRestore();
    }
  });

  it("restores fully culled completed occurrences before a pending LOD handoff", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const near = await addSplat({ id: "0x3", depth: 0.75, xFraction: 1.5, blue: true, decorate: false });
    const far = await addSplat({ id: "0x4", depth: 0.25, xFraction: 1.5, decorate: false });
    const delayed = deferSort();
    try {
      TestDecorator.dropAll();
      new Splats(near);
      new Splats(far);
      viewport.invalidateScene();
      expect(color()).toEqual([41,0,204]);
      // Move the frustum beyond the entire completed geometry's bounds.
      const origin = viewport.view.getOrigin().clone();
      viewport.view.setOrigin(origin.plusXYZ(1,0,0));
      viewport.setupFromView();
      expect(color()).toEqual([0,0,0]);
      expect(pick()).toBeUndefined();
      viewport.view.setOrigin(origin);
      viewport.setupFromView();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x1");
      const shape = ClipShape.createShape([new Point3d(1,0),new Point3d(2,0),new Point3d(2,1),new Point3d(1,1),new Point3d(1,0)])!;
      viewport.view.setViewClip(ClipVector.create([shape]));
      viewport.viewFlags = viewport.viewFlags.with("clipVolume", true);
      viewport.invalidateRenderPlan();
      expect(color()).toEqual([0,0,0]);
      expect(pick()).toBeUndefined();
      viewport.view.setViewClip(undefined);
      viewport.invalidateRenderPlan();
      expect(color()).toEqual([41,0,204]);
      expect(pick()).toBe("0x1");
    } finally {
      await delayed.resume();
    }
  });

  it("removes a hidden native tree immediately while another LOD replacement sorts", async () => {
    const modelA = imodel.transientIds.getNext(), modelB = imodel.transientIds.getNext();
    const near = await addSplat({ id: "0x1", modelId: modelA, depth: 0.75, blue: true, decorate: false });
    const far = await addSplat({ id: "0x2", modelId: modelB, depth: 0.25, decorate: false });
    const refA = tileTreeReferenceFromRenderGraphic({ graphic: near, iModel: imodel, modelId: modelA });
    const refB = tileTreeReferenceFromRenderGraphic({ graphic: far, iModel: imodel, modelId: modelB });
    refA.treeOwner.load();
    refB.treeOwner.load();
    let refs = [refA, refB];
    const provider: TiledGraphicsProvider = { forEachTileTreeRef: (_vp, callback) => refs.forEach(callback), getReferences: () => refs };
    viewport.addTiledGraphicsProvider(provider);
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const replacement = await addSplat({ id: "0x3", modelId: modelB, depth: 0.25, decorate: false });
    const transparent = await addSplat({ id: "0x4", modelId: modelB, opacity: 0, decorate: false });
    const graphic = IModelApp.renderSystem.createGraphicList([replacement, transparent]);
    graphics.push(graphic);
    const delayed = deferSort();
    try {
      refs = [refB];
      refB.treeOwner.tileTree!.rootTile.disposeContents();
      viewport.invalidateScene();
      expect(color()).toEqual([204,0,0]);
      expect(pick()).toBe("0x2");
      expect(getGaussianSplatAtlas().numPages).toBe(1);
      refB.treeOwner.tileTree!.rootTile.setContent({ graphic });
      viewport.invalidateScene();
      expect(color()).toEqual([204,0,0]);
      expect(pick()).toBe("0x2");
      expect(getGaussianSplatAtlas().numPages).toBe(3);
      await delayed.resume();
      await expect.poll(() => { color(); return pick(); }, { timeout: 5000 }).toBe("0x3");
      expect(color()).toEqual([204,0,0]);
      expect(getGaussianSplatAtlas().numPages).toBe(2);
      // A confirmed empty leaf is different from a not-yet-ready content gap.
      refB.treeOwner.tileTree!.rootTile.setContent({ isLeaf: true });
      viewport.invalidateScene();
      expect(color()).toEqual([0,0,0]);
      expect(pick()).toBeUndefined();
      expect(getGaussianSplatAtlas().numPages).toBe(0);
    } finally {
      await delayed.resume();
      viewport.dropTiledGraphicsProvider(provider);
    }
  });

  it("preserves completed splats when unchanged schedule branches rebuild and honors actual omissions", async () => {
    const blue = await addSplat({ id: "0x1", modelId: "0x10", depth: 0.75, blue: true });
    (blue as Branch).branch.animationId = "0x10_Node_1";
    await addSplat({ id: "0x2", modelId: "0x10", depth: 0.25 });
    viewport.displayStyle.scheduleScript = RenderSchedule.Script.fromJSON([{ modelId: "0x10", elementTimelines: [{
      batchId: 1, elementIds: ["0x1"], visibilityTimeline: [{ time: 0, value: 100 }, { time: 1, value: 0 }],
    }] }]);
    viewport.timePoint = 0;
    viewport.invalidateScene();
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    expect(pick()).toBe("0x1");
    const branches = viewport.target.animationBranches;
    expect(branches).toBeDefined();
    const delayed = deferSort();
    try {
      viewport.invalidateScene();
      expect(color()).toEqual([41,0,204]);
      expect(viewport.target.animationBranches).not.toBe(branches);
      expect(pick()).toBe("0x1");
      expect(delayed.pending).not.toHaveBeenCalled();
      // Undefined time and the script's first time represent the same animation state.
      viewport.timePoint = undefined;
      viewport.invalidateScene();
      expect(color()).toEqual([41,0,204]);
      expect(delayed.pending).not.toHaveBeenCalled();
      viewport.timePoint = 1;
      viewport.invalidateScene();
      expect(color()).toEqual([204,0,0]);
      expect(pick()).toBe("0x2");
    } finally {
      await delayed.resume();
    }
  });

  it("preserves sorted blending while harmless new content awaits its worker sort", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    const settled = color();
    const delayed = deferSort();
    try {
      await addSplat({ id: "0x3", opacity: 0 });
      expect(color()).toEqual(settled);
      expect(pick()).toBe("0x1");
      await expect.poll(() => delayed.pending.mock.calls.length, { timeout: 5000 }).toBeGreaterThan(0);
      expect(color()).toEqual(settled);
      await delayed.resume();
      expect(color()).toEqual(settled);
    } finally {
      await delayed.resume();
    }
  });

  it("preserves sorted blending and picking while shared atlas pages compact", async () => {
    const atlas = getGaussianSplatAtlas();
    const otherView = {};
    const others = Array.from({ length: 4 }, () => new GaussianSplatGeometry(packGaussianSplats(gaussianSplatFixture())));
    let resume = async () => {};
    try {
      atlas.update(otherView, others);
      await addSplat({ id: "0x1", depth: 0.75, blue: true });
      await addSplat({ id: "0x2", depth: 0.25 });
      await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
      const settled = color();
      const capacity = atlas.bytesUsed;
      const delayed = deferSort();
      resume = delayed.resume;
      atlas.release(otherView);
      viewport.requestRedraw();
      expect(color()).toEqual(settled);
      expect(atlas.bytesUsed).toBeLessThan(capacity);
      expect(pick()).toBe("0x1");
      await expect.poll(() => delayed.pending.mock.calls.length, { timeout: 5000 }).toBeGreaterThan(0);
      expect(color()).toEqual(settled);
      await resume();
      expect(color()).toEqual(settled);
      expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
    } finally {
      await resume();
      atlas.release(otherView);
      for (const geometry of others)
        geometry[Symbol.dispose]();
    }
  });

  it("sorts the same field again after it leaves and reenters the view", async () => {
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    TestDecorator.dropAll();
    viewport.invalidateScene();
    expect(color()).toEqual([0,0,0]);
    for (const graphic of graphics)
      new Splats(graphic);

    viewport.invalidateScene();
    await expect.poll(() => color(), { timeout: 5000 }).toEqual([41,0,204]);
    expect(pick()).toBe("0x1");
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("tests against opaque BIM depth and preserves native renderer state", async () => {
    await addSplat({ depth: 0.25 });
    const points = [new Point3d(0,0,0.75),new Point3d(1,0,0.75),new Point3d(1,1,0.75),new Point3d(0,1,0.75),new Point3d(0,0,0.75)];
    viewport.npcToWorldArray(points);
    new BoxDecorator({ viewport, color: ColorDef.blue, pickable: { id: "0x789" }, points });
    viewport.invalidateScene();
    expect(color()).toEqual([0,0,255]);
    expect(pick()).toBe("0x789");
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("clips both color and pick fragments", async () => {
    await addSplat();
    expect(pick()).toBe("0x123");
    const shape = ClipShape.createShape([new Point3d(2,2),new Point3d(3,2),new Point3d(3,3),new Point3d(2,3),new Point3d(2,2)])!;
    viewport.view.setViewClip(ClipVector.create([shape]));
    viewport.viewFlags = viewport.viewFlags.with("clipVolume", true);
    viewport.invalidateRenderPlan();
    expect(color()).toEqual([0,0,0]);
    expect(pick()).toBeUndefined();
  });

  it("converts linear trained colors after alpha composition", async () => {
    await addSplat({ linear: true, opacity: 1 });
    // A linear red value of .25 displays near sRGB .537, not .25.
    expect(color()[0]).toBeGreaterThan(110);
    expect(color()[0]).toBeLessThan(150);
  });

  it("blends a linear trained field with the background before display conversion", async () => {
    viewport.displayStyle.backgroundColor = ColorDef.blue;
    viewport.invalidateRenderPlan();
    await addSplat({ linear: true, opacity: 0.5 });
    const pixel = color();
    expect(pixel[0]).toBeGreaterThan(90);
    expect(pixel[0]).toBeLessThan(110);
    expect(pixel[1]).toBe(0);
    expect(pixel[2]).toBeGreaterThan(175);
    expect(pixel[2]).toBeLessThan(200);
  });

  it("retains SH values above one until alpha composition", async () => {
    await addSplat({ red: 2, opacity: 0.25 });
    expect(color()[0]).toBeGreaterThan(115);
    expect(color()[0]).toBeLessThan(140);
  });

  it("supports multisampling and releases pages after content leaves the view", async () => {
    await addSplat();
    viewport.antialiasSamples = 4;
    viewport.invalidateRenderPlan();
    expect(color()[0]).toBeGreaterThan(150);
    expect(pick()).toBe("0x123");
    TestDecorator.dropAll();
    viewport.invalidateScene();
    expect(color()).toEqual([0,0,0]);
    expect(pick()).toBeUndefined();
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });
});
