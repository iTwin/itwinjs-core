/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { RgbColor } from "@bentley/imodeljs-common";
import { IModelApp } from "../../IModelApp";
import { RenderClipVolume } from "../RenderClipVolume";
import { FloatRgba } from "./FloatRGBA";
import { Texture2DData, Texture2DHandle, TextureHandle } from "./Texture";
import { BlipVolume } from "./ClipVolume";
import { GL } from "./GL";
import { System } from "./System";

interface Clip {
  readonly numRows: number;
  readonly getData: (transform: Transform) => Uint8Array;
}

const emptyClipData = new Uint8Array(0);
const emptyClip = {
  numRows: 0,
  getData: () => emptyClipData,
};

/** Maintains a stack of ClipVolumes. The volumes nest such that the stack represents the intersection of all the volumes.
 * The bottom of the stack represents the view's clip volume and is always present even if the view has no clip.
 * It also maintains the inside/outside clip colors, where the alpha component is 1 if the color should be applied and 0 if not.
 * @internal
 */
export class ClipStack {
  protected _cpuBuffer: Uint8Array;
  protected _gpuBuffer: Texture2DData;
  protected _texture?: Texture2DHandle;
  protected readonly _isFloatTexture: boolean
  protected _numTotalRows: number;
  protected _numRowsInUse: number;
  protected readonly _stack: Clip[] = [ emptyClip ];
  protected _isStackDirty = false;
  protected readonly _getTransform: () => Transform;
  protected readonly _wantViewClip: () => boolean;
  protected readonly _insideColor = FloatRgba.from(0, 0, 0, 0);
  protected readonly _outsideColor = FloatRgba.from(0, 0, 0, 0);

  public constructor(getTransform: () => Transform, wantViewClip: () => boolean) {
    this._getTransform = getTransform;
    this._wantViewClip = wantViewClip;

    this._isFloatTexture = System.instance.capabilities.supportsTextureFloat;
    this._numTotalRows = this._numRowsInUse = 0;
    this._cpuBuffer = new Uint8Array(this._numTotalRows);
    this._gpuBuffer = this.allocateGpuBuffer();
  }

  public get insideColor(): FloatRgba {
    return this._insideColor;
  }

  public get outsideColor(): FloatRgba {
    return this._outsideColor;
  }

  public get hasOutsideColor(): boolean {
    return this.outsideColor.alpha !== 0;
  }

  public setViewClip(clip: ClipVector | undefined, style: { insideColor?: RgbColor, outsideColor?: RgbColor }): void {
    assert(this._stack.length === 1);

    this.updateColor(style.insideColor, this._insideColor);
    this.updateColor(style.outsideColor, this._outsideColor);

    const cur = this._stack[0];
    if (cur === emptyClip) {
      if (!clip)
        return; // no change.
    } else if (!clip) {
      this._stack[0] = emptyClip;
      this._numRowsInUse = 0;
      this._isStackDirty = true;
      return;
    } else {
      assert(cur instanceof BlipVolume);
      if (cur.clipVector === clip) {
        // We assume that the active view's ClipVector is never mutated in place, so if we are given the same ClipVector, we expect our RenderClipVolume to match it.
        return;
      }
    }

    // ClipVector has changed.
    // ###TODO const newClip = IModelApp.renderSystem.createClipVolume(clip);
    const newClip = BlipVolume.create(clip);
    if (!newClip) {
      this._isStackDirty = this._stack[0] !== emptyClip;
      this._stack[0] = emptyClip;
      this._numRowsInUse = 0;
    } else {
      this.pop();
      this.push(newClip);
    }
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

  public get numClipPlanes(): number {
    return this.endIndex - this.startIndex;
  }

  public get startIndex(): number {
    assert(this._stack.length > 0);
    return this._wantViewClip() ? 0 : this._stack[0].numRows;
  }

  public get endIndex(): number {
    return this._numRowsInUse;
  }

  public get textureHeight(): number {
    return this._numTotalRows;
  }

  public get texture(): TextureHandle | undefined {
    this.updateTexture();
    return this._texture;
  }

  // ###TODO: We're keeping the extra trailing union boundary. Will shader ignore it?
  protected updateTexture(): void {
    if (this._numTotalRows < this._numRowsInUse) {
      // We need to resize the texture.
      assert(this._isStackDirty);
      this._isStackDirty = true;
      this._texture = dispose(this._texture);
      this._numTotalRows = this._numRowsInUse;
      this._cpuBuffer = new Uint8Array(this._numTotalRows * 4 * 4);
      this._gpuBuffer = this.allocateGpuBuffer();
    }

    if (this._isStackDirty) {
      this._isStackDirty = false;
      this.recomputeTexture();
    }
  }

  protected recomputeTexture(): void {
    // Copy each clip's data to the buffer, recording whether the buffer's contents actually changed.
    let bufferDirty = false;
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
      this.uploadTexture();
    }
  }

  protected uploadTexture(): void {
    if (this._texture) {
      assert(this._texture.height === this._numTotalRows);
      this._texture.replaceTextureData(this._gpuBuffer);
    } else {
      this._texture = Texture2DHandle.createForData(this._isFloatTexture ? 1 : 4, this._numTotalRows, this._gpuBuffer, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    }
  }

  protected allocateGpuBuffer(): Texture2DData {
    if (this._isFloatTexture)
      return new Float32Array(this._cpuBuffer.buffer);

    return this._cpuBuffer;
  }

  protected updateColor(rgb: RgbColor | undefined, rgba: FloatRgba): void {
    rgba.alpha = undefined !== rgb ? 1 : 0;
    if (rgb)
      rgba.setRgbColor(rgb)
  }
}
