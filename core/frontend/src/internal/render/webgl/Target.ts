/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64, Id64String } from "@itwin/core-bentley";
import { Point2d, Point3d, Range3d, Transform, XAndY, XYZ } from "@itwin/core-geometry";
import {
  AmbientOcclusion, AnalysisStyle, ContourDisplay, Frustum, ImageBuffer, ImageBufferFormat, Npc, RenderMode, RenderTexture, ThematicDisplayMode, ViewFlags,
} from "@itwin/core-common";
import { ViewRect } from "../../../common/ViewRect";
import { canvasToImageBuffer, canvasToResizedCanvasWithBars, imageBufferToCanvas } from "../../../common/ImageUtil";
import { HiliteSet, ModelSubCategoryHiliteMode } from "../../../SelectionSet";
import { SceneContext } from "../../../ViewContext";
import { ReadImageBufferArgs, Viewport } from "../../../Viewport";
import { IModelConnection } from "../../../IModelConnection";
import { CanvasDecoration } from "../../../render/CanvasDecoration";
import { Decorations } from "../../../render/Decorations";
import { FeatureSymbology } from "../../../render/FeatureSymbology";
import { AnimationBranchStates } from "../AnimationBranchState";
import { Pixel } from "../../../render/Pixel";
import { GraphicList } from "../../../render/RenderGraphic";
import { RenderMemory } from "../../../render/RenderMemory";
import { createEmptyRenderPlan, RenderPlan } from "../RenderPlan";
import { PlanarClassifierMap, RenderPlanarClassifier } from "../RenderPlanarClassifier";
import { RenderTextureDrape, TextureDrapeMap } from "../RenderTextureDrape";
import { RenderTarget } from "../../../render/RenderTarget";
import { PrimitiveVisibility, RenderTargetDebugControl } from "../RenderTargetDebugControl";
import { ScreenSpaceEffectContext } from "../../../render/ScreenSpaceEffectBuilder";
import { Scene } from "../../../render/Scene";
import { QueryTileFeaturesOptions, QueryVisibleFeaturesCallback } from "../../../render/VisibleFeature";
import { BranchState } from "./BranchState";
import { CachedGeometry, SingleTexturedViewportQuadGeometry } from "./CachedGeometry";
import { ColorInfo } from "./ColorInfo";
import { WebGLDisposable } from "./Disposable";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { FrameBuffer } from "./FrameBuffer";
import { GL } from "./GL";
import { Batch, Branch, WorldDecorations } from "./Graphic";
import { IModelFrameLifecycle } from "./IModelFrameLifecycle";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { PlanarClassifier } from "./PlanarClassifier";
import { Primitive } from "./Primitive";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { RenderState } from "./RenderState";
import { SceneCompositor } from "./SceneCompositor";
import { freeDrawParams } from "./ScratchDrawParams";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { SolarShadowMap } from "./SolarShadowMap";
import { desync, SyncTarget } from "./Sync";
import { System } from "./System";
import { TargetUniforms } from "./TargetUniforms";
import { Techniques } from "./Technique";
import { TechniqueId } from "./TechniqueId";
import { Texture2DHandle, TextureHandle } from "./Texture";
import { TextureDrape } from "./TextureDrape";
import { EdgeSettings } from "./EdgeSettings";
import { TargetGraphics } from "./TargetGraphics";
import { VisibleTileFeatures } from "./VisibleTileFeatures";
import { FrameStatsCollector } from "../FrameStatsCollector";
import { ActiveSpatialClassifier } from "../../../SpatialClassifiersState";
import { AnimationNodeId } from "../../../common/internal/render/AnimationNodeId";
import { _implementationProhibited } from "../../../common/internal/Symbols";

function swapImageByte(image: ImageBuffer, i0: number, i1: number) {
  const tmp = image.data[i0];
  image.data[i0] = image.data[i1];
  image.data[i1] = tmp;
}

/** @internal */
export interface Hilites {
  readonly elements: Id64.Uint32Set;
  readonly subcategories: Id64.Uint32Set;
  readonly models: Id64.Uint32Set;
  readonly isEmpty: boolean;
  readonly modelSubCategoryMode: ModelSubCategoryHiliteMode;
}

class EmptyHiliteSet {
  public readonly elements: Id64.Uint32Set;
  public readonly subcategories: Id64.Uint32Set;
  public readonly models: Id64.Uint32Set;
  public readonly isEmpty = true;
  public readonly modelSubCategoryMode = "union";

  public constructor() {
    this.elements = this.subcategories = this.models = new Id64.Uint32Set();
  }
}

interface ReadPixelResources {
  readonly texture: Texture2DHandle;
  readonly fbo: FrameBuffer;
}

/** @internal */
export abstract class Target extends RenderTarget implements RenderTargetDebugControl, WebGLDisposable {
  protected override readonly [_implementationProhibited] = undefined;
  public readonly graphics = new TargetGraphics();
  private _planarClassifiers?: PlanarClassifierMap;
  private _textureDrapes?: TextureDrapeMap;
  private _worldDecorations?: WorldDecorations;
  private _currPickExclusions = new Id64.Uint32Set();
  private _swapPickExclusions = new Id64.Uint32Set();
  public readonly pickExclusionsSyncTarget: SyncTarget = { syncKey: Number.MIN_SAFE_INTEGER };
  private _hilites: Hilites = new EmptyHiliteSet();
  private readonly _hiliteSyncTarget: SyncTarget = { syncKey: Number.MIN_SAFE_INTEGER };
  private _flashed: Id64.Uint32Pair = { lower: 0, upper: 0 };
  private _flashedId = Id64.invalid;
  private _flashIntensity: number = 0;
  private _renderCommands: RenderCommands;
  private _overlayRenderState: RenderState;
  protected _compositor: SceneCompositor;
  protected _fbo?: FrameBuffer;
  private _dcAssigned = false;
  public performanceMetrics?: PerformanceMetrics;
  public readonly decorationsState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly uniforms = new TargetUniforms(this);
  public readonly renderRect = new ViewRect();
  public analysisStyle?: AnalysisStyle;
  public analysisTexture?: RenderTexture;
  public ambientOcclusionSettings = AmbientOcclusion.Settings.defaults;
  private _wantAmbientOcclusion = false;
  private _batches: Batch[] = [];
  public plan = createEmptyRenderPlan();
  private _animationBranches?: AnimationBranchStates;
  private _isReadPixelsInProgress = false;
  private _readPixelsSelector = Pixel.Selector.None;
  private _readPixelReusableResources?: ReadPixelResources;
  private _drawNonLocatable = true;
  private _currentlyDrawingClassifier?: PlanarClassifier;
  private _analysisFraction: number = 0;
  private _antialiasSamples = 1;
  // This exists strictly to be forwarded to ScreenSpaceEffects. Do not use it for anything else.
  private _viewport?: Viewport;
  private _screenSpaceEffects: string[] = [];
  public isFadeOutActive = false;
  public activeVolumeClassifierTexture?: WebGLTexture;
  public activeVolumeClassifierProps?: ActiveSpatialClassifier;
  public activeVolumeClassifierModelId?: Id64String;
  private _currentAnimationTransformNodeId?: number;

