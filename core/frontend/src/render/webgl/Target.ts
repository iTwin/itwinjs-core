/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Transform, Vector3d, Point3d, ClipPlane, ClipVector, Matrix4d } from "@bentley/geometry-core";
import { BeTimePoint, assert, Id64 } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem, DecorationList, Decorations, GraphicList, RenderPlan  } from "../System";
import { ViewFlags, Frustum, Hilite, ColorDef, Npc, RenderMode, HiddenLine } from "@bentley/imodeljs-common";
import { HilitedSet } from "../../SelectionSet";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { System } from "./System";
import { BranchStack, BranchState } from "./BranchState";
import { ShaderFlags, ShaderProgramExecutor } from "./ShaderProgram";
import { Branch } from "./Graphic";
import { EdgeOverrides } from "./EdgeOverrides";

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
  private _scene = new GraphicList();
  private _decorations = new Decorations();
  private _dynamics?: DecorationList;
  private _overridesUpdateTime = BeTimePoint.now();
  private _hilite?: HilitedSet;
  private _hiliteUpdateTime = BeTimePoint.now();
  private _flashedElemId = Id64.invalidId;
  private _flashedUpdateTime = BeTimePoint.now();
  private _flashIntensity: number = 0;
  private _transparencyThreshold: number = 0;
  protected _dcAssigned: boolean = false;
  public readonly clips = new Clips();
  public readonly decorationState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly frustumUniforms = new FrustumUniforms();
  public readonly bgColor = ColorDef.white.clone();
  public readonly monoColor = ColorDef.white.clone();
  public readonly hiliteSettings = new Hilite.Settings();
  public readonly planFrustum = new Frustum();
  public readonly nearPlaneCenter = new Point3d();
  public readonly viewMatrix = Transform.createIdentity();
  public readonly projectionMatrix = Matrix4d.createIdentity();
  public readonly visibleEdgeOverrides = new EdgeOverrides();
  public readonly hiddenEdgeOverrides = new EdgeOverrides();

  protected constructor() {
    super();
  }

  public get transparencyThreshold(): number { return this._transparencyThreshold; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public get hilite(): HilitedSet { return this._hilite!; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }

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

  private static scratch = {
    viewFlags: new ViewFlags(),
    nearCenter: new Point3d(),
    viewX: new Vector3d(),
    viewY: new Vector3d(),
    viewZ: new Vector3d(),
    vec3: new Vector3d(),
    point3: new Point3d(),
    visibleEdges: new HiddenLine.Style({}),
    hiddenEdges: new HiddenLine.Style({}),
  };

  public changeRenderPlan(plan: RenderPlan): void {
    // ###TODO if (this._dcAssigned && plan.is3d !== this.is3d)) {
    // ###TODO   // changed the dimensionality of the Target. World decorations no longer valid.
    // ###TODO   this.worldDecorations = undefined;
    // ###TODO }

    this.assignDC();

    this.bgColor.setFrom(plan.bgColor);
    this.monoColor.setFrom(plan.monoColor);
    this.hiliteSettings.copyFrom(plan.hiliteSettings);
    this._transparencyThreshold = 0.0;

    // ##TODO active volume...

    const scratch = Target.scratch;
    const visEdgeOvrs = undefined !== plan.hline ? plan.hline.visible.clone(scratch.visibleEdges) : undefined;
    const hidEdgeOvrs = undefined !== plan.hline ? plan.hline.hidden.clone(scratch.hiddenEdges) : undefined;

    const vf = ViewFlags.createFrom(plan.viewFlags, scratch.viewFlags);
    let forceEdgesOpaque = true; // most render modes want edges to be opaque so don't allow overrides to their alpha
    switch (vf.renderMode) {
      case RenderMode.Wireframe: {
        // Edge overrides never apply in wireframe mode
        vf.setShowVisibleEdges(false);
        vf.setShowHiddenEdges(false);
        forceEdgesOpaque = false;
        break;
      }
      case RenderMode.SmoothShade: {
        // Hidden edges require visible edges
        if (!vf.showVisibleEdges()) {
          vf.setShowHiddenEdges(false);
        }

        break;
      }
      case RenderMode.SolidFill: {
        // In solid fill, if the edge color is not overridden, the edges do not use the element's line color
        if (undefined !== visEdgeOvrs && !visEdgeOvrs.ovrColor) {
          // ###TODO? Probably supposed to be contrast with fill and/or background color...
          assert(undefined !== hidEdgeOvrs);
          visEdgeOvrs.color.setFrom(ColorDef.white);
          hidEdgeOvrs!.color.setFrom(ColorDef.white);
          visEdgeOvrs.ovrColor = hidEdgeOvrs!.ovrColor = true;
        }
      } // fall-through intentional...
      case RenderMode.HiddenLine: {
        // In solid fill and hidden line mode, visible edges always rendered and edge overrides always apply
        vf.setShowVisibleEdges(true);

        assert(undefined !== plan.hline); // these render modes only supported in 3d, in which case hline always initialized
        if (undefined !== plan.hline) {
          // The threshold in HiddenLineParams ranges from 0.0 (hide anything that's not 100% opaque)
          // to 1.0 (don't hide anything regardless of transparency). Convert it to an alpha value.
          let threshold = plan.hline.transparencyThreshold;
          threshold = Math.min(1.0, Math.max(0.0, threshold));
          this._transparencyThreshold = 1.0 - threshold;
        }

        break;
      }
    }

    this.visibleEdgeOverrides.init(forceEdgesOpaque, visEdgeOvrs);
    this.hiddenEdgeOverrides.init(forceEdgesOpaque, hidEdgeOvrs);

    this._stack.setViewFlags(vf);

    plan.frustum.clone(this.planFrustum);

    const farLowerLeft = plan.frustum.getCorner(Npc.LeftBottomRear);
    const farLowerRight = plan.frustum.getCorner(Npc.RightBottomRear);
    const farUpperLeft = plan.frustum.getCorner(Npc.LeftTopRear);
    const farUpperRight = plan.frustum.getCorner(Npc.RightTopRear);
    const nearLowerLeft = plan.frustum.getCorner(Npc.LeftBottomFront);
    const nearLowerRight = plan.frustum.getCorner(Npc.RightBottomFront);
    const nearUpperLeft = plan.frustum.getCorner(Npc.LeftTopFront);
    const nearUpperRight = plan.frustum.getCorner(Npc.RightTopFront);

    const nearCenter = nearLowerLeft.interpolate(0.5, nearUpperRight, scratch.nearCenter);

    const viewX = normalizedDifference(nearLowerRight, nearLowerLeft, scratch.viewX);
    const viewY = normalizedDifference(nearUpperLeft, nearLowerLeft, scratch.viewY);
    const viewZ = viewX.crossProduct(viewY, scratch.viewZ).normalize()!;

    if (!plan.is3d) {
      const halfWidth = Vector3d.createStartEnd(farLowerRight, farLowerLeft, scratch.vec3).magnitude() * 0.5;
      const halfHeight = Vector3d.createStartEnd(farLowerRight, farUpperRight).magnitude() * 0.5;
      const depth = 2 * RenderTarget.frustumDepth2d;

      this.nearPlaneCenter.set(nearCenter.x, nearCenter.y, RenderTarget.frustumDepth2d);

      lookIn(this.nearPlaneCenter, viewX, viewY, viewZ, this.viewMatrix);
      ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, 0, depth, this.projectionMatrix);

      this.frustumUniforms.setPlanes(halfHeight, -halfHeight, -halfWidth, halfWidth);
      this.frustumUniforms.setFrustum(0, depth, FrustumUniformType.TwoDee);
    } else if (plan.fraction > 0.999) { // ortho
      const halfWidth = Vector3d.createStartEnd(farLowerRight, farLowerLeft, scratch.vec3).magnitude() * 0.5;
      const halfHeight = Vector3d.createStartEnd(farLowerRight, farUpperRight).magnitude() * 0.5;
      const depth = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, scratch.vec3).magnitude();

      lookIn(nearCenter, viewX, viewY, viewZ, this.viewMatrix);
      ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, 0, depth, this.projectionMatrix);

      this.nearPlaneCenter.setFrom(nearLowerLeft);
      this.nearPlaneCenter.interpolate(0.5, nearUpperRight, this.nearPlaneCenter);

      this.frustumUniforms.setPlanes(halfHeight, -halfHeight, -halfWidth, halfWidth);
      this.frustumUniforms.setFrustum(0, depth, FrustumUniformType.Orthographic);
    } else { // perspective
      const scale = 1.0 / (1.0 - plan.fraction);
      const zVec = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, scratch.vec3);
      const cameraPosition = fromSumOf(farLowerLeft, zVec, scale, scratch.point3);

      const frustumLeft = dotDifference(farLowerLeft, cameraPosition, viewX) * plan.fraction;
      const frustumRight = dotDifference(farLowerRight, cameraPosition, viewX) * plan.fraction;
      const frustumBottom = dotDifference(farLowerLeft, cameraPosition, viewY) * plan.fraction;
      const frustumTop = dotDifference(farUpperLeft, cameraPosition, viewY) * plan.fraction;
      const frustumFront = -dotDifference(nearLowerLeft, cameraPosition, viewZ);
      const frustumBack = -dotDifference(farLowerLeft, cameraPosition, viewZ);

      lookIn(cameraPosition, viewX, viewY, viewZ, this.viewMatrix);
      frustum(frustumLeft, frustumRight, frustumBottom, frustumTop, frustumFront, frustumBack, this.projectionMatrix);

      this.nearPlaneCenter.setFrom(nearLowerLeft);
      this.nearPlaneCenter.interpolate(0.5, nearUpperRight);

      this.frustumUniforms.setPlanes(frustumTop, frustumBottom, frustumLeft, frustumRight);
      this.frustumUniforms.setFrustum(frustumFront, frustumBack, FrustumUniformType.Perspective);
    }
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

function normalizedDifference(p0: Point3d, p1: Point3d, out?: Vector3d): Vector3d {
  const result = undefined !== out ? out : new Vector3d();
  result.x = p0.x - p1.x;
  result.y = p0.y - p1.y;
  result.z = p0.z - p1.z;
  result.normalize();
  return result;
}

function fromSumOf(p: Point3d, v: Vector3d, scale: number, out?: Point3d) {
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
