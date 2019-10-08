/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { GL } from "./GL";
import { dispose, BeTimePoint } from "@bentley/bentleyjs-core";
import { FrameBuffer } from "./FrameBuffer";
import { RenderClipVolume, RenderMemory, RenderGraphic, RenderPlanarClassifier } from "../System";
import { Texture, TextureHandle } from "./Texture";
import { Target } from "./Target";
import { Matrix4 } from "./Matrix";
import { SceneContext } from "../../ViewContext";
import { TileTree } from "../../tile/TileTree";
import { Tile } from "../../tile/Tile";
import { Frustum, FrustumPlanes, RenderTexture, RenderMode, SpatialClassificationProps, ViewFlags, ColorDef } from "@bentley/imodeljs-common";
import { ViewportQuadGeometry, CombineTexturesGeometry } from "./CachedGeometry";
import { Plane3dByOriginAndUnitNormal, Point3d, Vector3d, Transform, Matrix4d, Map4d } from "@bentley/geometry-core";
import { System } from "./System";
import { TechniqueId } from "./TechniqueId";
import { getDrawParams } from "./ScratchDrawParams";
import { BatchState, BranchStack } from "./BranchState";
import { Batch, Branch } from "./Graphic";
import { RenderState } from "./RenderState";
import { DrawCommands, RenderCommands } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";
import { ViewState3d } from "../../ViewState";
import { PlanarTextureProjection } from "./PlanarTextureProjection";

export interface GraphicsCollector {
  addGraphic(graphic: RenderGraphic): void;
}

export class GraphicsCollectorDrawArgs extends Tile.DrawArgs {
  constructor(private _planes: FrustumPlanes, private _worldToViewMap: Map4d, private _collector: GraphicsCollector, context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: RenderClipVolume) {
    super(context, location, root, now, purgeOlderThan, clip);
  }
  public get frustumPlanes(): FrustumPlanes { return this._planes; }
  public get worldToViewMap(): Map4d { return this._worldToViewMap; }
  public drawGraphics(): void {
    if (!this.graphics.isEmpty)
      this._collector.addGraphic(this.context.createBranch(this.graphics, this.location));
  }

  public static create(context: SceneContext, collector: GraphicsCollector, tileTree: TileTree, planes: FrustumPlanes, worldToViewMap: Map4d) {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(tileTree.expirationTime);
    return new GraphicsCollectorDrawArgs(planes, worldToViewMap, collector, context, tileTree.location.clone(), tileTree, now, purgeOlderThan, tileTree.clipVolume);
  }
}

class Textures {
  private constructor(
    public readonly color: Texture,
    public readonly feature: Texture,
    public readonly hilite: Texture,
    public readonly combined: Texture) { }

  public dispose(): void {
    dispose(this.color);
    dispose(this.feature);
    dispose(this.hilite);
    dispose(this.combined);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addPlanarClassifier(this.color.bytesUsed);
    stats.addPlanarClassifier(this.feature.bytesUsed);
    stats.addPlanarClassifier(this.hilite.bytesUsed);
    stats.addPlanarClassifier(this.combined.bytesUsed);
  }

  public static create(width: number, height: number): Textures | undefined {
    const createHandle = (heightMult = 1.0) => TextureHandle.createForAttachment(width, height * heightMult, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    const hColor = createHandle();
    const hFeature = createHandle();
    const hCombined = createHandle(2.0);
    const hHilite = createHandle();
    if (!hColor || !hFeature || !hCombined || !hHilite)
      return undefined;

    const createTexture = (handle: TextureHandle) => new Texture(new RenderTexture.Params(undefined, RenderTexture.Type.TileSection, true), handle);
    const color = createTexture(hColor);
    const feature = createTexture(hFeature);
    const combined = createTexture(hCombined);
    const hilite = createTexture(hHilite);
    if (!color || !feature || !combined || !hilite)
      return undefined;

    return new Textures(color, feature, hilite, combined);
  }
}

abstract class FrameBuffers {
  protected constructor(
    public readonly textures: Textures,
    private readonly _hilite: FrameBuffer,
    private readonly _combine: FrameBuffer,
    private readonly _combineGeom: CombineTexturesGeometry) { }

