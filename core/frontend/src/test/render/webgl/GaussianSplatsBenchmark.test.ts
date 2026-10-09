/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { DecorateContext } from "../../../ViewContext";
import { GraphicType } from "../../../common/render/GraphicType";
import { GaussianSplatData } from "../../../internal/render/GaussianSplatData";
import { GaussianSplatWorker } from "../../../internal/render/GaussianSplatWorker";
import { getGaussianSplatAtlas } from "../../../internal/render/webgl/GaussianSplatAtlas";
import { System } from "../../../internal/render/webgl/System";
import { TestDecorator } from "../../TestDecorators";
import { openBlankViewport } from "../../openBlankViewport";

/* eslint-disable no-console -- The opt-in benchmark emits its measurements and hardware identity. */

// Opt in explicitly: these large allocations belong to a measured performance run, not routine unit tests.
declare const ITWIN_GAUSSIAN_BENCHMARK_ENABLED: boolean;
const enabled = ITWIN_GAUSSIAN_BENCHMARK_ENABLED;

describe.skipIf(!enabled)("Gaussian splat visible-content benchmark", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true } }));
  afterAll(async () => IModelApp.shutdown());

  for (const count of [1_000_000, 4_000_000]) {
    it(`renders and sorts ${count.toLocaleString()} visible splats`, async () => {
      using viewport = openBlankViewport({ width: 512, height: 512 });
      viewport.viewFlags = viewport.viewFlags.copy({ grid: false, acsTriad: false, lighting: false });
      viewport.renderFrame();
      const center = viewport.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 });
      const data = new Float32Array(count * 60);
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const x = (i % 1000) / 1000 - 0.5, y = (Math.floor(i / 1000) % 1000) / 1000 - 0.5;
        const z = ((i * 1664525 >>> 0) % 1000) / 1000 - 0.5;
        data[i * 60] = x; data[i * 60 + 1] = y; data[i * 60 + 2] = z;
        positions.set([x,y,z], i * 3);
        data[i * 60 + 3] = 0.2;
        data[i * 60 + 4] = data[i * 60 + 7] = data[i * 60 + 9] = 0.000001;
        data.set([1,0,-1], i * 60 + 12);
      }

      const splats: GaussianSplatData = {
        count, data, shDegree: 0, colorSpace: "srgb_rec709_display", origin: [center.x,center.y,center.z],
        bounds: [center.x-0.51,center.y-0.51,center.z-0.51,center.x+0.51,center.y+0.51,center.z+0.51],
      };
      using worker = new GaussianSplatWorker();
      await worker.register(1, positions);
      console.info("GAUSSIAN_BENCHMARK_PHASE", count, "sorting");
      const sortStart = performance.now();
      const order = await worker.sort({ perspective: true, tiles: [{ id: 1, count, pages: Array.from({ length: Math.ceil(count / 16384) }, (_, i) => i), transform: [1,0,0,0,0,1,0,0,0,0,1,-10] }] });
      const sortMs = performance.now() - sortStart;
      expect(order.length).toBe(count * 2);

      const geometry = System.instance.createGaussianSplatGeometry(splats)!;
      const graphic = System.instance.createRenderGraphic(geometry)!;
      const owner = System.instance.createGraphicOwner(graphic);
      const decorator = { decorate: (context: DecorateContext) => context.addDecoration(GraphicType.Scene, owner) };
      IModelApp.viewManager.addDecorator(decorator);
      const gl = System.instance.context;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      console.info("GAUSSIAN_BENCHMARK_PHASE", count, "drawing", gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
      try {
        viewport.invalidateDecorations();
        const uploadStart = performance.now();
        viewport.renderFrame();
        gl.finish();
        expect(getGaussianSplatAtlas().texture).toBeDefined();
        expect(getGaussianSplatAtlas().numPages).toBe(Math.ceil(count / 16384));
        // A new field joins the color pass only after its global sort completes.
        await expect.poll(() => {
          viewport.requestRedraw();
          viewport.renderFrame();
          gl.finish();
          return viewport.readImageBuffer()!.data.some((value, i) => i % 4 < 3 && value > 10);
        }, { timeout: 30000 }).toBe(true);
        const firstVisibleFrameMs = performance.now() - uploadStart;
        const frames: number[] = [];
        for (let i = 0; i < 5; i++) {
          viewport.requestRedraw();
          const start = performance.now();
          viewport.renderFrame();
          gl.finish();
          frames.push(performance.now() - start);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        frames.sort((a, b) => a - b);
        console.info("GAUSSIAN_BENCHMARK", JSON.stringify({
          count, width: viewport.viewRect.width, height: viewport.viewRect.height, shDegree: 0,
          sortMs, firstVisibleFrameMs, medianFrameMs: frames[2], atlasBytes: getGaussianSplatAtlas().bytesUsed,
          cpuPackedBytes: data.byteLength, renderer: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER), userAgent: navigator.userAgent,
        }));
        expect(gl.getError()).toBe(gl.NO_ERROR);
      } finally {
        IModelApp.viewManager.dropDecorator(decorator);
        graphic[Symbol.dispose]();
        TestDecorator.dropAll();
      }
    }, 120000);
  }
});
