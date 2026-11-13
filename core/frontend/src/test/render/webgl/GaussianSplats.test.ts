/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AxisOrder, Matrix3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { ColorDef, EmptyLocalization, RenderMode } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { SpatialViewState } from "../../../SpatialViewState";
import { ScreenViewport } from "../../../Viewport";
import { DecorateContext } from "../../../ViewContext";
import { ViewStatus } from "../../../ViewStatus";
import { GraphicType } from "../../../common/render/GraphicType";
import { ViewRect } from "../../../common/ViewRect";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { readGltfGraphics } from "../../../tile/internal";
import { GaussianSplatSource } from "../../../internal/render/GaussianSplatData";
import { loadGaussianSplatModule } from "../../../internal/render/GaussianSplatModuleLoader";
import { GaussianSplatWorker } from "../../../internal/render/GaussianSplatWorker";
import { System } from "../../../internal/render/webgl/System";
import { createBlankConnection } from "../../createBlankConnection";
import { BoxDecorator, TestDecorator } from "../../TestDecorators";
import { gaussianSplatFixture, gaussianSplatGlb } from "../GaussianSplatFixtures";

const shC0 = 0.2820947917738781;

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
    await IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true, errorOnMissingUniform: true } });
    // The tests read splats with readGltfGraphics, which waits for the splat module only once it decodes them.
    await loadGaussianSplatModule();
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

  /** Splat source data uses glTF y-up axes; the reader maps glTF (x, y, z) to iModel (x, -z, y). */
  function gltfFromWorld(point: { x: number, y: number, z: number }): number[] {
    return [point.x, point.z, -point.y];
  }

  /** Read `source` as glTF and, unless `decorate` is false, draw it as a scene decoration. */
  async function readSplats(source: GaussianSplatSource, id: string, decorate = true): Promise<RenderGraphic> {
    const graphic = await readGltfGraphics({ gltf: gaussianSplatGlb(source), iModel: imodel, pickableOptions: { id } });
    expect(graphic).toBeDefined();
    graphics.push(graphic!);
    if (decorate)
      new Splats(graphic!);

    viewport.invalidateScene();
    return graphic!;
  }

  /** One splat at the center of the view, at an NPC depth: red, or blue if `blue`. */
  async function addSplat(options: { id?: string, depth?: number, blue?: boolean, decorate?: boolean } = {}): Promise<RenderGraphic> {
    const source = gaussianSplatFixture();
    source.positions.set(gltfFromWorld(viewport.npcToWorld(new Point3d(0.5, 0.5, options.depth ?? 0.5))));
    source.scales.fill(0.08);
    if (options.blue)
      source.sh.set([-0.5 / shC0, -0.5 / shC0, 0.5 / shC0]);

    return readSplats(source, options.id ?? "0x123", options.decorate);
  }

  /** The color of the pixel containing a view-coordinate point (origin top-left), from the last rendered frame. */
  function colorAtView(point: Point3d): number[] {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    const image = viewport.readImageBuffer({ rect: new ViewRect(x, y, x + 1, y + 1) })!;
    expect(image).toBeDefined();
    return Array.from(image.data.subarray(0, 3));
  }

  /** Render a frame and return the color of the pixel at the center of the view. */
  function color(): number[] {
    viewport.requestRedraw();
    viewport.renderFrame();
    return colorAtView(new Point3d(viewport.viewRect.width / 2, viewport.viewRect.height / 2));
  }

  /** Hold every worker sort's result until `release`, so that a test can observe the frames drawn while sorts are in flight. */
  function holdSorts() {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => { open = resolve; });
    // The original method is invoked below with its worker receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const sort = GaussianSplatWorker.prototype.sort;
    const held = vi.spyOn(GaussianSplatWorker.prototype, "sort");
    held.mockImplementation(async function (this: GaussianSplatWorker, request) {
      const instances = await sort.call(this, request);
      await gate;
      return instances;
    });

    return {
      release: async () => {
        const sorts = held.mock.results.map((result) => result.value);
        held.mockRestore();
        open();
        await Promise.all(sorts);
      },
    };
  }

  it("draws an ellipse in orthographic and perspective views", async () => {
    await addSplat();

    expect(color()[0]).toBeGreaterThan(150);
    expect(color().slice(1)).toEqual([0, 0]);

    TestDecorator.dropAll();
    const perspective = { eyePoint: new Point3d(0.5, 0.5, 3), targetPoint: new Point3d(0.5, 0.5, 0.5), upVector: Vector3d.unitY(), frontDistance: 0.1, backDistance: 10 };
    expect((viewport.view as SpatialViewState).lookAt(perspective)).toBe(ViewStatus.Success);
    expect(viewport.setupFromView()).toBe(ViewStatus.Success);
    await addSplat();

    expect(color()[0]).toBeGreaterThan(150);
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("evaluates SH bands 1-3 like the float64 3DGS eval_sh reference", async () => {
    // An orthographic view direction for which every degree 1-3 basis function is at least 0.13 in magnitude,
    // so a wrong sign or a misplaced coefficient changes the result by at least 25 color codes.
    const view = viewport.view as SpatialViewState;
    const toEye = Vector3d.create(0.5504160161168589, 0.30510057979814814, 0.7771459614569708);
    view.setRotation(Matrix3d.createRigidHeadsUp(toEye, AxisOrder.ZXY).transpose());
    expect(viewport.setupFromView()).toBe(ViewStatus.Success);
    viewport.renderFrame();
    // Camera-to-splat direction in world coordinates, then in the splats' glTF frame.
    const world = Vector3d.createStartEnd(viewport.npcToWorld(new Point3d(0.5, 0.5, 1)), viewport.npcToWorld(new Point3d(0.5, 0.5, 0))).normalize()!;
    const [x, y, z] = gltfFromWorld(world);
    // 3DGS eval_sh (sh_utils.py), float64, for coefficients 1..15.
    const xx = x * x, yy = y * y, zz = z * z;
    const basis = [
      -0.4886025119029199 * y, 0.4886025119029199 * z, -0.4886025119029199 * x,
      1.0925484305920792 * x * y, -1.0925484305920792 * y * z, 0.31539156525252005 * (2 * zz - xx - yy), -1.0925484305920792 * x * z, 0.5462742152960396 * (xx - yy),
      -0.5900435899266435 * y * (3 * xx - yy), 2.890611442640554 * x * y * z, -0.4570457994644658 * y * (4 * zz - xx - yy),
      0.3731763325901154 * z * (2 * zz - 3 * xx - 3 * yy), -0.4570457994644658 * x * (4 * zz - xx - yy), 1.445305721320277 * z * (xx - yy),
      -0.5900435899266435 * x * (xx - 3 * yy),
    ];
    for (const value of basis)
      expect(Math.abs(value)).toBeGreaterThan(0.13);

    // Splat n (1..15) has only coefficient n: +0.375 red, -0.375 green, on SPZ's grid so storage is exact.
    // Means sit at pixel centers of a 4x4 grid of 16-pixel cells.
    const depth = viewport.worldToView(viewport.npcToWorld(new Point3d(0.5, 0.5, 0.5))).z;
    const cells = basis.map((_, n) => new Point3d(16 * (n % 4) + 8.5, 16 * Math.floor(n / 4) + 8.5, depth));
    const source = gaussianSplatFixture(15, 3);
    source.opacities.fill(1);
    source.scales.fill(2.5 * viewport.getPixelSizeAtPoint()); // 2.5-pixel sigma: neighbors 16 pixels away contribute nothing
    source.sh.fill(0);
    cells.forEach((cell, n) => {
      source.positions.set(gltfFromWorld(viewport.viewToWorld(cell)), n * 3);
      source.sh.set([0.375, -0.375], n * 48 + (n + 1) * 3);
    });
    await readSplats(source, "0x123");
    await expect.poll(() => { color(); return colorAtView(cells[0])[2]; }, { timeout: 5000 }).toBeGreaterThan(100);
    color();

    // Peak alpha is capped at 0.99 over a black background; DC 0 gives base color 0.5.
    const expected = (value: number) => Math.round(255 * 0.99 * Math.min(1, Math.max(0, value)));
    cells.forEach((cell, n) => {
      const rgb = colorAtView(cell);
      expect(Math.abs(rgb[0] - expected(0.5 + 0.375 * basis[n])), `coefficient ${n + 1} red`).toBeLessThanOrEqual(3);
      expect(Math.abs(rgb[1] - expected(0.5 - 0.375 * basis[n])), `coefficient ${n + 1} green`).toBeLessThanOrEqual(3);
      expect(Math.abs(rgb[2] - expected(0.5)), `coefficient ${n + 1} blue`).toBeLessThanOrEqual(3);
    });
  });

  it("is hidden by opaque BIM in front of it", async () => {
    await addSplat({ depth: 0.25 });
    const boxDepth = 0.75;
    const points = [new Point3d(0, 0, boxDepth), new Point3d(1, 0, boxDepth), new Point3d(1, 1, boxDepth), new Point3d(0, 1, boxDepth), new Point3d(0, 0, boxDepth)];
    viewport.npcToWorldArray(points);
    new BoxDecorator({ viewport, color: ColorDef.blue, points });
    viewport.invalidateScene();

    expect(color()).toEqual([0, 0, 255]);
    expect(System.instance.context.getError()).toBe(System.instance.context.NO_ERROR);
  });

  it("keeps a complete LOD field displayed until its replacement's sort is ready", async () => {
    // Blue in front of red.
    await addSplat({ id: "0x1", depth: 0.75, blue: true });
    await addSplat({ id: "0x2", depth: 0.25 });
    const displayedColor = [41, 0, 204];
    await expect.poll(() => color(), { timeout: 5000 }).toEqual(displayedColor);

    // Its replacement: red in front of blue.
    const near = await addSplat({ id: "0x3", depth: 0.75, decorate: false });
    const far = await addSplat({ id: "0x4", depth: 0.25, blue: true, decorate: false });
    const sorts = holdSorts();
    try {
      TestDecorator.dropAll();
      new Splats(near);
      new Splats(far);
      viewport.invalidateScene();
      expect(color()).toEqual(displayedColor);

      // Disposal by the tile cache must not invalidate the displayed field during the handoff.
      graphics[0][Symbol.dispose]();
      graphics[1][Symbol.dispose]();
      expect(color()).toEqual(displayedColor);
    } finally {
      await sorts.release();
    }

    await expect.poll(() => color(), { timeout: 5000 }).toEqual([204, 0, 41]);
  });
});