  public dispose(): void {
    dispose(this.textures);
    dispose(this._hilite);
    dispose(this._combine);
    dispose(this._combineGeom);
  }

  public abstract draw(cmds: DrawCommands, target: Target): void;

  public drawHilite(cmds: DrawCommands, target: Target): void {
    const system = System.instance;
    const gl = system.context;
    system.frameBufferStack.execute(this._hilite, true, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      target.techniques.execute(target, cmds, RenderPass.Hilite);
    });
  }

  public compose(target: Target): void {
    const system = System.instance;
    const gl = system.context;
    system.frameBufferStack.execute(this._combine, true, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      target.techniques.draw(getDrawParams(target, this._combineGeom));
    });
  }

  public static create(width: number, height: number): FrameBuffers | undefined {
    const textures = Textures.create(width, height);
    if (undefined === textures)
      return undefined;

    const hiliteFbo = FrameBuffer.create([textures.hilite.texture]);
    if (undefined === hiliteFbo)
      return undefined;

    const combineFbo = FrameBuffer.create([textures.combined.texture]);
    if (undefined === combineFbo)
      return undefined;

    const combineGeom = CombineTexturesGeometry.createGeometry(textures.color.texture.getHandle()!, textures.feature.texture.getHandle()!);
    if (undefined === combineGeom)
      return undefined;

    if (System.instance.capabilities.supportsDrawBuffers)
      return MRTFrameBuffers.createMRT(textures, hiliteFbo, combineFbo, combineGeom);
    else
      return MPFrameBuffers.createMP(textures, hiliteFbo, combineFbo, combineGeom);
  }
}

class MRTFrameBuffers extends FrameBuffers {
  private readonly _fbo: FrameBuffer;
  private readonly _clearGeom: ViewportQuadGeometry;

  private constructor(textures: Textures, hilite: FrameBuffer, combine: FrameBuffer, combineGeom: CombineTexturesGeometry, fbo: FrameBuffer, geom: ViewportQuadGeometry) {
    super(textures, hilite, combine, combineGeom);
    this._fbo = fbo;
    this._clearGeom = geom;
  }

  public dispose(): void {
    dispose(this._fbo);
    dispose(this._clearGeom);
    super.dispose();
  }

  public static createMRT(textures: Textures, hilite: FrameBuffer, combine: FrameBuffer, combineGeom: CombineTexturesGeometry): MRTFrameBuffers | undefined {
    const fbo = FrameBuffer.create([textures.color.texture, textures.feature.texture]);
    if (undefined === fbo)
      return undefined;

    const geom = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);
    return undefined !== geom ? new MRTFrameBuffers(textures, hilite, combine, combineGeom, fbo, geom) : undefined;
  }

  public draw(cmds: DrawCommands, target: Target): void {
    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      target.techniques.draw(getDrawParams(target, this._clearGeom));
      target.techniques.execute(target, cmds, RenderPass.PlanarClassification);
    });
  }
}

class MPFrameBuffers extends FrameBuffers {
  private readonly _color: FrameBuffer;
  private readonly _feature: FrameBuffer;

  private constructor(textures: Textures, hilite: FrameBuffer, combine: FrameBuffer, combineGeom: CombineTexturesGeometry, color: FrameBuffer, feature: FrameBuffer) {
    super(textures, hilite, combine, combineGeom);
    this._color = color;
    this._feature = feature;
  }

  public dispose(): void {
    dispose(this._color);
    dispose(this._feature);
    super.dispose();
  }

  public static createMP(textures: Textures, hilite: FrameBuffer, combine: FrameBuffer, combineGeom: CombineTexturesGeometry): MPFrameBuffers | undefined {
    const color = FrameBuffer.create([textures.color.texture]);
    const feature = FrameBuffer.create([textures.feature.texture]);
    return undefined !== color && undefined !== feature ? new MPFrameBuffers(textures, hilite, combine, combineGeom, color, feature) : undefined;
  }

  public draw(cmds: DrawCommands, target: Target): void {
    const system = System.instance;
    const gl = system.context;
    const draw = (feature: boolean) => {
      const fbo = feature ? this._feature : this._color;
      system.frameBufferStack.execute(fbo, true, () => {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(GL.BufferBit.Color);
        target.compositor.currentRenderTargetIndex = feature ? 1 : 0;
        target.techniques.execute(target, cmds, RenderPass.PlanarClassification);
      });
    };

    draw(false);
    draw(true);
  }
}

