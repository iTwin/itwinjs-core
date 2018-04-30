/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClipShape, ClipVector, Transform, Vector3d, Point3d, ClipPlane, ConvexClipPlaneSet, ClipPlaneSet } from "@bentley/geometry-core";
import { BeTimePoint } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem } from "../System";
import { ViewFlags } from "@bentley/imodeljs-common";
import { HilitedSet } from "../../SelectionSet";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { System } from "./System";

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
export class GLESClips {
  private clips: Float32Array;
  private clipCount: number;
  private clipActive: number;  // count of SetActiveClip nesting (only outermost used)

  public constructor() {
    this.clipCount = 0;
    this.clipActive = 0;
    const data = [];
    for (let i = 0; i < 6 * 4; i++) {
      data[i] = 0.0;
    }
    this.clips = new Float32Array(data);
  }

  /** Only simple clip planes supported in shader... ###TODO more complex clips must be applied to geometry beforehand. */
  public static convertClipToPlanes(clipVec: ClipVector, clipPlanes: ClipPlane[]): number {
    if (undefined === clipVec || 1 !== clipVec.clips.length)
      return 0;

    const clipPrim: ClipShape = clipVec.clips[0];
    const clipPlanesRef: ClipPlaneSet = clipPrim.fetchClipPlanesRef();
    const convexClipPlaneSets: ConvexClipPlaneSet[] = clipPlanesRef.convexSets;
    if (undefined === convexClipPlaneSets || 1 !== convexClipPlaneSets.length)
      return 0;

    const planes = convexClipPlaneSets[0].planes;
    const clipCount: number = planes.length;
    if (clipCount === 0 || clipCount > 6)
      return 0;

    for (let i = 0; i < clipCount; i++)
      clipPlanes[i] = planes[i];

    return clipCount;
  }

  public setClips(count: number, planes: ClipPlane[], viewMatrix: Transform): void {
    this.clipActive++;
    if (1 === this.clipActive) {
      this.clipCount = count;
      for (let i = 0; i < count; ++i) {
        // Transform direction of clip plane
        const norm: Vector3d = planes[i].inwardNormalRef;
        const dir: Vector3d = viewMatrix.multiplyVector(norm);
        dir.normalizeInPlace();
        this.clips[i * 4] = dir.x;
        this.clips[i * 4 + 1] = dir.y;
        this.clips[i * 4 + 2] = dir.z;

        // Transform distance of clip plane
        const pos: Point3d = norm.scale(planes[i].distance).cloneAsPoint3d();
        const xFormPos: Point3d = viewMatrix.multiplyPoint(pos);
        this.clips[i * 4 + 3] = -dir.dotProductXYZ(xFormPos.x, xFormPos.y, xFormPos.z);
      }
    }
  }

  public clearClips(): void {
    if (this.clipActive === 1)
      this.clipCount = 0;
    if (this.clipActive > 0)
      this.clipActive--;
  }

  public getClips(): Float32Array { return this.clips; }
  public getClipCount(): number { return this.clipCount; }
  public isValid(): boolean { return this.getClipCount() > 0; }
}

export class Target extends RenderTarget {
  private readonly _tempViewFlags = new ViewFlags(); // ###TODO BranchStack...
  protected _overrides?: FeatureSymbology.Overrides;
  protected _overridesUpdateTime?: BeTimePoint;
  protected _hilite?: HilitedSet;
  protected _hiliteUpdateTime?: BeTimePoint;

  public get renderSystem(): RenderSystem { return System.instance; }
  public get hilite(): HilitedSet { return this._hilite!; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime!; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._overrides = ovr;
    this._overridesUpdateTime = BeTimePoint.now();
  }

  public setHiliteSet(hilite: HilitedSet): void {
    this._hilite = hilite;
    this._hiliteUpdateTime = BeTimePoint.now();
  }

  public get currentViewFlags() { return this._tempViewFlags; } // ###TODO BranchStack...

  public get currentTransform() { return Transform.createIdentity(); } // ###TODO return one from top of BranchStack...
}

export class OnScreenTarget extends Target {
}
