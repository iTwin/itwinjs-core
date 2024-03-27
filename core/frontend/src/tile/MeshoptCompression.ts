/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Logger } from "@itwin/core-bentley";
import { FrontendLoggerCategory } from "../common/FrontendLoggerCategory";
import type { MeshoptDecoder } from "meshoptimizer";
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

/** Loads and configures the MeshoptDecoder module on demand. */
class Loader {
  private _status: "uninitialized" | "loading" | "ready" | "failed";
  private _promise?: Promise<void>;
  private _decoder?: typeof MeshoptDecoder;

  public constructor() {
    this._status = "uninitialized";
  }

  public async getDecoder(): Promise<typeof MeshoptDecoder | undefined> {
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
      await decoder.ready;

      // Configure it to do the decoding outside of the main thread. No compelling reason to use more than one worker.
      decoder.useWorkers(1);

      this._status = "ready";
      this._decoder = decoder;
    } catch (err) {
      Logger.logException(FrontendLoggerCategory.Render, err);
      this._status = "failed";
    } finally {
      this._promise = undefined;
    }
  }
}

const loader = new Loader();

/** @internal */
export async function decodeMeshoptBuffer(source: Uint8Array, args: DecodeMeshoptBufferArgs): Promise<Uint8Array | undefined> {
  const decoder = await loader.getDecoder();
  if (!decoder) {
    return undefined;
  }

  return decoder.decodeGltfBufferAsync(args.count, args.byteStride, source, args.mode, args.filter);
}
