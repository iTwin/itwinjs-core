/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, BeTimePoint, assert } from "@bentley/bentleyjs-core";
import { FrameBuffer } from "./FrameBuffer";
import { RenderClipVolume, RenderGraphic } from "../System";
import { Texture, TextureHandle } from "./Texture";
import { Target } from "./Target";
import { SceneContext } from "../../ViewContext";
import { TileTree } from "../../tile/TileTree";
import { Tile } from "../../tile/Tile";
import { Frustum, FrustumPlanes, RenderTexture } from "@bentley/imodeljs-common";
import { Transform, Matrix4d, Map4d } from "@bentley/geometry-core";
import { System } from "./System";
import { BatchState, BranchStack } from "./BranchState";
import { RenderCommands } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";
import { ViewState3d } from "../../ViewState";
import { PlanarTextureProjection } from "./PlanarTextureProjection";
import { TextureDrape } from "./TextureDrape";
import { BackgroundMapTileTreeReference } from "../../tile/WebMapTileTree";

class BackgroundMapDrapeDrawArgs extends Tile.DrawArgs {
  constructor(private _drapePlanes: FrustumPlanes, private _terrainDrape: BackgroundMapDrape, private _worldToViewMap: Map4d, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip);
  }
  public get frustumPlanes(): FrustumPlanes { return this._drapePlanes; }
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty) {
      this._terrainDrape.addGraphic(this.context.createBranch(this.graphics, this.location));
    }
  }

  public static create(context: SceneContext, texture: BackgroundMapDrape, tileTree: TileTree, planes: FrustumPlanes, worldToViewMap: Map4d) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new BackgroundMapDrapeDrawArgs(planes, texture, worldToViewMap, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}

/** @internal */
export class BackgroundMapDrape extends TextureDrape {
  private _fbo?: FrameBuffer;
  private _graphics?: RenderGraphic[];
  private _frustum?: Frustum;
  private _width = 0;
  private _height = 0;
  private _mapTree: BackgroundMapTileTreeReference;
  private _drapedTree: TileTree;
  private static _postProjectionMatrix = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, -1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private constructor(drapedTree: TileTree, mapTree: BackgroundMapTileTreeReference) {
    super();
    this._drapedTree = drapedTree;
    this._mapTree = mapTree;
  }

  public dispose() {
    super.dispose();
    this._fbo = dispose(this._fbo);
  }

  public addGraphic(graphic: RenderGraphic) { this._graphics!.push(graphic); }

  public static create(draped: TileTree, map: BackgroundMapTileTreeReference): BackgroundMapDrape {
    return new BackgroundMapDrape(draped, map);
  }

  public collectGraphics(context: SceneContext) {
    this._graphics = [];
    if (undefined === context.viewFrustum)
      return;

    const viewState = context.viewFrustum!.view as ViewState3d;
    if (undefined === viewState)
      return;

    const tileTree = this._mapTree.treeOwner.load();
    if (undefined === tileTree)
      return;

    const requiredWidth = 2 * Math.max(context.target.viewRect.width, context.target.viewRect.height);     // TBD - Size to textured area.
    const requiredHeight = requiredWidth;

    if (requiredWidth !== this._width || requiredHeight !== this._height)
      this.dispose();

    this._width = requiredWidth;
    this._height = requiredHeight;

    const plane = this._mapTree.plane;
    const projection = PlanarTextureProjection.computePlanarTextureProjection(plane!, context.viewFrustum, this._drapedTree, viewState, this._width, this._height);
    if (!projection.textureFrustum || !projection.projectionMatrix || !projection.worldToViewMap)
      return;

    this._frustum = projection.textureFrustum;
    this._projectionMatrix = projection.projectionMatrix;

    const drawArgs = BackgroundMapDrapeDrawArgs.create(context, this, tileTree, new FrustumPlanes(this._frustum), projection.worldToViewMap);
    tileTree.draw(drawArgs);
  }

  public draw(target: Target) {
    if (undefined === this._frustum || undefined === this._graphics || this._graphics.length === 0)
      return;

    if (undefined === this._fbo) {
      const colorTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      if (undefined === colorTextureHandle) {
        assert(false, "Failed to create planar texture");
        return;
      }
      this._texture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), colorTextureHandle);
      this._fbo = FrameBuffer.create([colorTextureHandle]);
    }
    if (undefined === this._fbo) {
      assert(false, "unable to create frame buffer object");
      return;
    }

    const prevState = System.instance.currentRenderState.clone();
    System.instance.context.viewport(0, 0, this._width, this._height);

    const drawingParams = PlanarTextureProjection.getTextureDrawingParams(target);
    const stack = new BranchStack();
    const batchState = new BatchState(stack);
    System.instance.applyRenderState(drawingParams.state);
    const prevPlan = target.plan;
    const prevBgColor = target.bgColor.tbgr;

    target.bgColor.set(0, 0, 0, 0); // Avoid white on white reversal.
    target.changeFrustum(this._frustum, this._frustum.getFraction(), true);
    target.projectionMatrix.setFrom(BackgroundMapDrape._postProjectionMatrix.multiplyMatrixMatrix(target.projectionMatrix));
    target.branchStack.setViewFlags(drawingParams.viewFlags);

    const renderCommands = new RenderCommands(target, stack, batchState);
    renderCommands.addGraphics(this._graphics, RenderPass.OpaqueGeneral);

    const system = System.instance;
    const gl = system.context;
    const useMRT = System.instance.capabilities.supportsDrawBuffers;

    system.frameBufferStack.execute(this._fbo, true, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      if (!useMRT) target.compositor.currentRenderTargetIndex = 0;
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaqueGeneral), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
    });

    batchState.reset();   // Reset the batch Ids...
    target.bgColor.setTbgr(prevBgColor);
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    system.applyRenderState(prevState);
    gl.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
  }
}
