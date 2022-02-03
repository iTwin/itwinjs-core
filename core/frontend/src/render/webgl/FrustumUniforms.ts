/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { InverseMatrixState, Matrix4d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { Frustum, Npc } from "@itwin/core-common";
import type { UniformHandle } from "./UniformHandle";
import { IModelFrameLifecycle } from "./IModelFrameLifecycle";
import { Matrix4 } from "./Matrix";
import { desync, sync } from "./Sync";

/** @internal */
export const enum FrustumUniformType { // eslint-disable-line no-restricted-syntax
  TwoDee,
  Orthographic,
  Perspective,
}

const enum Plane { // eslint-disable-line no-restricted-syntax
  kTop,
  kBottom,
  kLeft,
  kRight,
}

const enum FrustumData { // eslint-disable-line no-restricted-syntax
  kNear,
  kFar,
  kType,
}

/** Represents a Target's frustum for use in glsl as a pair of uniforms.
 * Do not modify fields of exposed objects directly. e.g., do not directly manipulate the projection or view matrices - use the appropriate APIs.
 * @internal
 */
export class FrustumUniforms {
  // CPU state. Do not modify - use APIs.
  public readonly planFrustum = new Frustum();
  private _planFraction = 0;
  private readonly _nearPlaneCenter = new Point3d();
  public readonly viewMatrix = Transform.createIdentity();
  public readonly projectionMatrix = Matrix4d.createIdentity();
  private readonly _worldUpVector = Vector3d.unitZ();
  private readonly _viewUpVector = Vector3d.unitZ();

  // GPU state
  private readonly _planeData: Float32Array = new Float32Array(4);
  private readonly _frustumData: Float32Array = new Float32Array(3);
  public readonly projectionMatrix32 = new Matrix4();
  private readonly _logZData = new Float32Array(2);
  private readonly _viewUpVector32 = new Float32Array(3);

  // SyncTarget
  public syncKey = 0;

  // Scratch variables
  private readonly _scratch = {
    point3d: new Point3d(),
    vec3d: new Vector3d(),
    viewX: new Vector3d(),
    viewY: new Vector3d(),
    viewZ: new Vector3d(),
  };

  public constructor() {
  }

  public bindProjectionMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix4(this.projectionMatrix32);
  }

  public bindUpVector(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._viewUpVector32);
  }

  // uniform vec4 u_frustumPlanes; // { top, bottom, left, right }
  public get planes(): Float32Array { return this._planeData; }

  // uniform vec3 u_frustum; // { near, far, type }
  public get frustum(): Float32Array { return this._frustumData; }

  public get nearPlane(): number { return this._frustumData[FrustumData.kNear]; }
  public get farPlane(): number { return this._frustumData[FrustumData.kFar]; }
  public get type(): FrustumUniformType { return this.frustum[FrustumData.kType] as FrustumUniformType; }
  public get is2d(): boolean { return FrustumUniformType.TwoDee === this.type; }
  public get planFraction(): number { return this._planFraction; }

  // uniform vec2 u_logZ where x = 1/near and y = log(far/near)
  public get logZ(): Float32Array { return this._logZData; }

  public changeFrustum(newFrustum: Frustum, newFraction: number, is3d: boolean): void {
    if (newFraction === this._planFraction && is3d !== this.is2d && newFrustum.equals(this.planFrustum))
      return;

    desync(this);

    newFrustum.clone(this.planFrustum);

    const farLowerLeft = newFrustum.getCorner(Npc.LeftBottomRear);
    const farLowerRight = newFrustum.getCorner(Npc.RightBottomRear);
    const farUpperLeft = newFrustum.getCorner(Npc.LeftTopRear);
    const farUpperRight = newFrustum.getCorner(Npc.RightTopRear);
    const nearLowerLeft = newFrustum.getCorner(Npc.LeftBottomFront);
    const nearLowerRight = newFrustum.getCorner(Npc.RightBottomFront);
    const nearUpperLeft = newFrustum.getCorner(Npc.LeftTopFront);
    const nearUpperRight = newFrustum.getCorner(Npc.RightTopFront);

    const nearCenter = nearLowerLeft.interpolate(0.5, nearUpperRight, this._scratch.point3d);

    const viewX = normalizedDifference(nearLowerRight, nearLowerLeft, this._scratch.viewX);
    const viewY = normalizedDifference(nearUpperLeft, nearLowerLeft, this._scratch.viewY);
    const viewZ = viewX.crossProduct(viewY, this._scratch.viewZ).normalize()!;

    this._planFraction = newFraction;

    if (!is3d || newFraction > 0.999) { // ortho or 2d
      const halfWidth = Vector3d.createStartEnd(farLowerRight, farLowerLeft, this._scratch.vec3d).magnitude() * 0.5;
      const halfHeight = Vector3d.createStartEnd(farLowerRight, farUpperRight).magnitude() * 0.5;
      const depth = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, this._scratch.vec3d).magnitude();

      lookIn(nearCenter, viewX, viewY, viewZ, this.viewMatrix);
      ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, 0, depth, this.projectionMatrix);

      this._nearPlaneCenter.setFrom(nearLowerLeft);
      this._nearPlaneCenter.interpolate(0.5, nearUpperRight, this._nearPlaneCenter);

      this.setPlanes(halfHeight, -halfHeight, -halfWidth, halfWidth);
      this.setFrustum(0, depth, is3d ? FrustumUniformType.Orthographic : FrustumUniformType.TwoDee);
    } else { // perspective
      const scale = 1.0 / (1.0 - newFraction);
      const zVec = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, this._scratch.vec3d);
      const cameraPosition = fromSumOf(farLowerLeft, zVec, scale, this._scratch.point3d);

      const frustumLeft = dotDifference(farLowerLeft, cameraPosition, viewX) * newFraction;
      const frustumRight = dotDifference(farLowerRight, cameraPosition, viewX) * newFraction;
      const frustumBottom = dotDifference(farLowerLeft, cameraPosition, viewY) * newFraction;
      const frustumTop = dotDifference(farUpperLeft, cameraPosition, viewY) * newFraction;
      const frustumFront = -dotDifference(nearLowerLeft, cameraPosition, viewZ);
      const frustumBack = -dotDifference(farLowerLeft, cameraPosition, viewZ);

      lookIn(cameraPosition, viewX, viewY, viewZ, this.viewMatrix);
      frustum(frustumLeft, frustumRight, frustumBottom, frustumTop, frustumFront, frustumBack, this.projectionMatrix);

      IModelFrameLifecycle.onChangeCameraView.raiseEvent({
        cameraPosition,
        viewX,
        viewY,
        viewZ,
      });
      IModelFrameLifecycle.onChangeCameraFrustum.raiseEvent({
        type: FrustumUniformType.Perspective,
        left: frustumLeft,
        right: frustumRight,
        bottom: frustumBottom,
        top: frustumTop,
        front: frustumFront,
        back: frustumBack,
      });

      this._nearPlaneCenter.setFrom(nearLowerLeft);
      this._nearPlaneCenter.interpolate(0.5, nearUpperRight, this._nearPlaneCenter);

      this.setPlanes(frustumTop, frustumBottom, frustumLeft, frustumRight);
      this.setFrustum(frustumFront, frustumBack, FrustumUniformType.Perspective);
    }

    this.viewMatrix.matrix.inverseState = InverseMatrixState.unknown;

    this.viewMatrix.matrix.multiplyVector(this._worldUpVector, this._viewUpVector);
    this._viewUpVector.normalizeInPlace();
    this._viewUpVector32[0] = this._viewUpVector.x;
    this._viewUpVector32[1] = this._viewUpVector.y;
    this._viewUpVector32[2] = this._viewUpVector.z;

    this.projectionMatrix32.initFromMatrix4d(this.projectionMatrix);
  }

  public changeProjectionMatrix(newMatrix: Matrix4d): void {
    desync(this);
    this.projectionMatrix.setFrom(newMatrix);
    this.projectionMatrix32.initFromMatrix4d(this.projectionMatrix);
  }

  protected setPlanes(top: number, bottom: number, left: number, right: number): void {
    this._planeData[Plane.kTop] = top;
    this._planeData[Plane.kBottom] = bottom;
    this._planeData[Plane.kLeft] = left;
    this._planeData[Plane.kRight] = right;
  }

  protected setFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void {
    this._frustumData[FrustumData.kNear] = nearPlane;
    this._frustumData[FrustumData.kFar] = farPlane;
    this._frustumData[FrustumData.kType] = type as number;

    // If nearPlane is zero, we don't have a camera (or got very unlucky); in that case shader will compute linear depth.
    this._logZData[0] = 0 !== nearPlane ? 1 / nearPlane : 0;
    this._logZData[1] = 0 !== nearPlane ? Math.log(farPlane / nearPlane) : farPlane;
  }
}

