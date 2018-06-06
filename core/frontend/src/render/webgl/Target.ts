/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Transform, Vector3d, Point3d, ClipPlane, ClipVector, Matrix4d } from "@bentley/geometry-core";
import { BeTimePoint, assert, Id64 } from "@bentley/bentleyjs-core";
import { RenderTarget, RenderSystem, DecorationList, Decorations, GraphicList, RenderPlan } from "../System";
import { ViewFlags, Frustum, Hilite, ColorDef, Npc, RenderMode, HiddenLine, ImageLight } from "@bentley/imodeljs-common";
import { HilitedSet } from "../../SelectionSet";
import { FeatureSymbology } from "../FeatureSymbology";
import { Techniques } from "./Technique";
import { TechniqueId } from "./TechniqueId";
import { System } from "./System";
import { BranchStack, BranchState } from "./BranchState";
import { ShaderFlags, ShaderProgramExecutor } from "./ShaderProgram";
import { Branch, WorldDecorations, FeatureOverrides, PickTable } from "./Graphic";
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
import { SingleTexturedViewportQuadGeometry } from "./CachedGeometry";
import { ShaderLights } from "./Lighting";

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

/** Represents the frustum for use in glsl as a pair of uniforms. */
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
        const xFormPos: Point3d = viewMatrix.multiplyPoint3d(pos);
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
  private _scene: GraphicList = [];
  private _decorations = new Decorations();
  private _dynamics?: DecorationList;
  private _worldDecorations?: WorldDecorations;
  private _overridesUpdateTime = BeTimePoint.now();
  private _hilite?: HilitedSet;
  private _hiliteUpdateTime = BeTimePoint.now();
  private _flashedElemId = Id64.invalidId;
  private _flashedUpdateTime = BeTimePoint.now();
  private _flashIntensity: number = 0;
  private _transparencyThreshold: number = 0;
  private _renderCommands: RenderCommands;
  private _overlayRenderState: RenderState;
  public readonly compositor: SceneCompositor;
  private _clipMask?: TextureHandle;
  private _fStop: number = 0;
  private _ambientLight: Float32Array = new Float32Array(3);
  private _shaderLights: ShaderLights | undefined;
  protected _dcAssigned: boolean = false;
  public readonly clips = new Clips();
  public readonly decorationState = BranchState.createForDecorations(); // Used when rendering view background and view/world overlays.
  public readonly frustumUniforms = new FrustumUniforms();
  public readonly bgColor = ColorDef.red.clone();
  public readonly monoColor = ColorDef.white.clone();
  public readonly hiliteSettings = new Hilite.Settings();
  public readonly planFrustum = new Frustum();
  public readonly nearPlaneCenter = new Point3d();
  public readonly viewMatrix = Transform.createIdentity();
  public readonly projectionMatrix = Matrix4d.createIdentity();
  public readonly environmentMap: TextureHandle | undefined = undefined; // ###TODO: for IBL
  public readonly diffuseMap: TextureHandle | undefined = undefined; // ###TODO: for IBL
  public readonly imageSolar: ImageLight.Solar | undefined = undefined; // ###TODO: for IBL
  private readonly _visibleEdgeOverrides = new EdgeOverrides();
  private readonly _hiddenEdgeOverrides = new EdgeOverrides();
  private _currentOverrides?: FeatureOverrides;
  private _currentPickTable?: PickTable;

  protected constructor() {
    super();
    this._renderCommands = new RenderCommands(this, this._stack);
    this._overlayRenderState = new RenderState();
    this._overlayRenderState.flags.depthMask = false;
    this._overlayRenderState.flags.blend = true;
    this._overlayRenderState.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);
    this.compositor = new SceneCompositor(this);
  }

  public get transparencyThreshold(): number { return this._transparencyThreshold; }
  public get techniques(): Techniques { return System.instance.techniques!; }

  public get hilite(): HilitedSet { return this._hilite!; }
  public get hiliteUpdateTime(): BeTimePoint { return this._hiliteUpdateTime; }

  public get flashedElemId(): Id64 { return this._flashedElemId; }
  public get flashedUpdateTime(): BeTimePoint { return this._flashedUpdateTime; }
  public get flashIntensity(): number { return this._flashIntensity; }

  public get overridesUpdateTime(): BeTimePoint { return this._overridesUpdateTime; }
  public get currentOverrides(): FeatureOverrides | undefined { return this._currentOverrides; }
  public get areDecorationOverridesActive(): boolean { return false; } // ###TODO
  public get currentPickTable(): PickTable | undefined { return this._currentPickTable; }

  public get fStop(): number { return this._fStop; }
  public get ambientLight(): Float32Array { return this._ambientLight; }
  public get shaderLights(): ShaderLights | undefined { return this._shaderLights; }

  public get scene(): GraphicList { return this._scene; }
  public get decorations(): Decorations { return this._decorations; }
  public get dynamics(): DecorationList | undefined { return this._dynamics; }
  public getWorldDecorations(decs: DecorationList): WorldDecorations {
    if (undefined === this._worldDecorations) {
      assert(0 < decs.length);

      // Don't allow flags like monochrome etc to affect world decorations. Allow lighting in 3d only.
      const vf = new ViewFlags();
      vf.setRenderMode(RenderMode.SmoothShade);
      vf.setShowClipVolume(false);
      if (this.is2d) {
        vf.setShowSourceLights(false);
        vf.setShowCameraLights(false);
        vf.setShowSolarLight(false);
      }

      this._worldDecorations = new WorldDecorations(decs[0].graphic.iModel, vf);
    }

    this._worldDecorations.init(decs);
    return this._worldDecorations;
  }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get currentTransform(): Transform { return this._stack.top.transform; }
  public get currentShaderFlags(): ShaderFlags { return this.currentViewFlags.isMonochrome() ? ShaderFlags.Monochrome : ShaderFlags.None; }

  public get hasClipVolume(): boolean { return this.clips.isValid && this._stack.top.showClipVolume; }
  public get hasClipMask(): boolean { return undefined !== this.clipMask; }
  public get clipMask(): TextureHandle | undefined { return this._clipMask; }
  public set clipMask(mask: TextureHandle | undefined) {
    assert(!this.hasClipMask);
    assert(this.is2d);
    this._clipMask = mask;
  }

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

  public pushActiveVolume(): void { } // ###TODO
  public popActiveVolume(): void { } // ###TODO

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
  private static _scratch = {
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
    if (this._dcAssigned && plan.is3d !== this.is3d) {
      // changed the dimensionality of the Target. World decorations no longer valid.
      // (lighting is enabled or disabled based on 2d vs 3d).
      this._worldDecorations = undefined;
    }

    if (!this.assignDC()) {
      assert(false);
      return;
    }

    this.bgColor.setFrom(plan.bgColor);
    this.monoColor.setFrom(plan.monoColor);
    this.hiliteSettings.copyFrom(plan.hiliteSettings);
    this._transparencyThreshold = 0.0;

    // ##TODO active volume...

    const scratch = Target._scratch;
    const visEdgeOvrs = undefined !== plan.hline ? plan.hline.visible.clone(scratch.visibleEdges) : undefined;
    const hidEdgeOvrs = undefined !== plan.hline ? plan.hline.hidden.clone(scratch.hiddenEdges) : undefined;

    plan.viewFlags.renderMode = RenderMode.SmoothShade; // ###TODO: Remove after we implement support for edges.
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

    this._visibleEdgeOverrides.init(forceEdgesOpaque, visEdgeOvrs);
    this._hiddenEdgeOverrides.init(forceEdgesOpaque, hidEdgeOvrs);

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
      this.nearPlaneCenter.interpolate(0.5, nearUpperRight, this.nearPlaneCenter);

      this.frustumUniforms.setPlanes(frustumTop, frustumBottom, frustumLeft, frustumRight);
      this.frustumUniforms.setFrustum(frustumFront, frustumBack, FrustumUniformType.Perspective);
    }
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

  public drawFrame(): void {
    assert(System.instance.frameBufferStack.isEmpty);
    if (undefined === this._scene) {
      return;
    }

    this.paintScene();
    assert(System.instance.frameBufferStack.isEmpty);
  }

  public onDestroy(): void { } // ###TODO
  public queueReset(): void { } // ###TODO
  public reset(): void {
    this._scene.length = 0;
    this._decorations.reset();
    this._dynamics = undefined;
    // ###TODO this._activeVolume = undefined;
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
      enabled = this.currentViewFlags.showHiddenEdges();
    } else {
      ovrs = this._visibleEdgeOverrides;
      enabled = this.currentViewFlags.showVisibleEdges();
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
    return new ColorInfo(this._visibleEdgeOverrides.color!);
  }

  private _doDebugPaint: boolean = false;
  protected debugPaint(): void { }

  private paintScene(): void {
    if (this._doDebugPaint) {
      this.debugPaint();
      return;
    }

    if (!this._dcAssigned) {
      return;
    }

    this._beginPaint();

    const gl = System.instance.context;
    const rect = this.viewRect;
    gl.viewport(0, 0, rect.width, rect.height);

    // ###TODO? System.instance.garbage.execute();

    this._renderCommands.init(this._scene, this._decorations, this._dynamics);

    this.compositor.draw(this._renderCommands);

    this._stack.pushState(this.decorationState);
    this.drawPass(RenderPass.WorldOverlay);
    this.drawPass(RenderPass.ViewOverlay);
    this._stack.pop();

    this._endPaint();
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

  // ---- Methods expected to be overridden by subclasses ---- //

  protected abstract _assignDC(): boolean;
  protected abstract _beginPaint(): void;
  protected abstract _endPaint(): void;
}

