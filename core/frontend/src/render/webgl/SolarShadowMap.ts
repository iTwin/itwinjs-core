/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, assert, BeTimePoint } from "@bentley/bentleyjs-core";
import { RenderMemory, RenderGraphic, RenderClipVolume } from "../System";
import { Geometry, Vector3d, Point3d, Map4d, Matrix3d, Matrix4d, Transform, Range3d } from "@bentley/geometry-core";
import { Target } from "./Target";
import { Texture, TextureHandle } from "./Texture";
import { FrameBuffer } from "./FrameBuffer";
import { SceneContext } from "../../ViewContext";
import { TileTree } from "../../tile/TileTree";
import { Tile } from "../../tile/Tile";
import { Frustum, FrustumPlanes, RenderTexture, RenderMode, SolarShadows, ViewFlags } from "@bentley/imodeljs-common";
import { System, RenderType } from "./System";
import { RenderState } from "./RenderState";
import { BatchState, BranchStack } from "./BranchState";
import { RenderCommands } from "./RenderCommands";
import { RenderPass, TextureUnit } from "./RenderFlags";
import { EVSMGeometry } from "./CachedGeometry";
import { getDrawParams } from "./ScratchDrawParams";
import { WebGLDisposable } from "./Disposable";

class SolarShadowMapDrawArgs extends Tile.DrawArgs {
  private _useViewportMap?: boolean;

  constructor(private _mapFrustumPlanes: FrustumPlanes, private _shadowMap: SolarShadowMap, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip);
  }

  public get frustumPlanes(): FrustumPlanes {
    if (true === this._useViewportMap)
      return super.frustumPlanes;
    else
      return this._mapFrustumPlanes;
  }
  protected get worldToViewMap(): Map4d {
    if (true === this._useViewportMap)
      return super.worldToViewMap;
    else
      return this._shadowMap.worldToViewMap;
  }

  public drawGraphics(): void {
    if (!this.graphics.isEmpty) {
      this._shadowMap.addGraphic(this.context.createBranch(this.graphics, this.location));
    }
  }

  public getPixelSize(tile: Tile): number {
    // For tiles that are part of the scene, size them based on the viewport frustum so that shadow map uses same resolution tiles as scene
    // - otherwise artifacts like shadow acne may result.
    // For tiles that are NOT part of the scene, size them based on the shadow frustum, not the viewport frustum
    // - otherwise excessive numbers of excessively detailed may be requested for the shadow map.
    if (undefined === this._useViewportMap) {
      this._useViewportMap = true;
      const vis = tile.computeVisibility(this);
      this._useViewportMap = Tile.Visibility.OutsideFrustum !== vis;
    }

    const size = super.getPixelSize(tile);
    this._useViewportMap = undefined;
    return size;
  }

  public static create(context: SceneContext, shadowMap: SolarShadowMap, tileTree: TileTree, planes: FrustumPlanes) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new SolarShadowMapDrawArgs(planes, shadowMap, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}

const shadowMapWidth = 4096;  // size of original depth buffer map
const shadowMapHeight = shadowMapWidth; // TBD - Adjust for aspect ratio.
const evsmWidth = shadowMapWidth / 2;  // EVSM buffer is 1/2 size each direction
const evsmHeight = shadowMapHeight / 2;
const postProjectionMatrixNpc = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, 1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

// Bundles up the disposable, create-once-and-reuse members of a SolarShadowMap.
class Bundle implements WebGLDisposable {
  private constructor(
    public readonly depthTexture: Texture,
    public readonly shadowMapTexture: Texture,
    public readonly fbo: FrameBuffer,
    public readonly fboSM: FrameBuffer,
    public readonly evsmGeom: EVSMGeometry,
    public readonly renderCommands: RenderCommands) {
  }

