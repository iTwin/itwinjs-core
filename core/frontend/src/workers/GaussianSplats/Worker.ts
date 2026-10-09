/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { loadSpz } from "@spz-loader/core";
import { GaussianSplatDecodeRequest, gaussianSplatError } from "../../internal/render/GaussianSplatData";
import { GaussianSplatSortRequest } from "../../internal/render/GaussianSplatSort";

import { gaussianSplatWasmBytes } from "./Wasm";
import { packGaussianSplats } from "./Packing";
import { sortGaussianSplats } from "./Sorting";

const positions = new Map<number, Float32Array>();

async function validateSpz(request: Extract<GaussianSplatDecodeRequest, { spz: Uint8Array }>): Promise<void> {
  // Inspect only the gzip header output before allocating the WASM cloud. Invalid or oversized tiles must
  // produce a useful error instead of aborting the codec's bounded address space.
  const reader = new Blob([request.spz]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const header = new Uint8Array(16);
  let length = 0;
  try {
    while (length < header.length) {
      const chunk = await reader.read();
      if (chunk.done)
        gaussianSplatError("truncated SPZ header");

      const bytes = chunk.value.subarray(0, header.length - length);
      header.set(bytes, length);
      length += bytes.length;
    }
  } finally {
    await reader.cancel();
  }

  const view = new DataView(header.buffer);
  const count = view.getUint32(8, true), degree = header[12];
  const version = view.getUint32(4, true);
  const validVersion = version === 2 || (version === 3 && request.coordinateSystem === "UNSPECIFIED");
  if (view.getUint32(0, true) !== 0x5053474e || !validVersion || count !== request.count || count > 2 * 1024 * 1024 || degree > 3 || header[13] > 24)
    gaussianSplatError("invalid SPZ header, count or SH degree");

  const estimatedBytes = count * (14 + ((degree + 1) ** 2 - 1) * 3) * 4 * 2;
  if (estimatedBytes > 512 * 1024 ** 2 || count * (((degree + 1) ** 2 * 3) * 8 + 160) > 512 * 1024 ** 2)
    gaussianSplatError("SPZ tile exceeds the decoder memory limit; split it into smaller tiles");
}

async function decode(request: GaussianSplatDecodeRequest) {
  if (!("spz" in request))
    return packGaussianSplats(request);

  await validateSpz(request);
  // The library returns activated scales/opacities and display colors, not raw SPZ log/logit/DC values.
  const cloud = await loadSpz(request.spz, { unpackOptions: { coordinateSystem: request.coordinateSystem ?? "LUF" }, colorScaleFactor: 1 });
  if (cloud.numPoints !== request.count || cloud.shDegree < 0 || cloud.shDegree > 3)
    gaussianSplatError("invalid SPZ count or unsupported SH degree");

  const sh = new Float32Array(cloud.numPoints * (cloud.shDegree + 1) ** 2 * 3);
  const higher = ((cloud.shDegree + 1) ** 2 - 1) * 3;
  if (cloud.colors.length !== cloud.numPoints * 3 || cloud.sh.length !== cloud.numPoints * higher)
    gaussianSplatError("invalid SPZ spherical harmonics");

  for (let i = 0; i < cloud.numPoints; i++) {
    for (let c = 0; c < 3; c++)
      sh[i * (higher + 3) + c] = cloud.colors[i * 3 + c] - 0.5;

    sh.set(cloud.sh.subarray(i * higher, (i + 1) * higher), i * (higher + 3) + 3);
  }

  return packGaussianSplats({
    positions: cloud.positions, scales: cloud.scales, rotations: cloud.rotations, opacities: cloud.alphas,
    sh, sortingMethod: request.coordinateSystem === "UNSPECIFIED" ? "viewDepth" : "cameraDistance", shDegree: cloud.shDegree, colorSpace: request.colorSpace, antialiased: cloud.antialiased,
  });
}

// Keep RPC local to this worker: errors, including failure to instantiate WASM, always settle the caller.
async function handleMessage(event: MessageEvent): Promise<void> {
  const { id, operation, payload } = event.data;
  try {
    let result: unknown;
    let transfer: Transferable[] = [];
    switch (operation) {
      case "decode": {
        const decoded = await decode(payload);
        result = decoded;
        transfer = [decoded.data.buffer, decoded.sh.buffer];
        if (decoded.covariance) transfer.push(decoded.covariance.buffer);
        if (decoded.appearance) transfer.push(decoded.appearance.buffer);
        break;
      }
      case "register":
        positions.set(payload.id, payload.positions);
        break;
      case "release":
        for (const tile of payload as number[])
          positions.delete(tile);
        break;
      case "sort": {
        const sorted = sortGaussianSplats(payload as GaussianSplatSortRequest, positions);
        result = sorted;
        transfer = [sorted.buffer];
        break;
      }
      default:
        gaussianSplatError("unknown worker operation");
    }

    self.postMessage({ id, result, wasmBytes: gaussianSplatWasmBytes() }, { transfer });
  } catch (error) {
    self.postMessage({ id, wasmBytes: gaussianSplatWasmBytes(), error: error instanceof Error ? error.message : String(error) });
  }
}

// Serialize codec work: simultaneous async SPZ decodes must not multiply cloud/packing peaks.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent) => {
  queue = queue.then(async () => handleMessage(event));
};
