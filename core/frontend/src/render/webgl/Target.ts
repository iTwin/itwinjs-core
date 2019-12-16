/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ClipPlaneContainment,
  ClipUtilities,
  ClipVector,
  InverseMatrixState,
  Matrix4d,
  Point2d,
  Point3d,
  Range3d,
  Transform,
  Vector3d,
  XAndY,
} from "@bentley/geometry-core";
import {
  BeTimePoint,
  IDisposable,
  Id64,
  Id64String,
  StopWatch,
  assert,
  dispose,
  disposeArray,
} from "@bentley/bentleyjs-core";
import {
  AnimationBranchStates,
  CanvasDecoration,
  ClippingType,
  Decorations,
  GraphicList,
  Pixel,
  PlanarClassifierMap,
  PrimitiveVisibility,
  RenderMemory,
  RenderPlan,
  RenderPlanarClassifier,
  RenderSystem,
  RenderTarget,
  RenderTargetDebugControl,
  RenderTextureDrape,
  TextureDrapeMap,
} from "../System";
import {
  AmbientOcclusion,
  AnalysisStyle,
  ColorDef,
  Frustum,
  Hilite,
  ImageBuffer,
  ImageBufferFormat,
  Npc,
  RenderMode,
  RenderTexture,
  SpatialClassificationProps,
  ViewFlags,
} from "@bentley/imodeljs-common";
import { freeDrawParams } from "./ScratchDrawParams";
import { Primitive } from "./Primitive";
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
import { TextureDrape } from "./TextureDrape";
import { CachedGeometry, SingleTexturedViewportQuadGeometry } from "./CachedGeometry";
import { ClipDef } from "./TechniqueFlags";
import { ClipMaskVolume, ClipPlanesVolume } from "./ClipVolume";
import { FloatRgba } from "./FloatRGBA";
import { SolarShadowMap } from "./SolarShadowMap";
import { imageBufferToCanvas, canvasToResizedCanvasWithBars, canvasToImageBuffer } from "../../ImageUtil";
import { HiliteSet } from "../../SelectionSet";
import { SceneContext } from "../../ViewContext";
import { GLTimerResultCallback } from "./../System";
import { WebGlDisposable } from "./Disposable";
import { cssPixelsToDevicePixels, queryDevicePixelRatio } from "../DevicePixelRatio";

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
  private readonly _planeData: Float32Array = new Float32Array(4);
  private readonly _frustumData: Float32Array = new Float32Array(3);
  private readonly _logZData = new Float32Array(2);
  private _useLogZ = false;

  public constructor() { }

  public get frustumPlanes(): Float32Array { return this._planeData; }  // uniform vec4 u_frustumPlanes; // { top, bottom, left, right }
  public get frustum(): Float32Array { return this._frustumData; } // uniform vec3 u_frustum; // { near, far, type }
  public get nearPlane(): number { return this._frustumData[FrustumData.kNear]; }
  public get farPlane(): number { return this._frustumData[FrustumData.kFar]; }
  public get type(): FrustumUniformType { return this.frustum[FrustumData.kType] as FrustumUniformType; }
  public get is2d(): boolean { return FrustumUniformType.TwoDee === this.type; }

  // uniform vec2 u_logZ where x = 1/near and y = log(far/near)
  public get logZ(): Float32Array | undefined { return this._useLogZ ? this._logZData : undefined; }

  public setPlanes(top: number, bottom: number, left: number, right: number): void {
    this._planeData[Plane.kTop] = top;
    this._planeData[Plane.kBottom] = bottom;
    this._planeData[Plane.kLeft] = left;
    this._planeData[Plane.kRight] = right;
  }
  public setFrustum(nearPlane: number, farPlane: number, type: FrustumUniformType, useLogZ: boolean): void {
    this._frustumData[FrustumData.kNear] = nearPlane;
    this._frustumData[FrustumData.kFar] = farPlane;
    this._frustumData[FrustumData.kType] = type as number;
    this._useLogZ = useLogZ && (FrustumUniformType.Perspective === type);
    if (this._useLogZ) {
      this._logZData[0] = 0 !== nearPlane ? 1 / nearPlane : 0;
      this._logZData[1] = 0 !== nearPlane ? Math.log(farPlane / nearPlane) : 1;
    }
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

interface AllTimePoints {
  begin: BeTimePoint;
  end: BeTimePoint;
  name: string;
}

/** @internal */
export class PerformanceMetrics {
  private _beginTimePoints: BeTimePoint[] = []; // stack of time points
  private _operationNames: string[] = []; // stack of operation names
  private _allTimePoints1: AllTimePoints[] = []; // queue 1 of data needed to make frameTimings; use 2 copies for double buffering
  private _allTimePoints2: AllTimePoints[] = []; // queue 2 of data needed to make frameTimings; use 2 copies for double buffering
  private _updateallTimePoints1 = true; // determine which buffer to use for the frame timings; used for double buffering the frame timings
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

  public constructor(gatherGlFinish = false, gatherCurPerformanceMetrics = false, gpuResults?: GLTimerResultCallback) {
    this.gatherGlFinish = gatherGlFinish;
    this.gatherCurPerformanceMetrics = gatherCurPerformanceMetrics;
    if (gpuResults) System.instance.debugControl.resultsCallback = gpuResults;
  }

  public beginFrame(sceneTime: number = 0) {
    this._beginTimePoints = [];
    this._operationNames = [];
    this.frameTimings = new Map<string, number>();
    this.frameTimings.set("Scene Time", sceneTime);
    this._operationNames.push("Total Time");
    this._operationNames.push("CPU Total Time");
    const now = BeTimePoint.now();
    this._beginTimePoints.push(now); // this first time point used to calculate total time at the end
    this._beginTimePoints.push(now); // this second time point used to calculate total cpu time at the end
  }

  public beginOperation(operationName: string) {
    this._operationNames.push(operationName);
    this._beginTimePoints.push(BeTimePoint.now());
  }

  public endOperation() {
    const endTimePoint = BeTimePoint.now();
    const beginTimePoint = this._beginTimePoints.length > 0 ? this._beginTimePoints.pop()! : endTimePoint;
    const operationName = this._operationNames.pop();
    if (operationName) { // Add data to queue now, calculate time later; helps eliminate time spent timing things in 'Total Time'
      if (this._updateallTimePoints1) // Push to currently active allTimePoints buffer
        this._allTimePoints1.push({ begin: beginTimePoint, end: endTimePoint, name: operationName });
      else
        this._allTimePoints2.push({ begin: beginTimePoint, end: endTimePoint, name: operationName });
    }
  }

  public endFrame() {
    this.endOperation();

    // Use double buffering here to ensure that we grab a COMPLETE set of timings from a SINGLE run when grabbing timing data while continuously rendering
    this._updateallTimePoints1 = !this._updateallTimePoints1; // Switch to other allTimePoints buffer
    if (this._updateallTimePoints1) { // Get data from the old buffer that was just completed
      this._allTimePoints2.forEach((record: AllTimePoints) => { this.frameTimings.set(record.name, record.end.milliseconds - record.begin.milliseconds); });
      this._allTimePoints2 = []; // Reset to empty
    } else {
      this._allTimePoints1.forEach((record: AllTimePoints) => { this.frameTimings.set(record.name, record.end.milliseconds - record.begin.milliseconds); });
      this._allTimePoints1 = []; // Reset to empty
    }
    this._beginTimePoints = []; // This should be back to [] at this point
    this._operationNames = []; // This should be back to [] at this point
  }
}

function swapImageByte(image: ImageBuffer, i0: number, i1: number) {
  const tmp = image.data[i0];
  image.data[i0] = image.data[i1];
  image.data[i1] = tmp;
}

type ClipVolume = ClipPlanesVolume | ClipMaskVolume;

/** @internal */
export interface Hilites {
  readonly elements: Id64.Uint32Set;
  readonly subcategories: Id64.Uint32Set;
  readonly models: Id64.Uint32Set;
  readonly isEmpty: boolean;
}

class EmptyHiliteSet {
  public readonly elements: Id64.Uint32Set;
  public readonly subcategories: Id64.Uint32Set;
  public readonly models: Id64.Uint32Set;
  public readonly isEmpty = true;

  public constructor() {
    this.elements = this.subcategories = this.models = new Id64.Uint32Set();
  }
}

/** @internal */
export abstract class Target extends RenderTarget implements RenderTargetDebugControl, WebGlDisposable {
  protected _decorations?: Decorations;
  private _stack = new BranchStack();
  private _batchState = new BatchState(this._stack);
  private _scene: GraphicList = [];
  private _backgroundMap: GraphicList = [];
  private _overlayGraphics: GraphicList = [];
  private _planarClassifiers?: PlanarClassifierMap;
  private _textureDrapes?: TextureDrapeMap;
  private _dynamics?: GraphicList;
  private _worldDecorations?: WorldDecorations;
  private _hilites: Hilites = new EmptyHiliteSet();
  private _hiliteUpdateTime = BeTimePoint.now();
  private _flashed: Id64.Uint32Pair = { lower: 0, upper: 0 };
  private _flashedId = Id64.invalid;
  private _flashedUpdateTime = BeTimePoint.now();
  private _flashIntensity: number = 0;
  private _transparencyThreshold: number = 0;
  private _renderCommands: RenderCommands;
  private _overlayRenderState: RenderState;
  protected _compositor: SceneCompositor;
  private _activeClipVolume?: ClipVolume;
  private _clipMask?: TextureHandle;
  public readonly clips = new Clips();
  protected _fbo?: FrameBuffer;
  protected _dcAssigned: boolean = false;
  public performanceMetrics?: PerformanceMetrics;
  public readonly decorationState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly frustumUniforms = new FrustumUniforms();
  public readonly bgColor = FloatRgba.fromColorDef(ColorDef.red);
  public readonly monoColor = FloatRgba.fromColorDef(ColorDef.white);
  public hiliteSettings = new Hilite.Settings();
  public hiliteColor = FloatRgba.fromColorDef(this.hiliteSettings.color);
  public emphasisSettings = new Hilite.Settings();
  public emphasisColor = FloatRgba.fromColorDef(this.emphasisSettings.color);
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
  private _currentlyDrawingClassifier?: PlanarClassifier;
  private _animationFraction: number = 0;
  public isFadeOutActive = false;
  public activeVolumeClassifierTexture?: WebGLTexture;
  public activeVolumeClassifierProps?: SpatialClassificationProps.Classifier;
  public activeVolumeClassifierModelId?: Id64String;

  // RenderTargetDebugControl
  public useLogZ = true;
  public vcSupportIntersectingVolumes: boolean = false;
  public drawForReadPixels = false;
  public primitiveVisibility = PrimitiveVisibility.All;
  public displayDrapeFrustum = false;
  public get shadowFrustum(): Frustum | undefined {
    const map = this.solarShadowMap;
    return map.isEnabled && map.isReady ? map.frustum : undefined;
  }
  public get debugControl(): RenderTargetDebugControl { return this; }

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
  public get wantLogZ(): boolean { return undefined !== this.frustumUniforms.logZ; }

  public get currentOverrides(): FeatureOverrides | undefined { return this._currentOverrides; }
  public set currentOverrides(ovr: FeatureOverrides | undefined) {
    // Don't bother setting up overrides if they don't actually override anything - wastes time doing texture lookups in shaders.
    if (undefined !== ovr && ovr.anyOverridden)
      this._currentOverrides = ovr;
    else
      this._currentOverrides = undefined;
  }

  public get transparencyThreshold(): number { return this._transparencyThreshold; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public get hilites(): Hilites { return this._hilites; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }

  public get flashed(): Id64.Uint32Pair | undefined { return Id64.isValid(this._flashedId) ? this._flashed : undefined; }
  public get flashedId(): Id64String { return this._flashedId; }
  public get flashedUpdateTime(): BeTimePoint { return this._flashedUpdateTime; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get scene(): GraphicList { return this._scene; }
  public get dynamics(): GraphicList | undefined { return this._dynamics; }

  public get animationFraction(): number { return this._animationFraction; }
  public set animationFraction(fraction: number) { this._animationFraction = fraction; }

  public get animationBranches(): AnimationBranchStates | undefined { return this._animationBranches; }
  public set animationBranches(branches: AnimationBranchStates | undefined) { this._animationBranches = branches; }
  public get branchStack(): BranchStack { return this._stack; }
  public get solarShadowMap(): SolarShadowMap { return this.compositor.solarShadowMap; }
  public get isDrawingShadowMap(): boolean { return this.solarShadowMap.isEnabled && this.solarShadowMap.isDrawing; }
  public getPlanarClassifier(id: Id64String): RenderPlanarClassifier | undefined {
    return undefined !== this._planarClassifiers ? this._planarClassifiers.get(id) : undefined;
  }
  public createPlanarClassifier(properties: SpatialClassificationProps.Classifier): PlanarClassifier {
    return PlanarClassifier.create(properties, this);
  }
  public getTextureDrape(id: Id64String): RenderTextureDrape | undefined {
    return undefined !== this._textureDrapes ? this._textureDrapes.get(id) : undefined;
  }

  public getWorldDecorations(decs: GraphicList): Branch {
    if (undefined === this._worldDecorations) {

      // Don't allow flags like monochrome etc to affect world decorations. Allow lighting in 3d only.
      const vf = new ViewFlags();
      vf.renderMode = RenderMode.SmoothShade;
      vf.clipVolume = false;

      vf.lighting = !this.is2d;
      vf.shadows = false; // don't want shadows applied to these

      this._worldDecorations = new WorldDecorations(vf);
    }

    this._worldDecorations.init(decs);
    return this._worldDecorations;
  }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get currentTransform(): Transform { return this._stack.top.transform; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.monochrome ? ShaderFlags.Monochrome : ShaderFlags.None; }
  public get currentFeatureSymbologyOverrides(): FeatureSymbology.Overrides { return this._stack.top.symbologyOverrides; }
  public get currentPlanarClassifier(): PlanarClassifier | undefined { return this._stack.top.planarClassifier; }
  public get currentlyDrawingClassifier(): PlanarClassifier | undefined { return this._currentlyDrawingClassifier; }
  public get currentTextureDrape(): TextureDrape | undefined {
    const drape = this._stack.top.textureDrape;
    return undefined !== drape && drape.isReady ? drape : undefined;
  }
  public get currentPlanarClassifierOrDrape(): PlanarClassifier | TextureDrape | undefined {
    const drape = this.currentTextureDrape;
    return undefined === drape ? this.currentPlanarClassifier : drape;
  }

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

  private _isDisposed = false;
  public get isDisposed(): boolean {
    return 0 === this._scene.length
      && undefined === this._decorations
      && undefined === this._dynamics
      && undefined === this._worldDecorations
      && undefined === this._planarClassifiers
      && undefined === this._textureDrapes
      && this._renderCommands.isEmpty
      && 0 === this._batches.length
      && undefined === this._activeClipVolume
      && this._isDisposed;
  }

  public dispose() {
    this.reset();

    dispose(this._compositor);

    this._dcAssigned = false;   // necessary to reassign to OnScreenTarget fbo member when re-validating render plan
    this._isDisposed = true;
  }

  public pushBranch(exec: ShaderProgramExecutor, branch: Branch): void {
    this._stack.pushBranch(branch);
    const clip = this._stack.top.clipVolume;
    if (undefined !== clip)
      clip.pushToShaderExecutor(exec);
  }
  public pushState(state: BranchState) {
    assert(undefined === state.clipVolume);
    this._stack.pushState(state);

  }
  public popBranch(): void {
    const clip = this._stack.top.clipVolume;
    if (undefined !== clip)
      clip.pop(this);

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

  private _scratchRangeCorners: Point3d[] = [
    new Point3d(), new Point3d(), new Point3d(), new Point3d(),
    new Point3d(), new Point3d(), new Point3d(), new Point3d(),
  ];

  private _getRangeCorners(r: Range3d): Point3d[] {
    const p = this._scratchRangeCorners;
    p[0].setFromPoint3d(r.low);
    p[1].set(r.high.x, r.low.y, r.low.z),
      p[2].set(r.low.x, r.high.y, r.low.z),
      p[3].set(r.high.x, r.high.y, r.low.z),
      p[4].set(r.low.x, r.low.y, r.high.z),
      p[5].set(r.high.x, r.low.y, r.high.z),
      p[6].set(r.low.x, r.high.y, r.high.z),
      p[7].setFromPoint3d(r.high);
    return p;
  }

  /** @internal */
  public isRangeOutsideActiveVolume(range: Range3d): boolean {
    if (undefined === this._activeClipVolume || !this._stack.top.showClipVolume || !this.clips.isValid)
      return false;

    range = this.currentTransform.multiplyRange(range, range);

    const testIntersection = false;
    if (testIntersection) {
      // ###TODO: Avoid allocation of Range3d inside called function...
      // ###TODO: Use some not-yet-existent API which will return as soon as it determines ANY intersection (we don't care about the actual intersection range).
      const clippedRange = ClipUtilities.rangeOfClipperIntersectionWithRange(this._activeClipVolume.clipVector, range);
      return clippedRange.isNull;
    } else {
      // Do the cheap, imprecise check. The above is far too slow and allocates way too many objects, especially for clips produced from non-convex shapes.
      return ClipPlaneContainment.StronglyOutside === this._activeClipVolume.clipVector.classifyPointContainment(this._getRangeCorners(range));
    }
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

  public updateSolarShadows(context: SceneContext | undefined): void {
    this.compositor.updateSolarShadows(context);
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
  public changeOverlayGraphics(overlayGraphics: GraphicList) {
    this._overlayGraphics = overlayGraphics;
  }

  private changeDrapesOrClassifiers<T extends IDisposable>(oldMap: Map<Id64String, T> | undefined, newMap: Map<Id64String, T> | undefined): void {
    if (undefined === newMap) {
      if (undefined !== oldMap)
        for (const value of oldMap.values())
          value.dispose();

      return;
    }

    if (undefined !== oldMap) {
      for (const entry of oldMap)
        if (newMap.get(entry[0]) !== entry[1])
          entry[1].dispose();
    }
  }
  public changeTextureDrapes(textureDrapes: TextureDrapeMap | undefined) {
    this.changeDrapesOrClassifiers<RenderTextureDrape>(this._textureDrapes, textureDrapes);
    this._textureDrapes = textureDrapes;
  }
  public changePlanarClassifiers(planarClassifiers?: PlanarClassifierMap) {
    this.changeDrapesOrClassifiers<RenderPlanarClassifier>(this._planarClassifiers, planarClassifiers);
    this._planarClassifiers = planarClassifiers;

  }
  public changeActiveVolumeClassifierProps(props?: SpatialClassificationProps.Classifier, modelId?: Id64String): void {
    this.activeVolumeClassifierProps = props;
    this.activeVolumeClassifierModelId = modelId;
  }

  public changeDynamics(dynamics?: GraphicList) {
    // ###TODO: set feature IDs into each graphic so that edge display works correctly...
    // See IModelConnection.transientIds
    disposeArray(this._dynamics);
    this._dynamics = dynamics;
  }
  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this._stack.setSymbologyOverrides(ovr);
  }
  public setHiliteSet(hilite: HiliteSet): void {
    this._hilites = hilite;
    this._hiliteUpdateTime = BeTimePoint.now();
  }
  public setFlashed(id: Id64String, intensity: number) {
    if (id !== this._flashedId) {
      this._flashedId = id;
      this._flashed = Id64.getUint32Pair(id);
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
      this.frustumUniforms.setFrustum(0, depth, FrustumUniformType.TwoDee, false);
    } else if (newFraction > 0.999) { // ortho
      const halfWidth = Vector3d.createStartEnd(farLowerRight, farLowerLeft, scratch.vec3).magnitude() * 0.5;
      const halfHeight = Vector3d.createStartEnd(farLowerRight, farUpperRight).magnitude() * 0.5;
      const depth = Vector3d.createStartEnd(farLowerLeft, nearLowerLeft, scratch.vec3).magnitude();

      lookIn(nearCenter, viewX, viewY, viewZ, this.viewMatrix);
      ortho(-halfWidth, halfWidth, -halfHeight, halfHeight, 0, depth, this.projectionMatrix);

      this.nearPlaneCenter.setFrom(nearLowerLeft);
      this.nearPlaneCenter.interpolate(0.5, nearUpperRight, this.nearPlaneCenter);

      this.frustumUniforms.setPlanes(halfHeight, -halfHeight, -halfWidth, halfWidth);
      this.frustumUniforms.setFrustum(0, depth, FrustumUniformType.Orthographic, false);
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
      this.frustumUniforms.setFrustum(frustumFront, frustumBack, FrustumUniformType.Perspective, this.useLogZ);
    }

    this.viewMatrix.matrix.inverseState = InverseMatrixState.unknown;
  }

  public changeRenderPlan(plan: RenderPlan): void {
    this.plan = plan;

    if (this._dcAssigned && plan.is3d !== this.is3d) {
      // changed the dimensionality of the Target. World decorations no longer valid.
      // (lighting is enabled or disabled based on 2d vs 3d).
      this._worldDecorations = dispose(this._worldDecorations);

      // Turn off shadows if switching from 3d to 2d
      if (!plan.is3d)
        this.updateSolarShadows(undefined);
    }

    if (!this.assignDC()) {
      assert(false);
      return;
    }

    this.bgColor.setColorDef(plan.bgColor);
    this.monoColor.setColorDef(plan.monoColor);
    this.hiliteSettings = plan.hiliteSettings;
    this.hiliteColor.setColorDef(this.hiliteSettings.color);
    this.emphasisSettings = plan.emphasisSettings;
    this.emphasisColor.setColorDef(this.emphasisSettings.color);
    this.isFadeOutActive = plan.isFadeOutActive;
    this.analysisStyle = plan.analysisStyle === undefined ? undefined : plan.analysisStyle.clone();
    this.analysisTexture = plan.analysisTexture;

    // used by HiddenLine, SolidFill, and determining shadow casting
    this._transparencyThreshold = 0.0;
    if (undefined !== plan.hline) {
      // The threshold in HiddenLineParams ranges from 0.0 (hide anything that's not 100% opaque)
      // to 1.0 (don't hide anything regardless of transparency). Convert it to an alpha value.
      let threshold = plan.hline.transparencyThreshold;
      threshold = Math.min(1.0, Math.max(0.0, threshold));
      this._transparencyThreshold = 1.0 - threshold;
    }

    this.updateActiveVolume(plan.activeVolume);

    const scratch = Target._scratch;
    let visEdgeOvrs = undefined !== plan.hline ? plan.hline.visible : undefined;
    let hidEdgeOvrs = undefined !== plan.hline ? plan.hline.hidden : undefined;

    const vf = ViewFlags.createFrom(plan.viewFlags, scratch.viewFlags);
    if (!plan.is3d)
      vf.renderMode = RenderMode.Wireframe;

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
        vf.transparency = false;
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

    this.changePlanarClassifiers(undefined);
    this.changeTextureDrapes(undefined);

    // Clear render commands
    this._renderCommands.clear();

    // Clear FeatureOverrides for this Target.
    // This may not be strictly necessary as the Target may still be viewing some of these batches, but better to clean up and recreate
    // than to leave unused in memory.
    for (const batch of this._batches)
      batch.onTargetDisposed(this);

    this._batches = [];

    this._activeClipVolume = dispose(this._activeClipVolume);

    freeDrawParams();
    ShaderProgramExecutor.freeParams();
    Primitive.freeParams();
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

  public beginPerfMetricFrame(sceneMilSecElapsed?: number) {
    if (System.instance.isGLTimerSupported)
      System.instance.glTimer.beginFrame();
    if (this.performanceMetrics)
      this.performanceMetrics.beginFrame(sceneMilSecElapsed);
  }

  public endPerfMetricFrame(sceneMilSecElapsed?: number) {
    if (System.instance.isGLTimerSupported)
      System.instance.glTimer.endFrame();

    if (this.performanceMetrics) {
      this.performanceMetrics.endOperation(); // End the 'CPU Total Time' operation
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
      if (this.performanceMetrics.gatherGlFinish && !System.instance.isGLTimerSupported) {
        this.performanceMetrics.beginOperation("Finish GPU Queue");
        // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
        const bytes = new Uint8Array(4);
        const gl = System.instance.context;
        System.instance.frameBufferStack.execute(this._fbo!, true, () => {
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        });
        this.performanceMetrics.endOperation();
      }
      this.performanceMetrics.endFrame();
    }
  }

  public beginPerfMetricRecord(operation: string): void {
    if (System.instance.isGLTimerSupported)
      System.instance.glTimer.beginOperation(operation);
    if (this.performanceMetrics)
      this.performanceMetrics.beginOperation(operation);
  }

  public endPerfMetricRecord(): void {
    if (System.instance.isGLTimerSupported)
      System.instance.glTimer.endOperation();
    if (this.performanceMetrics)
      this.performanceMetrics.endOperation();
  }

  private paintScene(sceneMilSecElapsed?: number): void {
    if (!this._dcAssigned) {
      return;
    }

    this.beginPerfMetricFrame(sceneMilSecElapsed);
    this.beginPerfMetricRecord("Begin Paint");
    this._beginPaint();
    this.endPerfMetricRecord();

    const gl = System.instance.context;
    const rect = this.viewRect;
    gl.viewport(0, 0, rect.width, rect.height);

    // Set this to true to visualize the output of readPixels()...useful for debugging pick.
    if (this.drawForReadPixels) {
      this._isReadPixelsInProgress = true;
      this._readPixelsSelector = Pixel.Selector.Feature;

      const vf = this.getViewFlagsForReadPixels();
      const state = BranchState.create(this._stack.top.symbologyOverrides, vf);
      this.pushState(state);

      this.beginPerfMetricRecord("Init Commands");
      this._renderCommands.init(this._scene, this._backgroundMap, this._overlayGraphics, this._decorations, this._dynamics, true);
      this.endPerfMetricRecord();
      this.compositor.drawForReadPixels(this._renderCommands, undefined !== this._decorations ? this._decorations.worldOverlay : undefined);
      this._stack.pop();

      this._isReadPixelsInProgress = false;
    } else {
      // After the Target is first created or any time its dimensions change, SceneCompositor.preDraw() must update
      // the compositor's textures, framebuffers, etc. This *must* occur before any drawing occurs.
      // SceneCompositor.draw() checks this, but solar shadow maps, planar classifiers, and texture drapes try to draw
      // before then. So do it now.
      this.compositor.preDraw();
      this.beginPerfMetricRecord("Planar Classifiers");
      this.drawPlanarClassifiers();
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("Shadow Maps");
      this.drawSolarShadowMap();
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("Texture Drapes");
      this.drawTextureDrapes();
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("Init Commands");
      this._renderCommands.init(this._scene, this._backgroundMap, this._overlayGraphics, this._decorations, this._dynamics);
      this.endPerfMetricRecord();

      this.compositor.draw(this._renderCommands); // scene compositor gets disposed and then re-initialized... target remains undisposed

      this.beginPerfMetricRecord("Overlay Draws");
      this._stack.pushState(this.decorationState);

      this.beginPerfMetricRecord("World Overlays");
      this.drawPass(RenderPass.WorldOverlay);
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("View Overlays");
      this.drawPass(RenderPass.ViewOverlay);
      this.endPerfMetricRecord();
      this._stack.pop();

      this.endPerfMetricRecord(); // End "Overlay Draws"
    }

    // Reset the batch IDs in all batches drawn for this call.
    this._batchState.reset();

    this.beginPerfMetricRecord("End Paint");
    this._endPaint();
    this.endPerfMetricRecord();
    this.endPerfMetricFrame(sceneMilSecElapsed);
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
    this.beginPerfMetricFrame();

    rect.left = cssPixelsToDevicePixels(rect.left);
    rect.right = cssPixelsToDevicePixels(rect.right);
    rect.bottom = cssPixelsToDevicePixels(rect.bottom);
    rect.top = cssPixelsToDevicePixels(rect.top);

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

  private getViewFlagsForReadPixels(): ViewFlags {
    const vf = this.currentViewFlags.clone(this._scratchViewFlags);
    vf.transparency = false;
    vf.lighting = false;
    vf.shadows = false;
    vf.noGeometryMap = true;
    vf.acsTriad = false;
    vf.grid = false;
    vf.monochrome = false;
    vf.materials = false;
    vf.ambientOcclusion = false;
    return vf;
  }

  private readonly _scratchTmpFrustum = new Frustum();
  private readonly _scratchRectFrustum = new Frustum();
  private readonly _scratchViewFlags = new ViewFlags();
  private readPixelsFromFbo(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    this.beginPerfMetricRecord("Init Commands");
    this._isReadPixelsInProgress = true;
    this._readPixelsSelector = selector;

    // Temporarily turn off lighting to speed things up.
    // ###TODO: Disable textures *unless* they contain transparency. If we turn them off unconditionally then readPixels() will locate fully-transparent pixels, which we don't want.
    const vf = this.getViewFlagsForReadPixels();
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

    // If a clip has been applied to the view, trivially do nothing if aperture does not intersect
    if (undefined !== this._activeClipVolume && this._stack.top.showClipVolume && this.clips.isValid)
      if (ClipPlaneContainment.StronglyOutside === this._activeClipVolume.clipVector.classifyPointContainment(rectFrust.points))
        return undefined;

    // Repopulate the command list, omitting non-pickable decorations and putting transparent stuff into the opaque passes.
    this._renderCommands.clear();
    this._renderCommands.setCheckRange(rectFrust);
    this._renderCommands.init(this._scene, this._backgroundMap, this._overlayGraphics, this._decorations, this._dynamics, true);
    this._renderCommands.clearCheckRange();
    this.endPerfMetricRecord(); // End "Init Commands"

    // Draw the scene
    this.compositor.drawForReadPixels(this._renderCommands, undefined !== this._decorations ? this._decorations.worldOverlay : undefined);
    if (this.performanceMetrics) {
      this.performanceMetrics.endOperation(); // End the 'CPU Total Time' operation
      if (this.performanceMetrics.gatherGlFinish && !System.instance.isGLTimerSupported) {
        // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
        this.performanceMetrics.beginOperation("Finish GPU Queue");
        const gl = System.instance.context;
        const bytes = new Uint8Array(4);
        System.instance.frameBufferStack.execute(this._fbo!, true, () => {
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        });
        this.performanceMetrics.endOperation();
      }
    }

    // Restore the state
    this._stack.pop();

    this.beginPerfMetricRecord("Read Pixels");
    const result = this.compositor.readPixels(rect, selector);
    this.endPerfMetricRecord();
    if (System.instance.isGLTimerSupported)
      System.instance.glTimer.endFrame();
    if (this.performanceMetrics) this.performanceMetrics.endFrame();
    this._isReadPixelsInProgress = false;
    return result;
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

  /** Returns a new size scaled up to a maximum size while maintaining proper aspect ratio.  The new size will be
   * curSize adjusted so that it fits fully within maxSize in one dimension, maintaining its original aspect ratio.
   */
  private static _applyAspectRatioCorrection(curSize: Point2d, maxSize: Point2d): Point2d {
    const widthRatio = maxSize.x / curSize.x;
    const heightRatio = maxSize.y / curSize.y;
    const bestRatio = Math.min(widthRatio, heightRatio);
    return new Point2d(curSize.x * bestRatio, curSize.y * bestRatio);
  }

  public readImage(wantRectIn: ViewRect, targetSizeIn: Point2d, flipVertically: boolean): ImageBuffer | undefined {
    // Determine capture rect and validate
    const actualViewRect = this.renderRect;

    const wantRect = wantRectIn.clone();
    if (wantRect.right === -1 || wantRect.bottom === -1) {  // Indicates to get the entire view, no clipping
      wantRect.right = actualViewRect.right;
      wantRect.bottom = actualViewRect.bottom;
    }

    const lowerRight = Point2d.create(wantRect.right - 1, wantRect.bottom - 1); // in BSIRect, the right and bottom are actually *outside* of the rectangle
    if (!actualViewRect.containsPoint(Point2d.create(wantRect.left, wantRect.top)) || !actualViewRect.containsPoint(lowerRight))
      return undefined;

    this.assignDC();

    // Read pixels. Note ViewRect thinks (0,0) = top-left. gl.readPixels expects (0,0) = bottom-left.
    const bytesPerPixel = 4;
    const imageData = new Uint8Array(bytesPerPixel * wantRect.width * wantRect.height);
    const isValidImageData = this.readImagePixels(imageData, wantRect.left, wantRect.top, wantRect.width, wantRect.height);
    if (!isValidImageData)
      return undefined;
    let image = ImageBuffer.create(imageData, ImageBufferFormat.Rgba, wantRect.width);
    if (!image)
      return undefined;

    const targetSize = targetSizeIn.clone();
    if (targetSize.x === 0 || targetSize.y === 0) { // Indicates image should have same dimensions as rect (no scaling)
      targetSize.x = wantRect.width;
      targetSize.y = wantRect.height;
    }

    if (targetSize.x === wantRect.width && targetSize.y === wantRect.height) {
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
    } else {
      const canvas = imageBufferToCanvas(image, false); // retrieve a canvas of the image we read, throwing away alpha channel.
      if (undefined === canvas)
        return undefined;

      const adjustedTargetSize = Target._applyAspectRatioCorrection(new Point2d(wantRect.width, wantRect.height), targetSize);
      const resizedCanvas = canvasToResizedCanvasWithBars(canvas, adjustedTargetSize, new Point2d(targetSize.x - adjustedTargetSize.x, targetSize.y - adjustedTargetSize.y), this.bgColor.toColorDef().toHexString());

      const resizedImage = canvasToImageBuffer(resizedCanvas);
      if (undefined !== resizedImage)
        image = resizedImage;
    }

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

  public copyImageToCanvas(): HTMLCanvasElement {
    const image = this.readImage(new ViewRect(0, 0, -1, -1), Point2d.createZero(), true);
    const canvas = undefined !== image ? imageBufferToCanvas(image, false) : undefined;
    const retCanvas = undefined !== canvas ? canvas : document.createElement("canvas");
    const pixelRatio = queryDevicePixelRatio();
    retCanvas.getContext("2d")!.scale(pixelRatio, pixelRatio);
    return retCanvas;
  }

  public drawPlanarClassifiers() {
    if (this._planarClassifiers) {
      this._planarClassifiers.forEach((classifier) => {
        this._currentlyDrawingClassifier = classifier as PlanarClassifier;
        this._currentlyDrawingClassifier.draw(this);
        this._currentlyDrawingClassifier = undefined;
      });
    }
  }
  public drawSolarShadowMap() {
    if (this.solarShadowMap.isEnabled)
      this.solarShadowMap.draw(this);
  }
  public drawTextureDrapes() {
    if (this._textureDrapes)
      this._textureDrapes.forEach((drape) => (drape as TextureDrape).draw(this));
  }

  // ---- Methods expected to be overridden by subclasses ---- //

  protected abstract _assignDC(): boolean;
  protected abstract _beginPaint(): void;
  protected abstract _endPaint(): void;

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._compositor.collectStatistics(stats);
  }
}

class CanvasState {
  public readonly canvas: HTMLCanvasElement;
  private _width = 0;
  private _height = 0;
  public needsClear = false;
  private _isWebGLCanvas: boolean;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this._isWebGLCanvas = this.canvas === System.instance.canvas;
  }

  // Returns true if the rect actually changed.
  public updateDimensions(pixelRatio: number = 1): boolean {
    const w = cssPixelsToDevicePixels(this.canvas.clientWidth);
    const h = cssPixelsToDevicePixels(this.canvas.clientHeight);
    if (w === this._width && h === this._height)
      return false;

    // Must ensure internal bitmap grid dimensions of on-screen canvas match its own on-screen appearance.
    this.canvas.width = this._width = w;
    this.canvas.height = this._height = h;

    if (!this._isWebGLCanvas) {
      const ctx = this.canvas.getContext("2d")!;
      ctx.scale(pixelRatio, pixelRatio); // apply the pixelRatio as a scale on the 2d context for drawing of decorations, etc.
      ctx.save();
    }

    return true;
  }

  public get width() { return this._width; }
  public get height() { return this._height; }
}

/** A Target that renders to a canvas on the screen
 * @internal
 */
export class OnScreenTarget extends Target {
  private readonly _2dCanvas: CanvasState;
  private readonly _webglCanvas: CanvasState;
  private _usingWebGLCanvas = false;
  private _blitGeom?: SingleTexturedViewportQuadGeometry;
  private _scratchProgParams?: ShaderProgramParams;
  private _scratchDrawParams?: DrawParams;

  private get _curCanvas() { return this._usingWebGLCanvas ? this._webglCanvas : this._2dCanvas; }

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._2dCanvas = new CanvasState(canvas);
    this._webglCanvas = new CanvasState(System.instance.canvas);
  }

  public get isDisposed(): boolean {
    return undefined === this._fbo
      && undefined === this._blitGeom
      && undefined === this._scratchProgParams
      && undefined === this._scratchDrawParams
      && super.isDisposed;
  }

  public dispose() {
    this._fbo = dispose(this._fbo);
    this._blitGeom = dispose(this._blitGeom);
    this._scratchProgParams = undefined;
    this._scratchDrawParams = undefined;
    super.dispose();
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);
    if (undefined !== this._blitGeom)
      this._blitGeom.collectStatistics(stats);
  }

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

  public updateViewRect(): boolean {
    const pixelRatio = queryDevicePixelRatio();
    const changed2d = this._2dCanvas.updateDimensions(pixelRatio);
    const changedWebGL = this._webglCanvas.updateDimensions(pixelRatio);
    this.renderRect.init(0, 0, this._curCanvas.width, this._curCanvas.height);
    return this._usingWebGLCanvas ? changedWebGL : changed2d;
  }

  protected _beginPaint(): void {
    assert(undefined !== this._fbo);

    // Render to our framebuffer
    const system = System.instance;
    system.frameBufferStack.push(this._fbo!, true);

    const viewRect = this.viewRect;

    // Ensure off-screen canvas is sufficiently large for on-screen canvas.
    // Using a portion of a larger canvas lets us avoid thrashing canvas resizes with multiple viewports.
    if (system.canvas.width < viewRect.width)
      system.canvas.width = viewRect.width;
    if (system.canvas.height < viewRect.height)
      system.canvas.height = viewRect.height;
    assert(system.context.drawingBufferWidth >= viewRect.width, "offscreen context dimensions don't match onscreen");
    assert(system.context.drawingBufferHeight >= viewRect.height, "offscreen context dimensions don't match onscreen");
  }

  private getDrawParams(target: OnScreenTarget, geom: SingleTexturedViewportQuadGeometry) {
    if (undefined === this._scratchProgParams) {
      this._scratchProgParams = new ShaderProgramParams();
      this._scratchDrawParams = new DrawParams();
    }

    this._scratchProgParams.init(target);
    this._scratchDrawParams!.init(this._scratchProgParams, geom);
    return this._scratchDrawParams!;
  }

  protected _endPaint(): void {
    if (undefined === this._blitGeom)
      return;

    const system = System.instance;
    const drawParams = this.getDrawParams(this, this._blitGeom);

    system.frameBufferStack.pop();
    system.applyRenderState(RenderState.defaults);
    system.techniques.draw(drawParams);

    if (this._usingWebGLCanvas)
      return; // We already drew (using WebGL) the framebuffer contents directly to the on-screen WebGL canvas.

    // Copy off-screen canvas contents to on-screen canvas
    const onscreenContext = this._2dCanvas.canvas.getContext("2d", { alpha: true });
    assert(null !== onscreenContext);
    if (null !== onscreenContext) {
      const w = this.viewRect.width, h = this.viewRect.height;
      const yOffset = system.canvas.height - h; // drawImage has top as Y=0, GL has bottom as Y=0
      onscreenContext.save();
      onscreenContext.setTransform(1, 0, 0, 1, 0, 0); // revert any previous devicePixelRatio scale for drawImage() call below.
      onscreenContext.drawImage(system.canvas, 0, yOffset, w, h, 0, 0, w, h);
      onscreenContext.restore();
    }
  }

  protected drawOverlayDecorations(): void {
    const ctx = this._2dCanvas.canvas.getContext("2d", { alpha: true })!;
    if (this._usingWebGLCanvas && this._2dCanvas.needsClear) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // revert any previous devicePixelRatio scale for clearRect() call below.
      ctx.clearRect(0, 0, this._2dCanvas.width, this._2dCanvas.height);
      ctx.restore();
      this._2dCanvas.needsClear = false;
    }

    if (undefined !== this._decorations && undefined !== this._decorations.canvasDecorations) {
      for (const overlay of this._decorations.canvasDecorations) {
        ctx.save();
        if (overlay.position)
          ctx.translate(overlay.position.x, overlay.position.y);

        overlay.drawDecoration(ctx);
        this._2dCanvas.needsClear = true;
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

  public setRenderToScreen(toScreen: boolean): HTMLCanvasElement | undefined {
    if (toScreen === this._usingWebGLCanvas)
      return;

    this._usingWebGLCanvas = toScreen;
    return toScreen ? this._webglCanvas.canvas : undefined;
  }

  public readImageToCanvas(): HTMLCanvasElement {
    return this._usingWebGLCanvas ? this.copyImageToCanvas() : this._2dCanvas.canvas;
  }
}

/** @internal */
export class OffScreenTarget extends Target {
  public constructor(rect: ViewRect) {
    super(rect);
  }

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

  public readImageToCanvas(): HTMLCanvasElement {
    return this.copyImageToCanvas();
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
