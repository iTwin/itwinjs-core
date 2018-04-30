/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Vector3d, Point3d, ClipPlane } from "@bentley/geometry-core";
import { BeTimePoint } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem } from "../System";
import { ViewFlags } from "@bentley/imodeljs-common";
import { HilitedSet } from "../../SelectionSet";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { System } from "./System";
import { BranchStack } from "./BranchState";
import { ShaderFlags } from "./ShaderProgram";

export const enum FrustumUniformType {
  TwoDee,
  Orthographic,
  Perspective,
}

const enum Plane {
  kTop,
  kBottom,
  kLeft,
  kRight,
}

const enum FrustumData {
  kNear,
  kFar,
  kType,
}

export class FrustumUniforms {
  private planeData: Float32Array;
  private frustumData: Float32Array;
  public constructor() {
    const pData = [];
    pData[Plane.kTop] = 0.0;
    pData[Plane.kBottom] = 0.0;
    pData[Plane.kLeft] = 0.0;
    pData[Plane.kRight] = 0.0;
    const fData = [];
    fData[FrustumData.kNear] = 0.0;
    fData[FrustumData.kFar] = 0.0;
    fData[FrustumData.kType] = 0.0;
    this.planeData = new Float32Array(pData);
    this.frustumData = new Float32Array(fData);
  }
  public getFrustumPlanes(): Float32Array { return this.planeData; }  // uniform vec4 u_frustumPlanes; // { top, bottom, left, right }
  public getFrustum(): Float32Array { return this.frustumData; } // uniform vec3 u_frustum; // { near, far, type }
  public getNearPlane(): number { return this.frustumData[FrustumData.kNear]; }
  public getFarPlane(): number { return this.frustumData[FrustumData.kFar]; }
  public GetType(): FrustumUniformType { return this.getFrustum()[FrustumData.kType] as FrustumUniformType; }
  public Is2d(): boolean { return FrustumUniformType.TwoDee === this.GetType(); }

  public SetPlanes(top: number, bottom: number, left: number, right: number): void {
    this.planeData[Plane.kTop] = top;
    this.planeData[Plane.kBottom] = bottom;
    this.planeData[Plane.kLeft] = left;
    this.planeData[Plane.kRight] = right;
  }
  public SetFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void {
    this.frustumData[FrustumData.kNear] = nearPlane;
    this.frustumData[FrustumData.kFar] = farPlane;
    this.frustumData[FrustumData.kType] = type as number;
  }
}

/** Interface for GPU clipping. Max of 6 planes of clipping; no nesting */
export class Clips {
  private readonly _clips: Float32Array;
  private _clipCount: number;
  private _clipActive: number;  // count of SetActiveClip nesting (only outermost used)

  public constructor() {
    this._clipCount = 0;
    this._clipActive = 0;
    const data = [];
    for (let i = 0; i < 6 * 4; i++) {
      data[i] = 0.0;
    }

    this._clips = new Float32Array(data);
  }

  public setFrom(planes: ClipPlane[], viewMatrix: Transform): void {
    this._clipActive++;
    if (1 === this._clipActive) {
      const count = planes.length;
      this._clipCount = count;
      for (let i = 0; i < count; ++i) {
        // Transform direction of clip plane
        const norm: Vector3d = planes[i].inwardNormalRef;
        const dir: Vector3d = viewMatrix.multiplyVector(norm);
        dir.normalizeInPlace();
        this._clips[i * 4] = dir.x;
        this._clips[i * 4 + 1] = dir.y;
        this._clips[i * 4 + 2] = dir.z;

        // Transform distance of clip plane
        const pos: Point3d = norm.scale(planes[i].distance).cloneAsPoint3d();
        const xFormPos: Point3d = viewMatrix.multiplyPoint(pos);
        this._clips[i * 4 + 3] = -dir.dotProductXYZ(xFormPos.x, xFormPos.y, xFormPos.z);
      }
    }
  }

  public clear(): void {
    if (this._clipActive === 1) {
      this._clipCount = 0;
    }

    if (this._clipActive > 0) {
      this._clipActive--;
    }
  }

  public get clips(): Float32Array { return this._clips; }
  public get length(): number { return this._clipCount; }
  public get isValid(): boolean { return this.length > 0; }
}

export class Target extends RenderTarget {
  private _stack = new BranchStack();
  protected _overrides?: FeatureSymbology.Overrides;
  protected _overridesUpdateTime = BeTimePoint.now();
  protected _hilite?: HilitedSet;
  protected _hiliteUpdateTime = BeTimePoint.now();
  private readonly _viewMatrix = Transform.createIdentity();
  public readonly clips = new Clips();

  public get renderSystem(): RenderSystem { return System.instance; }
  public get hilite(): HilitedSet { return this._hilite!; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._overrides = ovr;
    this._overridesUpdateTime = BeTimePoint.now();
  }

  public setHiliteSet(hilite: HilitedSet): void {
    this._hilite = hilite;
    this._hiliteUpdateTime = BeTimePoint.now();
  }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get currentTransform(): Transform { return this._stack.top.transform; }
  public get hasClipVolume(): boolean { return this.clips.isValid && this._stack.top.showClipVolume; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.isMonochrome() ? ShaderFlags.Monochrome : ShaderFlags.None; }

  public get viewMatrix() { return this._viewMatrix; }
}

export class OnScreenTarget extends Target {
}