  public static create(target: Target, stack: BranchStack, batch: BatchState): Bundle | undefined {
    const depthTextureHandle = System.instance.createDepthBuffer(shadowMapWidth, shadowMapHeight) as TextureHandle;
    if (undefined === depthTextureHandle)
      return undefined;

    const fbo = FrameBuffer.create([], depthTextureHandle);
    if (undefined === fbo)
      return undefined;

    let pixelDataType = GL.Texture.DataType.Float;
    switch (System.instance.capabilities.maxRenderType) {
      case RenderType.TextureFloat:
        break;
      case RenderType.TextureHalfFloat:
        const exthf = System.instance.capabilities.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float");
        if (undefined !== exthf) {
          pixelDataType = exthf.HALF_FLOAT_OES;
          break;
        }
      /* falls through */
      default:
        return undefined;
    }

    // shadowMap texture is 1/4 size the depth texture (and averaged down when converting)
    const shadowMapTextureHandle = TextureHandle.createForAttachment(evsmWidth, evsmHeight, GL.Texture.Format.Rgba, pixelDataType);
    if (undefined === shadowMapTextureHandle)
      return undefined;

    const fboSM = FrameBuffer.create([shadowMapTextureHandle]);
    if (undefined === fboSM)
      return undefined;

    const depthTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), depthTextureHandle);
    const evsmGeom = EVSMGeometry.createGeometry(depthTexture.texture.getHandle()!, shadowMapWidth, shadowMapHeight);
    if (undefined === evsmGeom)
      return undefined;

    const shadowMapTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.Normal, true), shadowMapTextureHandle);
    const renderCommands = new RenderCommands(target, stack, batch);
    return new Bundle(depthTexture, shadowMapTexture, fbo, fboSM, evsmGeom, renderCommands);
  }

  public get isDisposed(): boolean {
    return this.depthTexture.isDisposed
      && this.shadowMapTexture.isDisposed
      && this.fbo.isDisposed
      && this.fboSM.isDisposed
      && this.evsmGeom.isDisposed;
  }

  public dispose(): void {
    dispose(this.depthTexture);
    dispose(this.shadowMapTexture);
    dispose(this.fbo);
    dispose(this.fboSM);
    dispose(this.evsmGeom);
  }
}

/** Describes the set of parameters which, when they change, require us to recreate the shadow map. */
class ShadowMapParams {
  public readonly direction = new Vector3d();
  public readonly viewFrustum = new Frustum();
  public readonly settings: SolarShadows.Settings;

  public constructor(viewFrustum: Frustum, direction: Vector3d, settings: SolarShadows.Settings) {
    direction.clone(this.direction);
    this.viewFrustum.setFrom(viewFrustum);
    this.settings = SolarShadows.Settings.fromJSON(settings);
  }

  public update(viewFrustum: Frustum, direction: Vector3d, settings: SolarShadows.Settings): void {
    settings.clone(this.settings);
    this.viewFrustum.setFrom(viewFrustum);
    direction.clone(this.direction);
  }
}

const defaultSunDirection = Vector3d.create(-1, -1, -1).normalize()!;

export class SolarShadowMap implements RenderMemory.Consumer, WebGLDisposable {
  private _bundle?: Bundle;
  private _projectionMatrix = Matrix4d.createIdentity();
  private _graphics: RenderGraphic[] = [];
  private _shadowFrustum = new Frustum();
  private _isReady = false;
  private _isDrawing = false;
  private _enabled = false;
  private _params?: ShadowMapParams;
  private readonly _scratchRange = Range3d.createNull();
  private readonly _scratchTransform = Transform.createIdentity();
  private readonly _scratchFrustumPlanes = new FrustumPlanes();
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _renderState: RenderState;
  private readonly _noZRenderState: RenderState;
  private readonly _branchStack = new BranchStack();
  private readonly _batchState: BatchState;
  private _worldToViewMap = Map4d.createIdentity();
  private readonly _target: Target;

  // This exists chiefly for debugging. See ToggleShadowMapTilesTool.
  public onGraphicsChanged?: (graphics: RenderGraphic[]) => void;

  private getBundle(target: Target): Bundle | undefined {
    if (undefined === this._bundle) {
      this._bundle = Bundle.create(target, this._branchStack, this._batchState);
      assert(undefined !== this._bundle);
    }

    return this._bundle;
  }

  public get isReady() { return this._isReady; }
  public get isDrawing() { return this._isDrawing; }
  public get isEnabled() { return this._enabled; }
  public get projectionMatrix(): Matrix4d { return this._projectionMatrix; }
  public get depthTexture(): Texture | undefined { return undefined !== this._bundle ? this._bundle.depthTexture : undefined; }
  public get shadowMapTexture(): Texture | undefined { return undefined !== this._bundle ? this._bundle.shadowMapTexture : undefined; }
  public get settings(): SolarShadows.Settings | undefined { return undefined !== this._params ? this._params.settings : undefined; }
  public get direction(): Vector3d | undefined { return undefined !== this._params ? this._params.direction : undefined; }
  public get frustum(): Frustum { return this._shadowFrustum; }
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public addGraphic(graphic: RenderGraphic) { this._graphics.push(graphic); }

  public constructor(target: Target) {
    this._target = target;
    this._renderState = new RenderState();
    this._renderState.flags.depthMask = true;
    this._renderState.flags.blend = false;
    this._renderState.flags.depthTest = true;

    this._noZRenderState = new RenderState();
    this._noZRenderState.flags.depthMask = false;

    this._batchState = new BatchState(this._branchStack);
  }

