/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { ClipVector, Matrix3d, Matrix4d, Point3d, Transform, XYZ } from "@itwin/core-geometry";
import { ClipStyle, HiddenLine, ViewFlags } from "@itwin/core-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { BranchState } from "./BranchState";
import { BranchStack } from "./BranchStack";
import { BatchState } from "./BatchState";
import { CachedGeometry } from "./CachedGeometry";
import { Branch } from "./Graphic";
import { UniformHandle } from "./UniformHandle";
import { Matrix3, Matrix4 } from "./Matrix";
import { RenderCommands } from "./RenderCommands";
import { desync, sync, SyncToken } from "./Sync";
import { Target } from "./Target";
import { ClipStack } from "./ClipStack";

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
  public readonly clipStack: ClipStack;
  private _viewClipEnabled = false;

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
  private readonly _m32 = new Matrix4();
  private readonly _v32 = new Matrix3();
  private readonly _mvn32 = new Matrix3();

  // Working state
  private readonly _scratchTransform = Transform.createIdentity();
  private readonly _scratchTransform2 = Transform.createIdentity();
  private readonly _scratchViewToWorld = Matrix3d.createIdentity();
  private readonly _scratchVIModelMatrix = Transform.createIdentity();
  private readonly _zeroPoint = new Point3d(0, 0, 0);

  public get stack(): BranchStack { return this._stack; }

  public constructor(target: Target) {
    this._target = target;
    this.clipStack = new ClipStack(
      () => target.uniforms.frustum.viewMatrix,
      () => this._viewClipEnabled && this.top.viewFlags.clipVolume,
    );
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

  public get length(): number {
    return this._stack.length;
  }

  public pushBranch(branch: Branch): void {
    desync(this);
    this._stack.pushBranch(branch);
    if (this.top.clipVolume)
      this.clipStack.push(this.top.clipVolume);
  }

  public pushState(state: BranchState): void {
    desync(this);
    this._stack.pushState(state);
    if (this.top.clipVolume)
      this.clipStack.push(this.top.clipVolume);
  }

  public pop(): void {
    desync(this);
    if (this.top.clipVolume)
      this.clipStack.pop();

    this._stack.pop();
  }

  public pushViewClip(): void {
    assert(!this._viewClipEnabled);
    this._viewClipEnabled = true;

    // Target.readPixels() pushes another BranchState before pushing view clip...
    assert((this._target.isReadPixelsInProgress ? 2 : 1) === this._stack.length);
  }

  public popViewClip(): void {
    assert(this._viewClipEnabled);
    this._viewClipEnabled = false;
    assert((this._target.isReadPixelsInProgress ? 2 : 1) === this._stack.length);
  }

  public changeRenderPlan(vf: ViewFlags, is3d: boolean, hline: HiddenLine.Settings | undefined): void {
    this._stack.changeRenderPlan(vf, is3d, hline);
  }

  public updateViewClip(clip: ClipVector | undefined, style: ClipStyle): void {
    this.clipStack.setViewClip(clip, style);
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

  public bindModelToWorldTransform(uniform: UniformHandle, geom: CachedGeometry, isViewCoords: boolean) {
    if (this.update(uniform, geom, isViewCoords))
      uniform.setMatrix4(this._m32);
  }

  public bindWorldToViewNTransform(uniform: UniformHandle, geom: CachedGeometry, isViewCoords: boolean) {
    if (this.update(uniform, geom, isViewCoords))
      uniform.setMatrix3(this._v32);
  }

  public bindModelViewNTransform(uniform: UniformHandle, geom: CachedGeometry, isViewCoords: boolean) {
    if (this.update(uniform, geom, isViewCoords))
      uniform.setMatrix3(this._mvn32);
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
      if (instancedGeom)
        mv = instancedGeom.getRtcModelTransform(mv);

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
        if (vio) {
          const viewToWorldRot = viewMatrix.matrix.inverse(this._scratchViewToWorld)!;
          const rotateAboutOrigin = Transform.createFixedPointAndMatrix(vio, viewToWorldRot, this._scratchTransform2);
          const viModelMatrix = rotateAboutOrigin.multiplyTransformTransform(instancedGeom.getRtcModelTransform(modelMatrix), this._scratchVIModelMatrix);
          mv.multiplyTransformTransform(viModelMatrix, mv);
        } else {
          mv.multiplyTransformTransform(instancedGeom.getRtcModelTransform(modelMatrix), mv);
        }
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

    if (this._target.wantThematicDisplay) {
      this._m32.initFromTransform(modelMatrix);
      this._v32.initFromMatrix3d(this._target.uniforms.frustum.viewMatrix.matrix);
    }

    Matrix4d.createTransform(mv, this._mv);
    this._mv32.initFromTransform(mv);

    const inv = this._mv.createInverse();
    if (undefined !== inv) {
      const invTr = inv.cloneTransposed();
      this._mvn32.initFromMatrix3d(invTr.matrixPart());
    }

    // Don't bother computing mvp for instanced geometry - it's not used.
    if (!this._isInstanced) {
      uniforms.projectionMatrix.multiplyMatrixMatrix(this._mv, this._mvp);
      this._mvp32.initFromMatrix4d(this._mvp);
    }

    return true;
  }
}