function normalizedDifference(p0: Point3d, p1: Point3d, out?: Vector3d): Vector3d {
  const result = undefined !== out ? out : new Vector3d();
  result.x = p0.x - p1.x;
  result.y = p0.y - p1.y;
  result.z = p0.z - p1.z;
  result.normalizeInPlace();
  return result;
}

/** @internal */
export function fromSumOf(p: Point3d, v: Vector3d, scale: number, out?: Point3d) {
  const result = undefined !== out ? out : new Point3d();
  result.x = p.x + v.x * scale;
  result.y = p.y + v.y * scale;
  result.z = p.z + v.z * scale;
  return result;
}

function dotDifference(pt: Point3d, origin: Point3d, vec: Vector3d): number {
  return (pt.x - origin.x) * vec.x + (pt.y - origin.y) * vec.y + (pt.z - origin.z) * vec.z;
}

function lookIn(eye: Point3d, viewX: Vector3d, viewY: Vector3d, viewZ: Vector3d, result: Transform) {
  const rot = result.matrix.coffs;
  rot[0] = viewX.x; rot[1] = viewX.y; rot[2] = viewX.z;
  rot[3] = viewY.x; rot[4] = viewY.y; rot[5] = viewY.z;
  rot[6] = viewZ.x; rot[7] = viewZ.y; rot[8] = viewZ.z;

  result.origin.x = -viewX.dotProduct(eye);
  result.origin.y = -viewY.dotProduct(eye);
  result.origin.z = -viewZ.dotProduct(eye);
}

function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, result: Matrix4d) {
  Matrix4d.createRowValues(
    2.0 / (right - left), 0.0, 0.0, -(right + left) / (right - left),
    0.0, 2.0 / (top - bottom), 0.0, -(top + bottom) / (top - bottom),
    0.0, 0.0, -2.0 / (far - near), -(far + near) / (far - near),
    0.0, 0.0, 0.0, 1.0,
    result);
}

function frustum(left: number, right: number, bottom: number, top: number, near: number, far: number, result: Matrix4d) {
  Matrix4d.createRowValues(
    (2.0 * near) / (right - left), 0.0, (right + left) / (right - left), 0.0,
    0.0, (2.0 * near) / (top - bottom), (top + bottom) / (top - bottom), 0.0,
    0.0, 0.0, -(far + near) / (far - near), -(2.0 * far * near) / (far - near),
    0.0, 0.0, -1.0, 0.0,
    result);
}
