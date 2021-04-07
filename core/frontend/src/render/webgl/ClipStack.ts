/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { RenderClipVolume } from "../RenderClipVolume";
import { Texture2DData, Texture2DHandle, TextureHandle } from "./Texture";
import { BlipVolume } from "./ClipVolume";
import { GL } from "./GL";
import { System } from "./System";

/** Maintains a stack of ClipVolumes. The volumes nest such that the stack represents the intersection of all the volumes.
 * @internal
 */
export class ClipStack {
  private _cpuBuffer: Uint8Array;
  private _gpuBuffer: Texture2DData;
  private _texture?: Texture2DHandle;
  private readonly _isFloatTexture: boolean
  private _numTotalRows: number;
  private _numRowsInUse: number;
  private readonly _stack: BlipVolume[] = [];
  private _isStackDirty = false;
  private readonly _getTransform: () => Transform;
  private readonly _wantInitialClip: () => boolean;

  public constructor(getTransform: () => Transform, wantInitialClip: () => boolean) {
    this._getTransform = getTransform;
    this._wantInitialClip = wantInitialClip;

    this._isFloatTexture = System.instance.capabilities.supportsTextureFloat;
    this._numTotalRows = this._numRowsInUse = 0;
    this._cpuBuffer = new Uint8Array(this._numTotalRows);
    this._gpuBuffer = this.allocateGpuBuffer();
  }

  public push(clip: RenderClipVolume): void {
    assert(clip instanceof BlipVolume);

    this._stack.push(clip);
    this._numRowsInUse += clip.numRows;
    this._isStackDirty = true;
  }

  public pop(): void {
    assert(this._stack.length > 0);
    const clip = this._stack.pop();
    this._numRowsInUse -= (clip ? clip.numRows : 0);
  }

  public get hasClip(): boolean {
    return this.startIndex < this.endIndex;
  }

  public get startIndex(): number {
    if (this._stack.length === 0 || this._wantInitialClip())
      return 0;

    return this._stack[0].numRows;
  }

  public get endIndex(): number {
    return this._numRowsInUse;
  }

  public get textureHeight(): number {
    return this._numTotalRows;
  }

  public get texture(): TextureHandle | undefined {
    if (this._isStackDirty)
      this.updateTexture();

    return this._texture;
  }

  // ###TODO: We're keeping the extra trailing union boundary. Will shader ignore it?
  private updateTexture(): void {
    let bufferDirty = false;
    if (this._numTotalRows < this._numRowsInUse) {
      // We need to resize the texture.
      assert(this._isStackDirty);
      bufferDirty = true;
      this._texture = dispose(this._texture);
      this._numTotalRows = this._numRowsInUse;
      this._cpuBuffer = new Uint8Array(this._numTotalRows);
      this._gpuBuffer = this.allocateGpuBuffer();
    }

    if (!this._isStackDirty && !bufferDirty)
      return;

    this._isStackDirty = false;

    // Copy each clip's data to the buffer, recording whether the buffer's contents actually changed.
    const transform = this._getTransform();
    let bufferIndex = 0;
    for (const clip of this._stack) {
      const data = clip.getData(transform);
      for (let i = 0; i < data.byteLength; i++) {
        const byte = data[i];
        bufferDirty = bufferDirty || byte !== this._cpuBuffer[bufferIndex];
        this._cpuBuffer[bufferIndex++] = byte;
      }
    }

    // If the contents have changed, upload the new texture data to the GPU.
    if (bufferDirty) {
      if (this._texture) {
        assert(this._texture.height === this._numTotalRows);
        this._texture.replaceTextureData(this._gpuBuffer);
      } else {
        this._texture = Texture2DHandle.createForData(this._isFloatTexture ? 1 : 4, this._numTotalRows, this._gpuBuffer, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
      }
    }
  }

  private allocateGpuBuffer(): Texture2DData {
    return new (this._isFloatTexture ? Float32Array : Uint8Array)(this._cpuBuffer.buffer);
  }
}
