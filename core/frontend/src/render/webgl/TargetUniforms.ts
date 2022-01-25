/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Matrix4d, Vector3d } from "@itwin/core-geometry";
import { RenderPlan } from "../RenderPlan";
import { BatchUniforms } from "./BatchUniforms";
import { BranchUniforms } from "./BranchUniforms";
import { FrustumUniforms, FrustumUniformType } from "./FrustumUniforms";
import { UniformHandle } from "./UniformHandle";
import { HiliteUniforms } from "./HiliteUniforms";
import { LightingUniforms } from "./LightingUniforms";
import { Matrix4 } from "./Matrix";
import { ShadowUniforms } from "./ShadowUniforms";
import { StyleUniforms } from "./StyleUniforms";
import { desync, sync, SyncObserver, SyncToken } from "./Sync";
import { Target } from "./Target";
import { ThematicUniforms } from "./ThematicUniforms";
import { ViewRectUniforms } from "./ViewRectUniforms";

class PixelWidthFactor {
  /** The pixel width factor depends on both the frustum and the view rect. It also depends on the frustum scale associated with the current Branch. */
  private readonly _rectSync: SyncObserver = {};
  private readonly _frustumSync: SyncObserver = {};
  private readonly _branchSync: SyncObserver = {};
  private _factor = 0;
  public syncKey = 0;

  public bind(uniform: UniformHandle, uniforms: TargetUniforms): void {
    if (!sync(uniforms.frustum, this._frustumSync) || !sync(uniforms.viewRect, this._rectSync) || !sync(uniforms.branch, this._branchSync))
      this.compute(uniforms.frustum, uniforms.viewRect.width, uniforms.viewRect.height, uniforms.branch.top.frustumScale);

    if (!sync(this, uniform))
      uniform.setUniform1f(this._factor);
  }

  private compute(frustumUniforms: FrustumUniforms, width: number, height: number, scale: { x: number, y: number }): void {
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
      halfPixelHeight = scale.x * tanTheta / height;
      halfPixelWidth = scale.y * tanTheta / width;
    } else {
      halfPixelWidth = scale.x * 0.5 * (right - left) / width;
      halfPixelHeight = scale.y * 0.5 * (top - bottom) / height;
    }

    this._factor = Math.sqrt(halfPixelWidth * halfPixelWidth + halfPixelHeight * halfPixelHeight);
  }
}

// Direction in view space used if solar shadows are disabled and LightSettings.useSolarLighting is false.
const defaultSunDirectionView = new Vector3d(0.272166, 0.680414, 0.680414);

class SunDirection {
  // Sun direction is passed to shader in view coords so depends upon frustum.
  public syncToken?: SyncToken;
  public syncKey = 0;
  private _haveWorldDir = false;
  private readonly _worldDir = Vector3d.unitZ();
  private readonly _viewDir = defaultSunDirectionView.clone();
  private readonly _viewDir32 = new Float32Array(3);
  private _updated = true;

  public update(sunDir: Vector3d | undefined): void {
    const haveWorldDir = undefined !== sunDir;
    if (haveWorldDir !== this._haveWorldDir || (sunDir && !sunDir.isExactEqual(this._worldDir))) {
      this._updated = true;
      desync(this);

      this._haveWorldDir = haveWorldDir;
      if (sunDir) {
        sunDir.clone(this._worldDir);
        this._worldDir.normalizeInPlace();
      }
    }
  }

  public bind(uniform: UniformHandle, uniforms: TargetUniforms): void {
    if (!sync(uniforms.frustum, this) || this._updated) {
      if (this._haveWorldDir) {
        uniforms.frustum.viewMatrix.multiplyVector(this._worldDir, this._viewDir);
        this._viewDir.negate(this._viewDir);
      } else {
        defaultSunDirectionView.clone(this._viewDir);
      }

      this._viewDir.normalizeInPlace();
      this._viewDir32[0] = this._viewDir.x;
      this._viewDir32[1] = this._viewDir.y;
      this._viewDir32[2] = this._viewDir.z;

      desync(this);
      this._updated = false;
    }

    if (!sync(this, uniform))
      uniform.setUniform3fv(this._viewDir32);
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
  public readonly lights = new LightingUniforms();
  public readonly thematic = new ThematicUniforms();
  public readonly branch: BranchUniforms;
  public readonly batch: BatchUniforms;
  public readonly shadow: ShadowUniforms;
  private readonly _pixelWidthFactor = new PixelWidthFactor();
  private readonly _sunDirection = new SunDirection();

  public constructor(target: Target) {
    this.frustum = new FrustumUniforms();
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

  public bindSunDirection(uniform: UniformHandle): void {
    this._sunDirection.bind(uniform, this);
  }

  public updateRenderPlan(plan: RenderPlan): void {
    this.style.update(plan);
    this.hilite.update(plan.hiliteSettings, plan.emphasisSettings);

    let sunDir;
    if (plan.lights) {
      this.lights.update(plan.lights);

      const useSunDir = plan.viewFlags.shadows || plan.lights.solar.alwaysEnabled;
      if (useSunDir)
        sunDir = plan.lights.solar.direction;
    }

    this._sunDirection.update(sunDir);
  }
}
