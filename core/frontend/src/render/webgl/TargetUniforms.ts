/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Matrix4d } from "@bentley/geometry-core";
import {
  FrustumUniforms,
  FrustumUniformType,
} from "./FrustumUniforms";
import { HiliteUniforms } from "./HiliteUniforms";
import { StyleUniforms } from "./StyleUniforms";
import { ViewRectUniforms } from "./ViewRectUniforms";
import { BatchUniforms } from "./BatchUniforms";
import { BranchUniforms } from "./BranchUniforms";
import { ShadowUniforms } from "./ShadowUniforms";
import { UniformHandle } from "./Handle";
import { Matrix4 } from "./Matrix";
import { Target } from "./Target";
import { desync, sync, SyncObserver } from "./Sync";

class PixelWidthFactor {
  /** The pixel width factor depends on both the frustum and the view rect. */
  private readonly _rectSync: SyncObserver = { };
  private readonly _frustumSync: SyncObserver = { };
  private _factor = 0;
  public syncKey = 0;

  public bind(uniform: UniformHandle, uniforms: TargetUniforms): void {
    if (!sync(uniforms.frustum, this._frustumSync) || !sync(uniforms.viewRect, this._rectSync))
      this.compute(uniforms.frustum, uniforms.viewRect.width, uniforms.viewRect.height);

    if (!sync(this, uniform))
      uniform.setUniform1f(this._factor);
  }

  private compute(frustumUniforms: FrustumUniforms, width: number, height: number): void {
    desync(this);

    const frustumPlanes = frustumUniforms.planes;
    const top = frustumPlanes[0];
    const bottom = frustumPlanes[1];
    const left = frustumPlanes[2];
    const right = frustumPlanes[3];

    let halfPixelWidth: number;
    let halfPixelHeight: number;

    const frustum = frustumUniforms.frustum;

    if (FrustumUniformType.Perspective === frustumUniforms.type) {
      const inverseNear = 1.0 / frustum[0];
      const tanTheta = top * inverseNear;
      halfPixelHeight = tanTheta / height;
      halfPixelWidth = tanTheta / width;
    } else {
      halfPixelWidth = 0.5 * (right - left) / width;
      halfPixelHeight = 0.5 * (top - bottom) / height;
    }

    this._factor = Math.sqrt(halfPixelWidth * halfPixelWidth + halfPixelHeight * halfPixelHeight);
  }
}

/** Holds state for commonly-used uniforms to avoid unnecessary recomputation, owned by a Target.
 * DO NOT directly modify exposed members of the objects exposed by this class. Use their APIs.
 * e.g., code like `target.uniforms.frustum.projectionMatrix.setFrom(someOtherMatrix)` or `target.uniforms.branch.top.setViewFlags(blah)` will cause bugs.
 * @internal
 */
export class TargetUniforms {
  public readonly frustum: FrustumUniforms;
  public readonly viewRect = new ViewRectUniforms();
  public readonly hilite = new HiliteUniforms();
  public readonly style = new StyleUniforms();
  public readonly branch: BranchUniforms;
  public readonly batch: BatchUniforms;
  public readonly shadow: ShadowUniforms;
  private readonly _pixelWidthFactor = new PixelWidthFactor();

  public constructor(target: Target) {
    this.frustum = new FrustumUniforms(target);
    this.branch = new BranchUniforms(target);
    this.batch = new BatchUniforms(target, this.branch.createBatchState());
    this.shadow = new ShadowUniforms(target);
  }

  public getProjectionMatrix(forViewCoords: boolean): Matrix4d {
    return forViewCoords ? this.viewRect.projectionMatrix : this.frustum.projectionMatrix;
  }

  public getProjectionMatrix32(forViewCoords: boolean): Matrix4 {
    return forViewCoords ? this.viewRect.projectionMatrix32 : this.frustum.projectionMatrix32;
  }

  public bindProjectionMatrix(uniform: UniformHandle, forViewCoords: boolean): void {
    if (forViewCoords)
      this.viewRect.bindProjectionMatrix(uniform);
    else
      this.frustum.bindProjectionMatrix(uniform);
  }

  public bindPixelWidthFactor(uniform: UniformHandle): void {
    this._pixelWidthFactor.bind(uniform, this);
  }
}
