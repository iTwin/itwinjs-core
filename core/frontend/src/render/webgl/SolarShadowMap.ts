/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, assert, BeTimePoint } from "@bentley/bentleyjs-core";
import { RenderMemory, RenderSolarShadowMap, RenderGraphic, RenderClipVolume } from "../System";
import { Vector3d, Point3d, Matrix3d, Matrix4d, Transform, Range3d, Geometry } from "@bentley/geometry-core";
import { ModelSelectorState } from "../../ModelSelectorState";
import { CategorySelectorState } from "../../CategorySelectorState";
import { SpatialViewState } from "../../ViewState";
import { Matrix4 } from "./Matrix";
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
import { RenderCommands } from "./DrawCommand";
import { RenderPass, TextureUnit } from "./RenderFlags";
import { EVSMGeometry } from "./CachedGeometry";
import { getDrawParams } from "./ScratchDrawParams";

class SolarShadowMapDrawArgs extends Tile.DrawArgs {
  constructor(private _mapFrustumPlanes: FrustumPlanes, private _shadowMap: SolarShadowMap, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip);
  }
  public get frustumPlanes(): FrustumPlanes { return this._mapFrustumPlanes; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty) {
      this._shadowMap.addGraphic(this.context.createBranch(this.graphics, this.location));
    }
  }

  public static create(context: SceneContext, shadowMap: SolarShadowMap, tileTree: TileTree, planes: FrustumPlanes) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new SolarShadowMapDrawArgs(planes, shadowMap, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}

const enum Status { BelowHorizon, OutOfSynch, WaitingForTiles, GraphicsReady, TextureReady }

const shadowMapWidth = 4096;  // size of original depth buffer map
const shadowMapHeight = shadowMapWidth; // TBD - Adjust for aspect ratio.
const evsmWidth = shadowMapWidth / 2;  // EVSM buffer is 1/2 size each direction
const evsmHeight = shadowMapHeight / 2;

// Bundles up the disposable, create-once-and-reuse members of a SolarShadowMap.
class Bundle {
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

  public dispose(): void {
    dispose(this.depthTexture);
    dispose(this.shadowMapTexture);
    dispose(this.fbo);
    dispose(this.fboSM);
    dispose(this.evsmGeom);
  }
}

export class SolarShadowMap extends RenderSolarShadowMap implements RenderMemory.Consumer {
  private _bundle?: Bundle;
  private _doFitToFrustum = true;
  private _direction?: Vector3d;
  private _models?: ModelSelectorState;
  private _categories?: CategorySelectorState;
  private _projectionMatrix = new Matrix4();
  private _graphics: RenderGraphic[] = [];
  private _shadowFrustum = new Frustum();
  private _viewFrustum = new Frustum();
  private _status = Status.OutOfSynch;
  private _settings = new SolarShadows.Settings();
  private _treeRefs: TileTree.Reference[] = [];
  private readonly _scratchRange = Range3d.createNull();
  private readonly _scratchTransform = Transform.createIdentity();
  private readonly _scratchFrustumPlanes = new FrustumPlanes();
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _renderState: RenderState;
  private readonly _noZRenderState: RenderState;
  private readonly _branchStack = new BranchStack();
  private readonly _batchState: BatchState;

  private getBundle(target: Target): Bundle | undefined {
    if (undefined === this._bundle) {
      this._bundle = Bundle.create(target, this._branchStack, this._batchState);
      assert(undefined !== this._bundle);
    }

    return this._bundle;
  }

  public get isReady() { return this._status === Status.TextureReady; }
  public get projectionMatrix(): Matrix4 { return this._projectionMatrix; }
  public get depthTexture(): Texture | undefined { return undefined !== this._bundle ? this._bundle.depthTexture : undefined; }
  public get shadowMapTexture(): Texture | undefined { return undefined !== this._bundle ? this._bundle.shadowMapTexture : undefined; }
  public get settings(): SolarShadows.Settings { return this._settings; }
  public get direction(): Vector3d | undefined { return this._direction; }
  public addGraphic(graphic: RenderGraphic) { this._graphics.push(graphic); }

