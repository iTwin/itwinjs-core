/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import {
  Point3d,
  Matrix3d,
  Matrix4d,
  Transform,
  XYZ,
} from "@bentley/geometry-core";
import { ViewFlags } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { desync, sync, SyncToken } from "./Sync";
import { UniformHandle } from "./Handle";
import { Target } from "./Target";
import { BatchState, BranchStack, BranchState } from "./BranchState";
import { RenderCommands } from "./RenderCommands";
import { Branch } from "./Graphic";
import { Matrix4 } from "./Matrix";
import { CachedGeometry } from "./CachedGeometry";

function equalXYZs(a: XYZ | undefined, b: XYZ | undefined): boolean {
  if (a === b)
    return true;

  if ((undefined === a) !== (undefined === b))
    return false;

  if (undefined !== a && undefined !== b)
    return a.isExactEqual(b);

  assert(undefined === a && undefined === b);
  return true;
}

/** Maintains uniform variable state associated with the Branch currently being drawn by a Target.
 * @internal
 */
export class BranchUniforms {
  // The model-view and model-view-projection matrices depend on the frustum.
  public syncToken?: SyncToken;
  public syncKey = 0;
  private readonly _stack = new BranchStack();
  private readonly _target: Target;

  // Parameters that affect synchronization.
  private _isInstanced = false;
  private _viewIndependentOrigin?: Point3d;

  // CPU state
  private readonly _mv = Matrix4d.createIdentity();
  private readonly _mvp = Matrix4d.createIdentity();

  // GPU state
  private readonly _mv32 = new Matrix4();
  private readonly _mvp32 = new Matrix4();

  // Working state
  private readonly _scratchTransform = Transform.createIdentity();
  private readonly _scratchTransform2 = Transform.createIdentity();
  private readonly _scratchViewToWorld = Matrix3d.createIdentity();
  private readonly _scratchVIModelMatrix = Transform.createIdentity();
  private readonly _zeroPoint = new Point3d(0, 0, 0);

  public constructor(target: Target) {
    this._target = target;
  }

  public createBatchState(): BatchState {
    return new BatchState(this._stack);
  }

  public createRenderCommands(batchState: BatchState): RenderCommands {
    return new RenderCommands(this._target, this._stack, batchState);
  }

  public get modelViewMatrix(): Matrix4d {
    return this._mv;
  }

  public get top(): BranchState {
    return this._stack.top;
  }

  public pushBranch(branch: Branch): void {
    desync(this);
    this._stack.pushBranch(branch);
  }

  public pushState(state: BranchState): void {
    desync(this);
    this._stack.pushState(state);
  }

  public pop(): void {
    desync(this);
    this._stack.pop();
  }

  public changeViewFlags(vf: ViewFlags): void {
    this._stack.setViewFlags(vf);
  }

  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._stack.setSymbologyOverrides(ovr);
  }

  public bindModelViewMatrix(uniform: UniformHandle, geom: CachedGeometry, isViewCoords: boolean): void {
    if (this.update(uniform, geom, isViewCoords))
      uniform.setMatrix4(this._mv32);
  }

  public bindModelViewProjectionMatrix(uniform: UniformHandle, geom: CachedGeometry, isViewCoords: boolean): void {
    if (this.update(uniform, geom, isViewCoords))
      uniform.setMatrix4(this._mvp32);
  }

  private update(uniform: UniformHandle, geometry: CachedGeometry, isViewCoords: boolean): boolean {
    const uniforms = this._target.uniforms[isViewCoords ? "viewRect" : "frustum"];
    if (!sync(uniforms, this))
      desync(this);

    const instancedGeom = geometry.asInstanced;
    if (undefined !== instancedGeom || this._isInstanced) {
      this._isInstanced = undefined !== instancedGeom;
      desync(this);
    }

    const vio = geometry.viewIndependentOrigin;
    if (!equalXYZs(vio, this._viewIndependentOrigin)) {
      this._viewIndependentOrigin = vio;
      desync(this);
    }

    if (sync(this, uniform))
      return false;

    let mv;
    const modelMatrix = this._target.currentTransform;
    if (isViewCoords) {
      // Zero out Z for silly clipping tools...
      mv = modelMatrix.clone(this._scratchTransform);
      mv.matrix.coffs[2] = mv.matrix.coffs[5] = mv.matrix.coffs[8] = 0.0;

      // Scale based on device-pixel ratio.
      const scale = this._target.devicePixelRatio;
      const viewMatrix = Transform.createScaleAboutPoint(this._zeroPoint, scale, this._scratchTransform2);
      viewMatrix.multiplyTransformTransform(mv, mv);
    } else {
      const viewMatrix = this._target.uniforms.frustum.viewMatrix;
      mv = viewMatrix.clone(this._scratchTransform);

      if (undefined !== instancedGeom) {
        // For instanced geometry, the "model view" matrix is really a transform from center of instanced geometry range to view.
        // Shader will compute final model-view matrix based on this and the per-instance transform.
        mv.multiplyTransformTransform(instancedGeom.getRtcModelTransform(modelMatrix), mv);
      } else {
        if (undefined !== vio) {
          const viewToWorldRot = viewMatrix.matrix.inverse(this._scratchViewToWorld)!;
          const rotateAboutOrigin = Transform.createFixedPointAndMatrix(vio, viewToWorldRot, this._scratchTransform2);
          const viModelMatrix = rotateAboutOrigin.multiplyTransformTransform(modelMatrix, this._scratchVIModelMatrix);
          mv.multiplyTransformTransform(viModelMatrix, mv);
        } else {
          mv = mv.multiplyTransformTransform(modelMatrix, mv);
        }
      }
    }

    Matrix4d.createTransform(mv, this._mv);
    this._mv32.initFromTransform(mv);

    // Don't bother computing mvp for instanced geometry - it's not used.
    if (!this._isInstanced) {
      uniforms.projectionMatrix.multiplyMatrixMatrix(this._mv, this._mvp);
      this._mvp32.initFromMatrix4d(this._mvp);
    }

    return true;
  }
}
