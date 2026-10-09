/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { generate_splat_texture, initSync, radix_sort_gaussians_indexes } from "@cesium/wasm-splats";
import wasmUrl from "@cesium/wasm-splats/wasm_splats_bg.wasm?url&inline";

// @cesium/wasm-splats 0.1.0-alpha.2, Apache-2.0. Keep the alpha API behind this adapter.
let memory: WebAssembly.Memory | undefined;
function initialize(): void {
  memory ??= initSync({ module: Uint8Array.from(atob(wasmUrl.substring(wasmUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0)) }).memory;
}

/** WASM retains its heap high-water mark until the owning worker terminates. @internal */
export function gaussianSplatWasmBytes(): number { return memory?.buffer.byteLength ?? 0; }

/** Call only after validating every input. TextureData.data copies; always free its Rust owner. @internal */
export function generateGaussianSplatTexture(positions: Float32Array, scales: Float32Array, rotations: Float32Array, colors: Uint8Array): Uint32Array {
  initialize();
  const texture = generate_splat_texture(positions, scales, rotations, colors, colors.length / 4);
  try {
    const data = texture.data;
    return data.length === colors.length * 2 ? data : data.slice(0, colors.length * 2);
  } finally {
    texture.free();
  }
}

/** Sort bounded scalar keys encoded in Z; the kernel orders increasing view Z. @internal */
export function sortGaussianSplatKeys(positions: Float32Array): Uint32Array {
  initialize();
  return radix_sort_gaussians_indexes(positions, new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]), positions.length / 3);
}
