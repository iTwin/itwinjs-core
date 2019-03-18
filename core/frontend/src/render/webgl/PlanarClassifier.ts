/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, BeTimePoint, assert } from "@bentley/bentleyjs-core";
import { FrameBuffer } from "./FrameBuffer";
import { RenderMemory, RenderGraphic, RenderPlanarClassifier } from "../System";
import { Texture, TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Matrix4 } from "./Matrix";
import { SpatialClassification } from "../../SpatialClassification";
import { SceneContext } from "../../ViewContext";
import { GeometricModelState } from "../../ModelState";
import { TileTree, Tile } from "../../tile/TileTree";
import { Frustum, FrustumPlanes, RenderTexture, RenderMode } from "@bentley/imodeljs-common";
import { ViewportQuadGeometry } from "./CachedGeometry";
import { Plane3dByOriginAndUnitNormal, Point3d, Vector3d, Range3d, Transform, Matrix3d, ClipVector } from "@bentley/geometry-core";
import { System } from "./System";
import { TechniqueId } from "./TechniqueId";
import { getDrawParams } from "./SceneCompositor";
import { BatchState, BranchStack } from "./BranchState";
import { Batch, Branch } from "./Graphic";
import { RenderState } from "./RenderState";
import { RenderCommands } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";

class PlanarClassifierDrawArgs extends Tile.DrawArgs {
  constructor(private _classifierPlanes: FrustumPlanes, private _classifier: PlanarClassifier, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: ClipVector) {
    super(context, location, root, now, purgeOlderThan, clip);
  }
  public get frustumPlanes(): FrustumPlanes { return this._classifierPlanes; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty) {
      this._classifier.addGraphic(this.context.createBranch(this.graphics, this.location));
    }
  }

  public static create(context: SceneContext, classifier: PlanarClassifier, tileTree: TileTree, planes: FrustumPlanes) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new PlanarClassifierDrawArgs(planes, classifier, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVector);
  }
}

export class PlanarClassifier extends RenderPlanarClassifier implements RenderMemory.Consumer {
  private _colorTexture?: Texture;
  private _featureTexture?: Texture;
  private _hiliteTexture?: Texture;
  private _fbo?: FrameBuffer;
  private _hiliteFbo?: FrameBuffer;
  private _projectionMatrix = new Matrix4();
  private _graphics: RenderGraphic[] = [];
  private _frustum?: Frustum;
  private _width = 0;
  private _height = 0;
  private _baseBatchId = 0;
  private _anyHilited = false;
  private _plane = Plane3dByOriginAndUnitNormal.create(new Point3d(0, 0, 0), new Vector3d(0, 0, 1))!;    // TBD -- Support other planes - default to X-Y for now.
  private static _scratchFrustum = new Frustum();

  private constructor(private _classifierProperties: SpatialClassification.Properties) { super(); }
  public get colorTexture(): Texture | undefined { return this._colorTexture; }
  public get featureTexture(): Texture | undefined { return this._featureTexture; }
  public get hiliteTexture(): Texture | undefined { return this._hiliteTexture; }
  public get projectionMatrix(): Matrix4 { return this._projectionMatrix; }
  public get properties(): SpatialClassification.Properties { return this._classifierProperties; }
  public get baseBatchId(): number { return this._baseBatchId; }
  public get anyHilited(): boolean { return this._anyHilited; }
  public get insideDisplay(): SpatialClassification.Display { return this._classifierProperties.flags.inside; }
  public get outsideDisplay(): SpatialClassification.Display { return this._classifierProperties.flags.outside; }
  public addGraphic(graphic: RenderGraphic) { this._graphics.push(graphic); }

