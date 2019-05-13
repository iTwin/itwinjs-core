/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ClipUtilities, ClipVector, Transform, Vector3d, Point3d, Matrix4d, Point2d, Range3d, XAndY } from "@bentley/geometry-core";
import { assert, BeTimePoint, Id64String, Id64, StopWatch, dispose, disposeArray } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem, Decorations, GraphicList, RenderPlan, ClippingType, CanvasDecoration, Pixel, AnimationBranchStates, PlanarClassifierMap, RenderSolarShadowMap } from "../System";
import { ViewFlags, Frustum, Hilite, ColorDef, Npc, RenderMode, ImageBuffer, ImageBufferFormat, AnalysisStyle, RenderTexture, AmbientOcclusion } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { TechniqueId } from "./TechniqueId";
import { System } from "./System";
import { BranchStack, BranchState, BatchState } from "./BranchState";
import { ShaderFlags, ShaderProgramExecutor } from "./ShaderProgram";
import { Branch, WorldDecorations, FeatureOverrides, Batch } from "./Graphic";
import { EdgeOverrides } from "./EdgeOverrides";
import { ViewRect } from "../../Viewport";
import { RenderCommands, DrawParams, ShaderProgramParams } from "./DrawCommand";
import { ColorInfo } from "./ColorInfo";
import { RenderPass } from "./RenderFlags";
import { RenderState } from "./RenderState";
import { GL } from "./GL";
import { SceneCompositor } from "./SceneCompositor";
import { FrameBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { PlanarClassifier } from "./PlanarClassifier";
import { CachedGeometry, SingleTexturedViewportQuadGeometry } from "./CachedGeometry";
import { ShaderLights } from "./Lighting";
import { ClipDef } from "./TechniqueFlags";
import { ClipMaskVolume, ClipPlanesVolume } from "./ClipVolume";
import { FloatRgba } from "./FloatRGBA";
import { SolarShadowMap } from "./SolarShadowMap";

// tslint:disable:no-const-enum

/** @internal */
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

/** Represents the frustum for use in glsl as a pair of uniforms.
 * @internal
 */
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

/** Interface for 3d GPU clipping.
 * @internal
 */
export class Clips {
  private _texture?: TextureHandle;
  private _clipActive: number = 0;   // count of SetActiveClip nesting (only outermost used)
  private _clipCount: number = 0;

  public get texture(): TextureHandle | undefined { return this._texture; }
  public get count(): number { return this._clipCount; }
  public get isValid(): boolean { return this._clipCount > 0; }

  public set(numPlanes: number, texture: TextureHandle) {
    this._clipActive++;
    if (this._clipActive !== 1)
      return;

    this._clipCount = numPlanes;
    this._texture = texture;
  }

  public clear() {
    if (this._clipActive === 1) {
      this._clipCount = 0;
      this._texture = undefined;
    }
    if (this._clipActive > 0)
      this._clipActive--;
  }
}

/** Active classifiers - only the innermost is used.
 * @internal
 */
export class PlanarClassifiers {
  private _classifiers: PlanarClassifier[] = new Array<PlanarClassifier>();

  public get classifier(): PlanarClassifier | undefined { return this._classifiers.length === 0 ? undefined : this._classifiers[this._classifiers.length - 1]; }
  public get isValid(): boolean { return this._classifiers.length > 0; }

  public push(texture: PlanarClassifier) { this._classifiers.push(texture); }
  public pop() { this._classifiers.pop(); }
}

/** @internal */
export class PerformanceMetrics {
  private _lastTimePoint = BeTimePoint.now();
  public frameTimings = new Map<string, number>();
  public gatherGlFinish = false;
  public gatherCurPerformanceMetrics = false;
  public curSpfTimeIndex = 0;
  public spfTimes: number[] = [];
  public spfSum: number = 0;
  public renderSpfTimes: number[] = [];
  public renderSpfSum: number = 0;
  public loadTileTimes: number[] = [];
  public loadTileSum: number = 0;
  public fpsTimer: StopWatch = new StopWatch(undefined, true);
  public fpsTimerStart: number = 0;

  public constructor(gatherGlFinish = false, gatherCurPerformanceMetrics = false) {
    this.gatherGlFinish = gatherGlFinish;
    this.gatherCurPerformanceMetrics = gatherCurPerformanceMetrics;
  }

  public startNewFrame(sceneTime: number = 0) {
    this.frameTimings = new Map<string, number>();
    this.frameTimings.set("Scene Time", sceneTime);
    this._lastTimePoint = BeTimePoint.now();
  }

  public recordTime(operationName: string) {
    const newTimePoint = BeTimePoint.now();
    this.frameTimings.set(operationName, (newTimePoint.milliseconds - this._lastTimePoint.milliseconds));
    this._lastTimePoint = BeTimePoint.now();
  }

  public endFrame(operationName?: string) {
    const newTimePoint = BeTimePoint.now();
    let sum = 0;
    let prevGPUTime = 0;
    this.frameTimings.forEach((value, key) => {
      if (key === "Finish GPU Queue")
        prevGPUTime = value;
      else
        sum += value;
    });
    this.frameTimings.set("Total Render Time", sum);
    const lastTiming = (newTimePoint.milliseconds - this._lastTimePoint.milliseconds);
    this.frameTimings.set(operationName ? operationName : "Finish GPU Queue", lastTiming);
    this.frameTimings.set("Total Time", sum + prevGPUTime + lastTiming);
    this._lastTimePoint = BeTimePoint.now();
  }
}

function swapImageByte(image: ImageBuffer, i0: number, i1: number) {
  const tmp = image.data[i0];
  image.data[i0] = image.data[i1];
  image.data[i1] = tmp;
}

type ClipVolume = ClipPlanesVolume | ClipMaskVolume;

/** Used for debugging purposes, to toggle display of instanced or batched primitives.
 * @internal
 */
export const enum PrimitiveVisibility {
  /** Draw all primitives. */
  All,
  /** Only draw instanced primitives. */
  Instanced,
  /** Only draw un-instanced primitives. */
  Uninstanced,
}

/** @internal */
export abstract class Target extends RenderTarget {
  protected _decorations?: Decorations;
  private _stack = new BranchStack();
  private _batchState = new BatchState();
  private _scene: GraphicList = [];
  private _backgroundMap: GraphicList = [];
  private _planarClassifiers?: PlanarClassifierMap;
  private _dynamics?: GraphicList;
  private _worldDecorations?: WorldDecorations;
  private _overridesUpdateTime = BeTimePoint.now();
  private _hilite = new Id64.Uint32Set();
  private _hiliteUpdateTime = BeTimePoint.now();
  private _flashedElemId = Id64.invalid;
  private _flashedUpdateTime = BeTimePoint.now();
  private _flashIntensity: number = 0;
  private _transparencyThreshold: number = 0;
  private _renderCommands: RenderCommands;
  private _overlayRenderState: RenderState;
  protected _compositor: SceneCompositor;
  private _activeClipVolume?: ClipVolume;
  private _clipMask?: TextureHandle;
  public readonly clips = new Clips();
  public readonly planarClassifiers = new PlanarClassifiers();
  protected _fbo?: FrameBuffer;
  private _fStop: number = 0;
  private _ambientLight: Float32Array = new Float32Array(3);
  private _shaderLights?: ShaderLights;
  protected _dcAssigned: boolean = false;
  public performanceMetrics?: PerformanceMetrics;
  public readonly decorationState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly frustumUniforms = new FrustumUniforms();
  public readonly bgColor = FloatRgba.fromColorDef(ColorDef.red);
  public readonly monoColor = FloatRgba.fromColorDef(ColorDef.white);
  public hiliteSettings = new Hilite.Settings();
  public hiliteColor = FloatRgba.fromColorDef(this.hiliteSettings.color);
  public readonly planFrustum = new Frustum();
  public readonly renderRect = new ViewRect();
  private _planFraction: number = 0;
  public readonly nearPlaneCenter = new Point3d();
  public readonly viewMatrix = Transform.createIdentity();
  public readonly projectionMatrix = Matrix4d.createIdentity();
  private readonly _visibleEdgeOverrides = new EdgeOverrides();
  private readonly _hiddenEdgeOverrides = new EdgeOverrides();
  public analysisStyle?: AnalysisStyle;
  public analysisTexture?: RenderTexture;
  private _currentOverrides?: FeatureOverrides;
  public ambientOcclusionSettings = AmbientOcclusion.Settings.defaults;
  private _wantAmbientOcclusion = false;
  private _batches: Batch[] = [];
  public plan?: RenderPlan;
  private _animationBranches?: AnimationBranchStates;
  private _isReadPixelsInProgress = false;
  private _readPixelsSelector = Pixel.Selector.None;
  private _drawNonLocatable = true;
  public isFadeOutActive = false;
  public primitiveVisibility: PrimitiveVisibility = PrimitiveVisibility.All;
  private _solarShadowMap?: SolarShadowMap;

  protected constructor(rect?: ViewRect) {
    super();
    this._renderCommands = new RenderCommands(this, this._stack, this._batchState);
    this._overlayRenderState = new RenderState();
    this._overlayRenderState.flags.depthMask = false;
    this._overlayRenderState.flags.blend = true;
    this._overlayRenderState.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);
    this._compositor = SceneCompositor.create(this);  // compositor is created but not yet initialized... we are still undisposed
    this.renderRect = rect ? rect : new ViewRect();  // if the rect is undefined, expect that it will be updated dynamically in an OnScreenTarget
  }

  public get compositor() { return this._compositor; }
  public get isReadPixelsInProgress(): boolean { return this._isReadPixelsInProgress; }
  public get readPixelsSelector(): Pixel.Selector { return this._readPixelsSelector; }
  public get drawNonLocatable(): boolean { return this._drawNonLocatable; }

  public get currentOverrides(): FeatureOverrides | undefined { return this._currentOverrides; }
  public set currentOverrides(ovr: FeatureOverrides | undefined) {
    // Don't bother setting up overrides if they don't actually override anything - wastes time doing texture lookups in shaders.
    this._currentOverrides = (undefined !== ovr && ovr.anyOverridden) ? ovr : undefined;
  }

  public get transparencyThreshold(): number { return this._transparencyThreshold; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public get hilite(): Id64.Uint32Set { return this._hilite; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }

  public get flashedElemId(): Id64String { return this._flashedElemId; }
  public get flashedUpdateTime(): BeTimePoint { return this._flashedUpdateTime; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get overridesUpdateTime(): BeTimePoint { return this._overridesUpdateTime; }

  public get fStop(): number { return this._fStop; }
  public get ambientLight(): Float32Array { return this._ambientLight; }
  public get shaderLights(): ShaderLights | undefined { return this._shaderLights; }

  public get scene(): GraphicList { return this._scene; }
  public get dynamics(): GraphicList | undefined { return this._dynamics; }

  public get animationBranches(): AnimationBranchStates | undefined { return this._animationBranches; }
  public set animationBranches(branches: AnimationBranchStates | undefined) { this._animationBranches = branches; }
  public get branchStack(): BranchStack { return this._stack; }
  public get solarShadowMap(): SolarShadowMap | undefined { return this._solarShadowMap; }

  public getWorldDecorations(decs: GraphicList): Branch {
    if (undefined === this._worldDecorations) {

      // Don't allow flags like monochrome etc to affect world decorations. Allow lighting in 3d only.
      const vf = new ViewFlags();
      vf.renderMode = RenderMode.SmoothShade;
      vf.clipVolume = false;

      const showLights = !this.is2d;
      vf.sourceLights = showLights;
      vf.cameraLights = showLights;
      vf.solarLight = showLights;

      this._worldDecorations = new WorldDecorations(vf);
    }

    this._worldDecorations.init(decs);
    return this._worldDecorations;
  }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get currentTransform(): Transform { return this._stack.top.transform; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.monochrome ? ShaderFlags.Monochrome : ShaderFlags.None; }
  public get currentFeatureSymbologyOverrides(): FeatureSymbology.Overrides { return this._stack.top.symbologyOverrides; }

  public get clipDef(): ClipDef {
    if (this.hasClipVolume)
      return new ClipDef(ClippingType.Planes, this.clips.count);
    else if (this.hasClipMask)
      return new ClipDef(ClippingType.Mask);
    else
      return new ClipDef();
  }
  public get hasClipVolume(): boolean { return this.clips.isValid && this._stack.top.showClipVolume; }
  public get hasClipMask(): boolean { return undefined !== this.clipMask; }
  public get clipMask(): TextureHandle | undefined { return this._clipMask; }
  public set clipMask(mask: TextureHandle | undefined) {
    assert((mask === undefined) === this.hasClipMask);
    assert(this.is2d);
    this._clipMask = mask;
  }

  public get is2d(): boolean { return this.frustumUniforms.is2d; }
  public get is3d(): boolean { return !this.is2d; }

  public dispose() {
    this.reset();

    dispose(this._compositor);

    this._dcAssigned = false;   // necessary to reassign to OnScreenTarget fbo member when re-validating render plan
  }

  public pushBranch(exec: ShaderProgramExecutor, branch: Branch): void {
    this._stack.pushBranch(branch);
    const clip = this._stack.top.clipVolume;
    if (undefined !== clip) {
      clip.pushToShaderExecutor(exec);
    }
    const planarClassifier = this._stack.top.planarClassifier;
    if (undefined !== planarClassifier)
      planarClassifier.push(exec);
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
    const planarClassifier = this._stack.top.planarClassifier;
    if (undefined !== planarClassifier)
      planarClassifier.pop(this);

    this._stack.pop();
  }

  public pushActiveVolume(): void {
    if (this._activeClipVolume !== undefined)
      this._activeClipVolume.pushToTarget(this);
  }

  public popActiveVolume(): void {
    if (this._activeClipVolume !== undefined)
      this._activeClipVolume.pop(this);
  }

  private updateActiveVolume(clip?: ClipVector): void {
    if (undefined === clip) {
      this._activeClipVolume = dispose(this._activeClipVolume);
      return;
    }

    // ###TODO: Currently we assume the active view ClipVector is never mutated in place.
    // ###TODO: We may want to compare differing ClipVectors to determine if they are logically equivalent to avoid reallocating clip volume.
    if (undefined === this._activeClipVolume || this._activeClipVolume.clipVector !== clip) {
      this._activeClipVolume = dispose(this._activeClipVolume);
      this._activeClipVolume = System.instance.createClipVolume(clip) as ClipVolume;
    }
  }

  /** @internal */
  public isRangeOutsideActiveVolume(range: Range3d): boolean {
    if (undefined === this._activeClipVolume || !this._stack.top.showClipVolume || !this.clips.isValid)
      return false;

    range = this.currentTransform.multiplyRange(range, range);

    // ###TODO: Avoid allocation of Range3d inside called function...
    // ###TODO: Use some not-yet-existent API which will return as soon as it determines ANY intersection (we don't care about the actual intersection range).
    const clippedRange = ClipUtilities.rangeOfClipperIntersectionWithRange(this._activeClipVolume.clipVector, range);
    return clippedRange.isNull;
  }

  private readonly _scratchRange = new Range3d();
  /** @internal */
  public isGeometryOutsideActiveVolume(geom: CachedGeometry): boolean {
    if (undefined === this._activeClipVolume || !this._stack.top.showClipVolume || !this.clips.isValid)
      return false;

    const range = geom.computeRange(this._scratchRange);
    return this.isRangeOutsideActiveVolume(range);
  }

  public get batchState(): BatchState { return this._batchState; }
  public get currentBatchId(): number { return this._batchState.currentBatchId; }
  public pushBatch(batch: Batch) {
    this._batchState.push(batch, false);
    this.currentOverrides = batch.getOverrides(this);
  }
  public popBatch() {
    this.currentOverrides = undefined;
    this._batchState.pop();
  }

  public addBatch(batch: Batch) {
    assert(this._batches.indexOf(batch) < 0);
    this._batches.push(batch);
  }

  public onBatchDisposed(batch: Batch) {
    const index = this._batches.indexOf(batch);
    assert(index > -1);
    this._batches.splice(index, 1);
  }

  public get wantAmbientOcclusion(): boolean {
    return this._wantAmbientOcclusion;
  }

  // ---- Implementation of RenderTarget interface ---- //

  public get renderSystem(): RenderSystem { return System.instance; }
  public get cameraFrustumNearScaleLimit() {
    return 0; // ###TODO
  }
  public get planFraction() { return this._planFraction; }

  public changeDecorations(decs: Decorations): void {
    dispose(this._decorations);
    this._decorations = decs;
  }
  public changeScene(scene: GraphicList) {
    this._scene = scene;
  }
  public changeBackgroundMap(backgroundMap: GraphicList) {
    this._backgroundMap = backgroundMap;
  }
  public changePlanarClassifiers(planarClassifiers?: PlanarClassifierMap) {
    if (this._planarClassifiers)
      for (const planarClassifier of this._planarClassifiers)
        planarClassifier[1].dispose();

    this._planarClassifiers = planarClassifiers;
  }
  public changeSolarShadowMap(solarShadowMap?: RenderSolarShadowMap): void {
    this._solarShadowMap = solarShadowMap as SolarShadowMap;
  }

  public changeDynamics(dynamics?: GraphicList) {
    // ###TODO: set feature IDs into each graphic so that edge display works correctly...
    // See IModelConnection.transientIds
    disposeArray(this._dynamics);
    this._dynamics = dynamics;
  }
  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._stack.setSymbologyOverrides(ovr);
    this._overridesUpdateTime = BeTimePoint.now();
  }
  public setHiliteSet(hilite: Set<string>): void {
    this._hilite.clear();
    for (const id of hilite)
      this._hilite.addId(id);

    this._hiliteUpdateTime = BeTimePoint.now();
  }
  public setFlashed(id: Id64String, intensity: number) {
    if (id !== this._flashedElemId) {
      this._flashedElemId = id;
      this._flashedUpdateTime = BeTimePoint.now();
    }

    this._flashIntensity = intensity;
  }
  private static _scratch = {
    viewFlags: new ViewFlags(),
    nearCenter: new Point3d(),
    viewX: new Vector3d(),
    viewY: new Vector3d(),
    viewZ: new Vector3d(),
    vec3: new Vector3d(),
    point3: new Point3d(),
    //  visibleEdges: new HiddenLine.Style({}),
    // hiddenEdges: new HiddenLine.Style({ ovrColor: false, color: new ColorDef(ColorByName.white), width: 1, pattern: LinePixels.HiddenLine }),
    animationDisplay: undefined,
  };

  public changeFrustum(newFrustum: Frustum, newFraction: number, is3d: boolean): void {
    newFrustum.clone(this.planFrustum);

    const farLowerLeft = newFrustum.getCorner(Npc.LeftBottomRear);
    const farLowerRight = newFrustum.getCorner(Npc.RightBottomRear);
    const farUpperLeft = newFrustum.getCorner(Npc.LeftTopRear);
    const farUpperRight = newFrustum.getCorner(Npc.RightTopRear);
    const nearLowerLeft = newFrustum.getCorner(Npc.LeftBottomFront);
    const nearLowerRight = newFrustum.getCorner(Npc.RightBottomFront);
    const nearUpperLeft = newFrustum.getCorner(Npc.LeftTopFront);
    const nearUpperRight = newFrustum.getCorner(Npc.RightTopFront);

    const scratch = Target._scratch;
    const nearCenter = nearLowerLeft.interpolate(0.5, nearUpperRight, scratch.nearCenter);

    const viewX = normalizedDifference(nearLowerRight, nearLowerLeft, scratch.viewX);
    const viewY = normalizedDifference(nearUpperLeft, nearLowerLeft, scratch.viewY);
    const viewZ = viewX.crossProduct(viewY, scratch.viewZ).normalize()!;

    this._planFraction = newFraction;

    if (!is3d) {
      const halfWidth = Vector3d.createStartEnd(farLowerRight, farLowerLeft, scratch.vec3).magnitude() * 0.5;
      const halfHeight = Vector3d.createStartEnd(farLowerRight, farUpperRight).magnitude() * 0.5;
      const depth = 2 * RenderTarget.frustumDepth2d;

      this.nearPlaneCenter.set(nearCenter.x, nearCenter.y, RenderTarget.frustumDepth2d);

      lookIn(this.nearPlaneCenter, viewX, viewY, viewZ, this.viewMatrix);
      ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, 0, depth, this.projectionMatrix);

      this.frustumUniforms.setPlanes(halfHeight, -halfHeight, -halfWidth, halfWidth);
      this.frustumUniforms.setFrustum(0, depth, FrustumUniformType.TwoDee);
    } else if (newFraction > 0.999) { // ortho
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
      const scale = 1.0 / (1.0 - newFraction);
      const zVec = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, scratch.vec3);
      const cameraPosition = fromSumOf(farLowerLeft, zVec, scale, scratch.point3);

      const frustumLeft = dotDifference(farLowerLeft, cameraPosition, viewX) * newFraction;
      const frustumRight = dotDifference(farLowerRight, cameraPosition, viewX) * newFraction;
      const frustumBottom = dotDifference(farLowerLeft, cameraPosition, viewY) * newFraction;
      const frustumTop = dotDifference(farUpperLeft, cameraPosition, viewY) * newFraction;
      const frustumFront = -dotDifference(nearLowerLeft, cameraPosition, viewZ);
      const frustumBack = -dotDifference(farLowerLeft, cameraPosition, viewZ);

      lookIn(cameraPosition, viewX, viewY, viewZ, this.viewMatrix);
      frustum(frustumLeft, frustumRight, frustumBottom, frustumTop, frustumFront, frustumBack, this.projectionMatrix);

      this.nearPlaneCenter.setFrom(nearLowerLeft);
      this.nearPlaneCenter.interpolate(0.5, nearUpperRight, this.nearPlaneCenter);

      this.frustumUniforms.setPlanes(frustumTop, frustumBottom, frustumLeft, frustumRight);
      this.frustumUniforms.setFrustum(frustumFront, frustumBack, FrustumUniformType.Perspective);
    }
  }

  public changeRenderPlan(plan: RenderPlan): void {
    this.plan = plan;

    if (this._dcAssigned && plan.is3d !== this.is3d) {
      // changed the dimensionality of the Target. World decorations no longer valid.
      // (lighting is enabled or disabled based on 2d vs 3d).
      this._worldDecorations = dispose(this._worldDecorations);
    }

    if (!this.assignDC()) {
      assert(false);
      return;
    }

    this.bgColor.setFromColorDef(plan.bgColor);
    this.monoColor.setFromColorDef(plan.monoColor);
    this.hiliteSettings = plan.hiliteSettings;
    this.hiliteColor.setFromColorDef(this.hiliteSettings.color);
    this.isFadeOutActive = plan.isFadeOutActive;
    this._transparencyThreshold = 0.0;
    this.analysisStyle = plan.analysisStyle === undefined ? undefined : plan.analysisStyle.clone();
    this.analysisTexture = plan.analysisTexture;

    this.updateActiveVolume(plan.activeVolume);

    const scratch = Target._scratch;
    let visEdgeOvrs = undefined !== plan.hline ? plan.hline.visible : undefined;
    let hidEdgeOvrs = undefined !== plan.hline ? plan.hline.hidden : undefined;

    const vf = ViewFlags.createFrom(plan.viewFlags, scratch.viewFlags);
    let forceEdgesOpaque = true; // most render modes want edges to be opaque so don't allow overrides to their alpha
    switch (vf.renderMode) {
      case RenderMode.Wireframe: {
        // Edge overrides never apply in wireframe mode
        vf.visibleEdges = false;
        vf.hiddenEdges = false;
        forceEdgesOpaque = false;
        break;
      }
      case RenderMode.SmoothShade: {
        // Hidden edges require visible edges
        if (!vf.visibleEdges)
          vf.hiddenEdges = false;

        break;
      }
      case RenderMode.SolidFill: {
        // In solid fill, if the edge color is not overridden, the edges do not use the element's line color
        if (undefined !== visEdgeOvrs && !visEdgeOvrs.ovrColor) {
          // ###TODO? Probably supposed to be contrast with fill and/or background color...
          assert(undefined !== hidEdgeOvrs);
          visEdgeOvrs = visEdgeOvrs.overrideColor(ColorDef.white);
          hidEdgeOvrs = hidEdgeOvrs!.overrideColor(ColorDef.white);
        }
      }
      /* falls through */
      case RenderMode.HiddenLine: {
        // In solid fill and hidden line mode, visible edges always rendered and edge overrides always apply
        vf.visibleEdges = true;

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

    if (RenderMode.SmoothShade === vf.renderMode && plan.is3d && undefined !== plan.ao && vf.ambientOcclusion) {
      this._wantAmbientOcclusion = true;
      this.ambientOcclusionSettings = plan.ao;
    } else {
      this._wantAmbientOcclusion = vf.ambientOcclusion = false;
    }

    this._visibleEdgeOverrides.init(forceEdgesOpaque, visEdgeOvrs);
    this._hiddenEdgeOverrides.init(forceEdgesOpaque, hidEdgeOvrs);

    this._stack.setViewFlags(vf);

    this.changeFrustum(plan.frustum, plan.fraction, plan.is3d);

    // this.shaderlights.clear // ###TODO : Lighting
    this._fStop = 0.0;
    this._ambientLight[0] = 0.2;
    this._ambientLight[1] = 0.2;
    this._ambientLight[2] = 0.2;
    if (plan.is3d && undefined !== plan.lights) {
      // convertLights(...); // TODO: Lighting
      this._fStop = plan.lights.fstop;
    }
  }

  public drawFrame(sceneMilSecElapsed?: number): void {
    assert(System.instance.frameBufferStack.isEmpty);
    if (undefined === this._scene) {
      return;
    }

    this.paintScene(sceneMilSecElapsed);
    this.drawOverlayDecorations();
    assert(System.instance.frameBufferStack.isEmpty);
  }

  protected drawOverlayDecorations(): void { }

  /*
   * Invoked via Viewport.changeView() when the owning Viewport is changed to look at a different view.
   * Invoked via dispose() when the target is being destroyed.
   * The primary difference is that in the former case we retain the SceneCompositor.
   */
  public reset(): void {
    // Clear the scene
    this._scene.length = 0;

    // Clear decorations
    this._decorations = dispose(this._decorations);
    this._dynamics = disposeArray(this._dynamics);
    this._worldDecorations = dispose(this._worldDecorations);

    // Clear render commands
    this._renderCommands.clear();

    // Clear FeatureOverrides for this Target.
    // This may not be strictly necessary as the Target may still be viewing some of these batches, but better to clean up and recreate
    // than to leave unused in memory.
    for (const batch of this._batches)
      batch.onTargetDisposed(this);

    this._batches = [];

    this._activeClipVolume = dispose(this._activeClipVolume);
  }

  public get wantInvertBlackBackground(): boolean { return false; }

  public get visibleEdgeOverrides(): EdgeOverrides | undefined { return this.getEdgeOverrides(RenderPass.OpaqueLinear); }
  public get hiddenEdgeOverrides(): EdgeOverrides | undefined { return this.getEdgeOverrides(RenderPass.HiddenEdge); }
  public get isEdgeColorOverridden(): boolean {
    const ovrs = this.visibleEdgeOverrides;
    return undefined !== ovrs && ovrs.overridesColor;
  }
  public get isEdgeWeightOverridden(): boolean {
    const ovrs = this.visibleEdgeOverrides;
    return undefined !== ovrs && ovrs.overridesWeight;
  }
  public getEdgeOverrides(pass: RenderPass): EdgeOverrides | undefined {
    let ovrs: EdgeOverrides | undefined;
    let enabled = false;
    if (RenderPass.HiddenEdge === pass) {
      ovrs = this._hiddenEdgeOverrides;
      enabled = this.currentViewFlags.hiddenEdges;
    } else {
      ovrs = this._visibleEdgeOverrides;
      enabled = this.currentViewFlags.visibleEdges;
    }

    return enabled ? ovrs : undefined;
  }
  public getEdgeWeight(params: ShaderProgramParams, baseWeight: number): number {
    const ovrs = this.getEdgeOverrides(params.renderPass);
    return undefined !== ovrs && undefined !== ovrs.weight ? ovrs.weight : baseWeight;
  }
  public getEdgeLineCode(params: ShaderProgramParams, baseCode: number): number {
    const ovrs = this.getEdgeOverrides(params.renderPass);
    return undefined !== ovrs && undefined !== ovrs.lineCode ? ovrs.lineCode : baseCode;
  }
  public get edgeColor(): ColorInfo {
    assert(this.isEdgeColorOverridden);
    return ColorInfo.createUniform(this._visibleEdgeOverrides.color!);
  }

  private _doDebugPaint: boolean = false;
  protected debugPaint(): void { }

  public recordPerformanceMetric(operation: string): void {
    if (this.performanceMetrics)
      this.performanceMetrics.recordTime(operation);
  }

  private paintScene(sceneMilSecElapsed?: number): void {
    if (this._doDebugPaint) {
      this.debugPaint();
      return;
    }

    if (!this._dcAssigned) {
      return;
    }

    if (this.performanceMetrics) this.performanceMetrics.startNewFrame(sceneMilSecElapsed);
    this._beginPaint();

    const gl = System.instance.context;
    const rect = this.viewRect;
    gl.viewport(0, 0, rect.width, rect.height);

    // Set this to true to visualize the output of readPixels()...useful for debugging pick.
    const drawForReadPixels = false;
    if (drawForReadPixels) {
      this._isReadPixelsInProgress = true;
      this._readPixelsSelector = Pixel.Selector.Feature;

      this.recordPerformanceMetric("Begin Paint");
      const vf = this.currentViewFlags.clone(this._scratchViewFlags);
      vf.transparency = false;
      vf.textures = false;
      vf.sourceLights = false;
      vf.cameraLights = false;
      vf.solarLight = false;
      vf.shadows = false;
      vf.noGeometryMap = true;
      vf.acsTriad = false;
      vf.grid = false;
      vf.monochrome = false;
      vf.materials = false;

      const state = BranchState.create(this._stack.top.symbologyOverrides, vf);
      this.pushState(state);

      this._renderCommands.init(this._scene, this._backgroundMap, this._decorations, this._dynamics, true);
      this.recordPerformanceMetric("Init Commands");
      this.compositor.drawForReadPixels(this._renderCommands);
      this._stack.pop();

      this._isReadPixelsInProgress = false;
    } else {
      this.recordPerformanceMetric("Begin Draw Planar Classifiers");
      this.drawPlanarClassifiers();
      this.recordPerformanceMetric("Begin Draw Shadow Maps");
      this.drawSolarShadowMap();
      this.recordPerformanceMetric("Begin Paint");
      this._renderCommands.init(this._scene, this._backgroundMap, this._decorations, this._dynamics);

      this.recordPerformanceMetric("Init Commands");
      this.compositor.draw(this._renderCommands); // scene compositor gets disposed and then re-initialized... target remains undisposed

      this._stack.pushState(this.decorationState);
      this.drawPass(RenderPass.WorldOverlay);
      this.drawPass(RenderPass.ViewOverlay);
      this._stack.pop();

      this.recordPerformanceMetric("Overlay Draws");
    }

    // Reset the batch IDs in all batches drawn for this call.
    this._batchState.reset();

    this._endPaint();
    this.recordPerformanceMetric("End Paint");

    if (this.performanceMetrics) {
      if (this.performanceMetrics.gatherCurPerformanceMetrics) {
        const perfMet = this.performanceMetrics;
        const fpsTimerElapsed = perfMet.fpsTimer.currentSeconds - perfMet.fpsTimerStart;
        if (perfMet.spfTimes[perfMet.curSpfTimeIndex]) perfMet.spfSum -= perfMet.spfTimes[perfMet.curSpfTimeIndex];
        perfMet.spfSum += fpsTimerElapsed;
        perfMet.spfTimes[perfMet.curSpfTimeIndex] = fpsTimerElapsed;

        let renderTimeElapsed = 0;
        perfMet.frameTimings.forEach((val) => {
          renderTimeElapsed += val;
        });
        if (perfMet.renderSpfTimes[perfMet.curSpfTimeIndex]) perfMet.renderSpfSum -= perfMet.renderSpfTimes[perfMet.curSpfTimeIndex];
        perfMet.renderSpfSum += renderTimeElapsed;
        perfMet.renderSpfTimes[perfMet.curSpfTimeIndex] = renderTimeElapsed;

        if (sceneMilSecElapsed !== undefined) {
          if (perfMet.loadTileTimes[perfMet.curSpfTimeIndex]) perfMet.loadTileSum -= perfMet.loadTileTimes[perfMet.curSpfTimeIndex];
          perfMet.loadTileSum += sceneMilSecElapsed;
          perfMet.loadTileTimes[perfMet.curSpfTimeIndex] = sceneMilSecElapsed;
        }
        perfMet.curSpfTimeIndex++;
        if (perfMet.curSpfTimeIndex >= 50) perfMet.curSpfTimeIndex = 0;
        perfMet.fpsTimerStart = perfMet.fpsTimer.currentSeconds;
      }
      if (this.performanceMetrics.gatherGlFinish) {
        // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
        const bytes = new Uint8Array(4);
        System.instance.frameBufferStack.execute(this._fbo!, true, () => {
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        });
        if (this.performanceMetrics) this.performanceMetrics.endFrame("Finish GPU Queue");
      }
    }
  }

  private drawPass(pass: RenderPass): void {
    System.instance.applyRenderState(this.getRenderState(pass));
    this.techniques.execute(this, this._renderCommands.getCommands(pass), pass);
  }

  private getRenderState(pass: RenderPass): RenderState {
    // the other passes are handled by SceneCompositor
    assert(RenderPass.ViewOverlay === pass || RenderPass.WorldOverlay === pass);
    return this._overlayRenderState;
  }

  private assignDC(): boolean {
    if (!this._dcAssigned) {
      this._dcAssigned = this._assignDC();
    }

    assert(this._dcAssigned);
    return this._dcAssigned;
  }

  public readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean): void {
    if (this.performanceMetrics) this.performanceMetrics.startNewFrame();

    // We can't reuse the previous frame's data for a variety of reasons, chief among them that some types of geometry (surfaces, translucent stuff) don't write
    // to the pick buffers and others we don't want - such as non-pickable decorations - do.
    // Render to an offscreen buffer so that we don't destroy the current color buffer.
    const texture = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === texture) {
      receiver(undefined);
      return;
    }

    let result: Pixel.Buffer | undefined;
    const fbo = FrameBuffer.create([texture]);
    if (undefined !== fbo) {
      System.instance.frameBufferStack.execute(fbo, true, () => {
        this._drawNonLocatable = !excludeNonLocatable;
        result = this.readPixelsFromFbo(rect, selector);
        this._drawNonLocatable = true;
      });

      dispose(fbo);
    }

    dispose(texture);

    receiver(result);

    // Reset the batch IDs in all batches drawn for this call.
    this._batchState.reset();
  }

  private readonly _scratchTmpFrustum = new Frustum();
  private readonly _scratchRectFrustum = new Frustum();
  private readonly _scratchViewFlags = new ViewFlags();
  private readPixelsFromFbo(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    this._isReadPixelsInProgress = true;
    this._readPixelsSelector = selector;

    // Temporarily turn off lighting to speed things up.
    // ###TODO: Disable textures *unless* they contain transparency. If we turn them off unconditionally then readPixels() will locate fully-transparent pixels, which we don't want.
    const vf = this.currentViewFlags.clone(this._scratchViewFlags);
    vf.transparency = false;
    vf.textures = true; // false;
    vf.sourceLights = false;
    vf.cameraLights = false;
    vf.solarLight = false;
    vf.shadows = false;
    vf.noGeometryMap = true;
    vf.acsTriad = false;
    vf.grid = false;
    vf.monochrome = false;
    vf.materials = false;
    vf.ambientOcclusion = false;

    const state = BranchState.create(this._stack.top.symbologyOverrides, vf);
    this.pushState(state);

    // Create a culling frustum based on the input rect.
    const viewRect = this.viewRect;
    const leftScale = (rect.left - viewRect.left) / (viewRect.right - viewRect.left);
    const rightScale = (viewRect.right - rect.right) / (viewRect.right - viewRect.left);
    const topScale = (rect.top - viewRect.top) / (viewRect.bottom - viewRect.top);
    const bottomScale = (viewRect.bottom - rect.bottom) / (viewRect.bottom - viewRect.top);

    const tmpFrust = this._scratchTmpFrustum;
    const planFrust = this.planFrustum;
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._000, leftScale, Npc._100);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._100, rightScale, Npc._000);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._010, leftScale, Npc._110);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._110, rightScale, Npc._010);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._001, leftScale, Npc._101);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._101, rightScale, Npc._001);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._011, leftScale, Npc._111);
    interpolateFrustumPoint(tmpFrust, planFrust, Npc._111, rightScale, Npc._011);

    const rectFrust = this._scratchRectFrustum;
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._000, bottomScale, Npc._010);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._100, bottomScale, Npc._110);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._010, topScale, Npc._000);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._110, topScale, Npc._100);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._001, bottomScale, Npc._011);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._101, bottomScale, Npc._111);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._011, topScale, Npc._001);
    interpolateFrustumPoint(rectFrust, tmpFrust, Npc._111, topScale, Npc._101);

    // Repopulate the command list, omitting non-pickable decorations and putting transparent stuff into the opaque passes.
    this._renderCommands.clear();
    this._renderCommands.setCheckRange(rectFrust);
    this._renderCommands.init(this._scene, this._backgroundMap, this._decorations, this._dynamics, true);
    this._renderCommands.clearCheckRange();
    this.recordPerformanceMetric("Init Commands");

    // Draw the scene
    this.compositor.drawForReadPixels(this._renderCommands, undefined !== this._decorations ? this._decorations.worldOverlay : undefined);

    if (this.performanceMetrics && this.performanceMetrics.gatherGlFinish) {
      // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
      const gl = System.instance.context;
      const bytes = new Uint8Array(4);
      System.instance.frameBufferStack.execute(this._fbo!, true, () => {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      });
      this.recordPerformanceMetric("Finish GPU Queue");
    }

    // Restore the state
    this._stack.pop();

    const result = this.compositor.readPixels(rect, selector);
    if (this.performanceMetrics) this.performanceMetrics.endFrame("Read Pixels");
    this._isReadPixelsInProgress = false;
    return result;
  }

  /** Given a ViewRect, return a new rect that has been adjusted for the given aspect ratio. */
  private adjustRectForAspectRatio(requestedRect: ViewRect, targetAspectRatio: number): ViewRect {
    const rect = requestedRect.clone();
    if (targetAspectRatio >= 1) {
      const requestedWidth = rect.width;
      const requiredWidth = rect.height * targetAspectRatio;
      const adj = requiredWidth - requestedWidth;
      rect.inset(-adj / 2, 0);
    } else {
      const requestedHeight = rect.height;
      const requiredHeight = rect.width / targetAspectRatio;
      const adj = requiredHeight - requestedHeight;
      rect.inset(0, -adj / 2);
    }
    return rect;
  }

  protected readImagePixels(out: Uint8Array, x: number, y: number, w: number, h: number): boolean {
    assert(this._fbo !== undefined);
    if (this._fbo === undefined)
      return false;

    const context = System.instance.context;
    let didSucceed = true;
    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      try {
        context.readPixels(x, y, w, h, context.RGBA, context.UNSIGNED_BYTE, out);
      } catch (e) {
        didSucceed = false;
      }
    });
    if (!didSucceed)
      return false;
    return true;
  }

  public readImage(wantRectIn: ViewRect, targetSizeIn: Point2d, flipVertically: boolean): ImageBuffer | undefined {
    // Determine capture rect and validate
    const actualViewRect = this.renderRect;

    const wantRect = wantRectIn.clone();
    if (wantRect.right === -1 || wantRect.bottom === -1) {  // Indicates to get the entire view, no clipping
      wantRect.right = actualViewRect.right;
      wantRect.bottom = actualViewRect.bottom;
    }

    const targetSize = targetSizeIn.clone();
    if (targetSize.x === 0 || targetSize.y === 0) { // Indicates image should have same dimensions as rect (no scaling)
      targetSize.x = wantRect.width;
      targetSize.y = wantRect.height;
    }

    const lowerRight = Point2d.create(wantRect.right - 1, wantRect.bottom - 1); // in BSIRect, the right and bottom are actually *outside* of the rectangle
    if (!actualViewRect.containsPoint(Point2d.create(wantRect.left, wantRect.top)) || !actualViewRect.containsPoint(lowerRight))
      return undefined;

    let captureRect = this.adjustRectForAspectRatio(wantRect, targetSize.x / targetSize.y);

    captureRect = wantRect.clone();
    targetSize.x = captureRect.width;
    targetSize.y = captureRect.height;

    if (!actualViewRect.containsPoint(Point2d.create(wantRect.left, wantRect.top)) || !actualViewRect.containsPoint(lowerRight))
      return undefined; // ###TODO: additional logic to shrink requested rectangle to fit inside view

    this.assignDC();

    // Read pixels. Note ViewRect thinks (0,0) = top-left. gl.readPixels expects (0,0) = bottom-left.
    const bytesPerPixel = 4;
    const imageData = new Uint8Array(bytesPerPixel * captureRect.width * captureRect.height);
    const isValidImageData = this.readImagePixels(imageData, captureRect.left, actualViewRect.height - captureRect.bottom, captureRect.width, captureRect.height);
    if (!isValidImageData)
      return undefined;
    const image = ImageBuffer.create(imageData, ImageBufferFormat.Rgba, targetSize.x);
    if (!image)
      return undefined;

    // No need to scale image.
    // Some callers want background pixels to be treated as fully-transparent
    // They indicate this by supplying a background color with full transparency
    // Any other pixels are treated as fully-opaque as alpha has already been blended
    // ###TODO: This introduces a defect in that we are not preserving alpha of translucent pixels, and therefore the returned image cannot be blended
    const preserveBGAlpha = 0.0 === this.bgColor.alpha;

    // Optimization for view attachments: if image consists entirely of background pixels, return an undefined
    let isEmptyImage = true;
    for (let i = 3; i < image.data.length; i += 4) {
      const a = image.data[i];
      if (!preserveBGAlpha || 0 < a) {
        image.data[i] = 0xff;
        isEmptyImage = false;
      }
    }
    if (isEmptyImage)
      return undefined;

    if (flipVertically) {
      const halfHeight = Math.floor(image.height / 2);
      const numBytesPerRow = image.width * 4;
      for (let loY = 0; loY < halfHeight; loY++) {
        for (let x = 0; x < image.width; x++) {
          const hiY = (image.height - 1) - loY;
          const loIdx = loY * numBytesPerRow + x * 4;
          const hiIdx = hiY * numBytesPerRow + x * 4;

          swapImageByte(image, loIdx, hiIdx);
          swapImageByte(image, loIdx + 1, hiIdx + 1);
          swapImageByte(image, loIdx + 2, hiIdx + 2);
          swapImageByte(image, loIdx + 3, hiIdx + 3);
        }
      }
    }

    return image;
  }

  public drawPlanarClassifiers() {
    if (this._planarClassifiers)
      this._planarClassifiers.forEach((classifier) => (classifier as PlanarClassifier).draw(this));
  }
  public drawSolarShadowMap() {
    if (this._solarShadowMap)
      (this._solarShadowMap as SolarShadowMap).draw(this);
  }

  // ---- Methods expected to be overridden by subclasses ---- //

  protected abstract _assignDC(): boolean;
  protected abstract _beginPaint(): void;
  protected abstract _endPaint(): void;
}