const scratchPrevRenderState = new RenderState();
const scratchViewFlags = new ViewFlags();

/** @internal */
export class PlanarClassifier extends RenderPlanarClassifier implements RenderMemory.Consumer {
  private _buffers?: FrameBuffers;
  private _projectionMatrix = new Matrix4();
  private readonly _graphics: RenderGraphic[] = [];
  private _frustum?: Frustum;
  private _width = 0;
  private _height = 0;
  private _baseBatchId = 0;
  private _anyHilited = false;
  private _anyOpaque = false;
  private _anyTranslucent = false;
  private readonly _plane = Plane3dByOriginAndUnitNormal.create(new Point3d(0, 0, 0), new Vector3d(0, 0, 1))!;    // TBD -- Support other planes - default to X-Y for now.
  private readonly _classifier: SpatialClassificationProps.Classifier;
  private readonly _renderState = new RenderState();
  private readonly _renderCommands: RenderCommands;
  private readonly _branchStack = new BranchStack();
  private readonly _batchState: BatchState;
  private static _postProjectionMatrix = Matrix4d.createRowValues(
    0, 1, 0, 0,
    0, 0, -1, 0,
    1, 0, 0, 0,
    0, 0, 0, 1);
  private _debugFrustum?: Frustum;
  private _doDebugFrustum = false;
  private _debugFrustumGrahic?: RenderGraphic = undefined;

  private constructor(classifier: SpatialClassificationProps.Classifier, target: Target) {
    super();
    this._classifier = classifier;

    const flags = this._renderState.flags;
    flags.depthMask = flags.blend = flags.depthTest = false;

    this._batchState = new BatchState(this._branchStack);
    this._renderCommands = new RenderCommands(target, this._branchStack, this._batchState);
  }

  public getParams(params: Float32Array): void {
    params[0] = this.insideDisplay;
    params[1] = this.outsideDisplay;
  }

  public get hiliteTexture(): Texture | undefined { return undefined !== this._buffers ? this._buffers.textures.hilite : undefined; }
  public get texture(): Texture | undefined { return undefined !== this._buffers ? this._buffers.textures.combined : undefined; }
  public get projectionMatrix(): Matrix4 { return this._projectionMatrix; }
  public get properties(): SpatialClassificationProps.Classifier { return this._classifier; }
  public get baseBatchId(): number { return this._baseBatchId; }
  public get anyHilited(): boolean { return this._anyHilited; }
  public get anyOpaque(): boolean { return this._anyOpaque; }
  public get anyTranslucent(): boolean { return this._anyTranslucent; }
  public get insideDisplay(): SpatialClassificationProps.Display { return this._classifier.flags.inside; }
  public get outsideDisplay(): SpatialClassificationProps.Display { return this._classifier.flags.outside; }
  public addGraphic(graphic: RenderGraphic) {
    this._graphics.push(graphic);
  }

