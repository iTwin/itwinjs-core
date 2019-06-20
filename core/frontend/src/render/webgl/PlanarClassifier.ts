/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, BeTimePoint, assert } from "@bentley/bentleyjs-core";
import { FrameBuffer } from "./FrameBuffer";
import { RenderClipVolume, RenderMemory, RenderGraphic, RenderPlanarClassifier } from "../System";
import { Texture, TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Matrix4 } from "./Matrix";
import { SceneContext } from "../../ViewContext";
import { TileTree } from "../../tile/TileTree";
import { Tile } from "../../tile/Tile";
import { Frustum, FrustumPlanes, RenderTexture, RenderMode, ColorDef, SpatialClassificationProps } from "@bentley/imodeljs-common";
import { ViewportQuadGeometry, CombineTexturesGeometry } from "./CachedGeometry";
import { Plane3dByOriginAndUnitNormal, Point3d, Vector3d, Transform, Matrix4d } from "@bentley/geometry-core";
import { System } from "./System";
import { TechniqueId } from "./TechniqueId";
import { getDrawParams } from "./ScratchDrawParams";
import { BatchState, BranchStack } from "./BranchState";
import { Batch, Branch } from "./Graphic";
import { RenderState } from "./RenderState";
import { RenderCommands } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";
import { FloatRgba } from "./FloatRGBA";
import { ViewState3d } from "../../ViewState";
import { PlanarTextureProjection } from "./PlanarTextureProjection";

class PlanarClassifierDrawArgs extends Tile.DrawArgs {
  constructor(private _classifierPlanes: FrustumPlanes, private _classifier: PlanarClassifier, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
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
    return new PlanarClassifierDrawArgs(planes, classifier, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}

/** @internal */
export class PlanarClassifier extends RenderPlanarClassifier implements RenderMemory.Consumer {
  private _colorTexture?: Texture;
  private _featureTexture?: Texture;
  private _hiliteTexture?: Texture;
  private _combinedTexture?: Texture;
  private _fbo?: FrameBuffer;
  private _featureFbo?: FrameBuffer;    // For multi-pass case only.
  private _hiliteFbo?: FrameBuffer;
  private _combinedFbo?: FrameBuffer;
  private _projectionMatrix = new Matrix4();
  private _graphics: RenderGraphic[] = [];
  private _frustum?: Frustum;
  private _width = 0;
  private _height = 0;
  private _baseBatchId = 0;
  private _anyHilited = false;
  private _plane = Plane3dByOriginAndUnitNormal.create(new Point3d(0, 0, 0), new Vector3d(0, 0, 1))!;    // TBD -- Support other planes - default to X-Y for now.
  private _postProjectionMatrix = Matrix4d.createRowValues(/* Row 1 */ 0, 1, 0, 0, /* Row 1 */ 0, 0, -1, 0, /* Row 3 */ 1, 0, 0, 0, /* Row 4 */ 0, 0, 0, 1);

  private constructor(private _classifier: SpatialClassificationProps.Classifier) { super(); }
  public get hiliteTexture(): Texture | undefined { return this._hiliteTexture; }
  public get combinedTexture(): Texture | undefined { return this._combinedTexture; }
  public get projectionMatrix(): Matrix4 { return this._projectionMatrix; }
  public get properties(): SpatialClassificationProps.Classifier { return this._classifier; }
  public get baseBatchId(): number { return this._baseBatchId; }
  public get anyHilited(): boolean { return this._anyHilited; }
  public get insideDisplay(): SpatialClassificationProps.Display { return this._classifier.flags.inside; }
  public get outsideDisplay(): SpatialClassificationProps.Display { return this._classifier.flags.outside; }
  public addGraphic(graphic: RenderGraphic) { this._graphics.push(graphic); }

  public static create(properties: SpatialClassificationProps.Classifier, tileTree: TileTree, classifiedTree: TileTree, sceneContext: SceneContext): PlanarClassifier {
    const classifier = new PlanarClassifier(properties);
    classifier.collectGraphics(sceneContext, classifiedTree, tileTree);
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
      exec.target.activePlanarClassifiers.push(this);
  }
  public pop(target: Target) {
    if (undefined !== this._colorTexture)
      target.activePlanarClassifiers.pop();
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

  public collectGraphics(context: SceneContext, classifiedTree: TileTree, tileTree: TileTree) {
    if (undefined === context.viewFrustum)
      return;

    const viewState = context.viewFrustum!.view as ViewState3d;
    if (undefined === viewState)
      return;

    const projection = PlanarTextureProjection.computePlanarTextureProjection(this._plane, context.viewFrustum, classifiedTree, viewState);
    if (!projection.textureFrustum || !projection.projectionMatrix)
      return;

    this._projectionMatrix = projection.projectionMatrix;
    this._frustum = projection.textureFrustum;

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

    const requiredHeight = 2 * Math.max(target.viewRect.width, target.viewRect.height);
    const requiredWidth = requiredHeight;

    if (requiredWidth !== this._width || requiredHeight !== this._height)
      this.dispose();

    this._width = requiredWidth;
    this._height = requiredHeight;
    const useMRT = System.instance.capabilities.supportsDrawBuffers;

    if (undefined === this._fbo) {
      const colorTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      const featureTextureHandle = TextureHandle.createForAttachment(this._width, this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      const combinedTextureHandle = TextureHandle.createForAttachment(this._width, 2 * this._height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      if (undefined === colorTextureHandle ||
        undefined === featureTextureHandle ||
        undefined === combinedTextureHandle) {
        assert(false, "Failed to create planar classifier texture");
        return;
      }

      this._colorTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), colorTextureHandle);
      this._featureTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), featureTextureHandle);
      this._combinedTexture = new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), combinedTextureHandle);
      if (useMRT)
        this._fbo = FrameBuffer.create([colorTextureHandle, featureTextureHandle]);
      else {
        this._fbo = FrameBuffer.create([colorTextureHandle]);
        this._featureFbo = FrameBuffer.create([featureTextureHandle]);
      }
      this._combinedFbo = FrameBuffer.create([combinedTextureHandle]);
    }

