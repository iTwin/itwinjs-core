/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  ClipPlaneContainment,
  ClipUtilities,
  Point2d,
  Point3d,
  Range3d,
  Transform,
  XAndY,
  XYZ,
} from "@bentley/geometry-core";
import {
  IDisposable,
  Id64,
  Id64String,
  assert,
  dispose,
  disposeArray,
} from "@bentley/bentleyjs-core";
import { GraphicList } from "../RenderGraphic";
import { Scene } from "../Scene";
import { AnimationBranchStates } from "../GraphicBranch";
import { CanvasDecoration } from "../CanvasDecoration";
import { Decorations } from "../Decorations";
import { Pixel } from "../Pixel";
import { ClippingType } from "../RenderClipVolume";
import {
  PlanarClassifierMap,
  RenderPlanarClassifier,
} from "../RenderPlanarClassifier";
import {
  PrimitiveVisibility,
  RenderTarget,
  RenderTargetDebugControl,
} from "../RenderTarget";
import { RenderMemory } from "../RenderMemory";
import {
  RenderTextureDrape,
  TextureDrapeMap,
} from "../RenderSystem";
import { RenderPlan } from "../RenderPlan";
import {
  AmbientOcclusion,
  AnalysisStyle,
  ColorDef,
  Frustum,
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
import { BranchState } from "./BranchState";
import { ShaderFlags, ShaderProgramExecutor } from "./ShaderProgram";
import { Branch, WorldDecorations, Batch } from "./Graphic";
import { EdgeOverrides } from "./EdgeOverrides";
import { ViewRect } from "../../ViewRect";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { RenderCommands } from "./RenderCommands";
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
import { SolarShadowMap } from "./SolarShadowMap";
import { imageBufferToCanvas, canvasToResizedCanvasWithBars, canvasToImageBuffer } from "../../ImageUtil";
import { HiliteSet } from "../../SelectionSet";
import { SceneContext } from "../../ViewContext";
import { WebGLDisposable } from "./Disposable";
import { TargetUniforms } from "./TargetUniforms";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { desync, SyncTarget } from "./Sync";
import { IModelFrameLifecycle } from "./IModelFrameLifecycle";
import { Viewport } from "../../Viewport";
import { ViewClipSettings } from "../ViewClipSettings";
import { FloatRgba } from "./FloatRGBA";

/** Interface for 3d GPU clipping.
 * @internal
 */
export class Clips {
  private _texture?: TextureHandle;
  private _clipActive: number = 0;   // count of SetActiveClip nesting (only outermost used)
  private _clipCount: number = 0;
  private _outsideRgba: FloatRgba = FloatRgba.from(0.0, 0.0, 0.0, 0.0); // 0 alpha means disabled
  private _insideRgba: FloatRgba = FloatRgba.from(0.0, 0.0, 0.0, 0.0); // 0 alpha means disabled

  public get outsideRgba(): FloatRgba { return this._outsideRgba; }
  public get insideRgba(): FloatRgba { return this._insideRgba; }

  public get texture(): TextureHandle | undefined { return this._texture; }
  public get count(): number { return this._clipCount; }
  public get isValid(): boolean { return this._clipCount > 0; }

  public set(numPlanes: number, texture: TextureHandle, outsideRgba: FloatRgba, insideRgba: FloatRgba) {
    this._clipActive++;
    if (this._clipActive !== 1)
      return;

    this._clipCount = numPlanes;
    this._texture = texture;
    this._outsideRgba = outsideRgba;
    this._insideRgba = insideRgba;
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
export abstract class Target extends RenderTarget implements RenderTargetDebugControl, WebGLDisposable {
  protected _decorations?: Decorations;
  private _scene: GraphicList = [];
  private _backgroundMap: GraphicList = [];
  private _overlayGraphics: GraphicList = [];
  private _planarClassifiers?: PlanarClassifierMap;
  private _textureDrapes?: TextureDrapeMap;
  private _dynamics?: GraphicList;
  private _worldDecorations?: WorldDecorations;
  private _hilites: Hilites = new EmptyHiliteSet();
  private _hiliteSyncTarget: SyncTarget = { syncKey: Number.MIN_SAFE_INTEGER };
  private _flashed: Id64.Uint32Pair = { lower: 0, upper: 0 };
  private _flashedId = Id64.invalid;
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
  public readonly decorationsState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly uniforms = new TargetUniforms(this);
  public readonly renderRect = new ViewRect();
  private readonly _visibleEdgeOverrides = new EdgeOverrides();
  private readonly _hiddenEdgeOverrides = new EdgeOverrides();
  public analysisStyle?: AnalysisStyle;
  public analysisTexture?: RenderTexture;
  public ambientOcclusionSettings = AmbientOcclusion.Settings.defaults;
  private _wantAmbientOcclusion = false;
  private _batches: Batch[] = [];
  public plan = RenderPlan.createEmpty();
  private _animationBranches?: AnimationBranchStates;
  private _isReadPixelsInProgress = false;
  private _readPixelsSelector = Pixel.Selector.None;
  private _drawNonLocatable = true;
  private _currentlyDrawingClassifier?: PlanarClassifier;
  private _analysisFraction: number = 0;
  public isFadeOutActive = false;
  public activeVolumeClassifierTexture?: WebGLTexture;
  public activeVolumeClassifierProps?: SpatialClassificationProps.Classifier;
  public activeVolumeClassifierModelId?: Id64String;
  public terrainTransparency: number = 0.0;

  // RenderTargetDebugControl
  public useLogZ = true;
  public vcSupportIntersectingVolumes: boolean = false;
  public drawForReadPixels = false;
  public primitiveVisibility = PrimitiveVisibility.All;
  public displayDrapeFrustum = false;
  public displayRealityTilePreload = false;
  public displayRealityTileRanges = false;
  public logRealityTiles = false;

  public freezeRealityTiles = false;
  public get shadowFrustum(): Frustum | undefined {
    const map = this.solarShadowMap;
    return map.isEnabled && map.isReady ? map.frustum : undefined;
  }

  public get debugControl(): RenderTargetDebugControl { return this; }

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
  }

  public get compositor() { return this._compositor; }
  public get isReadPixelsInProgress(): boolean { return this._isReadPixelsInProgress; }
  public get readPixelsSelector(): Pixel.Selector { return this._readPixelsSelector; }
  public get drawNonLocatable(): boolean { return this._drawNonLocatable; }
  public get wantLogZ(): boolean { return undefined !== this.uniforms.frustum.logZ; }

  public get transparencyThreshold(): number { return this._transparencyThreshold; }
  public get techniques(): Techniques { return this.renderSystem.techniques!; }

  public get hilites(): Hilites { return this._hilites; }
  public get hiliteSyncTarget(): SyncTarget { return this._hiliteSyncTarget; }

  public get flashed(): Id64.Uint32Pair | undefined { return Id64.isValid(this._flashedId) ? this._flashed : undefined; }
  public get flashedId(): Id64String { return this._flashedId; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get scene(): GraphicList { return this._scene; }
  public get dynamics(): GraphicList | undefined { return this._dynamics; }

  public get analysisFraction(): number { return this._analysisFraction; }
  public set analysisFraction(fraction: number) { this._analysisFraction = fraction; }

  public get animationBranches(): AnimationBranchStates | undefined {
    return this._animationBranches;
  }
  public set animationBranches(branches: AnimationBranchStates | undefined) {
    this.disposeAnimationBranches();
    this._animationBranches = branches;
  }

  private disposeAnimationBranches(): void {
    if (this._animationBranches)
      for (const branch of this._animationBranches.values())
        branch.dispose();

    this._animationBranches = undefined;
  }

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
      vf.whiteOnWhiteReversal = false;

      vf.lighting = !this.is2d;
      vf.shadows = false; // don't want shadows applied to these

      this._worldDecorations = new WorldDecorations(vf);
    }

    this._worldDecorations.init(decs);
    return this._worldDecorations;
  }

  public get currentViewFlags(): ViewFlags { return this.uniforms.branch.top.viewFlags; }
  public get currentTransform(): Transform { return this.uniforms.branch.top.transform; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.monochrome ? ShaderFlags.Monochrome : ShaderFlags.None; }
  public get currentFeatureSymbologyOverrides(): FeatureSymbology.Overrides { return this.uniforms.branch.top.symbologyOverrides; }
  public get currentPlanarClassifier(): PlanarClassifier | undefined { return this.uniforms.branch.top.planarClassifier; }
  public get currentlyDrawingClassifier(): PlanarClassifier | undefined { return this._currentlyDrawingClassifier; }
  public get currentTextureDrape(): TextureDrape | undefined {
    const drape = this.uniforms.branch.top.textureDrape;
    return undefined !== drape && drape.isReady ? drape : undefined;
  }
  public get currentPlanarClassifierOrDrape(): PlanarClassifier | TextureDrape | undefined {
    const drape = this.currentTextureDrape;
    return undefined === drape ? this.currentPlanarClassifier : drape;
  }

  public modelToView(modelPt: XYZ, result?: Point3d): Point3d {
    return this.uniforms.branch.modelViewMatrix.multiplyPoint3dQuietNormalize(modelPt, result);
  }

  public get clipDef(): ClipDef {
    if (this.hasClipVolume)
      return new ClipDef(ClippingType.Planes, this.clips.count);
    else if (this.hasClipMask)
      return new ClipDef(ClippingType.Mask);
    else
      return new ClipDef();
  }
  public get hasClipVolume(): boolean { return this.clips.isValid && this.uniforms.branch.top.showClipVolume; }
  public get hasClipMask(): boolean { return undefined !== this.clipMask; }
  public get clipMask(): TextureHandle | undefined { return this._clipMask; }
  public set clipMask(mask: TextureHandle | undefined) {
    assert((mask === undefined) === this.hasClipMask);
    assert(this.is2d);
    this._clipMask = mask;
  }

  public get is2d(): boolean { return this.uniforms.frustum.is2d; }
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
      && this.uniforms.thematic.isDisposed
      && this._isDisposed;
  }

  public dispose() {
    this.reset();

    dispose(this._compositor);

    this._dcAssigned = false;   // necessary to reassign to OnScreenTarget fbo member when re-validating render plan
    this._isDisposed = true;
  }

  public pushBranch(exec: ShaderProgramExecutor, branch: Branch): void {
    this.uniforms.branch.pushBranch(branch);
    const clip = this.uniforms.branch.top.clipVolume;
    if (undefined !== clip)
      clip.pushToShaderExecutor(exec);
  }
  public pushState(state: BranchState) {
    assert(undefined === state.clipVolume);
    this.uniforms.branch.pushState(state);

  }
  public popBranch(): void {
    const clip = this.uniforms.branch.top.clipVolume;
    if (undefined !== clip)
      clip.pop(this);

    this.uniforms.branch.pop();
  }

  public pushActiveVolume(): void {
    if (this._activeClipVolume !== undefined)
      this._activeClipVolume.pushToTarget(this);
  }

  public popActiveVolume(): void {
    if (this._activeClipVolume !== undefined)
      this._activeClipVolume.pop(this);
  }

  private updateActiveVolume(clipSettings?: ViewClipSettings): void {
    if (undefined === clipSettings) {
      this._activeClipVolume = dispose(this._activeClipVolume);
      return;
    }

    // ###TODO: Currently we assume the active view ClipVector is never mutated in place.
    // ###TODO: We may want to compare differing ClipVectors to determine if they are logically equivalent to avoid reallocating clip volume.
    if (undefined === this._activeClipVolume || this._activeClipVolume.clipVector !== clipSettings.clipVector) {
      this._activeClipVolume = dispose(this._activeClipVolume);
      this._activeClipVolume = this.renderSystem.createClipVolume(clipSettings.clipVector) as ClipVolume;
    }
    if (undefined !== this._activeClipVolume) {
      this._activeClipVolume.setClipColors(clipSettings.outsideColor, clipSettings.insideColor);
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
    if (undefined === this._activeClipVolume || !this.uniforms.branch.top.showClipVolume || !this.clips.isValid || this._activeClipVolume.hasOutsideClipColor)
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
    if (undefined === this._activeClipVolume || !this.uniforms.branch.top.showClipVolume || !this.clips.isValid)
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

  public updateSolarShadows(context: SceneContext | undefined): void {
    this.compositor.updateSolarShadows(context);
  }

  // ---- Implementation of RenderTarget interface ---- //

  public get renderSystem(): System { return System.instance; }

  public get planFraction() { return this.uniforms.frustum.planFraction; }
  public get planFrustum() { return this.uniforms.frustum.planFrustum; }

  public changeDecorations(decs: Decorations): void {
    dispose(this._decorations);
    this._decorations = decs;
  }

  public changeScene(scene: Scene) {
    this._scene = scene.foreground;
    this._backgroundMap = scene.background; // NB: May contain things other than map...
    this._overlayGraphics = scene.overlay;

    this.changeTextureDrapes(scene.textureDrapes);
    this.changePlanarClassifiers(scene.planarClassifiers);

    this.changeDrapesOrClassifiers<RenderPlanarClassifier>(this._planarClassifiers, scene.planarClassifiers);
    this._planarClassifiers = scene.planarClassifiers;

    this.activeVolumeClassifierProps = scene.volumeClassifier?.classifier;
    this.activeVolumeClassifierModelId = scene.volumeClassifier?.modelId;
  }

  public onBeforeRender(viewport: Viewport, setSceneNeedRedraw: (redraw: boolean) => void) {
    IModelFrameLifecycle.onBeforeRender.raiseEvent({
      renderSystem: this.renderSystem,
      viewport,
      setSceneNeedRedraw,
    });
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

  public changeDynamics(dynamics?: GraphicList) {
    // ###TODO: set feature IDs into each graphic so that edge display works correctly...
    // See IModelConnection.transientIds
    disposeArray(this._dynamics);
    this._dynamics = dynamics;
  }
  public overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void {
    this.uniforms.branch.overrideFeatureSymbology(ovr);
  }
  public setHiliteSet(hilite: HiliteSet): void {
    this._hilites = hilite;
    desync(this._hiliteSyncTarget);
  }
  public setFlashed(id: Id64String, intensity: number) {
    if (id !== this._flashedId) {
      this._flashedId = id;
      this._flashed = Id64.getUint32Pair(id);
    }

    this._flashIntensity = intensity;
  }

  public changeFrustum(newFrustum: Frustum, newFraction: number, is3d: boolean): void {
    this.uniforms.frustum.changeFrustum(newFrustum, newFraction, is3d);
  }

  private readonly _scratchViewFlags = new ViewFlags();
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

    if (!this.assignDC())
      return;

    this.terrainTransparency = plan.terrainTransparency;

    this.uniforms.updateRenderPlan(plan);
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

    this.updateActiveVolume(plan.activeClipSettings);

    let visEdgeOvrs = undefined !== plan.hline ? plan.hline.visible : undefined;
    let hidEdgeOvrs = undefined !== plan.hline ? plan.hline.hidden : undefined;

    const vf = ViewFlags.createFrom(plan.viewFlags, this._scratchViewFlags);
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

    this.uniforms.thematic.update(plan);

    this._visibleEdgeOverrides.init(forceEdgesOpaque, visEdgeOvrs);
    this._hiddenEdgeOverrides.init(forceEdgesOpaque, hidEdgeOvrs);

    this.uniforms.branch.changeViewFlags(vf);

    this.changeFrustum(plan.frustum, plan.fraction, plan.is3d);
  }

  public drawFrame(sceneMilSecElapsed?: number): void {
    assert(this.renderSystem.frameBufferStack.isEmpty);
    if (undefined === this._scene)
      return;

    if (!this.assignDC())
      return;

    this.paintScene(sceneMilSecElapsed);
    this.drawOverlayDecorations();
    assert(this.renderSystem.frameBufferStack.isEmpty);
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

    // Clear thematic texture
    dispose(this.uniforms.thematic);

    this.changePlanarClassifiers(undefined);
    this.changeTextureDrapes(undefined);

    this._renderCommands.clear();

    // Clear FeatureOverrides for this Target.
    // This may not be strictly necessary as the Target may still be viewing some of these batches, but better to clean up and recreate
    // than to leave unused in memory.
    for (const batch of this._batches)
      batch.onTargetDisposed(this);

    this._batches = [];
    this._activeClipVolume = dispose(this._activeClipVolume);
    this.disposeAnimationBranches();

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

  private paintScene(sceneMilSecElapsed?: number): void {
    if (!this._dcAssigned) {
      return;
    }

    this.beginPerfMetricFrame(sceneMilSecElapsed, this.drawForReadPixels);
    this.beginPerfMetricRecord("Begin Paint", this.drawForReadPixels);
    this._beginPaint();
    this.endPerfMetricRecord(this.drawForReadPixels);

    const gl = this.renderSystem.context;
    const rect = this.viewRect;
    gl.viewport(0, 0, rect.width, rect.height);

    // Set this to true to visualize the output of readPixels()...useful for debugging pick.
    if (this.drawForReadPixels) {
      this._isReadPixelsInProgress = true;
      this._readPixelsSelector = Pixel.Selector.Feature;

      const vf = this.getViewFlagsForReadPixels();
      const state = BranchState.create(this.uniforms.branch.top.symbologyOverrides, vf);
      this.pushState(state);

      this.beginPerfMetricRecord("Init Commands", this.drawForReadPixels);
      this._renderCommands.init(this._scene, this._backgroundMap, this._overlayGraphics, this._decorations, this._dynamics, true);
      this.endPerfMetricRecord(this.drawForReadPixels);

      this.compositor.drawForReadPixels(this._renderCommands, this._overlayGraphics, this._decorations?.worldOverlay);
      this.uniforms.branch.pop();

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

      this.beginPerfMetricRecord("World Overlays");
      this.drawPass(RenderPass.WorldOverlay);
      this.endPerfMetricRecord();

      this.beginPerfMetricRecord("View Overlays");
      this.drawPass(RenderPass.ViewOverlay);
      this.endPerfMetricRecord();

      this.endPerfMetricRecord(); // End "Overlay Draws"
    }

    // Reset the batch IDs in all batches drawn for this call.
    this.uniforms.batch.resetBatchState();

    this.beginPerfMetricRecord("End Paint", this.drawForReadPixels);
    this._endPaint();
    this.endPerfMetricRecord(this.drawForReadPixels);

    this.endPerfMetricFrame(this.drawForReadPixels);
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
    if (!this._dcAssigned) {
      if (!this._assignDC())
        return false;

      const rect = this.viewRect;
      if (rect.width < 1 || rect.height < 1)
        return false;

      this.uniforms.viewRect.update(rect.width, rect.height);
      this._dcAssigned = true;
    }

    return true;
  }

  public readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean): void {
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
    const texture = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === texture) {
      receiver(undefined);
      return;
    }

    let result: Pixel.Buffer | undefined;
    const fbo = FrameBuffer.create([texture]);
    if (undefined !== fbo) {
      this.renderSystem.frameBufferStack.execute(fbo, true, () => {
        this._drawNonLocatable = !excludeNonLocatable;
        result = this.readPixelsFromFbo(rect, selector);
        this._drawNonLocatable = true;
      });

      dispose(fbo);
    }

    dispose(texture);

    receiver(result);

    // Reset the batch IDs in all batches drawn for this call.
    this.uniforms.batch.resetBatchState();
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
  private readPixelsFromFbo(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    // const collectReadPixelsTimings = this.performanceMetrics !== undefined && !this.performanceMetrics.gatherCurPerformanceMetrics; // Only collect data here if in display-perf-test-app
    // if (collectReadPixelsTimings) this.beginPerfMetricRecord("Init Commands");
    this.beginPerfMetricRecord("Init Commands", true);

    this._isReadPixelsInProgress = true;
    this._readPixelsSelector = selector;

    // Temporarily turn off lighting to speed things up.
    // ###TODO: Disable textures *unless* they contain transparency. If we turn them off unconditionally then readPixels() will locate fully-transparent pixels, which we don't want.
    const vf = this.getViewFlagsForReadPixels();
    const state = BranchState.create(this.uniforms.branch.top.symbologyOverrides, vf);
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
    if (undefined !== this._activeClipVolume && this.uniforms.branch.top.showClipVolume && this.clips.isValid)
      if (ClipPlaneContainment.StronglyOutside === this._activeClipVolume.clipVector.classifyPointContainment(rectFrust.points))
        return undefined;

    // Repopulate the command list, omitting non-pickable decorations and putting transparent stuff into the opaque passes.
    this._renderCommands.clear();
    this._renderCommands.setCheckRange(rectFrust);
    this._renderCommands.init(this._scene, this._backgroundMap, this._overlayGraphics, this._decorations, this._dynamics, true);
    this._renderCommands.clearCheckRange();

    this.endPerfMetricRecord(true); // End "Init Commands"

    // Draw the scene
    this.compositor.drawForReadPixels(this._renderCommands, this._overlayGraphics, this._decorations?.worldOverlay);

    if (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics) { // Only collect readPixels data if in disp-perf-test-app
      this.performanceMetrics.endOperation(); // End the 'CPU Total Time' operation
      if (this.performanceMetrics.gatherGlFinish && !this.renderSystem.isGLTimerSupported) {
        // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
        this.performanceMetrics.beginOperation("Finish GPU Queue");
        const gl = this.renderSystem.context;
        const bytes = new Uint8Array(4);
        this.renderSystem.frameBufferStack.execute(this._fbo!, true, () => {
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        });
        this.performanceMetrics.endOperation();
      }
    }

    // Restore the state
    this.uniforms.branch.pop();

    this.beginPerfMetricRecord("Read Pixels", true);
    const result = this.compositor.readPixels(rect, selector);
    this.endPerfMetricRecord(true);

    if (this.performanceMetrics && !this.performanceMetrics.gatherCurPerformanceMetrics) { // Only collect readPixels data if in disp-perf-test-app
      if (this.renderSystem.isGLTimerSupported)
        this.renderSystem.glTimer.endFrame();
      if (this.performanceMetrics)
        this.performanceMetrics.endFrame();
    }

    this._isReadPixelsInProgress = false;
    return result;
  }

  protected readImagePixels(out: Uint8Array, x: number, y: number, w: number, h: number): boolean {
    assert(this._fbo !== undefined);
    if (this._fbo === undefined)
      return false;

    const context = this.renderSystem.context;
    let didSucceed = true;
    this.renderSystem.frameBufferStack.execute(this._fbo, true, () => {
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

  /** wantRectIn is in CSS pixels. Output ImageBuffer will be in device pixels.
   * If wantRect.right or wantRect.bottom is -1, that means "read the entire image".
   */
  public readImage(wantRectIn: ViewRect, targetSizeIn: Point2d, flipVertically: boolean): ImageBuffer | undefined {
    if (!this.assignDC())
      return undefined;

    // Determine capture rect and validate
    const actualViewRect = this.renderRect; // already has device pixel ratio applied
    const wantRect = (wantRectIn.right === -1 || wantRectIn.bottom === -1) ? actualViewRect : this.cssViewRectToDeviceViewRect(wantRectIn);
    const lowerRight = Point2d.create(wantRect.right - 1, wantRect.bottom - 1);
    if (!actualViewRect.containsPoint(Point2d.create(wantRect.left, wantRect.top)) || !actualViewRect.containsPoint(lowerRight))
      return undefined;

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
      const preserveBGAlpha = 0.0 === this.uniforms.style.backgroundAlpha;

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
      const resizedCanvas = canvasToResizedCanvasWithBars(canvas, adjustedTargetSize, new Point2d(targetSize.x - adjustedTargetSize.x, targetSize.y - adjustedTargetSize.y), this.uniforms.style.backgroundHexString);

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

  // ---- Methods expected to be overridden by subclasses ---- //

  protected abstract _assignDC(): boolean;
  protected abstract _beginPaint(): void;
  protected abstract _endPaint(): void;

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._compositor.collectStatistics(stats);
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
  public updateDimensions(pixelRatio: number): boolean {
    const w = Math.floor(this.canvas.clientWidth * pixelRatio);
    const h = Math.floor(this.canvas.clientHeight * pixelRatio);
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
  private _devicePixelRatioOverride?: number;

  private get _curCanvas() { return this._usingWebGLCanvas ? this._webglCanvas : this._2dCanvas; }

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._2dCanvas = new CanvasState(canvas);
    this._webglCanvas = new CanvasState(this.renderSystem.canvas);
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

  public get devicePixelRatioOverride(): number | undefined { return this._devicePixelRatioOverride; }
  public set devicePixelRatioOverride(ovr: number | undefined) { this._devicePixelRatioOverride = ovr; }
  public get devicePixelRatio(): number {
    if (undefined !== this.devicePixelRatioOverride)
      return this.devicePixelRatioOverride;

    if (false === this.renderSystem.options.dpiAwareViewports)
      return 1.0;

    return window.devicePixelRatio || 1.0;
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean): void {
    assert(false);
  }

  protected _assignDC(): boolean {
    dispose(this._fbo);

    const rect = this.viewRect;
    const color = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (undefined === color)
      return false;

    this._fbo = FrameBuffer.create([color]);
    if (undefined === this._fbo)
      return false;

    const tx = this._fbo.getColor(0);
    assert(undefined !== tx.getHandle());
    this._blitGeom = SingleTexturedViewportQuadGeometry.createGeometry(tx.getHandle()!, TechniqueId.CopyColorNoAlpha);
    if (undefined === this._blitGeom)
      dispose(this._fbo);

    return undefined !== this._blitGeom;
  }

  public updateViewRect(): boolean {
    const pixelRatio = this.devicePixelRatio;
    const changed2d = this._2dCanvas.updateDimensions(pixelRatio);
    const changedWebGL = this._webglCanvas.updateDimensions(pixelRatio);
    this.renderRect.init(0, 0, this._curCanvas.width, this._curCanvas.height);
    return this._usingWebGLCanvas ? changedWebGL : changed2d;
  }

  protected _beginPaint(): void {
    assert(undefined !== this._fbo);

    // Render to our framebuffer
    const system = this.renderSystem;
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

    const system = this.renderSystem;
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

  public onResized(): void {
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

    this._dcAssigned = false;
    this._fbo = dispose(this._fbo);
    dispose(this._compositor);
  }

  protected _assignDC(): boolean {
    if (this._fbo !== undefined)
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
    this.renderSystem.frameBufferStack.push(this._fbo!, true);
  }

  protected _endPaint(): void {
    this.renderSystem.frameBufferStack.pop();
  }

  public readImageToCanvas(): HTMLCanvasElement {
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