/** A Target which renders to a canvas on the screen */
export class OnScreenTarget extends Target {
  private readonly _viewRect = new ViewRect();
  private readonly _canvas: HTMLCanvasElement;
  private _fbo?: FrameBuffer;
  private _blitGeom?: SingleTexturedViewportQuadGeometry;
  private _prevViewRect: ViewRect = new ViewRect();

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._canvas = canvas;
  }

  public get viewRect(): ViewRect {
    this._viewRect.init(0, 0, this._canvas.clientWidth, this._canvas.clientHeight);
    assert(Math.floor(this._viewRect.width) === this._viewRect.width && Math.floor(this._viewRect.height) === this._viewRect.height, "fractional view rect dimensions");
    return this._viewRect;
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean): void { assert(false); }

  protected _assignDC(): boolean {
    assert(undefined === this._fbo);

    const rect = this.viewRect;
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
    this._blitGeom = SingleTexturedViewportQuadGeometry.createGeometry(tx.getHandle()!, TechniqueId.CopyColor);
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

    const context = this._canvas.getContext("2d");
    assert(null !== context);
    context!.drawImage(canvas, 0, 0);
  }

  public updateViewRect(): boolean {
    const viewRect = this.viewRect;

    if (this._prevViewRect.width !== viewRect.width || this._prevViewRect.height !== viewRect.height) {
      // Must ensure internal bitmap grid dimensions of on-screen canvas match its own on-screen appearance
      this._canvas.width = viewRect.width;
      this._canvas.height = viewRect.height;
      this._prevViewRect = new ViewRect(0, 0, viewRect.width, viewRect.height);
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
  protected _endPaint(): void {
    const onscreenContext = this._canvas.getContext("2d");
    assert(null !== onscreenContext);
    assert(undefined !== this._blitGeom);
    if (undefined === this._blitGeom || null === onscreenContext) {
      return;
    }

    const system = System.instance;
    system.frameBufferStack.pop();

    // Copy framebuffer contents to off-screen canvas
    system.applyRenderState(RenderState.defaults);
    const params = new DrawParams(this, this._blitGeom);
    system.techniques.draw(params);

    // Copy off-screen canvas contents to on-screen canvas
    // ###TODO: Determine if clearRect() actually required...seems to leave some leftovers from prev image if not...
    onscreenContext.clearRect(0, 0, this._canvas.clientWidth, this._canvas.clientHeight);
    onscreenContext.drawImage(system.canvas, 0, 0);
  }
  public onResized(): void {
    this._dcAssigned = false;
    this._fbo = undefined;
  }
}

export class OffScreenTarget extends Target {
  private _viewRect: ViewRect;

  public constructor(rect: ViewRect) {
    super();
    this._viewRect = new ViewRect(rect.left, rect.bottom, rect.right, rect.top);
  }

  public get viewRect(): ViewRect { return this._viewRect; }

  public setViewRect(rect: ViewRect, temporary: boolean): void {
    if (this._viewRect.equals(rect))
      return;

    this._viewRect.copyFrom(rect);
    if (temporary) {
      // Temporarily adjust view rect in order to create scene for a view attachment.
      // Will be reset before attachment is rendered - so don't blow away our framebuffers + textures
      return;
    }

    this._dcAssigned = false;
    // ###TODO this._fbo = undefined;
    this.compositor.reset();
  }

  // ###TODO...
  protected _assignDC(): boolean { return false; }
  protected _makeCurrent(): void { }
  protected _beginPaint(): void { }
  protected _endPaint(): void { }
  public onResized(): void { assert(false); } // offscreen viewport's dimensions are set once, in constructor.
  public updateViewRect(): boolean {
    return false;
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
