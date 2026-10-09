/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { GaussianSplatAtlasUpload } from "../../../internal/render/GaussianSplatDiagnostics";
import { GaussianSplatAtlas } from "../../../internal/render/webgl/GaussianSplatAtlas";
import { GaussianSplatGeometry } from "../../../internal/render/webgl/GaussianSplatGeometry";
import { System } from "../../../internal/render/webgl/System";

declare const ITWIN_GAUSSIAN_BENCHMARK_ENABLED: boolean;

// Isolate main-thread staging from navigation/LOD variability. No sort, image
// readback or GPU-completion wait is included in the recorded atlas wall times.
describe.skipIf(!ITWIN_GAUSSIAN_BENCHMARK_ENABLED)("Gaussian atlas upload benchmark", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization(), renderSys: { enableGaussianSplats: true } }));
  afterAll(async () => IModelApp.shutdown());

  it("records repeated fixed-size replacements with retained tiles", async () => {
    using atlas = new GaussianSplatAtlas();
    const count = 250_000;
    const geometries = Array.from({ length: 5 }, (_, tile) => {
      const data = new Uint32Array(count * 8);
      const sh = new Float32Array(count * 12);
      const covariance = new Float32Array(count * 6);
      const appearance = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        data[i * 8] = i + tile;
        sh[i * 12] = i / count;
        covariance[i * 6] = 0.1;
        appearance[i * 4 + 3] = 0.731;
      }
      return new GaussianSplatGeometry({ count, data, sh, covariance, appearance, shDegree: 1,
        colorSpace: "srgb_rec709_display", origin: [0, 0, 0], bounds: [0, 0, 0, 1, 1, 1] });
    });
    const owner = {};
    const samples: GaussianSplatAtlasUpload[] = [];
    const selections = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [0, 2, 4]];
    try {
      for (let frame = 0; frame < 16; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const selected = selections[frame % selections.length].map((index) => geometries[index]);
        expect(atlas.canAdmit(owner, selected)).toBe(true);
        expect(atlas.canUpdate(owner, selected)).toBe(true);
        atlas.collectUploadStatistics(frame < 4 ? [] : samples, () => atlas.update(owner, selected));
      }
      expect(samples).toHaveLength(12);
      expect(samples.every((s) => s.succeeded && s.splats === count * 3 && s.retainedSplats === count * 2)).toBe(true);
      const gl = System.instance.context;
      expect(gl.getError()).toBe(gl.NO_ERROR);
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const ordered = samples.map((s) => s.durationMs).sort((a, b) => a - b);
      const report = { method: "12 atlas replacement wall samples after four warmups; 750,000 splats, two of three tiles retained; no GPU completion claim",
        browser: navigator.userAgent, renderer: gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
        medianMs: ordered[6], p95Ms: ordered[11], samples };
      await commands.writeFile("lib/gaussian-upload-benchmark.json", JSON.stringify(report, undefined, 2));
      console.info("GAUSSIAN_UPLOAD_BENCHMARK", JSON.stringify(report));
    } finally {
      atlas.release(owner);
      for (const geometry of geometries) geometry[Symbol.dispose]();
    }
  }, 60000);
});
