/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { basisWorkerScript } from "./BasisWorker";
import { System } from "./System";

// async function _fetchBasisTranscoderWasm(): Promise<ArrayBuffer> {
//   const resp = await fetch("http://localhost:3000/basis_transcoder.wasm");
//   return resp.arrayBuffer();
// }

// async function _fetchBasisTranscoderJs(): Promise<string> {
//   const resp = await fetch("http://localhost:3000/basis_transcoder.js");
//   return resp.text();
// }

// The following function dynamically imports the transcoder script and wasm binary.
// This is ideal because they are both large pieces of data, and we want to skip downloading them when Basis is not used.
async function _fetchBasisTranscoder(): Promise<{js: string, wasm: Uint8Array}> {
  const { basisTranscoderScript, basisTranscoderWasm } = await import("./BasisTranscoder");
  return { js: basisTranscoderScript, wasm: Base64.toUint8Array(basisTranscoderWasm) };
}

enum BasisTranscodeFormat {
  ETC1_RGB = 0, // ETC1 (RGB)
  ETC2_RGBA = 1, // ETC2 (RGBA)
  BC1_RGB = 2, // DXT1 (RGB)
  BC3_RGBA = 3, // DXT5 (RGBA)
  PVRTC1_4_RGB = 8, // PVRTC1 (RGB)
  PVRTC1_4_RGBA = 9, // PVRTC1 (RGBA)
  RGBA32 = 13, // Uncompressed 32bpp RGBA
}

interface TextureFormats {
  basisFormat: BasisTranscodeFormat;
  glFormat: number;
}

interface TextureFormatsForTranscoder {
  rgb: TextureFormats;
  rgba: TextureFormats;
}

/** @internal */
export interface TranscodedTextureData {
  buffers: Array<Uint8Array>;
  dimensions: Array<{width: number, height: number}>;
  glFormat: number;
  hasAlpha: boolean;
}

interface TranscodeJob {
  basisBuffer: Uint8Array;
  wantMipMaps: boolean;
  textureFormats: TextureFormatsForTranscoder;
  resolver: (value: TranscodedTextureData | PromiseLike<TranscodedTextureData>) => void;
  callback?: (value: TranscodedTextureData) => void;
}

export class BasisLoader {
  private _compressedTextureExtensions: any;
  private _initPromise?: Promise<void>;
  private static _instance?: BasisLoader;
  private _basisWorker?: Worker;
  private _wasmBinary: any;
  private _pendingTranscodeJobs: Array<TranscodeJob> = [];
  private _activeTranscodeJob?: TranscodeJob;

  public static get instance(): BasisLoader {
    if (undefined === this._instance)
      this._instance = new BasisLoader();
    return this._instance;
  }

  private constructor() {
    this._compressedTextureExtensions = System.instance.capabilities.compressedTextureExtensions;
  }

  private _determineTextureFormats(): TextureFormatsForTranscoder {
    const rgbaFmt = { basisFormat: BasisTranscodeFormat.RGBA32, glFormat: System.instance.context.RGBA };
    const dxt = this._compressedTextureExtensions.dxt;
    const etc1 = this._compressedTextureExtensions.etc1;
    const etc2 = this._compressedTextureExtensions.etc2;
    const pvrtc = this._compressedTextureExtensions.pvrtc;

    if (undefined !== dxt)
      return {
        rgb: { basisFormat: BasisTranscodeFormat.BC1_RGB, glFormat: dxt.COMPRESSED_RGB_S3TC_DXT1_EXT },
        rgba: { basisFormat: BasisTranscodeFormat.BC3_RGBA, glFormat: dxt.COMPRESSED_RGBA_S3TC_DXT5_EXT },
      };
    if (undefined !== etc1 || undefined !== etc2)
      return {
        rgb: etc1 !== undefined ? { basisFormat: BasisTranscodeFormat.ETC1_RGB, glFormat: this._compressedTextureExtensions.etc1.COMPRESSED_RGB_ETC1_WEBGL } : rgbaFmt,
        rgba: etc2 !== undefined ? { basisFormat: BasisTranscodeFormat.ETC2_RGBA, glFormat: etc2.COMPRESSED_RGBA8_ETC2_EAC } : rgbaFmt,
      };
    if (undefined !== pvrtc)
      return {
        rgb: { basisFormat: BasisTranscodeFormat.PVRTC1_4_RGB, glFormat: pvrtc.COMPRESSED_RGB_PVRTC_4BPPV1_IMG },
        rgba: { basisFormat: BasisTranscodeFormat.PVRTC1_4_RGBA, glFormat: pvrtc.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG },
      };

    return { rgb: rgbaFmt, rgba: rgbaFmt }; // fallback - uncompressed RGBA pixels
  }

