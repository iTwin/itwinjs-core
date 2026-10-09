/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { loadSpz } from "@spz-loader/core";
import { IModelApp } from "../../IModelApp";
import { GltfAccessor, GltfMeshPrimitive } from "../../common/gltf/GltfSchema";
import { packGaussianSplats, readGaussianSplatAccessor, readGaussianSplatSource } from "../../internal/render/GaussianSplatData";
import { sortGaussianSplats } from "../../internal/render/GaussianSplatSort";
import { GaussianSplatWorker } from "../../internal/render/GaussianSplatWorker";
import { GltfReaderProps } from "../../tile/internal";
import { gaussianSplatFixture, gaussianSplatGlb, gaussianSplatSpz } from "./GaussianSplatFixtures";

describe("Gaussian splat data", () => {
  it("packs linear scales, opacity, xyzw rotation, SH and three-sigma bounds", () => {
    const source = gaussianSplatFixture();
    source.positions.set([1000000, 2, 3]);
    source.scales.set([1, 2, 3]);
    source.rotations.set([0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    source.opacities[0] = 0.25;
    const packed = packGaussianSplats(source);
    expect(packed.origin).toEqual([1000000, 2, 3]);
    expect(Array.from(packed.data.subarray(0, 4))).toEqual([0, 0, 0, 0.25]);
    expect(packed.data[4]).toBeCloseTo(4);
    expect(packed.data[7]).toBeCloseTo(1);
    expect(packed.data[9]).toBeCloseTo(9);
    expect(packed.bounds).toEqual([999994, -1, -6, 1000006, 5, 12].map((n) => expect.closeTo(n)));
    expect(Array.from(packed.data.subarray(12, 60))).toEqual(Array.from(source.sh));
  });

  it("reads strided normalized data from an unaligned buffer and applies sparse values", () => {
    const data = new Uint8Array([99, 0, 128, 255, 99, 255, 128, 0, 99]);
    const accessor: GltfAccessor = { bufferView: 0, count: 2, type: "VEC3", componentType: 5121, normalized: true };
    const buffers = { 0: { byteLength: data.length, resolvedBuffer: data } };
    const views: Parameters<typeof readGaussianSplatAccessor>[3] = { 0: { buffer: 0, byteOffset: 1, byteLength: 7, byteStride: 4 } };
    expect(Array.from(readGaussianSplatAccessor(accessor, 3, buffers, views))).toEqual([0, expect.closeTo(128/255), 1, 1, expect.closeTo(128/255), 0]);

    accessor.sparse = { count: 1, indices: { bufferView: 1, componentType: 5121 }, values: { bufferView: 2 } };
    views[1] = { buffer: 0, byteOffset: 0, byteLength: 1 };
    views[2] = { buffer: 0, byteOffset: 5, byteLength: 3 };
    data[0] = 0;
    expect(Array.from(readGaussianSplatAccessor(accessor, 3, buffers, views)).slice(0, 3)).toEqual([1, expect.closeTo(128/255), 0]);
  });

  it("rejects out-of-bounds accessors, invalid quaternions/scales/opacity and non-finite SH", () => {
    expect(() => readGaussianSplatAccessor({ bufferView: 0, count: 2, type: "VEC3", componentType: 5126 }, 3,
      { 0: { byteLength: 12, resolvedBuffer: new Uint8Array(12) } }, { 0: { buffer: 0, byteLength: 12 } })).toThrow(/exceeds/);
    for (const mutate of [
      (s: ReturnType<typeof gaussianSplatFixture>) => { s.rotations.fill(0); },
      (s: ReturnType<typeof gaussianSplatFixture>) => { s.scales[0] = -1; },
      (s: ReturnType<typeof gaussianSplatFixture>) => { s.opacities[0] = 2; },
      (s: ReturnType<typeof gaussianSplatFixture>) => { s.sh[0] = NaN; },
    ]) {
      const source = gaussianSplatFixture();
      mutate(source);
      expect(() => packGaussianSplats(source)).toThrow(/Gaussian splats/);
    }
  });

  it("reads full SH degrees 0 through 3 from GLB and rejects incomplete bands", () => {
    for (let degree = 0; degree <= 3; degree++) {
      const source = gaussianSplatFixture(2, degree);
      source.sh[51] = 0.123;
      const props = GltfReaderProps.create(gaussianSplatGlb(source), true)!;
      const doc = props.glTF;
      const primitive = doc.meshes![0]!.primitives![0];
      const buffers = { 0: { ...doc.buffers![0]!, resolvedBuffer: props.binaryData } };
      const decoded = readGaussianSplatSource(primitive, doc, buffers, doc.bufferViews!);
      expect("shDegree" in decoded && decoded.shDegree).toBe(degree);
      if (degree > 0) {
        delete primitive.attributes["KHR_gaussian_splatting:SH_DEGREE_1_COEF_0"];
        expect(() => readGaussianSplatSource(primitive, doc, buffers, doc.bufferViews!)).toThrow(/missing/);
      }
    }
  });

  it("rejects unsupported extension profiles", () => {
    const primitive: GltfMeshPrimitive = {
      mode: 0, attributes: { ["POSITION"]: 0 },
      extensions: { ["KHR_gaussian_splatting"]: { kernel: "box", colorSpace: "srgb_rec709_display" } },
    };
    expect(() => readGaussianSplatSource(primitive, { asset: { version: "2.0" } }, {}, {})).toThrow(/unsupported/);
  });

  it("sorts globally across tile pages by camera distance, or view depth for orthographic views", () => {
    const positions = new Map([[1, new Float32Array([0, 0, 0, 10, 0, 0])], [2, new Float32Array([0, 0, 0])]]);
    const request = {
      perspective: true,
      tiles: [
        { id: 1, pages: [1], count: 2, transform: [1,0,0,0, 0,1,0,0, 0,0,1,-2] },
        { id: 2, pages: [3], count: 1, transform: [1,0,0,0, 0,1,0,0, 0,0,1,-4] },
      ],
    };
    expect(Array.from(sortGaussianSplats(request, positions))).toEqual([16385, 0, 49152, 1, 16384, 0]);
    request.perspective = false;
    expect(Array.from(sortGaussianSplats(request, positions))).toEqual([49152, 1, 16384, 0, 16385, 0]);
    positions.delete(1);
    expect(() => sortGaussianSplats(request, positions)).toThrow(/stale/);
  });
});

describe("Gaussian splat worker", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("decodes an independent SPZ 2 golden payload with activated scales/alpha and SH", async () => {
    using worker = new GaussianSplatWorker();
    const result = await worker.decode({ spz: await gaussianSplatSpz(), count: 1, colorSpace: "srgb_rec709_display" });
    expect(result.count).toBe(1);
    expect(result.shDegree).toBe(1);
    expect(result.data[3]).toBeCloseTo(128/255);
    expect(result.data[4]).toBeCloseTo(1);
    expect(result.data[7]).toBeCloseTo(1);
    expect(result.data[9]).toBeCloseTo(1);
    expect(result.data[12]).toBeCloseTo((140/255-0.5)/0.15);
    expect(result.data[13]).toBeCloseTo((128/255-0.5)/0.15);
    expect(result.data[14]).toBeCloseTo((116/255-0.5)/0.15);
    expect(result.origin).toEqual([-1, 2, -3]);
    expect(Array.from(result.data.subarray(15, 24))).toEqual(Array.from({ length: 9 }, (_, i) => expect.closeTo((i + 1)/128 * (i < 3 ? 1 : -1))));
  });

  it("matches Cesium 1.146's decode of its official degree-three SPZ cube", async () => {
    const bytes = new Uint8Array(await (await fetch("/GaussianSplats/cesium-cube.glb")).arrayBuffer());
    const props = GltfReaderProps.create(bytes, true)!;
    const doc = props.glTF;
    const primitive = doc.meshes![0]!.primitives![0];
    const request = readGaussianSplatSource(primitive, doc, { 0: { ...doc.buffers![0]!, resolvedBuffer: props.binaryData } }, doc.bufferViews!);
    expect("spz" in request).toBe(true);
    if (!("spz" in request))
      throw new Error("Expected compressed fixture");

    expect(request.coordinateSystem).toBe("UNSPECIFIED");
    // These are the options used by CesiumJS 1.146's GltfSpzLoader; the native worker owns its separate codec.
    const cesium = await loadSpz(request.spz.slice(), { unpackOptions: { coordinateSystem: "UNSPECIFIED" } });
    using worker = new GaussianSplatWorker();
    const native = await worker.decode(request);
    expect(native.count).toBe(27);
    expect(native.shDegree).toBe(3);
    for (let i = 0; i < native.count; i++) {
      for (let c = 0; c < 3; c++) {
        expect(native.data[i * 60 + c] + native.origin[c]).toBeCloseTo(cesium.positions[i * 3 + c]);
        expect(native.data[i * 60 + 12 + c] * 0.282 + 0.5).toBeCloseTo(cesium.colors[i * 3 + c], 4);
      }
      expect(native.data[i * 60 + 3]).toBeCloseTo(cesium.alphas[i]);
      expect(Array.from(native.data.subarray(i * 60 + 15, i * 60 + 60))).toEqual(Array.from(cesium.sh.subarray(i * 45, i * 45 + 45)));
    }
  });

  it("rejects malformed, wrong-version and mismatched SPZ without losing the worker", async () => {
    using worker = new GaussianSplatWorker();
    await expect(worker.decode({ spz: new Uint8Array([1,2,3]), count: 1, colorSpace: "srgb_rec709_display" })).rejects.toThrow();
    await expect(worker.decode({ spz: await gaussianSplatSpz(), count: 2, colorSpace: "srgb_rec709_display" })).rejects.toThrow(/header/);
    const result = await worker.decode({ spz: await gaussianSplatSpz(), count: 1, colorSpace: "srgb_rec709_display" });
    expect(result.count).toBe(1);
  });

  it("transfers raw data, sorts, rejects stale tiles and settles termination", async () => {
    const worker = new GaussianSplatWorker();
    const source = gaussianSplatFixture();
    const decoded = await worker.decode(source);
    expect(source.positions.byteLength).toBe(0);
    expect(decoded.data[3]).toBeCloseTo(0.8);
    await worker.register(1, new Float32Array([0,0,0]));
    const request = { perspective: true, tiles: [{ id: 1, pages: [0], count: 1, transform: [1,0,0,0,0,1,0,0,0,0,1,-1] }] };
    expect(Array.from(await worker.sort(request))).toEqual([0,0]);
    await worker.release([1]);
    await expect(worker.sort(request)).rejects.toThrow(/stale/);
    const pending = worker.sort(request);
    worker[Symbol.dispose]();
    await expect(pending).rejects.toThrow(/disposed/);
  });
});