/** A Target that renders to a canvas on the screen
 * @internal
 */
export class OnScreenTarget extends Target {
  private readonly _canvas: HTMLCanvasElement;
  private _blitGeom?: SingleTexturedViewportQuadGeometry;
  private readonly _prevViewRect = new ViewRect();
  private _animationFraction: number = 0;

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._canvas = canvas;
  }

  public dispose() {
    this._fbo = dispose(this._fbo);
    this._blitGeom = dispose(this._blitGeom);
    super.dispose();
  }

  public get animationFraction(): number { return this._animationFraction; }
  public set animationFraction(fraction: number) { this._animationFraction = fraction; }

  public get viewRect(): ViewRect {
    assert(0 < this.renderRect.width && 0 < this.renderRect.height, "Zero-size view rect");
    assert(Math.floor(this.renderRect.width) === this.renderRect.width && Math.floor(this.renderRect.height) === this.renderRect.height, "fractional view rect dimensions");
    return this.renderRect;
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean): void { assert(false); }

  protected _assignDC(): boolean {
    assert(undefined === this._fbo);

    const rect = this.viewRect; // updates the render rect to be the client width and height
    const color = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === color) {
      return false;
    }

    this._fbo = FrameBuffer.create([color]);
    if (undefined === this._fbo) {
      return false;
    }

    const tx = this._fbo.getColor(0);
    assert(undefined !== tx.getHandle());
    this._blitGeom = SingleTexturedViewportQuadGeometry.createGeometry(tx.getHandle()!, TechniqueId.CopyColorNoAlpha);
    return undefined !== this._blitGeom;
  }

  protected debugPaint(): void {
    const rect = this.viewRect;
    const canvas = System.instance.canvas;
    canvas.width = rect.width;
    canvas.height = rect.height;

    const gl = System.instance.context;
    gl.viewport(0, 0, rect.width, rect.height);
    gl.clearColor(1, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const context = this._canvas.getContext("2d", { alpha: false });
    assert(null !== context);
    context!.drawImage(canvas, 0, 0);
  }

  public updateViewRect(): boolean {
    this.renderRect.init(0, 0, this._canvas.clientWidth, this._canvas.clientHeight);
    const viewRect = this.renderRect;

    if (this._prevViewRect.width !== viewRect.width || this._prevViewRect.height !== viewRect.height) {
      // Must ensure internal bitmap grid dimensions of on-screen canvas match its own on-screen appearance
      this._canvas.width = viewRect.width;
      this._canvas.height = viewRect.height;
      this._prevViewRect.setFrom(viewRect);
      return true;
    }
    return false;
  }

  protected _beginPaint(): void {
    assert(undefined !== this._fbo);

    // Render to our framebuffer
    const system = System.instance;
    system.frameBufferStack.push(this._fbo!, true);

    const viewRect = this.viewRect;

    // Ensure off-screen canvas dimensions match on-screen canvas dimensions
    if (system.canvas.width !== viewRect.width)
      system.canvas.width = viewRect.width;
    if (system.canvas.height !== viewRect.height)
      system.canvas.height = viewRect.height;

    assert(system.context.drawingBufferWidth === viewRect.width, "offscreen context dimensions don't match onscreen");
    assert(system.context.drawingBufferHeight === viewRect.height, "offscreen context dimensions don't match onscreen");
  }

  private static _progParams?: ShaderProgramParams;
  private static _drawParams?: DrawParams;
  private static getDrawParams(target: OnScreenTarget, geom: SingleTexturedViewportQuadGeometry) {
    if (undefined === this._progParams) {
      this._progParams = new ShaderProgramParams();
      this._drawParams = new DrawParams();
    }

    this._progParams.init(target);
    this._drawParams!.init(this._progParams, geom);
    return this._drawParams!;
  }

  protected _endPaint(): void {
    const onscreenContext = this._canvas.getContext("2d", { alpha: false });
    assert(null !== onscreenContext);
    assert(undefined !== this._blitGeom);
    if (undefined === this._blitGeom || null === onscreenContext) {
      return;
    }

    const system = System.instance;
    system.frameBufferStack.pop();

    // Copy framebuffer contents to off-screen canvas
    system.applyRenderState(RenderState.defaults);
    const drawParams = OnScreenTarget.getDrawParams(this, this._blitGeom);
    system.techniques.draw(drawParams);

    // NB: Very early on we found that we needed to do a clearRect() on the 2d context to prevent artifacts in final image...
    // this turned out to be a significant performance issue in Firefox and removal produced no artifacts.
    // onscreenContext.clearRect(0, 0, this._canvas.clientWidth, this._canvas.clientHeight);

    // Copy off-screen canvas contents to on-screen canvas
    onscreenContext.drawImage(system.canvas, 0, 0);
  }

  protected drawOverlayDecorations(): void {
    if (undefined !== this._decorations && undefined !== this._decorations.canvasDecorations) {
      const ctx = this._canvas.getContext("2d", { alpha: false })!;
      for (const overlay of this._decorations.canvasDecorations) {
        ctx.save();
        if (overlay.position)
          ctx.translate(overlay.position.x, overlay.position.y);
        overlay.drawDecoration(ctx);
        ctx.restore();
      }
    }
  }

  public pickOverlayDecoration(pt: XAndY): CanvasDecoration | undefined {
    let overlays: CanvasDecoration[] | undefined;
    if (undefined === this._decorations || undefined === (overlays = this._decorations.canvasDecorations))
      return undefined;

    // loop over array backwards, because later entries are drawn on top.
    for (let i = overlays.length - 1; i >= 0; --i) {
      const overlay = overlays[i];
      if (undefined !== overlay.pick && overlay.pick(pt))
        return overlay;
    }
    return undefined;
  }

  public onResized(): void {
    this._dcAssigned = false;
    this._fbo = dispose(this._fbo);
  }
}