  // RenderTargetDebugControl
  public vcSupportIntersectingVolumes: boolean = false;
  public drawForReadPixels = false;
  public drawingBackgroundForReadPixels = false;
  public primitiveVisibility = PrimitiveVisibility.All;
  public displayDrapeFrustum = false;
  public displayMaskFrustum = false;
  public displayRealityTilePreload = false;
  public displayRealityTileRanges = false;
  public logRealityTiles = false;
  public displayNormalMaps = true;

  public freezeRealityTiles = false;

  public get shadowFrustum(): Frustum | undefined {
    const map = this.solarShadowMap;
    return map.isEnabled && map.isReady ? map.frustum : undefined;
  }

  public override get debugControl(): RenderTargetDebugControl { return this; }

  public get viewRect(): ViewRect {
    return this.renderRect;
  }

  protected constructor(rect?: ViewRect) {
    super();
    this._renderCommands = this.uniforms.branch.createRenderCommands(this.uniforms.batch.state);
    this._overlayRenderState = new RenderState();
    this._overlayRenderState.flags.depthMask = false;
    this._overlayRenderState.flags.blend = true;
    this._overlayRenderState.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);
    this._compositor = SceneCompositor.create(this);  // compositor is created but not yet initialized... we are still undisposed
    this.renderRect = rect ? rect : new ViewRect();  // if the rect is undefined, expect that it will be updated dynamically in an OnScreenTarget
    if (undefined !== System.instance.antialiasSamples)
      this._antialiasSamples = System.instance.antialiasSamples;
    else
      this._antialiasSamples = (undefined !== System.instance.options.antialiasSamples ? System.instance.options.antialiasSamples : 1);
  }

  public get compositor() { return this._compositor; }
  public get isReadPixelsInProgress(): boolean { return this._isReadPixelsInProgress; }
  public get readPixelsSelector(): Pixel.Selector { return this._readPixelsSelector; }
  public get drawNonLocatable(): boolean { return this._drawNonLocatable; }

  public get techniques(): Techniques { return this.renderSystem.techniques; }

  public get hilites(): Hilites { return this._hilites; }
  public get hiliteSyncTarget(): SyncTarget { return this._hiliteSyncTarget; }

  public get pickExclusions(): Id64.Uint32Set { return this._currPickExclusions; }

  public get flashed(): Id64.Uint32Pair | undefined { return Id64.isValid(this._flashedId) ? this._flashed : undefined; }
  public get flashedId(): Id64String { return this._flashedId; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get analysisFraction(): number { return this._analysisFraction; }
  public set analysisFraction(fraction: number) { this._analysisFraction = fraction; }

  public override get animationBranches(): AnimationBranchStates | undefined {
    return this._animationBranches;
  }
  public override set animationBranches(branches: AnimationBranchStates | undefined) {
    this.disposeAnimationBranches();
    this._animationBranches = branches;
  }

  private disposeAnimationBranches(): void {
    this._animationBranches = undefined;
  }

  public override get antialiasSamples(): number { return this._antialiasSamples; }
  public override set antialiasSamples(numSamples: number) { this._antialiasSamples = numSamples; }

  public get solarShadowMap(): SolarShadowMap { return this.compositor.solarShadowMap; }
  public get isDrawingShadowMap(): boolean { return this.solarShadowMap.isEnabled && this.solarShadowMap.isDrawing; }
  public override getPlanarClassifier(id: Id64String): RenderPlanarClassifier | undefined {
    return undefined !== this._planarClassifiers ? this._planarClassifiers.get(id) : undefined;
  }
  public override createPlanarClassifier(properties?: ActiveSpatialClassifier): PlanarClassifier {
    return PlanarClassifier.create(properties, this);
  }
  public override getTextureDrape(id: Id64String): RenderTextureDrape | undefined {
    return undefined !== this._textureDrapes ? this._textureDrapes.get(id) : undefined;
  }

  public getWorldDecorations(decs: GraphicList): Branch {
    if (undefined === this._worldDecorations) {
      // Don't allow flags like monochrome etc to affect world decorations. Allow lighting in 3d only.
      const vf = new ViewFlags({
        renderMode: RenderMode.SmoothShade,
        clipVolume: false,
        whiteOnWhiteReversal: false,
        lighting: !this.is2d,
        shadows: false,
      });

      this._worldDecorations = new WorldDecorations(vf);
    }

    this._worldDecorations.init(decs);
    return this._worldDecorations;
  }

  public get currentBranch(): BranchState { return this.uniforms.branch.top; }
  public get currentViewFlags(): ViewFlags { return this.currentBranch.viewFlags; }
  public get currentTransform(): Transform { return this.currentBranch.transform; }
  public get currentTransparencyThreshold(): number { return this.currentEdgeSettings.transparencyThreshold; }
  public get currentEdgeSettings(): EdgeSettings { return this.currentBranch.edgeSettings; }
  public get currentFeatureSymbologyOverrides(): FeatureSymbology.Overrides { return this.currentBranch.symbologyOverrides; }
  public get currentPlanarClassifier(): PlanarClassifier | undefined { return this.currentBranch.planarClassifier; }
  public get currentlyDrawingClassifier(): PlanarClassifier | undefined { return this._currentlyDrawingClassifier; }
  public get currentTextureDrape(): TextureDrape | undefined {
    const drape = this.currentBranch.textureDrape;
    return undefined !== drape && drape.isReady ? drape : undefined;
  }
  public get currentPlanarClassifierOrDrape(): PlanarClassifier | TextureDrape | undefined {
    const drape = this.currentTextureDrape;
    return undefined === drape ? this.currentPlanarClassifier : drape;
  }
  public get currentContours(): ContourDisplay | undefined { return this.currentBranch.contourLine; }

  public modelToView(modelPt: XYZ, result?: Point3d): Point3d {
    return this.uniforms.branch.modelViewMatrix.multiplyPoint3dQuietNormalize(modelPt, result);
  }

  public get is2d(): boolean { return this.uniforms.frustum.is2d; }
  public get is3d(): boolean { return !this.is2d; }

  private _isDisposed = false;
  public get isDisposed(): boolean {
    return this.graphics.isDisposed
      && undefined === this._fbo
      && undefined === this._worldDecorations
      && undefined === this._planarClassifiers
      && undefined === this._textureDrapes
      && this._renderCommands.isEmpty
      && 0 === this._batches.length
      && this.uniforms.thematic.isDisposed
      && this._isDisposed;
  }

  protected allocateFbo(): FrameBuffer | undefined {
    if (this._fbo)
      return this._fbo;

    const rect = this.viewRect;
    const color = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === color)
      return undefined;

    const depth = System.instance.createDepthBuffer(rect.width, rect.height, 1);
    if (undefined === depth) {
      color[Symbol.dispose]();
      return undefined;
    }

    this._fbo = FrameBuffer.create([color], depth);
    if (undefined === this._fbo) {
      color[Symbol.dispose]();
      depth[Symbol.dispose]();
      return undefined;
    }

    return this._fbo;
  }

  protected disposeFbo(): void {
    if (!this._fbo)
      return;

    const tx = this._fbo.getColor(0);
    const db = this._fbo.depthBuffer;
    this._fbo = dispose(this._fbo);
    this._dcAssigned = false;

    // We allocated our framebuffer's color attachment, so must dispose of it too.
    assert(undefined !== tx);
    dispose(tx);
    // We allocated our framebuffer's depth attachment, so must dispose of it too.
    assert(undefined !== db);
    dispose(db);
  }

  public override[Symbol.dispose]() {
    this.reset();
    this.disposeFbo();
    dispose(this._compositor);
    this._viewport = undefined;

    this._isDisposed = true;
  }

  public pushBranch(branch: Branch): void {
    this.uniforms.branch.pushBranch(branch);
  }
  public pushState(state: BranchState) {
    this.uniforms.branch.pushState(state);
  }
  public popBranch(): void {
    this.uniforms.branch.pop();
  }

  public pushViewClip(): void {
    this.uniforms.branch.pushViewClip();
  }

  public popViewClip(): void {
    this.uniforms.branch.popViewClip();
  }

  /** @internal */
  public isRangeOutsideActiveVolume(range: Range3d): boolean {
    return this.uniforms.branch.clipStack.isRangeClipped(range, this.currentTransform);
  }

  private readonly _scratchRange = new Range3d();

  /** @internal */
  public isGeometryOutsideActiveVolume(geom: CachedGeometry): boolean {
    if (!this.uniforms.branch.clipStack.hasClip || this.uniforms.branch.clipStack.hasOutsideColor)
      return false;

    const range = geom.computeRange(this._scratchRange);
    return this.isRangeOutsideActiveVolume(range);
  }

  public pushBatch(batch: Batch) {
    this.uniforms.batch.setCurrentBatch(batch);
  }
  public popBatch() {
    this.uniforms.batch.setCurrentBatch(undefined);
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

  public get wantThematicDisplay(): boolean {
    return this.currentViewFlags.thematicDisplay && this.is3d && undefined !== this.uniforms.thematic.thematicDisplay;
  }

  public get wantAtmosphere(): boolean {
    return undefined !== this.plan.atmosphere;
  }

  public get wantThematicSensors(): boolean {
    const thematic = this.plan.thematic;
    return this.wantThematicDisplay && undefined !== thematic && ThematicDisplayMode.InverseDistanceWeightedSensors === thematic.displayMode && thematic.sensorSettings.sensors.length > 0;
  }

  public override updateSolarShadows(context: SceneContext | undefined): void {
    this.compositor.updateSolarShadows(context);
  }

  // ---- Implementation of RenderTarget interface ---- //

  public get renderSystem(): System { return System.instance; }

  public get planFraction() { return this.uniforms.frustum.planFraction; }
  public get planFrustum() { return this.uniforms.frustum.planFrustum; }

  public changeDecorations(decs: Decorations): void {
    this.graphics.decorations = decs;
  }

  public changeScene(scene: Scene) {
    this.graphics.changeScene(scene);

    this.changeTextureDrapes(scene.textureDrapes);
    this.changePlanarClassifiers(scene.planarClassifiers);

    this.changeDrapesOrClassifiers<RenderPlanarClassifier>(this._planarClassifiers, scene.planarClassifiers);
    this._planarClassifiers = scene.planarClassifiers;

    this.activeVolumeClassifierProps = scene.volumeClassifier?.classifier;
    this.activeVolumeClassifierModelId = scene.volumeClassifier?.modelId;
  }

  public override onBeforeRender(viewport: Viewport, setSceneNeedRedraw: (redraw: boolean) => void) {
    this._viewport = viewport;
    IModelFrameLifecycle.onBeforeRender.raiseEvent({
      renderSystem: this.renderSystem,
      viewport,
      setSceneNeedRedraw,
    });
  }

  private changeDrapesOrClassifiers<T extends Disposable>(oldMap: Map<string, T> | undefined, newMap: Map<string, T> | undefined): void {
    if (undefined === newMap) {
      if (undefined !== oldMap)
        for (const value of oldMap.values())
          value[Symbol.dispose]();

      return;
    }

    if (undefined !== oldMap) {
      for (const entry of oldMap)
        if (newMap.get(entry[0]) !== entry[1])
          entry[1][Symbol.dispose]();
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

  public changeDynamics(foreground: GraphicList | undefined, overlay: GraphicList | undefined) {
    this.graphics.changeDynamics(foreground, overlay);
  }

  public override overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this.uniforms.branch.overrideFeatureSymbology(ovr);
  }
  public override setHiliteSet(hilite: HiliteSet): void {
    this._hilites = hilite;
    desync(this._hiliteSyncTarget);
  }
  public override setFlashed(id: Id64String, intensity: number) {
    if (id !== this._flashedId) {
      this._flashedId = id;
      this._flashed = Id64.getUint32Pair(id);
    }

    this._flashIntensity = intensity;
  }

  public changeFrustum(newFrustum: Frustum, newFraction: number, is3d: boolean): void {
    this.uniforms.frustum.changeFrustum(newFrustum, newFraction, is3d);
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

    if (plan.is3d !== this.decorationsState.is3d)
      this.decorationsState.changeRenderPlan(this.decorationsState.viewFlags, plan.is3d, undefined);

    if (!this.assignDC())
      return;

    this.isFadeOutActive = plan.isFadeOutActive;
    this.analysisStyle = plan.analysisStyle;
    this.analysisTexture = plan.analysisTexture;

    this.uniforms.branch.updateViewClip(plan.clip, plan.clipStyle);

    let vf = plan.viewFlags;
    if (!plan.is3d)
      vf = vf.withRenderMode(RenderMode.Wireframe);

    if (RenderMode.SmoothShade === vf.renderMode && plan.is3d && undefined !== plan.ao && vf.ambientOcclusion) {
      this._wantAmbientOcclusion = true;
      this.ambientOcclusionSettings = plan.ao;
    } else {
      this._wantAmbientOcclusion = false;
      vf = vf.with("ambientOcclusion", false);
    }

    this.uniforms.branch.changeRenderPlan(vf, plan.is3d, plan.hline, plan.contours);

    this.changeFrustum(plan.frustum, plan.fraction, plan.is3d);

    this.uniforms.thematic.update(this);

    this.uniforms.contours.update(this);

    this.uniforms.atmosphere.update(this);

    // NB: This must be done after changeFrustum() as some of the uniforms depend on the frustum.
    this.uniforms.updateRenderPlan(plan);
  }

  public drawFrame(sceneMilSecElapsed?: number): void {
    assert(this.renderSystem.frameBufferStack.isEmpty);
    if (!this.assignDC())
      return;

    this.paintScene(sceneMilSecElapsed);
    this.drawOverlayDecorations();
    assert(this.renderSystem.frameBufferStack.isEmpty);
  }

  protected drawOverlayDecorations(): void { }

  /**
   * Invoked via Viewport.changeView() when the owning Viewport is changed to look at a different view.
   * Invoked via dispose() when the target is being destroyed.
   * The primary difference is that in the former case we retain the SceneCompositor.
   */
  public override reset(_realityMapLayerChanged?: boolean): void {
    this.graphics[Symbol.dispose]();
    this._worldDecorations = dispose(this._worldDecorations);
    dispose(this.uniforms.thematic);

    // Ensure that only necessary classifiers are removed. If the reality map layer has not changed,
    // removing all classifiers would result in the loss of draping effects without triggering a refresh.
    if (_realityMapLayerChanged) {
      this.changePlanarClassifiers(undefined);
    } else if (this._planarClassifiers) {
        const filteredClassifiers = new Map(
            [...this._planarClassifiers.entries()]
                .filter(([key]) => key.toLowerCase().includes("maplayer"))
        );
        this.changePlanarClassifiers(filteredClassifiers.size > 0 ? filteredClassifiers : undefined);
    }

    this.changeTextureDrapes(undefined);

    this._renderCommands.clear();

    // Clear FeatureOverrides for this Target.
    // This may not be strictly necessary as the Target may still be viewing some of these batches, but better to clean up and recreate
    // than to leave unused in memory.
    for (const batch of this._batches)
      batch.onTargetDisposed(this);

    this._batches = [];
    this.disposeAnimationBranches();

    freeDrawParams();
    ShaderProgramExecutor.freeParams();
    Primitive.freeParams();
  }

  public get wantInvertBlackBackground(): boolean { return false; }

  public computeEdgeWeight(pass: RenderPass, baseWeight: number): number {
    return this.currentEdgeSettings.getWeight(pass, this.currentViewFlags) ?? baseWeight;
  }
  public computeEdgeLineCode(pass: RenderPass, baseCode: number): number {
    return this.currentEdgeSettings.getLineCode(pass, this.currentViewFlags) ?? baseCode;
  }
  public computeEdgeColor(baseColor: ColorInfo): ColorInfo {
    const color = this.currentEdgeSettings.getColor(this.currentViewFlags);
    return undefined !== color ? ColorInfo.createUniform(color) : baseColor;
  }

  public beginPerfMetricFrame(sceneMilSecElapsed?: number, readPixels = false) {
    if (!readPixels || (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics)) { // only capture readPixel data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.beginFrame();
      if (this.performanceMetrics)
        this.performanceMetrics.beginFrame(sceneMilSecElapsed);
    }
  }

  public endPerfMetricFrame(readPixels = false) {
    if (!readPixels || (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics)) { // only capture readPixel data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.endFrame();

      if (undefined === this.performanceMetrics)
        return;

      this.performanceMetrics.endOperation(); // End the 'CPU Total Time' operation
      this.performanceMetrics.completeFrameTimings(this._fbo!);
    }
  }

  public beginPerfMetricRecord(operation: string, readPixels = false): void {
    if (!readPixels || (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics)) { // only capture readPixel data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.beginOperation(operation);
      if (this.performanceMetrics)
        this.performanceMetrics.beginOperation(operation);
    }
  }

  public endPerfMetricRecord(readPixels = false): void {
    if (!readPixels || (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics)) { // only capture readPixel data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.endOperation();
      if (this.performanceMetrics)
        this.performanceMetrics.endOperation();
    }
  }

  private _frameStatsCollector = new FrameStatsCollector();

  public get frameStatsCollector(): FrameStatsCollector { return this._frameStatsCollector; }

  public override assignFrameStatsCollector(collector: FrameStatsCollector) { this._frameStatsCollector = collector; }

  private paintScene(sceneMilSecElapsed?: number): void {
    if (!this._dcAssigned)
      return;

    this._frameStatsCollector.beginTime("totalFrameTime");
    this.beginPerfMetricFrame(sceneMilSecElapsed, this.drawForReadPixels);
    this.beginPerfMetricRecord("Begin Paint", this.drawForReadPixels);
    assert(undefined !== this._fbo);
    this._beginPaint(this._fbo);
    this.endPerfMetricRecord(this.drawForReadPixels);

    const gl = this.renderSystem.context;
    const rect = this.viewRect;
    gl.viewport(0, 0, rect.width, rect.height);

    // Set this to true to visualize the output of readPixels()...useful for debugging pick.
    if (this.drawForReadPixels) {
      this.beginReadPixels(Pixel.Selector.Feature);
      this.compositor.drawForReadPixels(this._renderCommands, this.graphics.overlays, this.graphics.decorations?.worldOverlay, this.graphics.decorations?.viewOverlay);
      this.endReadPixels();
    } else {
      // After the Target is first created or any time its dimensions change, SceneCompositor.preDraw() must update
      // the compositor's textures, framebuffers, etc. This *must* occur before any drawing occurs.
      // SceneCompositor.draw() checks this, but solar shadow maps, planar classifiers, and texture drapes try to draw
      // before then. So do it now.
      this.compositor.preDraw();

      this._frameStatsCollector.beginTime("classifiersTime");
      this.beginPerfMetricRecord("Planar Classifiers");
      this.drawPlanarClassifiers();
      this.endPerfMetricRecord();
      this._frameStatsCollector.endTime("classifiersTime");

      this._frameStatsCollector.beginTime("shadowsTime");
      this.beginPerfMetricRecord("Shadow Maps");
      this.drawSolarShadowMap();
      this.endPerfMetricRecord();
      this._frameStatsCollector.endTime("shadowsTime");

      this.beginPerfMetricRecord("Texture Drapes");
      this.drawTextureDrapes();
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("Init Commands");
      this._renderCommands.initForRender(this.graphics);
      this.endPerfMetricRecord();

      this.compositor.draw(this._renderCommands); // scene compositor gets disposed and then re-initialized... target remains undisposed

      this._frameStatsCollector.beginTime("overlaysTime");
      this.beginPerfMetricRecord("Overlay Draws");

      this.beginPerfMetricRecord("World Overlays");
      this.drawPass(RenderPass.WorldOverlay);
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("View Overlays");
      this.drawPass(RenderPass.ViewOverlay);
      this.endPerfMetricRecord();

      this.endPerfMetricRecord(); // End "Overlay Draws"
      this._frameStatsCollector.endTime("overlaysTime");
    }

    // Apply screen-space effects. Note we do not reset this._isReadPixelsInProgress until *after* doing so, as screen-space effects only apply
    // during readPixels() if the effect shifts pixels from their original locations.
    this._frameStatsCollector.beginTime("screenspaceEffectsTime");
    this.beginPerfMetricRecord("Screenspace Effects", this.drawForReadPixels);
    this.renderSystem.screenSpaceEffects.apply(this);
    this.endPerfMetricRecord(this.drawForReadPixels);
    this._frameStatsCollector.endTime("screenspaceEffectsTime");

    // Reset the batch IDs in all batches drawn for this call.
    this.uniforms.batch.resetBatchState();

    this.beginPerfMetricRecord("End Paint", this.drawForReadPixels);
    this._endPaint();
    this.endPerfMetricRecord(this.drawForReadPixels);

    this.endPerfMetricFrame(this.drawForReadPixels);
    this._frameStatsCollector.endTime("totalFrameTime");
  }

  private drawPass(pass: RenderPass): void {
    this.renderSystem.applyRenderState(this.getRenderState(pass));
    this.techniques.execute(this, this._renderCommands.getCommands(pass), pass);
  }

  private getRenderState(pass: RenderPass): RenderState {
    // the other passes are handled by SceneCompositor
    assert(RenderPass.ViewOverlay === pass || RenderPass.WorldOverlay === pass);
    return this._overlayRenderState;
  }

  private assignDC(): boolean {
    if (this._dcAssigned)
      return true;

    if (!this._assignDC())
      return false;

    const rect = this.viewRect;
    if (rect.width < 1 || rect.height < 1)
      return false;

    this.uniforms.viewRect.update(rect.width, rect.height);
    this._dcAssigned = true;

    return true;
  }

  public readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean, excludedElements?: Iterable<Id64String>): void {
    if (!this.assignDC())
      return;

    // if (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics)
    this.beginPerfMetricFrame(undefined, true);

    rect = this.cssViewRectToDeviceViewRect(rect);

    const gl = this.renderSystem.context;
    const viewRect = this.viewRect;
    gl.viewport(0, 0, viewRect.width, viewRect.height);

    // We can't reuse the previous frame's data for a variety of reasons, chief among them that some types of geometry (surfaces, translucent stuff) don't write
    // to the pick buffers and others we don't want - such as non-pickable decorations - do.
    // Render to an offscreen buffer so that we don't destroy the current color buffer.
    const resources = this.createOrReuseReadPixelResources(rect);
    if (resources === undefined) {
      receiver(undefined);
      return;
    }

    let result: Pixel.Buffer | undefined;

    this.renderSystem.frameBufferStack.execute(resources.fbo, true, false, () => {
      let updatedExclusions = false;
      if (excludedElements) {
        const swap = this._swapPickExclusions;
        swap.clear();
        for (const exclusion of excludedElements) {
          swap.addId(exclusion);
        }

        if (!this._currPickExclusions.equals(swap)) {
          this._swapPickExclusions = this._currPickExclusions;
          this._currPickExclusions = swap;
          updatedExclusions = true;
          desync(this.pickExclusionsSyncTarget);
        }
      }

      this._drawNonLocatable = !excludeNonLocatable;
      result = this.readPixelsFromFbo(rect, selector);
      this._drawNonLocatable = true;

      if (updatedExclusions) {
        this._currPickExclusions.clear();
        desync(this.pickExclusionsSyncTarget);
      }
    });

    this.disposeOrReuseReadPixelResources(resources);

    receiver(result);

    // Reset the batch IDs in all batches drawn for this call.
    this.uniforms.batch.resetBatchState();
  }

  private createOrReuseReadPixelResources(rect: ViewRect): ReadPixelResources | undefined {
    if (this._readPixelReusableResources !== undefined) {

      // To reuse a texture, we need it to be the same size or bigger than what we need
      if (this._readPixelReusableResources.texture.width >= rect.width && this._readPixelReusableResources.texture.height >= rect.height) {
        const resources = this._readPixelReusableResources;
        this._readPixelReusableResources = undefined;

        return resources;
      }
    }

    // Create a new texture/fbo
    const texture = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (texture === undefined)
      return undefined;

    const fbo = FrameBuffer.create([texture]);
    if (fbo === undefined) {
      dispose(texture);
      return undefined;
    }

    return { texture, fbo };
  }

  private disposeOrReuseReadPixelResources({ texture, fbo }: ReadPixelResources) {
    const maxReusableTextureSize = 256;
    const isTooBigToReuse = texture.width > maxReusableTextureSize || texture.height > maxReusableTextureSize;

    let reuseResources = !isTooBigToReuse;

    if (reuseResources && this._readPixelReusableResources !== undefined) {

      // Keep the biggest texture
      if (this._readPixelReusableResources.texture.width > texture.width && this._readPixelReusableResources.texture.height > texture.height) {
        reuseResources = false; // The current resources being reused are better
      } else {
        // Free memory of the current reusable resources before replacing them
        dispose(this._readPixelReusableResources.fbo);
        dispose(this._readPixelReusableResources.texture);
      }
    }

    if (reuseResources) {
      this._readPixelReusableResources = { texture, fbo };
    } else {
      dispose(fbo);
      dispose(texture);
    }
  }

  private beginReadPixels(selector: Pixel.Selector, cullingFrustum?: Frustum): void {
    this.beginPerfMetricRecord("Init Commands", true);

    this._isReadPixelsInProgress = true;
    this._readPixelsSelector = selector;

    // Temporarily turn off lighting to speed things up.
    // ###TODO: Disable textures *unless* they contain transparency. If we turn them off unconditionally then readPixels() will locate fully-transparent pixels, which we don't want.
    const vf = this.currentViewFlags.copy({
      transparency: false,
      lighting: false,
      shadows: false,
      acsTriad: false,
      grid: false,
      monochrome: false,
      materials: false,
      ambientOcclusion: false,
      thematicDisplay: this.currentViewFlags.thematicDisplay && this.uniforms.thematic.wantIsoLines,
    });

    const top = this.currentBranch;
    const state = new BranchState({
      viewFlags: vf,
      symbologyOverrides: top.symbologyOverrides,
      is3d: top.is3d,
      edgeSettings: top.edgeSettings,
      transform: Transform.createIdentity(),
      clipVolume: top.clipVolume,
      contourLine: top.contourLine,
    });

    this.pushState(state);

    // Repopulate the command list, omitting non-pickable decorations and putting transparent stuff into the opaque passes.
    if (cullingFrustum)
      this._renderCommands.setCheckRange(cullingFrustum);

    this._renderCommands.initForReadPixels(this.graphics);
    this._renderCommands.clearCheckRange();
    this.endPerfMetricRecord(true);
  }

  private endReadPixels(preserveBatchState = false): void {
    // Pop the BranchState pushed by beginReadPixels.
    this.uniforms.branch.pop();
    if (!preserveBatchState)
      this.uniforms.batch.resetBatchState();

    this._isReadPixelsInProgress = false;
  }

  private readonly _scratchTmpFrustum = new Frustum();
  private readonly _scratchRectFrustum = new Frustum();
  private readPixelsFromFbo(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    // Create a culling frustum based on the input rect. We can't do this if a screen-space effect is going to move pixels around.
    let rectFrust;
    if (!this.renderSystem.screenSpaceEffects.shouldApply(this)) {
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

      rectFrust = this._scratchRectFrustum;
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._000, bottomScale, Npc._010);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._100, bottomScale, Npc._110);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._010, topScale, Npc._000);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._110, topScale, Npc._100);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._001, bottomScale, Npc._011);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._101, bottomScale, Npc._111);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._011, topScale, Npc._001);
      interpolateFrustumPoint(rectFrust, tmpFrust, Npc._111, topScale, Npc._101);
    }

    this.beginReadPixels(selector, rectFrust);

    // Draw the scene
    this.compositor.drawForReadPixels(this._renderCommands, this.graphics.overlays, this.graphics.decorations?.worldOverlay, this.graphics.decorations?.viewOverlay);

    if (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics) { // Only collect readPixels data if in disp-perf-test-app
      this.performanceMetrics.endOperation(); // End the 'CPU Total Time' operation
      if (this.performanceMetrics.gatherGlFinish && !this.renderSystem.isGLTimerSupported) {
        // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
        this.performanceMetrics.beginOperation("Finish GPU Queue");
        const gl = this.renderSystem.context;
        const bytes = new Uint8Array(4);
        this.renderSystem.frameBufferStack.execute(this._fbo!, true, false, () => {
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        });
        this.performanceMetrics.endOperation();
      }
    }

    // Apply any screen-space effects that shift pixels from their original locations.
    this.beginPerfMetricRecord("Screenspace Effects", true);
    this.renderSystem.screenSpaceEffects.apply(this);
    this.endPerfMetricRecord(true); // End "Screenspace Effects"

    this.endReadPixels(true);

    this.beginPerfMetricRecord("Read Pixels", true);
    const result = this.compositor.readPixels(rect, selector);
    this.endPerfMetricRecord(true);

    if (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics) { // Only collect readPixels data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.endFrame();
      if (this.performanceMetrics)
        this.performanceMetrics.endFrame();
    }

    return result;
  }

  public override queryVisibleTileFeatures(options: QueryTileFeaturesOptions, iModel: IModelConnection, callback: QueryVisibleFeaturesCallback): void {
    this.beginReadPixels(Pixel.Selector.Feature);
    callback(new VisibleTileFeatures(this._renderCommands, options, this, iModel));
    this.endReadPixels();
  }

  protected readImagePixels(out: Uint8Array, x: number, y: number, w: number, h: number): boolean {
    assert(this._fbo !== undefined);
    if (this._fbo === undefined)
      return false;

    const context = this.renderSystem.context;
    let didSucceed = true;
    this.renderSystem.frameBufferStack.execute(this._fbo, true, false, () => {
      try {
        context.readPixels(x, y, w, h, context.RGBA, context.UNSIGNED_BYTE, out);
      } catch {
        didSucceed = false;
      }
    });

    return didSucceed;
  }

  /** Returns a new size scaled up to a maximum size while maintaining proper aspect ratio.  The new size will be
   * curSize adjusted so that it fits fully within maxSize in one dimension, maintaining its original aspect ratio.
   */
  private static _applyAspectRatioCorrection(curSize: XAndY, maxSize: XAndY): Point2d {
    const widthRatio = maxSize.x / curSize.x;
    const heightRatio = maxSize.y / curSize.y;
    const bestRatio = Math.min(widthRatio, heightRatio);
    return new Point2d(curSize.x * bestRatio, curSize.y * bestRatio);
  }

  public override readImageBuffer(args?: ReadImageBufferArgs): ImageBuffer | undefined {
    if (!this.assignDC())
      return undefined;

    // Determine and validate capture rect.
    const viewRect = this.renderRect; // already has device pixel ratio applied
    const captureRect = args?.rect ? this.cssViewRectToDeviceViewRect(args.rect) : viewRect;
    if (captureRect.isNull)
      return undefined;

    const topLeft = Point3d.create(captureRect.left, captureRect.top);
    const bottomRight = Point2d.create(captureRect.right - 1, captureRect.bottom - 1);
    if (!viewRect.containsPoint(topLeft) || !viewRect.containsPoint(bottomRight))
      return undefined;

    // ViewRect origin is at top-left. GL origin is at bottom-left.
    const bottom = viewRect.height - captureRect.bottom;
    const imageData = new Uint8Array(4 * captureRect.width * captureRect.height);
    if (!this.readImagePixels(imageData, captureRect.left, bottom, captureRect.width, captureRect.height))
      return undefined;

    // Alpha has already been blended. Make all pixels opaque, *except* for background pixels if background color is fully transparent.
    const preserveBGAlpha = 0 === this.uniforms.style.backgroundAlpha;
    let isEmptyImage = true;
    for (let i = 3; i < imageData.length; i += 4) {
      const a = imageData[i];
      if (!preserveBGAlpha || a > 0) {
        imageData[i] = 0xff;
        isEmptyImage = false;
      }
    }

    // Optimization for view attachments: if image consists entirely of transparent background pixels, don't bother producing an image.
    let image = !isEmptyImage ? ImageBuffer.create(imageData, ImageBufferFormat.Rgba, captureRect.width) : undefined;
    if (!image)
      return undefined;

    // Scale image.
    if (args?.size && (args.size.x !== captureRect.width || args.size.y !== captureRect.height)) {
      if (args.size.x <= 0 || args.size.y <= 0)
        return undefined;

      let canvas = imageBufferToCanvas(image, true);
      if (!canvas)
        return undefined;

      const adjustedSize = Target._applyAspectRatioCorrection({ x: captureRect.width, y: captureRect.height }, args.size);
      canvas = canvasToResizedCanvasWithBars(canvas, adjustedSize, new Point2d(args.size.x - adjustedSize.x, args.size.y - adjustedSize.y), this.uniforms.style.backgroundHexString);
      image = canvasToImageBuffer(canvas);
      if (!image)
        return undefined;
    }

    // Our image is upside-down by default. Flip it unless otherwise specified.
    if (!args?.upsideDown) {
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

  public copyImageToCanvas(overlayCanvas?: HTMLCanvasElement): HTMLCanvasElement {
    const image = this.readImageBuffer();
    const canvas = undefined !== image ? imageBufferToCanvas(image, false) : undefined;
    const retCanvas = undefined !== canvas ? canvas : document.createElement("canvas");

    if (overlayCanvas) {
      const ctx = retCanvas.getContext("2d")!;
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    const pixelRatio = this.devicePixelRatio;
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

  public get screenSpaceEffects(): Iterable<string> {
    return this._screenSpaceEffects;
  }

  public set screenSpaceEffects(effects: Iterable<string>) {
    this._screenSpaceEffects = [...effects];
  }

  public get screenSpaceEffectContext(): ScreenSpaceEffectContext {
    assert(undefined !== this._viewport);
    return { viewport: this._viewport };
  }

  public get currentAnimationTransformNodeId(): number | undefined {
    return this._currentAnimationTransformNodeId;
  }
  public set currentAnimationTransformNodeId(id: number | undefined) {
    assert(undefined === this._currentAnimationTransformNodeId || undefined === id);
    this._currentAnimationTransformNodeId = id;
  }

  /** Given GraphicBranch.animationId identifying *any* node in the scene's schedule script, return the transform node Id
   * that should be used to filter the branch's graphics for display, or undefined if no filtering should be applied.
   */
  public getAnimationTransformNodeId(animationNodeId: number | undefined): number | undefined {
    if (undefined === this.animationBranches || undefined === this.currentAnimationTransformNodeId || undefined === animationNodeId)
      return undefined;

    return this.animationBranches.transformNodeIds.has(animationNodeId) ? animationNodeId : AnimationNodeId.Untransformed;
  }

  protected abstract _assignDC(): boolean;
  protected abstract _beginPaint(fbo: FrameBuffer): void;
  protected abstract _endPaint(): void;

  public override collectStatistics(stats: RenderMemory.Statistics): void {
    this._compositor.collectStatistics(stats);
    const thematicBytes = this.uniforms.thematic.bytesUsed;
    if (0 < thematicBytes)
      stats.addThematicTexture(thematicBytes);

    const clipBytes = this.uniforms.branch.clipStack.bytesUsed;
    if (clipBytes)
      stats.addClipVolume(clipBytes);
  }

  protected cssViewRectToDeviceViewRect(rect: ViewRect): ViewRect {
    // NB: ViewRect constructor *floors* inputs.
    const ratio = this.devicePixelRatio;
    return new ViewRect(
      Math.floor(rect.left * ratio),
      Math.floor(rect.top * ratio),
      Math.floor(rect.right * ratio),
      Math.floor(rect.bottom * ratio));
  }

  public getRenderCommands(): Array<{ name: string, count: number }> {
    return this._renderCommands.dump();
  }
}

class CanvasState {
  public readonly canvas: HTMLCanvasElement;
  public needsClear = false;
  private _isWebGLCanvas: boolean;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this._isWebGLCanvas = this.canvas === System.instance.canvas;
  }

  // Returns true if the rect actually changed.
  public updateDimensions(pixelRatio: number): boolean {
    const w = Math.floor(this.canvas.clientWidth * pixelRatio);
    const h = Math.floor(this.canvas.clientHeight * pixelRatio);

    // Do not update the dimensions if not needed, or if new width or height is 0, which is invalid.
    // NB: the 0-dimension check indirectly resolves an issue when a viewport is dropped and immediately re-added
    // to the view manager. See ViewManager.test.ts for more details.  0 is also the case when vpDiv.removeChild
    // is done on webGLCanvas, due to client sizes being 0 afterward.
    if (w === this.canvas.width && h === this.canvas.height || (0 === w || 0 === h))
      return false;

    // Must ensure internal bitmap grid dimensions of on-screen canvas match its own on-screen appearance.
    this.canvas.width = w;
    this.canvas.height = h;

    if (!this._isWebGLCanvas) {
      const ctx = this.canvas.getContext("2d")!;
      ctx.scale(pixelRatio, pixelRatio); // apply the pixelRatio as a scale on the 2d context for drawing of decorations, etc.
      ctx.save();
    }

    return true;
  }

  public get width() { return this.canvas.width; }
  public get height() { return this.canvas.height; }
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
  private _devicePixelRatioOverride?: number;

  private get _curCanvas() { return this._usingWebGLCanvas ? this._webglCanvas : this._2dCanvas; }

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._2dCanvas = new CanvasState(canvas);
    this._webglCanvas = new CanvasState(this.renderSystem.canvas);
  }

  public override get isDisposed(): boolean {
    return undefined === this._blitGeom
      && undefined === this._scratchProgParams
      && undefined === this._scratchDrawParams
      && super.isDisposed;
  }

  public override[Symbol.dispose]() {
    this._blitGeom = dispose(this._blitGeom);
    this._scratchProgParams = undefined;
    this._scratchDrawParams = undefined;
    super[Symbol.dispose]();
  }

  public override collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);
    if (undefined !== this._blitGeom)
      this._blitGeom.collectStatistics(stats);
  }

  public get devicePixelRatioOverride(): number | undefined { return this._devicePixelRatioOverride; }
  public set devicePixelRatioOverride(ovr: number | undefined) { this._devicePixelRatioOverride = ovr; }
  public override get devicePixelRatio(): number {
    if (undefined !== this.devicePixelRatioOverride)
      return this.devicePixelRatioOverride;

    if (false === this.renderSystem.options.dpiAwareViewports)
      return 1.0;

    if (undefined !== this.renderSystem.options.devicePixelRatioOverride)
      return this.renderSystem.options.devicePixelRatioOverride;

    return window.devicePixelRatio || 1.0;
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean): void {
    assert(false);
  }

  /** Internal-only function for testing. Returns true if the FBO dimensions match the canvas dimensions */
  public checkFboDimensions(): boolean {
    if (undefined !== this._fbo) {
      const tx = this._fbo.getColor(0);
      if (tx.width !== this._curCanvas.width || tx.height !== this._curCanvas.height)
        return false;
    }
    return true;
  }

  protected _assignDC(): boolean {
    this.disposeFbo();
    const fbo = this.allocateFbo();
    if (!fbo)
      return false;

    const tx = fbo.getColor(0);
    assert(undefined !== tx.getHandle());
    this._blitGeom = SingleTexturedViewportQuadGeometry.createGeometry(tx.getHandle()!, TechniqueId.CopyColorNoAlpha);
    if (undefined === this._blitGeom)
      this.disposeFbo();

    return undefined !== this._blitGeom;
  }

  public updateViewRect(): boolean {
    const pixelRatio = this.devicePixelRatio;
    const changed2d = this._2dCanvas.updateDimensions(pixelRatio);
    const changedWebGL = this._webglCanvas.updateDimensions(pixelRatio);
    this.renderRect.init(0, 0, this._curCanvas.width, this._curCanvas.height);
    return this._usingWebGLCanvas ? changedWebGL : changed2d;
  }

  protected _beginPaint(fbo: FrameBuffer): void {
    // Render to our framebuffer
    const system = this.renderSystem;
    system.frameBufferStack.push(fbo, true, false);

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

    // Blit the final image to the canvas.
    const drawParams = this.getDrawParams(this, this._blitGeom);

    const system = this.renderSystem;
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

      if (this.uniforms.style.backgroundAlpha < 1) {
        // If background is transparent, we aren't guaranteed that every pixel will be overwritten - clear it.
        onscreenContext.clearRect(0, 0, w, h);
      }

      onscreenContext.setTransform(1, 0, 0, 1, 0, 0); // revert any previous devicePixelRatio scale for drawImage() call below.
      onscreenContext.drawImage(system.canvas, 0, yOffset, w, h, 0, 0, w, h);
      onscreenContext.restore();
    }
  }

  protected override drawOverlayDecorations(): void {
    const ctx = this._2dCanvas.canvas.getContext("2d", { alpha: true })!;
    if (this._usingWebGLCanvas && this._2dCanvas.needsClear) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // revert any previous devicePixelRatio scale for clearRect() call below.
      ctx.clearRect(0, 0, this._2dCanvas.width, this._2dCanvas.height);
      ctx.restore();
      this._2dCanvas.needsClear = false;
    }

    const canvasDecs = this.graphics.canvasDecorations;
    if (canvasDecs) {
      for (const overlay of canvasDecs) {
        ctx.save();
        if (overlay.position)
          ctx.translate(overlay.position.x, overlay.position.y);

        overlay.drawDecoration(ctx);
        this._2dCanvas.needsClear = true;
        ctx.restore();
      }
    }
  }

  public override pickOverlayDecoration(pt: XAndY): CanvasDecoration | undefined {
    const overlays = this.graphics.canvasDecorations;
    if (undefined === overlays)
      return undefined;

    // loop over array backwards, because later entries are drawn on top.
    for (let i = overlays.length - 1; i >= 0; --i) {
      const overlay = overlays[i];
      if (undefined !== overlay.pick && overlay.pick(pt))
        return overlay;
    }
    return undefined;
  }

  public override onResized(): void {
    this.disposeFbo();
  }

  public override setRenderToScreen(toScreen: boolean): HTMLCanvasElement | undefined {
    if (toScreen === this._usingWebGLCanvas)
      return;

    // NB: need to force a buffer change in this case because nothing is changing sizes except the webglCanvas
    if (toScreen)
      this.compositor.forceBufferChange();

    this._usingWebGLCanvas = toScreen;
    return toScreen ? this._webglCanvas.canvas : undefined;
  }

  public override readImageToCanvas(overlayCanvas?: HTMLCanvasElement): HTMLCanvasElement {
    return this._usingWebGLCanvas || !overlayCanvas ? this.copyImageToCanvas(overlayCanvas) : this._2dCanvas.canvas;
  }
}
/** @internal */
export class OffScreenTarget extends Target {
  public constructor(rect: ViewRect) {
    super(rect);
  }

  public override onResized(): void {
    assert(false); // offscreen viewport's dimensions are set once, in constructor.
  }

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

    this.disposeFbo();
    dispose(this._compositor);
  }

  protected _assignDC(): boolean {
    return undefined !== this.allocateFbo();
  }

  protected _beginPaint(fbo: FrameBuffer): void {
    this.renderSystem.frameBufferStack.push(fbo, true, false);
  }

  protected _endPaint(): void {
    this.renderSystem.frameBufferStack.pop();
  }

  public override readImageToCanvas(): HTMLCanvasElement {
    return this.copyImageToCanvas();
  }
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
