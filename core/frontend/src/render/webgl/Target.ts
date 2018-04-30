/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Vector3d, Point3d, ClipPlane, ClipVector } from "@bentley/geometry-core";
import { BeTimePoint, assert, Id64 } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem, DecorationList, Decorations, GraphicList, RenderPlan  } from "../System";
import { ViewFlags } from "@bentley/imodeljs-common";
import { HilitedSet } from "../../SelectionSet";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { System } from "./System";
import { BranchStack, BranchState } from "./BranchState";
import { ShaderFlags, ShaderProgramExecutor } from "./ShaderProgram";
import { Branch } from "./Graphic";

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
  private _planeData: Float32Array;
  private _frustumData: Float32Array;

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
    this._planeData = new Float32Array(pData);
    this._frustumData = new Float32Array(fData);
  }

  public get frustumPlanes(): Float32Array { return this._planeData; }  // uniform vec4 u_frustumPlanes; // { top, bottom, left, right }
  public get frustum(): Float32Array { return this._frustumData; } // uniform vec3 u_frustum; // { near, far, type }
  public get nearPlane(): number { return this._frustumData[FrustumData.kNear]; }
  public get farPlane(): number { return this._frustumData[FrustumData.kFar]; }
  public get type(): FrustumUniformType { return this.frustum[FrustumData.kType] as FrustumUniformType; }
  public get is2d(): boolean { return FrustumUniformType.TwoDee === this.type; }

  public setPlanes(top: number, bottom: number, left: number, right: number): void {
    this._planeData[Plane.kTop] = top;
    this._planeData[Plane.kBottom] = bottom;
    this._planeData[Plane.kLeft] = left;
    this._planeData[Plane.kRight] = right;
  }
  public setFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType): void {
    this._frustumData[FrustumData.kNear] = nearPlane;
    this._frustumData[FrustumData.kFar] = farPlane;
    this._frustumData[FrustumData.kType] = type as number;
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

export abstract class Target extends RenderTarget {
  private _stack = new BranchStack();
  private readonly _viewMatrix = Transform.createIdentity();
  private _scene = new GraphicList();
  private _decorations = new Decorations();
  private _dynamics?: DecorationList;
  private _overridesUpdateTime = BeTimePoint.now();
  private _hilite?: HilitedSet;
  private _hiliteUpdateTime = BeTimePoint.now();
  private _flashedElemId = Id64.invalidId;
  private _flashedUpdateTime = BeTimePoint.now();
  private _flashIntensity: number = 0;
  protected _dcAssigned: boolean = false;
  public readonly clips = new Clips();
  public readonly decorationState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly frustumUniforms = new FrustumUniforms();

  protected constructor() {
    super();
  }

  public get hilite(): HilitedSet { return this._hilite!; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public get flashedElemId(): Id64 { return this._flashedElemId; }
  public get flashedUpdateTime(): BeTimePoint { return this._flashedUpdateTime; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get overridesUpdateTime(): BeTimePoint { return this._overridesUpdateTime; }

  public get scene(): GraphicList { return this._scene; }
  public get decorations(): Decorations { return this._decorations; }
  public get dynamics(): DecorationList | undefined { return this._dynamics; }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get currentTransform(): Transform { return this._stack.top.transform; }
  public get hasClipVolume(): boolean { return this.clips.isValid && this._stack.top.showClipVolume; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.isMonochrome() ? ShaderFlags.Monochrome : ShaderFlags.None; }

  public get is2d(): boolean { return this.frustumUniforms.is2d; }
  public get is3d(): boolean { return !this.is2d; }

  public pushBranch(exec: ShaderProgramExecutor, branch: Branch): void {
    this._stack.pushBranch(branch);
    const clip = this._stack.top.clipVolume;
    if (undefined !== clip) {
      clip.push(exec);
    }
  }
  public pushState(state: BranchState) {
    assert(undefined === state.clipVolume);
    this._stack.pushState(state);
  }
  public popBranch(): void {
    const clip = this._stack.top.clipVolume;
    if (undefined !== clip) {
      clip.pop(this);
    }

    this._stack.pop();
  }

  public get viewMatrix() { return this._viewMatrix; }

  // ---- Implementation of RenderTarget interface ---- //

  public get renderSystem(): RenderSystem { return System.instance; }
  public get cameraFrustumNearScaleLimit() {
    return 0; // ###TODO
  }

  public changeDecorations(decs: Decorations): void { this._decorations = decs; }
  public changeScene(scene: GraphicList, _activeVolume: ClipVector) {
    this._scene = scene;
    // ###TODO active volume
  }
  public changeDynamics(dynamics?: DecorationList) {
    // ###TODO: set feature IDs into each graphic so that edge display works correctly...
    this._dynamics = dynamics;
  }
  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._stack.setSymbologyOverrides(ovr);
    this._overridesUpdateTime = BeTimePoint.now();
  }
  public setHiliteSet(hilite: HilitedSet): void {
    this._hilite = hilite;
    this._hiliteUpdateTime = BeTimePoint.now();
  }
  public setFlashed(id: Id64, intensity: number) {
    if (!id.equals(this._flashedElemId)) {
      this._flashedElemId = id;
      this._flashedUpdateTime = BeTimePoint.now();
    }

    this._flashIntensity = intensity;
  }
  public onResized(): void {
    // ###TODO
    this._dcAssigned = false;
  }

  public changeRenderPlan(_plan: RenderPlan): void {
  }

  public drawFrame(): void {
    // ###TODO
  }

  // ---- Methods expected to be overridden by subclasses ---- //

  protected abstract assignDC(): boolean;
  protected abstract makeCurrent(): void;
  protected abstract beginPaint(): void;
  protected abstract endPaint(): void;
  protected update(): void { }
}

export class OnScreenTarget extends Target {
  public constructor() {
    super();
  }

  // ###TODO...
  protected assignDC(): boolean {
    this._dcAssigned = true;
    return true;
  }
  protected makeCurrent(): void { }
  protected beginPaint(): void { }
  protected endPaint(): void { }
}

export class OffScreenTarget extends Target {
  public constructor() {
    super();
  }

  // ###TODO...
  protected assignDC(): boolean { return false; }
  protected makeCurrent(): void { }
  protected beginPaint(): void { }
  protected endPaint(): void { }
}
