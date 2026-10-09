/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { loadSpz } from "@spz-loader/core";
import { IModelApp } from "../../IModelApp";
import { GltfAccessor, GltfMeshPrimitive } from "../../common/gltf/GltfSchema";
import { readGaussianSplatAccessor, readGaussianSplatSource } from "../../internal/render/GaussianSplatData";
import { sortGaussianSplats } from "../../workers/GaussianSplats/Sorting";
import { packGaussianSplats } from "../../workers/GaussianSplats/Packing";
import * as gaussianWasm from "../../workers/GaussianSplats/Wasm";
import { decodeGaussianSplats, GaussianSplatWorker } from "../../internal/render/GaussianSplatWorker";
import { GltfReaderProps } from "../../tile/internal";
import { gaussianSplatFixture, gaussianSplatGlb, gaussianSplatSpz } from "./GaussianSplatFixtures";

vi.mock("../../workers/GaussianSplats/Wasm", { spy: true });

// Decode the compact texture independently of the renderer's shader.
function covarianceFromTexture(data: Uint32Array, splat = 0): number[] {
  const offset = splat * 8;
  const exponent = new Float32Array(data.buffer, data.byteOffset, data.length)[offset + 3];
  const half = (bits: number) => {
    const sign = bits & 0x8000 ? -1 : 1;
    const e = (bits >>> 10) & 31;
    const mantissa = bits & 1023;
    return sign * (e === 0 ? mantissa * 2 ** -24 : (1 + mantissa / 1024) * 2 ** (e - 15));
  };
  return Array.from({ length: 6 }, (_, i) => half((data[offset + 4 + Math.floor(i / 2)] >>> (i % 2 * 16)) & 0xffff) * 2 ** exponent / 4);
}

