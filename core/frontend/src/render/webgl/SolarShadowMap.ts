/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, assert, BeTimePoint } from "@bentley/bentleyjs-core";
import { RenderMemory, RenderSolarShadowMap, RenderGraphic, RenderClipVolume } from "../System";
import { Vector3d, Point3d, Matrix3d, Matrix4d, Transform, Range3d } from "@bentley/geometry-core";
import { ModelSelectorState } from "../../ModelSelectorState";
import { CategorySelectorState } from "../../CategorySelectorState";
import { Matrix4 } from "./Matrix";
import { Target } from "./Target";
import { Texture, TextureHandle } from "./Texture";
import { FrameBuffer } from "./FrameBuffer";
import { SceneContext } from "../../ViewContext";
import { TileTree, Tile } from "../../tile/TileTree";
import { IModelConnection } from "../../IModelConnection";
import { Frustum, FrustumPlanes, RenderTexture, RenderMode, SolarShadows } from "@bentley/imodeljs-common";
import { System } from "./System";
import { RenderState } from "./RenderState";
import { BatchState, BranchStack } from "./BranchState";
import { RenderCommands } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";

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
export class SolarShadowMap extends RenderSolarShadowMap implements RenderMemory.Consumer {

  private _doFitToFrustum = true;
  private _depthTexture?: Texture;
  private _fbo?: FrameBuffer;
  private _direction?: Vector3d;
  private _models?: ModelSelectorState;
  private _categories?: CategorySelectorState;
  private _projectionMatrix = new Matrix4();
  private _graphics: RenderGraphic[] = [];
  private _shadowFrustum = new Frustum();
  private _viewFrustum = new Frustum();
  private _status = Status.OutOfSynch;
  private _settings = new SolarShadows.Settings();
  public get isReady() { return this._status === Status.TextureReady; }
  public get projectionMatrix(): Matrix4 { return this._projectionMatrix; }
  public get depthTexture(): Texture | undefined { return this._depthTexture; }
  public get settings(): SolarShadows.Settings { return this._settings; }
  public addGraphic(graphic: RenderGraphic) { this._graphics.push(graphic); }
  private static _scratchRange = Range3d.createNull();
  private static _scratchTransform = Transform.createIdentity();

  public constructor() {
    super();
  }
  public get requiresSynch() { return this._status === Status.OutOfSynch; }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._depthTexture)
      stats.addShadowMap(this._depthTexture.bytesUsed);
  }
  public dispose() {
    this._depthTexture = dispose(this._depthTexture);
    this._fbo = dispose(this._fbo);
    this.clearGraphics();
  }
  public set(viewFrustum: Frustum, direction: Vector3d, settings: SolarShadows.Settings, models: ModelSelectorState, categories: CategorySelectorState) {
    const minimumHorizonDirection = -.1;
    this._settings = settings.clone();
    if (direction.z > minimumHorizonDirection) {
      this._status = Status.BelowHorizon;
      return;
    }
    if (this._doFitToFrustum && !this._viewFrustum.equals(viewFrustum)) {
      this._status = Status.OutOfSynch;
      this._viewFrustum.setFrom(viewFrustum);
    }

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
      this._status = Status.OutOfSynch;
    }
  }

  private forEachTileTree(iModel: IModelConnection, func: (tileTree: TileTree) => void) {
    if (this._models) {
      for (const modelId of this._models.models) {
        const model = iModel.models.getLoaded(modelId);
        const model3d = undefined !== model ? model.asGeometricModel3d : undefined;
        if (undefined !== model3d && undefined !== model3d.tileTree) {
          func(model3d.tileTree);
        }
      }
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
    for (const modelId of this._models.models) {
      const model = iModel.models.getLoaded(modelId);
      const model3d = undefined !== model ? model.asGeometricModel3d : undefined;
      if (undefined !== model3d && model3d.loadStatus < TileTree.LoadStatus.Loaded) {
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
        const viewPlanes = new FrustumPlanes(this._viewFrustum);
        this.forEachTileTree(iModel, (tileTree) => tileTree.accumlateTransformedRange(viewTileRange, worldToMap, viewPlanes));
        if (!viewTileRange.isNull)
          shadowRange.intersect(viewTileRange, shadowRange);
      }
      const projectRange = worldToMapTransform.multiplyRange(iModel.projectExtents, SolarShadowMap._scratchRange);
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
    const frustumPlanes = new FrustumPlanes(this._shadowFrustum);
    const originalMissingTileCount = sceneContext.missingTiles.entries.length;
    this.forEachTileTree(iModel, ((tileTree) => {
      const drawArgs = SolarShadowMapDrawArgs.create(sceneContext, this, tileTree, frustumPlanes);
      const tileToMapTransform = worldToMapTransform.multiplyTransformTransform(tileTree.location, SolarShadowMap._scratchTransform);
      const selectedTiles = tileTree.selectTiles(drawArgs);

      for (const selectedTile of selectedTiles) {
        tileRange.extendRange(tileToMapTransform.multiplyRange(selectedTile.range, SolarShadowMap._scratchRange));
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

    const shadowMapWidth = 4096;
    const shadowMapHeight = shadowMapWidth;   // TBD - Adjust for aspect ratio.
    if (undefined === this._fbo || undefined === this._depthTexture) {
      const depthTextureHandle = System.instance.createDepthBuffer(shadowMapWidth, shadowMapHeight) as TextureHandle;
      if (undefined === depthTextureHandle ||
        undefined === (this._fbo = FrameBuffer.create([], depthTextureHandle))) {
        assert(false, "Failed to create shadow depth buffer");
        return;
      }
      this._depthTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), depthTextureHandle);
    }

    const prevState = System.instance.currentRenderState.clone();
    System.instance.context.viewport(0, 0, shadowMapWidth, shadowMapHeight);

    const state = new RenderState();
    state.flags.depthMask = true;
    state.flags.blend = false;
    state.flags.depthTest = true;

    const viewFlags = target.currentViewFlags.clone();
    viewFlags.renderMode = RenderMode.SmoothShade;
    viewFlags.transparency = false;
    viewFlags.textures = false;
    viewFlags.sourceLights = false;
    viewFlags.cameraLights = false;
    viewFlags.solarLight = false;
    viewFlags.shadows = false;
    viewFlags.noGeometryMap = true;
    viewFlags.monochrome = false;
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    const batchState = new BatchState();
    System.instance.applyRenderState(state);
    const prevPlan = target.plan;

    target.changeFrustum(this._shadowFrustum, this._shadowFrustum.getFraction(), true);
    target.branchStack.setViewFlags(viewFlags);

    const renderCommands = new RenderCommands(target, new BranchStack(), batchState);
    renderCommands.addGraphics(this._graphics);

    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      System.instance.context.clearDepth(1.0);
      System.instance.context.clear(GL.BufferBit.Depth);
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaqueGeneral), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
    });

    batchState.reset();   // Reset the batch Ids...
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    System.instance.applyRenderState(prevState);
    System.instance.context.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
    this.clearGraphics();
    this._status = Status.TextureReady;
  }
}