/** @internal */
export class OffScreenTarget extends Target {
  private _animationFraction: number = 0;

  public constructor(rect: ViewRect) {
    super(rect);
  }

  public get animationFraction(): number { return this._animationFraction; }
  public set animationFraction(fraction: number) { this._animationFraction = fraction; }

  public get viewRect(): ViewRect { return this.renderRect; }

  public onResized(): void { assert(false); } // offscreen viewport's dimensions are set once, in constructor.
  public updateViewRect(): boolean { return false; } // offscreen target does not dynamically resize the view rect

  public setViewRect(rect: ViewRect, temporary: boolean): void {
    if (this.renderRect.equals(rect))
      return;

    this.renderRect.setFrom(rect);
    if (temporary) {
      // Temporarily adjust view rect to create scene for a view attachment.
      // Will be reset before attachment is rendered - so don't blow away our framebuffers + textures
      return;
    }

    this._dcAssigned = false;
    this._fbo = dispose(this._fbo);
    dispose(this._compositor);
  }

  protected _assignDC(): boolean {
    if (!this.updateViewRect() && this._fbo !== undefined)
      return true;

    const rect = this.viewRect;
    const color = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (color === undefined)
      return false;
    this._fbo = FrameBuffer.create([color]);
    assert(this._fbo !== undefined);
    return this._fbo !== undefined;
  }

  protected _beginPaint(): void {
    assert(this._fbo !== undefined);
    System.instance.frameBufferStack.push(this._fbo!, true);
  }

  protected _endPaint(): void {
    System.instance.frameBufferStack.pop();
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

function interpolatePoint(p0: Point3d, fraction: number, p1: Point3d, out: Point3d): Point3d {
  let x: number;
  let y: number;
  let z: number;
  if (fraction <= 0.5) {
    x = p0.x + fraction * (p1.x - p0.x);
    y = p0.y + fraction * (p1.y - p0.y);
    z = p0.z + fraction * (p1.z - p0.z);
  } else {
    const t = fraction - 1.0;
    x = p1.x + t * (p1.x - p0.x);
    y = p1.y + t * (p1.y - p0.y);
    z = p1.z + t * (p1.z - p0.z);
  }

  return Point3d.create(x, y, z, out);
}

function interpolateFrustumPoint(destFrust: Frustum, srcFrust: Frustum, destPoint: Npc, scale: number, srcPoint: Npc): void {
  interpolatePoint(srcFrust.getCorner(destPoint), scale, srcFrust.getCorner(srcPoint), destFrust.points[destPoint]);
}