  public disable() {
    this._enabled = this._isReady = false;
    this._bundle = dispose(this._bundle);
    this.clearGraphics(true);
    this._target.uniforms.shadow.update();
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const bundle = this._bundle;
    if (undefined !== bundle)
      stats.addShadowMap(bundle.depthTexture.bytesUsed + bundle.shadowMapTexture.bytesUsed);
  }

  public get isDisposed(): boolean { return undefined === this._bundle && 0 === this._graphics.length; }

  public dispose() {
    this._bundle = dispose(this._bundle);
    this.clearGraphics(true);
  }

  private clearGraphics(notify: boolean) {
    for (const graphic of this._graphics)
      graphic.dispose();

    this._graphics.length = 0;
    if (notify)
      this.notifyGraphicsChanged();
  }

  private notifyGraphicsChanged(): void {
    if (undefined !== this.onGraphicsChanged)
      this.onGraphicsChanged(this._graphics);
  }

  public update(context: SceneContext | undefined) {
    this._isReady = false;
    this.clearGraphics(false);

    if (undefined === context || !context.viewport.view.isSpatialView()) {
      this.disable();
      this.notifyGraphicsChanged();
      return;
    }

    const view = context.viewport.view;
    const style = view.getDisplayStyle3d();
    let sunDirection = style.sunDirection;
    if (undefined === sunDirection)
      sunDirection = defaultSunDirection;

    const minimumHorizonDirection = -.01;
    if (sunDirection.z > minimumHorizonDirection) {
      this.notifyGraphicsChanged();
      return;
    }

    this._enabled = true;
    const viewFrustum = context.viewingSpace.getFrustum();
    const settings = style.settings.solarShadowsSettings;
    if (undefined === this._params)
      this._params = new ShadowMapParams(viewFrustum, sunDirection, settings);
    else
      this._params.update(viewFrustum, sunDirection, settings);

    const iModel = view.iModel;

    const worldToMapTransform = Transform.createRefs(Point3d.createZero(), Matrix3d.createRigidHeadsUp(this._params.direction.negate()).inverse()!);
    const worldToMap = Matrix4d.createTransform(worldToMapTransform);
    const mapToWorld = worldToMap.createInverse()!;

    const backgroundOn = context.viewFlags.backgroundMap;
    const shadowRange = Range3d.createTransformedArray(worldToMapTransform, this._params.viewFrustum.points);

    // By fitting to the actual tiles we can reduce the shadowRange and make better use of the texture pixels.
    if (!backgroundOn) {
      const viewTileRange = Range3d.createNull();
      this._scratchFrustumPlanes.init(this._params.viewFrustum);
      view.forEachModelTreeRef((ref) => {
        const tree = ref.treeOwner.load();
        if (undefined !== tree)
          tree.accumulateTransformedRange(viewTileRange, worldToMap, this._scratchFrustumPlanes);
      });

      if (!viewTileRange.isNull)
        shadowRange.intersect(viewTileRange, shadowRange);
    }

    const projectRange = worldToMapTransform.multiplyRange(iModel.projectExtents, this._scratchRange);
    shadowRange.low.x = Math.max(shadowRange.low.x, projectRange.low.x);
    shadowRange.high.x = Math.min(shadowRange.high.x, projectRange.high.x);
    shadowRange.low.y = Math.max(shadowRange.low.y, projectRange.low.y);
    shadowRange.high.y = Math.min(shadowRange.high.y, projectRange.high.y);
    shadowRange.high.z = projectRange.high.z;

    if (shadowRange.isNull) {
      this.notifyGraphicsChanged();
      return;
    }

    this._shadowFrustum.initFromRange(shadowRange);
    mapToWorld.multiplyPoint3dArrayQuietNormalize(this._shadowFrustum.points);

    const tileRange = Range3d.createNull();
    this._scratchFrustumPlanes.init(this._shadowFrustum);
    view.forEachModelTreeRef(((ref) => {
      const tileTree = ref.treeOwner.tileTree;
      if (undefined === tileTree)
        return;

      const drawArgs = SolarShadowMapDrawArgs.create(context, this, tileTree, this._scratchFrustumPlanes);
      const tileToMapTransform = worldToMapTransform.multiplyTransformTransform(tileTree.location, this._scratchTransform);
      const selectedTiles = tileTree.selectTiles(drawArgs);

      for (const selectedTile of selectedTiles) {
        tileRange.extendRange(tileToMapTransform.multiplyRange(selectedTile.range, this._scratchRange));
        selectedTile.drawGraphics(drawArgs);
      }

      drawArgs.drawGraphics();
    }));

    if (tileRange.isNull) {
      this.clearGraphics(true);
    } else if (0 < this._graphics.length) {
      if (!backgroundOn) {
        shadowRange.intersect(tileRange, shadowRange);

        // Avoid an uninvertible matrix on empty range...
        if (Geometry.isAlmostEqualNumber(shadowRange.low.x, shadowRange.high.x) ||
          Geometry.isAlmostEqualNumber(shadowRange.low.y, shadowRange.high.y) ||
          Geometry.isAlmostEqualNumber(shadowRange.low.z, shadowRange.high.z)) {
          this.clearGraphics(true);
          return;
        }

        this._shadowFrustum.initFromRange(shadowRange);
        mapToWorld.multiplyPoint3dArrayQuietNormalize(this._shadowFrustum.points);
      }

      const frustumMap = this._shadowFrustum.toMap4d();
      if (undefined === frustumMap) {
        this.clearGraphics(true);
        assert(false);
        return;
      }

      this._projectionMatrix = frustumMap.transform0.clone();

      const worldToNpc = postProjectionMatrixNpc.multiplyMatrixMatrix(this._projectionMatrix);
      const npcToView = Map4d.createBoxMap(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1), Point3d.create(0, 0, 0), Point3d.create(shadowMapWidth, shadowMapHeight, 1))!;
      const npcToWorld = worldToNpc.createInverse();
      if (undefined === npcToWorld) {
        this.clearGraphics(true);
        return;
      }

      const worldToNpcMap = Map4d.createRefs(worldToNpc, npcToWorld);
      this._worldToViewMap = npcToView.multiplyMapMap(worldToNpcMap);
    }

