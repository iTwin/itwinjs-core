/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Logger } from "@itwin/core-bentley";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import type { ExtMeshoptCompressionFilter, ExtMeshoptCompressionMode } from "../common/gltf/GltfSchema";

/** Arguments supplied to decodeMeshoptBuffer.
 * @internal
 */
export interface DecodeMeshoptBufferArgs {
  byteStride: number;
  count: number;
  mode: ExtMeshoptCompressionMode;
  filter?: ExtMeshoptCompressionFilter;
}

/** The meshoptimizer decoder
 * @internal
 */
export interface MeshoptDecoder {
  supported: boolean;
  ready: Promise<void>;

  decodeVertexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string) => void;
  decodeIndexBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;
  decodeIndexSequence: (target: Uint8Array, count: number, size: number, source: Uint8Array) => void;

  decodeGltfBuffer: (target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string) => void;

  useWorkers: (count: number) => void;
  decodeGltfBufferAsync: (count: number, size: number, source: Uint8Array, mode: string, filter?: string) => Promise<Uint8Array>;
};

/**Loads and configures the MeshoptDecoder module on demand. */
class Loader {
  private _status: "uninitialized" | "loading" | "ready" | "failed";
  private _promise?: Promise<void>;
  private _decoder?: MeshoptDecoder;
  private _numWorkers: number;

  public constructor(numWorkers: number = 0) {
    this._status = "uninitialized";
    this._numWorkers = numWorkers;
  }

  public async getDecoder(): Promise<MeshoptDecoder | undefined> {

    const status = this._status;
    switch (status) {
      case "failed":
        assert(undefined === this._decoder);
        assert(undefined === this._promise);
        return undefined;
      case "ready":
        assert(undefined !== this._decoder);
        assert(undefined === this._promise);
        return this._decoder;
      case "loading":
        assert(undefined !== this._promise);
        await this._promise;
        assert("failed" === this._status || "ready" === this._status);
        assert(undefined === this._promise);
        return this._decoder;
    }

    assert("uninitialized" === status);
    this._status = "loading";
    this._promise = this.load();

    return this.getDecoder();
  }

  private async load(): Promise<void> {
    try {
      // Import the module on first use.
      const decoder = (await import("meshoptimizer")).MeshoptDecoder;

      if(!decoder.supported){
        Logger.logError(FrontendLoggerCategory.Render, "MeshoptDecoder is not supported in this environment.");
        this._status = "failed";
      }
      else {
        await decoder.ready;
        if(this._numWorkers > 0){
          decoder.useWorkers(this._numWorkers);
        }
        this._status = "ready";
        this._decoder = decoder;
      }
    } catch (err) {
      Logger.logException(FrontendLoggerCategory.Render, err);
      this._status = "failed";
    } finally {
      this._promise = undefined;
    }
  }
}

let meshoptDecoders = new Map<number, MeshoptDecoder | undefined>();

/** @internal */
export async function getMeshoptDecoder(numWorkers: number = 0): Promise<MeshoptDecoder | undefined> {
  if(!meshoptDecoders.has(numWorkers)){
    const loader = new Loader(numWorkers);
    const decoder = await loader.getDecoder();
    meshoptDecoders.set(numWorkers, decoder);
  }
  return meshoptDecoders.get(numWorkers);
}

/** @internal */
export async function decodeMeshoptBuffer(source: Uint8Array, args: DecodeMeshoptBufferArgs): Promise<Uint8Array | undefined> {
  const decoder = await getMeshoptDecoder(1);
  if (!decoder) {
    return undefined;
  }

  return decoder.decodeGltfBufferAsync(args.count, args.byteStride, source, args.mode, args.filter);
}
