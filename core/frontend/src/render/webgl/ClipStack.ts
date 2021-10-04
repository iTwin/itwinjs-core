/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { ClipPlaneContainment, ClipVector, Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { RgbColor } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { RenderClipVolume } from "../RenderClipVolume";
import { FloatRgba } from "./FloatRGBA";
import { Texture2DData, Texture2DHandle, TextureHandle } from "./Texture";
import { ClipVolume } from "./ClipVolume";
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

const scratchRangeCorners = [
  new Point3d(), new Point3d(), new Point3d(), new Point3d(),
  new Point3d(), new Point3d(), new Point3d(), new Point3d(),
];

function getRangeCorners(r: Range3d): Point3d[] {
  return r.corners(scratchRangeCorners);
}

/** Maintains a stack of ClipVolumes. The volumes nest such that the stack represents the intersection of all the volumes.
 * The bottom of the stack represents the view's clip volume and is always present even if the view has no clip.
 * It also maintains the inside/outside clip colors, where the alpha component is 1 if the color should be applied and 0 if not.
 * @internal
 */
export class ClipStack {
  /** Encoded data for all clips on the stack, update when the stack or the transform changes. */
  protected _cpuBuffer: Uint8Array;
  /** A view of the encoded buffer in the format expected by the GPU. */
  protected _gpuBuffer: Texture2DData;
  protected _texture?: Texture2DHandle;
  protected readonly _isFloatTexture: boolean;
  /** The maximum number of rows we have ever required. Determines the texture height. Grows as needed, reallocating a larger texture, but never shrinks. */
  protected _numTotalRows: number;
  /** The number of rows in the texture actually required to encode the current contents of the stack. */
  protected _numRowsInUse: number;
  /** The first entry always represents the view clip. The rest are pushed and popped with GraphicBranches. */
  protected readonly _stack: Clip[] = [emptyClip];
  /** True if we need to recompute the texture. */
  protected _isStackDirty = false;
  /** Obtain the transform to be applied to the clips - i.e., the view matrix. */
  protected readonly _getTransform: () => Transform;
  /** If this returns false, the clip at the bottom of the stack is ignored. */
  protected readonly _wantViewClip: () => boolean;
  /** If alpha is 1 then geometry inside the clip will be drawn in this color. */
  protected readonly _insideColor = FloatRgba.from(0, 0, 0, 0);
  /** If alpha is 1 then geometry outside the clip will be drawn in this color. */
  protected readonly _outsideColor = FloatRgba.from(0, 0, 0, 0);
  /** For detecting whether the transform changed from one invocation of setViewClip to the next. */
  protected readonly _prevTransform = Transform.createZero();

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

  public get bytesUsed(): number {
    return this._texture ? this._texture.bytesUsed : 0;
  }

  public setViewClip(clip: ClipVector | undefined, style: { insideColor?: RgbColor, outsideColor?: RgbColor }): void {
    assert(this._stack.length === 1);

    this.updateColor(style.insideColor, this._insideColor);
    this.updateColor(style.outsideColor, this._outsideColor);

    const transform = this._getTransform();
    if (!transform.isAlmostEqual(this._prevTransform)) {
      transform.clone(this._prevTransform);
      this._isStackDirty = true;
    }

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
      assert(cur instanceof ClipVolume);
      if (cur.clipVector === clip) {
        // We assume that the active view's ClipVector is never mutated in place, so if we are given the same ClipVector, we expect our RenderClipVolume to match it.
        return;
      }
    }

    // ClipVector has changed.
    const newClip = IModelApp.renderSystem.createClipVolume(clip);
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
    assert(clip instanceof ClipVolume);

    this._stack.push(clip);
    this._numRowsInUse += clip.numRows;
    this._numTotalRows = Math.max(this._numRowsInUse, this._numTotalRows);
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

  public get hasViewClip(): boolean {
    return emptyClip !== this._stack[0] && this._wantViewClip();
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

  public isRangeClipped(range: Range3d, transform: Transform): boolean {
    if (this.hasOutsideColor || !this.hasClip)
      return false;

    range = transform.multiplyRange(range, range);
    const corners = getRangeCorners(range);
    const startIndex = this._wantViewClip() && emptyClip !== this._stack[0] ? 0 : 1;
    for (let i = startIndex; i < this._stack.length; i++) {
      const clip = this._stack[i];
      assert(clip instanceof ClipVolume);
      if (ClipPlaneContainment.StronglyOutside === clip.clipVector.classifyPointContainment(corners))
        return true;
    }

    return false;
  }

  /** Exposed strictly for tests. */
  public get clips(): ReadonlyArray<{ numRows: number }> {
    return this._stack;
  }

  /** Exposed strictly for tests. */
  public static get emptyViewClip() {
    return emptyClip;
  }

  protected updateTexture(): void {
    if (this._numTotalRows > 0 && (!this._texture || this._texture.height < this._numTotalRows)) {
      // We need to resize the texture.
      assert(this._isStackDirty);
      this._isStackDirty = true;
      this._texture = dispose(this._texture);
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
    if (this._texture)
      this._texture.replaceTextureData(this._gpuBuffer);
    else
      this._texture = Texture2DHandle.createForData(this._isFloatTexture ? 1 : 4, this._numTotalRows, this._gpuBuffer, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);

    assert(this._texture!.height === this._numTotalRows);
  }

  protected allocateGpuBuffer(): Texture2DData {
    if (this._isFloatTexture)
      return new Float32Array(this._cpuBuffer.buffer);

    return this._cpuBuffer;
  }

  protected updateColor(rgb: RgbColor | undefined, rgba: FloatRgba): void {
    rgba.alpha = undefined !== rgb ? 1 : 0;
    if (rgb)
      rgba.setRgbColor(rgb);
  }
}