  public static create(properties: SpatialClassificationProps.Classifier, target: Target): PlanarClassifier {
    return new PlanarClassifier(properties, target);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._buffers)
      this._buffers.textures.collectStatistics(stats);
  }

  public dispose() {
    this._buffers = dispose(this._buffers);
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
    this._graphics.length = 0;
    if (undefined === context.viewFrustum)
      return;

    const viewState = context.viewFrustum!.view as ViewState3d;
    if (undefined === viewState)
      return;

    // TBD - Refine resolution calculation -- increase height based on viewing angle.
    const requiredHeight = Math.max(context.target.viewRect.width, context.target.viewRect.height);
    const requiredWidth = requiredHeight;

    if (requiredWidth !== this._width || requiredHeight !== this._height)
      this.dispose();

    this._width = requiredWidth;
    this._height = requiredHeight;

    const projection = PlanarTextureProjection.computePlanarTextureProjection(this._plane, context.viewFrustum, classifiedTree, tileTree, viewState, this._width, this._height);
    if (!projection.textureFrustum || !projection.projectionMatrix || !projection.worldToViewMap)
      return;

    this._projectionMatrix = projection.projectionMatrix;
    this._frustum = projection.textureFrustum;
    this._debugFrustum = projection.debugFrustum;

    const drawArgs = GraphicsCollectorDrawArgs.create(context, this, tileTree, new FrustumPlanes(this._frustum), projection.worldToViewMap);
    tileTree.draw(drawArgs);

    if (this._doDebugFrustum) {
      this._debugFrustumGrahic = dispose(this._debugFrustumGrahic);
      const builder = context.createSceneGraphicBuilder();

      builder.setSymbology(ColorDef.green, ColorDef.green, 1);
      builder.addFrustum(context.viewFrustum.getFrustum());
      builder.setSymbology(ColorDef.red, ColorDef.red, 1);
      builder.addFrustum(this._debugFrustum!);
      builder.setSymbology(ColorDef.white, ColorDef.white, 1);
      builder.addFrustum(this._frustum);
      this._debugFrustumGrahic = builder.finish();
    }
  }

  public draw(target: Target) {
    if (undefined === this._frustum)
      return;

    if (undefined === this._buffers) {
      this._buffers = FrameBuffers.create(this._width, this._height);
      if (undefined === this._buffers)
        return;
    }

    if (undefined !== this._debugFrustumGrahic)
      target.scene.push(this._debugFrustumGrahic);

    // Temporarily override the Target's state.
    const system = System.instance;
    const prevState = system.currentRenderState.clone(scratchPrevRenderState);
    system.context.viewport(0, 0, this._width, this._height);

    const vf = target.currentViewFlags.clone(scratchViewFlags);
    vf.renderMode = RenderMode.SmoothShade;
    vf.transparency = true;
    vf.noGeometryMap = true;
    vf.textures = vf.lighting = vf.shadows = false;
    vf.monochrome = vf.materials = vf.ambientOcclusion = false;
    vf.visibleEdges = vf.hiddenEdges = false;

    system.applyRenderState(this._renderState);
    const prevPlan = target.plan;

    const prevBgColor = target.bgColor.tbgr;
    target.bgColor.set(0, 0, 0, 0); // Avoid white on white reversal.

    target.changeFrustum(this._frustum, this._frustum.getFraction(), true);
    target.projectionMatrix.setFrom(PlanarClassifier._postProjectionMatrix.multiplyMatrixMatrix(target.projectionMatrix));
    target.branchStack.setViewFlags(vf);

    const renderCommands = this._renderCommands;
    renderCommands.reset(target, this._branchStack, this._batchState);
    renderCommands.addGraphics(this._graphics);

    // Draw the classifiers into our attachments.
    // When using Display.ElementColor, the color and transparency come from the classifier geometry. Therefore we may need to draw the classified geometry
    // in a different pass - or both passes - depending on the transparency of the classifiers.
    // NB: "Outside" geometry by definition cannot take color/transparency from element...
    const cmds = renderCommands.getCommands(RenderPass.OpaquePlanar);

    // NB: We don't strictly require the classifier geometry to be planar, and sometimes (e.g., "planar" polyface/bspsurf) we do not detect planarity.
    cmds.push(...renderCommands.getCommands(RenderPass.OpaqueGeneral));
    this._anyOpaque = cmds.length > 0;
    const transCmds = renderCommands.getCommands(RenderPass.Translucent);
    if (transCmds.length > 0) {
      cmds.push(...transCmds);
      this._anyTranslucent = true;
    }

    this._buffers.draw(cmds, target);

    // Draw any hilited classifiers.
    const hiliteCommands = renderCommands.getCommands(RenderPass.Hilite);
    this._anyHilited = 0 !== hiliteCommands.length;
    if (this._anyHilited)
      this._buffers.drawHilite(hiliteCommands, target);

    // Create combined texture with color followed by featureIds.  We do this to conserve texture units - could use color and feature textures directly otherwise.
    system.context.viewport(0, 0, this._width, 2 * this._height);
    this._buffers.compose(target);

    // Reset the Target's state.
    this._batchState.reset();
    target.bgColor.setTbgr(prevBgColor);
    if (prevPlan)
      target.changeRenderPlan(prevPlan);

    system.applyRenderState(prevState);
    system.context.viewport(0, 0, target.viewRect.width, target.viewRect.height);
  }
}