  public constructor() {
    super();

    this._renderState = new RenderState();
    this._renderState.flags.depthMask = true;
    this._renderState.flags.blend = false;
    this._renderState.flags.depthTest = true;

    this._noZRenderState = new RenderState();
    this._noZRenderState.flags.depthMask = false;

    this._batchState = new BatchState(this._branchStack);
  }

  public get requiresSynch() { return this._status === Status.OutOfSynch; }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const bundle = this._bundle;
    if (undefined !== bundle)
      stats.addShadowMap(bundle.depthTexture.bytesUsed + bundle.shadowMapTexture.bytesUsed);
  }
  public dispose() {
    this._bundle = dispose(this._bundle);
    this.clearGraphics();
  }
  public set(viewFrustum: Frustum, direction: Vector3d, settings: SolarShadows.Settings, view: SpatialViewState) {
    const minimumHorizonDirection = -.01;
    this._settings = settings.clone();
    if (direction.z > minimumHorizonDirection) {
      this._status = Status.BelowHorizon;
      return;
    }

    if (this._doFitToFrustum && !this._viewFrustum.equals(viewFrustum)) {
      this._status = Status.OutOfSynch;
      this._viewFrustum.setFrom(viewFrustum);
    }

    // ###TODO: Scene does not get invalidated when only category selector changes...probably needs to when shadows are enabled - otherwise shadow map still shows shadows from invisible geometry
    // until camera moves.
    const models = view.modelSelector;
    const categories = view.categorySelector;

    if (undefined === this._direction ||
      !this._direction.isAlmostEqual(direction) ||
      undefined === this._models ||
      !this._models!.equalState(models) ||
      undefined === this._categories ||
      !this._categories!.equalState(categories)) {
      // The solar direction, models and categories have changed..
      this._direction = direction.clone();
      this._models = models.clone();
      this._categories = categories.clone();

      this._treeRefs.length = 0;
      view.forEachModelTreeRef((treeRef) => this._treeRefs.push(treeRef));

      this._status = Status.OutOfSynch;
    }
  }

  private forEachTileTree(func: (tileTree: TileTree) => void) {
    for (const treeRef of this._treeRefs) {
      const tree = treeRef.treeOwner.load();
      if (undefined !== tree)
        func(tree);
    }
  }

  private clearGraphics() {
    for (const graphic of this._graphics)
      graphic.dispose();

    this._graphics.length = 0;
  }

  public collectGraphics(sceneContext: SceneContext) {
    if (this.isReady)
      return;

    const iModel = sceneContext.viewport.iModel;
    if (this._status === Status.BelowHorizon)
      return;
    if (this._direction === undefined ||
      this._models === undefined ||
      this._categories === undefined) {
      assert(false);
      return;
    }

    for (const treeRef of this._treeRefs) {
      if (treeRef.treeOwner.loadStatus < TileTree.LoadStatus.Loaded) {
        this._status = Status.WaitingForTiles;
        return;
      }
    }

    const worldToMapTransform = Transform.createRefs(Point3d.createZero(), Matrix3d.createRigidHeadsUp(this._direction.negate()).inverse()!);
    const worldToMap = Matrix4d.createTransform(worldToMapTransform);
    const mapToWorld = worldToMap.createInverse()!;

    const backgroundOn = sceneContext.viewFlags.backgroundMap;
    let shadowRange;
    if (this._doFitToFrustum) {
      shadowRange = Range3d.createTransformedArray(worldToMapTransform, this._viewFrustum.points);

      // By fitting to the actual tiles we can reduce the shadowRange and make better use of the texture pixels.
      if (!backgroundOn) {
        const viewTileRange = Range3d.createNull();
        this._scratchFrustumPlanes.init(this._viewFrustum);
        this.forEachTileTree((tileTree) => tileTree.accumulateTransformedRange(viewTileRange, worldToMap, this._scratchFrustumPlanes));
        if (!viewTileRange.isNull)
          shadowRange.intersect(viewTileRange, shadowRange);
      }

      const projectRange = worldToMapTransform.multiplyRange(iModel.projectExtents, this._scratchRange);
      shadowRange.low.x = Math.max(shadowRange.low.x, projectRange.low.x);
      shadowRange.high.x = Math.min(shadowRange.high.x, projectRange.high.x);
      shadowRange.low.y = Math.max(shadowRange.low.y, projectRange.low.y);
      shadowRange.high.y = Math.min(shadowRange.high.y, projectRange.high.y);
      shadowRange.high.z = projectRange.high.z;
    } else {
      shadowRange = worldToMapTransform.multiplyRange(iModel.projectExtents);
    }

    if (shadowRange.isNull) {
      return;
    }

    this._shadowFrustum.initFromRange(shadowRange);
    mapToWorld.multiplyPoint3dArrayQuietNormalize(this._shadowFrustum.points);

    const tileRange = Range3d.createNull();
    this._scratchFrustumPlanes.init(this._shadowFrustum);
    const originalMissingTileCount = sceneContext.missingTiles.entries.length;
    this.forEachTileTree(((tileTree) => {
      const drawArgs = SolarShadowMapDrawArgs.create(sceneContext, this, tileTree, this._scratchFrustumPlanes);
      const tileToMapTransform = worldToMapTransform.multiplyTransformTransform(tileTree.location, this._scratchTransform);
      const selectedTiles = tileTree.selectTiles(drawArgs);

      for (const selectedTile of selectedTiles) {
        tileRange.extendRange(tileToMapTransform.multiplyRange(selectedTile.range, this._scratchRange));
        selectedTile.drawGraphics(drawArgs);
      }

      drawArgs.drawGraphics();
      sceneContext.viewport.numSelectedTiles += selectedTiles.length;
    }));

    if (tileRange.isNull || sceneContext.missingTiles.entries.length > originalMissingTileCount) {
      this._status = Status.WaitingForTiles;
      this.clearGraphics();
    } else {
      this._status = Status.GraphicsReady;
      if (!backgroundOn) {
        shadowRange.intersect(tileRange, shadowRange);
        if (Geometry.isAlmostEqualNumber(shadowRange.low.x, shadowRange.high.x) ||
          Geometry.isAlmostEqualNumber(shadowRange.low.y, shadowRange.high.y) ||
          Geometry.isAlmostEqualNumber(shadowRange.low.z, shadowRange.high.z)) {
          this._status = Status.WaitingForTiles;
          this.clearGraphics();
          return;
        }

        this._shadowFrustum.initFromRange(shadowRange);
        mapToWorld.multiplyPoint3dArrayQuietNormalize(this._shadowFrustum.points);
      }

      const frustumMap = this._shadowFrustum.toMap4d();
      if (undefined === frustumMap) {
        assert(false);
        return;
      }

      this._projectionMatrix.initFromMatrix4d(frustumMap.transform0);
    }
  }

  public draw(target: Target) {
    if (this._status !== Status.GraphicsReady)
      return;

    const bundle = this.getBundle(target);
    if (undefined === bundle)
      return;

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
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    System.instance.applyRenderState(this._renderState);
    const prevPlan = target.plan;

    target.changeFrustum(this._shadowFrustum, this._shadowFrustum.getFraction(), true);
    target.branchStack.setViewFlags(viewFlags);

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
    gl.activeTexture(TextureUnit.ShadowMap);
    gl.bindTexture(gl.TEXTURE_2D, bundle.shadowMapTexture.texture.getHandle()!);
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
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    System.instance.applyRenderState(prevState);
    System.instance.context.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
    this.clearGraphics();
    this._status = Status.TextureReady;
  }
}