  public static create(properties: SpatialClassification.Properties, tileTree: TileTree, classifiedModel: GeometricModelState, sceneContext: SceneContext): PlanarClassifier {
    const classifier = new PlanarClassifier(properties);
    classifier.drawScene(sceneContext, classifiedModel, tileTree);
    return classifier;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._colorTexture)
      stats.addPlanarClassifier(this._colorTexture.bytesUsed);
    if (undefined !== this._featureTexture)
      stats.addPlanarClassifier(this._featureTexture.bytesUsed);
    if (undefined !== this._hiliteTexture)
      stats.addPlanarClassifier(this._hiliteTexture.bytesUsed);
  }
  public dispose() {
    this._colorTexture = dispose(this._colorTexture);
    this._featureTexture = dispose(this._featureTexture);
    this._hiliteTexture = dispose(this._hiliteTexture);
    this._fbo = dispose(this._fbo);
    this._hiliteFbo = dispose(this._hiliteFbo);
  }

  public push(exec: ShaderProgramExecutor) {
    if (undefined !== this._colorTexture)
      exec.target.planarClassifiers.push(this);
  }
  public pop(target: Target) {
    if (undefined !== this._colorTexture)
      target.planarClassifiers.pop();
  }
  private pushBatches(batchState: BatchState, graphics: RenderGraphic[]) {
    graphics.forEach((graphic) => {
      if (graphic instanceof Batch) {
        batchState.push(graphic as Batch, true);
        batchState.pop();
      } else if (graphic instanceof Branch) {
        const branch = graphic as Branch;
        this.pushBatches(batchState, branch.branch.entries);
      }
    });
  }

  public pushBatchState(batchState: BatchState) {
    this._baseBatchId = batchState.nextBatchId - 1;
    if (undefined !== this._graphics)
      this.pushBatches(batchState, this._graphics);
  }
  private static extendRangeByTiles(range: Range3d, frustumPlanes: FrustumPlanes, tile: Tile, treeTransform: Transform, matrix: Matrix3d) {
    const box = Frustum.fromRange(tile.range, PlanarClassifier._scratchFrustum);
    box.transformBy(treeTransform, box);
    if (FrustumPlanes.Containment.Outside === frustumPlanes.computeFrustumContainment(box))
      return;
    if (tile.children === undefined) {
      matrix.multiplyVectorArrayInPlace(box.points);
      range.extendArray(box.points);
    } else {
      for (const child of tile.children)
        this.extendRangeByTiles(range, frustumPlanes, child, treeTransform, matrix);
    }
  }

  private computeClassifiedRange(viewFrustum: Frustum, classifiedModel: GeometricModelState, matrix: Matrix3d): Range3d {
    const range = Range3d.createNull();
    if (classifiedModel.tileTree !== undefined) {
      PlanarClassifier.extendRangeByTiles(range, new FrustumPlanes(viewFrustum), classifiedModel.tileTree.rootTile, classifiedModel.tileTree.location, matrix);
    } else {
      const corners = new Array<Point3d>(8);
      for (let i = 0; i < 8; i++)
        corners[i] = viewFrustum.getCorner(i);

      matrix.multiplyVectorArrayInPlace(corners);
      range.extendArray(corners);
    }
    range.low.z = Math.min(range.low.z, -.0001);    // Always include classification plane.
    range.high.z = Math.max(range.high.z, .0001);
    return range;
  }

  public drawScene(context: SceneContext, classifiedModel: GeometricModelState, tileTree: TileTree) {
    const classifierZ = this._plane.getNormalRef();
    if (undefined === context.viewFrustum)
      return;

    const viewX = context.viewFrustum.rotation.rowX();
    const viewZ = context.viewFrustum.rotation.rowZ();
    const minCrossMagnitude = 1.0E-4;

    if (viewZ === undefined)
      return;       // View without depth?....

    let classifierX = viewZ.crossProduct(classifierZ);
    let classifierY;
    if (classifierX.magnitude() < minCrossMagnitude) {
      classifierY = viewX.crossProduct(classifierZ);
      classifierX = classifierY.crossProduct(classifierZ).normalize()!;
    } else {
      classifierX.normalizeInPlace();
      classifierY = classifierZ.crossProduct(classifierX).normalize()!;
    }

    const classifierMatrix = Matrix3d.createRows(classifierX, classifierY, classifierZ);
    const range = this.computeClassifiedRange(context.viewFrustum.getFrustum(), classifiedModel, classifierMatrix);

    this._frustum = Frustum.fromRange(range);
    classifierMatrix.transposeInPlace();
    classifierMatrix.multiplyVectorArrayInPlace(this._frustum.points);
    this._projectionMatrix.initFromMatrix4d(this._frustum.toMap4d()!.transform0);

    const drawArgs = PlanarClassifierDrawArgs.create(context, this, tileTree, new FrustumPlanes(this._frustum));
    tileTree.draw(drawArgs);
  }
  public draw(target: Target) {
    if (undefined === this._frustum) {
      assert(false);
      return;
    }

    if (this._graphics === undefined)
      return;

    const requiredHeight = 2 * Math.max(target.viewRect.width, target.viewRect.height);     // TBD - Size to classified area.
    const requiredWidth = requiredHeight;

    if (requiredWidth !== this._width || requiredHeight !== this._height)
      this.dispose();

    this._width = requiredWidth;
    this._height = requiredHeight;

    if (undefined === this._fbo) {
      const colorTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      const featureTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      if (undefined === colorTextureHandle ||
        undefined === featureTextureHandle ||
        undefined === (this._fbo = FrameBuffer.create([colorTextureHandle, featureTextureHandle]))) {
        assert(false, "Failed to create planar classifier texture");
        return;
      }
      this._colorTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), colorTextureHandle);
      this._featureTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), featureTextureHandle);
    }

    const prevState = System.instance.currentRenderState.clone();
    System.instance.context.viewport(0, 0, this._width, this._height);

    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    const viewFlags = target.currentViewFlags.clone();
    viewFlags.renderMode = RenderMode.SmoothShade;
    viewFlags.transparency = false;
    viewFlags.textures = false;
    viewFlags.sourceLights = false;
    viewFlags.cameraLights = false;
    viewFlags.solarLight = false;
    viewFlags.shadows = false;
    viewFlags.noGeometryMap = true;
    viewFlags.acsTriad = false;
    viewFlags.grid = false;
    viewFlags.monochrome = false;
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;

    const batchState = new BatchState();
    System.instance.applyRenderState(state);
    const prevPlan = target.plan;
    const prevBgColor = target.bgColor.clone();

    target.bgColor.tbgr = 0xff000000;    // Avoid white on white reversal.
    target.changeFrustum(this._frustum, this._frustum.getFraction(), true);
    target.branchStack.setViewFlags(viewFlags);

    const renderCommands = new RenderCommands(target, new BranchStack(), batchState);
    renderCommands.addGraphics(this._graphics);

    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      const clearPickAndColor = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);
      target.techniques.draw(getDrawParams(target, clearPickAndColor!));
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaqueGeneral), RenderPass.OpaqueGeneral);
      target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.OpaquePlanar);
    });
    const hiliteCommands = renderCommands.getCommands(RenderPass.Hilite);
    if (false !== (this._anyHilited = 0 !== hiliteCommands.length)) {
      if (undefined === this._hiliteFbo) {
        const hiliteTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
        this._hiliteTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), hiliteTextureHandle!);
        if (undefined === hiliteTextureHandle || undefined === (this._hiliteFbo = FrameBuffer.create([hiliteTextureHandle!]))) {
          assert(false, "Failed to create planar classifier hilite texture");
          return;
        }
      }

      System.instance.frameBufferStack.execute(this._hiliteFbo, true, () => {
        System.instance.context.clearColor(0, 0, 0, 0);
        System.instance.context.clear(GL.BufferBit.Color);
        target.techniques.execute(target, hiliteCommands, RenderPass.Hilite);
      });
    }

    batchState.reset();   // Reset the batch Ids...
    target.bgColor.setFrom(prevBgColor);
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    System.instance.applyRenderState(prevState);
    System.instance.context.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
  }
}