    if (undefined === this._fbo || (!useMRT && undefined === this._featureFbo)) {
      assert(false, "unable to create frame buffer objects");
      return;
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
    viewFlags.monochrome = false;
    viewFlags.materials = false;
    viewFlags.ambientOcclusion = false;
    viewFlags.visibleEdges = viewFlags.hiddenEdges = false;

    const batchState = new BatchState();
    System.instance.applyRenderState(state);
    const prevPlan = target.plan;
    const prevBgColor = FloatRgba.fromColorDef(ColorDef.white);
    prevBgColor.setFromFloatRgba(target.bgColor);

    target.bgColor.setFromColorDef(ColorDef.from(0, 0, 0, 255)); // Avoid white on white reversal.
    target.changeFrustum(this._frustum, this._frustum.getFraction(), true);
    target.projectionMatrix.setFrom(this._postProjectionMatrix.multiplyMatrixMatrix(target.projectionMatrix));
    target.branchStack.setViewFlags(viewFlags);

    const renderCommands = new RenderCommands(target, new BranchStack(), batchState);
    renderCommands.addGraphics(this._graphics);

    const system = System.instance;
    const gl = system.context;
    if (undefined !== this._featureFbo) {
      system.frameBufferStack.execute(this._fbo, true, () => {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(GL.BufferBit.Color);
        target.compositor.currentRenderTargetIndex = 0;
        target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
      });
      system.frameBufferStack.execute(this._featureFbo!, true, () => {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(GL.BufferBit.Color);
        target.compositor.currentRenderTargetIndex = 1;
        target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
      });
    } else {
      system.frameBufferStack.execute(this._fbo, true, () => {
        const clearPickAndColor = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);
        target.techniques.draw(getDrawParams(target, clearPickAndColor!));
        target.techniques.execute(target, renderCommands.getCommands(RenderPass.OpaquePlanar), RenderPass.PlanarClassification);    // Draw these with RenderPass.PlanarClassification (rather than Opaque...) so that the pick ordering is avoided.
      });
    }

    // Create combined texture with color followed by featureIds.
    system.frameBufferStack.execute(this._combinedFbo!, true, () => {
      gl.clearColor(0, 0, 0, 0);
      const combineTextures = CombineTexturesGeometry.createGeometry(this._colorTexture!.texture.getHandle()!, this._featureTexture!.texture.getHandle()!);
      target.techniques.draw(getDrawParams(target, combineTextures!));
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

      system.frameBufferStack.execute(this._hiliteFbo, true, () => {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(GL.BufferBit.Color);
        target.techniques.execute(target, hiliteCommands, RenderPass.Hilite);
      });
    }

    // Create combined texture with color followed by featureIds.  We do this to conserve texture units - could use color and feature textures directly otherwise.
    System.instance.context.viewport(0, 0, this._width, 2 * this._height);
    system.frameBufferStack.execute(this._combinedFbo!, true, () => {
      gl.clearColor(0, 0, 0, 0);
      const combineTextures = CombineTexturesGeometry.createGeometry(this._colorTexture!.texture.getHandle()!, this._featureTexture!.texture.getHandle()!);
      target.techniques.draw(getDrawParams(target, combineTextures!));
    });

    batchState.reset();   // Reset the batch Ids...
    target.bgColor.setFromFloatRgba(prevBgColor);
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    system.applyRenderState(prevState);
    gl.viewport(0, 0, target.viewRect.width, target.viewRect.height); // Restore viewport
  }
}