  private async _init() {
    if (undefined === this._initPromise) {
      const transcoderPromise = _fetchBasisTranscoder();

      this._initPromise = Promise.all([transcoderPromise]).then(([transcoder]) => {
        const js = [transcoder.js, basisWorkerScript].join("\n\n");
        const srcUrl = URL.createObjectURL(new Blob([js]));
        this._wasmBinary = transcoder.wasm;
        this._basisWorker = new Worker(srcUrl);
        this._basisWorker.addEventListener("message", BasisLoader._basisWorkerEventListener);
        this._basisWorker.postMessage({ command: "initializeBasisModule", wasmBinary: this._wasmBinary});
      });
    }

    return this._initPromise;
  }

  private static _basisWorkerEventListener(e: any) {
    const message = e.data;
    switch (message.type) {
      case "transcodeBasisResult":
        if ("success" === message.result) {
          const buffers = new Array<Uint8Array>();
          message.transcodedBuffers.forEach((element: any) => {
            buffers.push(new Uint8Array(element));
          });
          BasisLoader.instance._resolveActiveTranscodeJob(buffers, message.dimensions, message.hasAlpha);
        }
        break;
    }
  }

  private _resolveActiveTranscodeJob(buffers: Array<Uint8Array>, dimensions: Array<{width: number, height: number}>, hasAlpha: boolean) {
    const activeJob = this._activeTranscodeJob;
    assert(activeJob !== undefined);

    const transcodeResult = { buffers, dimensions, glFormat: hasAlpha ? activeJob.textureFormats.rgba.glFormat : activeJob.textureFormats.rgb.glFormat, hasAlpha };

    console.log(`transcode result: numLevels=${  buffers.length }, hasAlpha=${  hasAlpha}`);

    activeJob.resolver(transcodeResult);
    if (undefined !== activeJob.callback)
      activeJob.callback(transcodeResult);

    if (this._pendingTranscodeJobs.length > 0) {
      const nextJob = this._pendingTranscodeJobs.shift()!;
      this._activeTranscodeJob = nextJob;
      this._startActiveTranscodeJob();
    } else
      this._activeTranscodeJob = undefined;
  }

  private _startActiveTranscodeJob() {
    const activeJob = this._activeTranscodeJob;
    assert(activeJob !== undefined);
    const basisBuffers = [ activeJob.basisBuffer.buffer ];
    this._basisWorker?.postMessage({ command: "transcodeBasisImage", basisBuffers, transcodeFormats: { rgb: activeJob.textureFormats.rgb.basisFormat, rgba: activeJob.textureFormats.rgba.basisFormat }, wantMipMaps: activeJob.wantMipMaps }, basisBuffers);
  }

  public async transcodeBasisTexture(basisBuffer: Uint8Array, wantMipMaps: boolean, callback?: (value: TranscodedTextureData) => void): Promise<TranscodedTextureData | undefined> {
    await this._init();

    let resultPromise;

    const textureFormats = this._determineTextureFormats();

    if (undefined === this._activeTranscodeJob) {
      resultPromise = new Promise<TranscodedTextureData>((resolver) => {
        this._activeTranscodeJob = { basisBuffer, wantMipMaps, textureFormats, resolver, callback };
        this._startActiveTranscodeJob();
      });
    } else {
      resultPromise = new Promise<TranscodedTextureData>((resolver) => {
        this._pendingTranscodeJobs.push({ basisBuffer, wantMipMaps, textureFormats, resolver, callback });
      });
    }

    return resultPromise;
  }
}