    this._target.uniforms.shadow.update();
    this.notifyGraphicsChanged();
  }

  public draw(target: Target) {
    assert(this.isEnabled);

    if (this.isReady || 0 === this._graphics.length)
      return;

    const bundle = this.getBundle(target);
    if (undefined === bundle)
      return;

    this._isDrawing = true;

    const prevState = System.instance.currentRenderState.clone();
    const gl = System.instance.context;
    gl.viewport(0, 0, shadowMapWidth, shadowMapHeight);

    const viewFlags = target.currentViewFlags.clone(this._scratchViewFlags);
    viewFlags.renderMode = RenderMode.SmoothShade;
    viewFlags.transparency = false;
    // viewFlags.textures = false;  // need textures for alpha transparency shadows
    viewFlags.lighting = false;
    viewFlags.shadows = false;
    viewFlags.noGeometryMap = true;
    viewFlags.monochrome = false;
    // viewFlags.materials = false; material transparency affects whether or not surface casts shadows
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    System.instance.applyRenderState(this._renderState);
    const prevPlan = target.plan;

    target.changeFrustum(this._shadowFrustum, this._shadowFrustum.getFraction(), true);
    target.uniforms.branch.changeViewFlags(viewFlags);

    const renderCommands = bundle.renderCommands;
    renderCommands.reset(target, this._branchStack, this._batchState);
    renderCommands.addGraphics(this._graphics);

    System.instance.frameBufferStack.execute(bundle.fbo, true, () => {
      System.instance.context.clearDepth(1.0);
      System.instance.context.clear(GL.BufferBit.Depth);
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaqueGeneral), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
    });

    // copy depth buffer to EVSM shadow buffer and average down for AA effect
    gl.viewport(0, 0, evsmWidth, evsmHeight);
    System.instance.frameBufferStack.execute(bundle.fboSM, true, () => {
      System.instance.applyRenderState(this._noZRenderState);
      const params = getDrawParams(target, bundle.evsmGeom);
      target.techniques.draw(params);
    });

    // mipmap resulting EVSM texture and set filtering options
    System.instance.activateTexture2d(TextureUnit.ShadowMap, bundle.shadowMapTexture.texture.getHandle()!);
    gl.generateMipmap(gl.TEXTURE_2D);
    const fullFloat = System.instance.capabilities.maxRenderType === RenderType.TextureFloat;
    if (fullFloat && System.instance.capabilities.supportsTextureFloatLinear || !fullFloat && System.instance.capabilities.supportsTextureHalfFloatLinear) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    const ext = System.instance.capabilities.queryExtensionObject<EXT_texture_filter_anisotropic>("EXT_texture_filter_anisotropic");
    if (undefined !== ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
    }
    // target.recordPerformanceMetric("Compute EVSM");

    this._batchState.reset();   // Reset the batch Ids...
    target.changeRenderPlan(prevPlan);

    System.instance.applyRenderState(prevState);
    System.instance.context.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
    this.clearGraphics(false);
    this._isDrawing = false;
    this._isReady = true;
  }
}