describe("Gaussian splat data", () => {
  it("packs linear scales, opacity, xyzw rotation, SH and three-sigma bounds", () => {
    const source = gaussianSplatFixture(1, 3);
    source.positions.set([1000000, 2, 3]);
    source.scales.set([1, 2, 3]);
    source.rotations.set([0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    source.opacities[0] = 0.25;
    const packed = packGaussianSplats(source);
    expect(packed.origin).toEqual([1000000, 2, 3]);
    expect(packed.data).toBeInstanceOf(Uint32Array);
    expect(packed.data.length).toBe(8);
    expect(Array.from(new Float32Array(packed.data.buffer).subarray(0, 4))).toEqual([0, 0, 0, 2]);
    expect(covarianceFromTexture(packed.data)).toEqual([4, 0, 0, 1, 0, 9].map((n) => expect.closeTo(n)));
    expect(packed.data[7]).toBe(0x400000ff);
    expect(packed.appearance![3]).toBe(0.25);
    expect(packed.bounds).toEqual([999994, -1, -6, 1000006, 5, 12].map((n) => expect.closeTo(n)));
    expect(Array.from(packed.sh)).toEqual(Array.from(source.sh));
  });

  it.each([0.000045, 128])("preserves covariance for scale %s through exponent normalization", (scale) => {
    const source = gaussianSplatFixture();
    source.scales.fill(scale);
    const packed = packGaussianSplats(source);
    const expected = source.scales[0] ** 2;
    const covariance = covarianceFromTexture(packed.data);
    for (const i of [0, 3, 5])
      expect(Math.abs(covariance[i] / expected - 1)).toBeLessThan(0.001);
    expect(packed.covariance).toBeUndefined();
  });

  it("retains float covariance for anisotropic splats and exact appearance when bytes lose precision", () => {
    const source = gaussianSplatFixture();
    source.scales.set([1, 0.000045, 128]);
    source.opacities[0] = 0.001;
    source.sh.set([4, -4, 0]);
    const packed = packGaussianSplats(source);
    expect(Array.from(packed.covariance!)).toEqual([1, 0, 0, source.scales[1] ** 2, 0, 16384].map((n) => expect.closeTo(n, 12)));
    expect(packed.appearance).toEqual(new Float32Array([0.5 + 4 * 0.2820947917738781, 0.5 - 4 * 0.2820947917738781, 0.5, source.opacities[0]]));
    expect(packed.data[7]).toBe(0x008000ff);
    expect(packed.sh.length).toBe(0);
  });

  it("retains exactly the active SH bands including DC", () => {
    for (let degree = 0; degree <= 3; degree++) {
      const source = gaussianSplatFixture(2, degree);
      source.sh.set(Array.from({ length: 96 }, (_, i) => i / 100));
      const packed = packGaussianSplats(source);
      const coefficients = degree > 0 ? (degree + 1) ** 2 * 3 : 0;
      expect(Array.from(packed.sh)).toEqual([...source.sh.subarray(0, coefficients), ...source.sh.subarray(48, 48 + coefficients)]);
    }
  });

  it("rejects invalid array lengths before entering WASM", () => {
    const generate = vi.mocked(gaussianWasm.generateGaussianSplatTexture);
    generate.mockClear();
    for (const field of ["positions", "scales", "rotations", "opacities", "sh"] as const) {
      const source = gaussianSplatFixture();
      source[field] = new Float32Array(source[field].length - 1);
      expect(() => packGaussianSplats(source)).toThrow(/array lengths/);
    }
    expect(generate).not.toHaveBeenCalled();
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

  it("sorts large negative depths without signed key overflow", () => {
    const positions = new Map([[1, new Float32Array([0, 0, -600000, 0, 0, -700000, 0, 0, -100])]]);
    const request = { perspective: false, tiles: [{ id: 1, count: 3, pages: [0], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0] }] };
    expect(Array.from(sortGaussianSplats(request, positions))).toEqual([1, 0, 0, 0, 2, 0]);
  });

  it("honors perspective viewDepth content and repeated tile occurrences", () => {
    const positions = new Map([[1, new Float32Array([10, 0, 0, 0, 0, -4])]]);
    const tile = { id: 1, count: 2, pages: [0], transform: [1,0,0,0, 0,1,0,0, 0,0,1,-2], sortingMethod: "viewDepth" as const };
    expect(Array.from(sortGaussianSplats({ perspective: true, tiles: [tile] }, positions))).toEqual([1, 0, 0, 0]);
    const repeated = { ...tile, pages: [2], transform: [1,0,0,0, 0,1,0,0, 0,0,1,-20] };
    expect(Array.from(sortGaussianSplats({ perspective: true, tiles: [tile, repeated] }, positions))).toEqual([32769, 1, 32768, 1, 1, 0, 0, 0]);
  });

  it("maps the first splat after a page boundary to its own page", () => {
    const positions = new Float32Array(16385 * 3);
    for (let i = 0; i < 16385; i++)
      positions[i * 3 + 2] = -1;
    positions[2] = -3;
    positions[16384 * 3 + 2] = -2;
    const tile = { id: 1, count: 16385, pages: [3, 7], transform: [1,0,0,0, 0,1,0,0, 0,0,1,0] };
    const sorted = sortGaussianSplats({ perspective: false, tiles: [tile] }, new Map([[1, positions]]));
    expect(sorted.length).toBe(16385 * 2);
    expect(Array.from(sorted.subarray(0, 6))).toEqual([49152, 0, 114688, 0, 49153, 0]);
    expect(Array.from(sorted.subarray(-2))).toEqual([65535, 0]);
  });
  it("refines colliding normalized keys without reversing adjacent splats in a wide scene", () => {
    const request = { perspective: false, tiles: [{ id: 1, pages: [0], count: 3, transform: [1,0,0,0,0,1,0,0,0,0,1,0] }] };
    const positions = new Map([[1, new Float32Array([0,0,-700000, 0,0,-100, 0,0,-100.001])]]);
    expect(Array.from(sortGaussianSplats(request, positions))).toEqual([0,0,2,0,1,0]);
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
    expect(result.data.length).toBe(8);
    expect(result.data[7] >>> 24).toBe(128);
    expect(covarianceFromTexture(result.data)).toEqual([1, 0, 0, 1, 0, 1].map((n) => expect.closeTo(n)));
    expect(result.sh[0]).toBeCloseTo((140/255-0.5)/0.15);
    expect(result.sh[1]).toBeCloseTo((128/255-0.5)/0.15);
    expect(result.sh[2]).toBeCloseTo((116/255-0.5)/0.15);
    expect(result.origin).toEqual([-1, 2, -3]);
    expect(Array.from(result.sh.subarray(3, 12))).toEqual(Array.from({ length: 9 }, (_, i) => expect.closeTo((i + 1)/128 * (i < 3 ? 1 : -1))));
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
    const positions = new Float32Array(native.data.buffer);
    for (let i = 0; i < native.count; i++) {
      for (let c = 0; c < 3; c++) {
        expect(positions[i * 8 + c] + native.origin[c]).toBeCloseTo(cesium.positions[i * 3 + c]);
        expect(native.sh[i * 48 + c] * 0.282 + 0.5).toBeCloseTo(cesium.colors[i * 3 + c], 4);
      }
      expect(native.appearance![i * 4 + 3]).toBeCloseTo(cesium.alphas[i]);
      expect(Array.from(native.sh.subarray(i * 48 + 3, i * 48 + 48))).toEqual(Array.from(cesium.sh.subarray(i * 45, i * 45 + 45)));
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
    expect(decoded.data[7] >>> 24).toBe(204);
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

describe("Shared Gaussian decoder recovery", () => {
  beforeEach(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterEach(async () => {
    await IModelApp.shutdown();
    vi.restoreAllMocks();
  });

  it.each(["error", "messageerror"])("replaces the decoder after %s without replaying transferred requests", async (eventType) => {
    const posts = vi.spyOn(Worker.prototype, "postMessage");
    const terminate = vi.spyOn(Worker.prototype, "terminate");
    const listeners = IModelApp.onBeforeShutdown.numberOfListeners;
    expect((await decodeGaussianSplats(gaussianSplatFixture())).count).toBe(1);
    const failedWorker = posts.mock.contexts[0] as Worker;

    // One request transfers immediately; the queued request still owns its buffers.
    const sources = [gaussianSplatFixture(), gaussianSplatFixture()];
    const pending = Promise.allSettled(sources.map(async (source) => decodeGaussianSplats(source)));
    expect(sources.map((source) => source.positions.byteLength === 0)).toEqual([true, false]);
    const fail = (worker: Worker) => worker.dispatchEvent(eventType === "error"
      ? new ErrorEvent("error", { message: "decoder test failure", cancelable: true })
      : new MessageEvent("messageerror"));
    fail(failedWorker);
    const results = await pending;
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected")
        expect(String(result.reason)).toContain(eventType === "error" ? "decoder test failure" : "invalid response");
    }
    expect(posts).toHaveBeenCalledTimes(2); // No retry of the detached inputs.
    expect(terminate.mock.contexts).toEqual([failedWorker]);

    const recovered = await Promise.all([decodeGaussianSplats(gaussianSplatFixture()), decodeGaussianSplats(gaussianSplatFixture())]);
    expect(recovered.map((result) => result.count)).toEqual([1, 1]);
    const replacement = posts.mock.contexts[2] as Worker;
    expect(replacement).not.toBe(failedWorker);
    expect(posts.mock.contexts[3]).toBe(replacement);
    expect(IModelApp.onBeforeShutdown.numberOfListeners).toBe(listeners + 1);

    // Further replacements still use one shutdown listener, which closes the latest worker.
    fail(replacement);
    expect((await decodeGaussianSplats(gaussianSplatFixture())).count).toBe(1);
    const latest = posts.mock.contexts[4] as Worker;
    expect(latest).not.toBe(replacement);
    expect(IModelApp.onBeforeShutdown.numberOfListeners).toBe(listeners + 1);
    await IModelApp.shutdown();
    expect(terminate.mock.contexts).toEqual([failedWorker, replacement, latest]);

    await IModelApp.startup({ localization: new EmptyLocalization() });
    expect((await decodeGaussianSplats(gaussianSplatFixture())).count).toBe(1);
    expect(posts.mock.contexts[5]).not.toBe(latest);
  });

  it("drains a burst whose combined packing peaks exceed the decoder budget", async () => {
    using worker = new GaussianSplatWorker();
    const posts = vi.spyOn(Worker.prototype, "postMessage");
    const sources = Array.from({ length: 3 }, () => ({ spz: new Uint8Array([1, 2, 3]), count: 500000, colorSpace: "srgb_rec709_display" as const }));
    const results = Promise.allSettled(sources.map(async (source) => worker.decode(source)));
    expect(posts).toHaveBeenCalledTimes(1);
    expect(sources.map((source) => source.spz.byteLength)).toEqual([0, 3, 3]);
    expect(worker.bytesUsed).toBe(500000 * 544 + 6);
    for (const result of await results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(String(result.reason)).not.toContain("budget");
    }
    expect(posts).toHaveBeenCalledTimes(3);
    expect(worker.isIdle).toBe(true);
    expect((await worker.decode(gaussianSplatFixture())).count).toBe(1);
  });

  it("keeps the shared worker after a malformed payload", async () => {
    const posts = vi.spyOn(Worker.prototype, "postMessage");
    await expect(decodeGaussianSplats({ spz: new Uint8Array([1, 2, 3]), count: 1, colorSpace: "srgb_rec709_display" })).rejects.toThrow();
    expect((await decodeGaussianSplats(gaussianSplatFixture())).count).toBe(1);
    expect(posts.mock.contexts[1]).toBe(posts.mock.contexts[0]);
  });
});
