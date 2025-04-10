/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { BeEvent, dispose } from "@itwin/core-bentley";
import {
  ColorDef, Frustum, FrustumPlanes, RenderMode, RenderTexture, SpatialClassifierInsideDisplay, SpatialClassifierOutsideDisplay, TextureTransparency,
} from "@itwin/core-common";
import { Matrix4d, Plane3dByOriginAndUnitNormal, Point3d, Range3d, Vector3d } from "@itwin/core-geometry";
import { PlanarClipMaskState } from "../../../PlanarClipMaskState";
import { GraphicsCollectorDrawArgs, SpatialClassifierTileTreeReference, TileTreeReference } from "../../../tile/internal";
import { SceneContext } from "../../../ViewContext";
import { FeatureSymbology } from "../../../render/FeatureSymbology";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { RenderMemory } from "../../../render/RenderMemory";
import { PlanarClassifierTarget, RenderPlanarClassifier } from "../RenderPlanarClassifier";
import { BatchState } from "./BatchState";
import { BranchStack } from "./BranchStack";
import { CachedGeometry, Combine3TexturesGeometry, CombineTexturesGeometry, ViewportQuadGeometry } from "./CachedGeometry";
import { WebGLDisposable } from "./Disposable";
import { DrawCommands } from "./DrawCommand";
import { FrameBuffer } from "./FrameBuffer";
import { GL } from "./GL";
import { Batch, Branch } from "./Graphic";
import { PlanarTextureProjection } from "./PlanarTextureProjection";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { RenderState } from "./RenderState";
import { getDrawParams } from "./ScratchDrawParams";
import { System } from "./System";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { Texture, TextureHandle } from "./Texture";
import { ActiveSpatialClassifier } from "../../../SpatialClassifiersState";

export enum PlanarClassifierContent { None = 0, MaskOnly = 1, ClassifierOnly = 2, ClassifierAndMask = 3 }

function createTexture(handle: TextureHandle): Texture {
  return new Texture({
    handle,
    ownership: "external",
    type: RenderTexture.Type.TileSection,
    transparency: TextureTransparency.Opaque,
  });
}

function createTextureHandle(width: number, height: number, heightMult = 1.0) {
  return TextureHandle.createForAttachment(width, height * heightMult, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
}

class ClassifierTextures implements WebGLDisposable {
  private constructor(public readonly color: Texture,
    public readonly feature: Texture,
    public readonly hilite: Texture) { }

  public get isDisposed(): boolean {
    return this.color.isDisposed
      && this.feature.isDisposed
      && this.hilite.isDisposed;
  }

  public [Symbol.dispose](): void {
    dispose(this.color);
    dispose(this.feature);
    dispose(this.hilite);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addPlanarClassifier(this.color.bytesUsed);
    stats.addPlanarClassifier(this.feature.bytesUsed);
    stats.addPlanarClassifier(this.hilite.bytesUsed);
  }

  public static create(width: number, height: number): ClassifierTextures | undefined {
    const hColor = createTextureHandle(width, height);
    const hFeature = createTextureHandle(width, height);
    const hHilite = createTextureHandle(width, height);
    if (!hColor || !hFeature || !hHilite)
      return undefined;

    const color = createTexture(hColor);
    const feature = createTexture(hFeature);
    const hilite = createTexture(hHilite);
    if (!color || !feature || !hilite)
      return undefined;

    return new ClassifierTextures(color, feature, hilite);
  }
}

class ClassifierFrameBuffers implements WebGLDisposable {
  private constructor(
    public readonly textures: ClassifierTextures,
    private readonly _hilite: FrameBuffer,
    private readonly _fbo: FrameBuffer,
    private readonly _clearGeom: ViewportQuadGeometry) {
  }

  public get isDisposed(): boolean {
    return this.textures.isDisposed && this._hilite.isDisposed && this._fbo.isDisposed && this._clearGeom.isDisposed;
  }

  public [Symbol.dispose](): void {
    dispose(this._fbo);
    dispose(this._clearGeom);
    dispose(this.textures);
    dispose(this._hilite);
  }

  public draw(cmds: DrawCommands, target: Target): void {
    System.instance.frameBufferStack.execute(this._fbo, true, false, () => {
      target.techniques.draw(getDrawParams(target, this._clearGeom));
      target.techniques.execute(target, cmds, RenderPass.PlanarClassification);
    });
  }

  public drawHilite(cmds: DrawCommands, target: Target): void {
    const system = System.instance;
    const gl = system.context;
    system.frameBufferStack.execute(this._hilite, true, false, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      target.techniques.execute(target, cmds, RenderPass.Hilite);
    });
  }

  public static create(width: number, height: number): ClassifierFrameBuffers | undefined {
    const textures = ClassifierTextures.create(width, height);
    if (undefined === textures)
      return undefined;

    const hiliteFbo = FrameBuffer.create([textures.hilite.texture]);
    if (undefined === hiliteFbo)
      return undefined;

    const fbo = FrameBuffer.create([textures.color.texture, textures.feature.texture]);
    if (undefined === fbo)
      return undefined;

    const geom = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);
    return undefined !== geom ? new this(textures, hiliteFbo, fbo, geom) : undefined;
  }
}

interface TextureAndFbo {
  texture: Texture;
  fbo: FrameBuffer;
}

abstract class SingleTextureFrameBuffer implements WebGLDisposable {
  public texture: Texture;
  protected fbo: FrameBuffer;
  public get isDisposed(): boolean { return this.texture.isDisposed && this.fbo.isDisposed; }
  public collectStatistics(stats: RenderMemory.Statistics): void { stats.addPlanarClassifier(this.texture.bytesUsed); }
  protected constructor(textureAndFbo: TextureAndFbo) {
    this.texture = textureAndFbo.texture;
    this.fbo = textureAndFbo.fbo;
  }
  public [Symbol.dispose](): void {
    dispose(this.texture);
    dispose(this.fbo);
  }
  public static createTextureAndFrameBuffer(width: number, height: number): TextureAndFbo | undefined {
    const hTexture = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    if (!hTexture)
      return undefined;

    const texture = new Texture({ type: RenderTexture.Type.TileSection, ownership: "external", handle: hTexture, transparency: TextureTransparency.Opaque });
    if (!texture)
      return undefined;

    const fbo = FrameBuffer.create([texture.texture]);
    if (undefined === fbo)
      return undefined;

    return { texture, fbo };
  }
}
class MaskFrameBuffer extends SingleTextureFrameBuffer {
  public static create(width: number, height: number): MaskFrameBuffer | undefined {
    const textureFbo = SingleTextureFrameBuffer.createTextureAndFrameBuffer(width, height);
    return undefined === textureFbo ? undefined : new MaskFrameBuffer(textureFbo);
  }
  public draw(cmds: DrawCommands, target: Target): void {
    const system = System.instance;
    const gl = system.context;

    system.frameBufferStack.execute(this.fbo, true, false, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      target.techniques.execute(target, cmds, RenderPass.PlanarClassification);
    });
  }
}
abstract class CombineTexturesFrameBuffer extends SingleTextureFrameBuffer {
  constructor(textureAndFbo: TextureAndFbo, private _combineGeom: CachedGeometry, private _width: number, private _height: number, private _heightMult: number) { super(textureAndFbo); }
  public compose(target: Target): void {
    const system = System.instance;
    const gl = system.context;
    system.context.viewport(0, 0, this._width, this._heightMult * this._height);
    system.frameBufferStack.execute(this.fbo, true, false, () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(GL.BufferBit.Color);
      target.techniques.draw(getDrawParams(target, this._combineGeom));
    });
  }
}

class ClassifierCombinationBuffer extends CombineTexturesFrameBuffer {
  public static create(width: number, height: number, classifierColor: Texture, classifierFeature: Texture): ClassifierAndMaskCombinationBuffer | undefined {
    const combineGeom = CombineTexturesGeometry.createGeometry(classifierColor.texture.getHandle()!, classifierFeature.texture.getHandle()!);
    if (undefined === combineGeom)
      return undefined;

    const textureFbo = SingleTextureFrameBuffer.createTextureAndFrameBuffer(width, 2 * height);
    return undefined === textureFbo ? undefined : new ClassifierCombinationBuffer(textureFbo, combineGeom, width, height, 2);
  }
}
class ClassifierAndMaskCombinationBuffer extends CombineTexturesFrameBuffer {
  public static create(width: number, height: number, classifierColor: Texture, classifierFeature: Texture, mask: Texture): ClassifierAndMaskCombinationBuffer | undefined {
    const combineGeom = Combine3TexturesGeometry.createGeometry(classifierColor.texture.getHandle()!, classifierFeature.texture.getHandle()!, mask.texture.getHandle()!);
    if (undefined === combineGeom)
      return undefined;

    const textureFbo = SingleTextureFrameBuffer.createTextureAndFrameBuffer(width, 3 * height);
    return undefined === textureFbo ? undefined : new ClassifierAndMaskCombinationBuffer(textureFbo, combineGeom, width, height, 3);
  }
}

const scratchPrevRenderState = new RenderState();

/** @internal */
export class PlanarClassifier extends RenderPlanarClassifier implements RenderMemory.Consumer, WebGLDisposable {
  private _classifierBuffers?: ClassifierFrameBuffers;
  private _maskBuffer?: MaskFrameBuffer;
  private _classifierCombinedBuffer?: ClassifierCombinationBuffer;
  private _classifierAndMaskCombinedBuffer?: ClassifierAndMaskCombinationBuffer;
  private _projectionMatrix = Matrix4d.createIdentity();
  private _graphics?: RenderGraphic[];
  private readonly _classifierGraphics: RenderGraphic[] = [];
  private readonly _maskGraphics: RenderGraphic[] = [];
  private _frustum?: Frustum;
  private _width = 0;
  private _height = 0;
  private _baseBatchId = 0;
  private _anyHilited = false;
  private _anyOpaque = false;
  private _anyTranslucent = false;
  private _classifier?: ActiveSpatialClassifier;
  private readonly _plane = Plane3dByOriginAndUnitNormal.create(new Point3d(0, 0, 0), new Vector3d(0, 0, 1))!;    // TBD -- Support other planes - default to X-Y for now.
  private readonly _renderState = new RenderState();
  private readonly _renderCommands: RenderCommands;
  private readonly _branchStack = new BranchStack();
  private readonly _batchState: BatchState;
  private _planarClipMask?: PlanarClipMaskState;
  private _classifierTreeRef?: SpatialClassifierTileTreeReference;
  private _planarClipMaskOverrides?: FeatureSymbology.Overrides;
  private _contentMode: PlanarClassifierContent = PlanarClassifierContent.None;
  private _removeMe?: () => void;
  private _featureSymbologySource: FeatureSymbology.Source = {
    onSourceDisposed: new BeEvent<() => void>(),
  };;

  private static _postProjectionMatrix = Matrix4d.createRowValues(
    0, 1, 0, 0,
    0, 0, -1, 0,
    1, 0, 0, 0,
    0, 0, 0, 1);
  private _debugFrustum?: Frustum;
  private _doDebugFrustum = false;
  private _debugFrustumGraphic?: RenderGraphic = undefined;
  private _isClassifyingPointCloud?: boolean; // we will detect this the first time we draw
  private readonly _bgColor = ColorDef.from(0, 0, 0, 255);

  private constructor(classifier: ActiveSpatialClassifier | undefined, target: Target) {
    super();
    this._classifier = classifier;

    const flags = this._renderState.flags;
    flags.depthMask = flags.blend = flags.depthTest = false;

    this._batchState = new BatchState(this._branchStack);
    this._renderCommands = new RenderCommands(target, this._branchStack, this._batchState);
  }
  public get textureImageCount(): number { return this._contentMode; }

  public getParams(params: Float32Array): void {
    params[0] = this.insideDisplay;
    params[1] = this.outsideDisplay;
    params[2] = this._contentMode;
    if (this._planarClipMask?.settings.invert)   // If the mask sense is inverted, negate the contentMode to indicate this to the shader.
      params[2] = - params[2];

    params[3] = (this._planarClipMask?.settings.transparency === undefined) ? -1 : this._planarClipMask.settings.transparency;

  }

  public get hiliteTexture(): Texture | undefined { return undefined !== this._classifierBuffers ? this._classifierBuffers.textures.hilite : undefined; }
  public get projectionMatrix(): Matrix4d { return this._projectionMatrix; }
  // public get properties(): SpatialClassifier { return this._classifier; }
  public get baseBatchId(): number { return this._baseBatchId; }
  public get anyHilited(): boolean { return this._anyHilited; }
  public get anyOpaque(): boolean { return this._anyOpaque; }
  public get anyTranslucent(): boolean { return this._anyTranslucent; }
  public get insideDisplay(): SpatialClassifierInsideDisplay { return this._classifier ? this._classifier.flags.inside : SpatialClassifierInsideDisplay.Off; }
  public get outsideDisplay(): SpatialClassifierOutsideDisplay { return this._classifier ? this._classifier.flags.outside : SpatialClassifierOutsideDisplay.On; }
  public get isClassifyingPointCloud(): boolean { return true === this._isClassifyingPointCloud; }

  public addGraphic(graphic: RenderGraphic) {
    this._graphics!.push(graphic);
  }

  public static create(properties: ActiveSpatialClassifier | undefined, target: Target): PlanarClassifier {
    return new PlanarClassifier(properties, target);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._classifierBuffers)
      this._classifierBuffers.textures.collectStatistics(stats);

    if (undefined !== this._maskBuffer)
      this._maskBuffer.collectStatistics(stats);

    if (undefined !== this._classifierCombinedBuffer)
      this._classifierCombinedBuffer.collectStatistics(stats);

    if (undefined !== this._classifierAndMaskCombinedBuffer)
      this._classifierAndMaskCombinedBuffer.collectStatistics(stats);
  }

  public get isDisposed(): boolean { return undefined === this._classifierBuffers; }

  public [Symbol.dispose]() {
    this._classifierBuffers = dispose(this._classifierBuffers);
    this._maskBuffer = dispose(this._maskBuffer);
    this._classifierCombinedBuffer = dispose(this._classifierCombinedBuffer);
    this._classifierAndMaskCombinedBuffer = dispose(this._classifierAndMaskCombinedBuffer);
    if (this._removeMe) {
      this._removeMe();
      this._removeMe = undefined;
    }
    this._featureSymbologySource.onSourceDisposed.raiseEvent();
  }

  public get texture(): Texture | undefined {
    switch (this._contentMode) {
      case PlanarClassifierContent.None:
        return undefined;
      case PlanarClassifierContent.ClassifierOnly:
        return this._classifierCombinedBuffer?.texture;
      case PlanarClassifierContent.MaskOnly:
        return this._maskBuffer?.texture;
      case PlanarClassifierContent.ClassifierAndMask:
        return this._classifierAndMaskCombinedBuffer?.texture;
    }
  }
  public getOrCreateClassifierTexture(): Texture | undefined {
    if (undefined === this._classifierBuffers)
      this._classifierBuffers = ClassifierFrameBuffers.create(this._width, this._height);
    if (undefined !== this._classifierBuffers && undefined === this._classifierCombinedBuffer)
      this._classifierCombinedBuffer = ClassifierCombinationBuffer.create(this._width, this._height, this._classifierBuffers.textures.color, this._classifierBuffers.textures.feature);

    return this._classifierCombinedBuffer?.texture;
  }

  private pushBatches(batchState: BatchState, graphics: RenderGraphic[]) {
    graphics.forEach((graphic) => {
      if (graphic instanceof Batch) {
        batchState.push(graphic, true);
        batchState.pop();
      } else if (graphic instanceof Branch) {
        this.pushBatches(batchState, graphic.branch.entries);
      }
    });
  }
  public get sourceTransparency() {
    return this._classifierTreeRef?.transparency;
  }

  public pushBatchState(batchState: BatchState) {
    this._baseBatchId = batchState.nextBatchId - 1;
    if (undefined !== this._classifierGraphics)
      this.pushBatches(batchState, this._classifierGraphics);
  }

  public setSource(classifierTreeRef?: SpatialClassifierTileTreeReference, planarClipMask?: PlanarClipMaskState) {
    this._classifierTreeRef = classifierTreeRef;
    this._classifier = classifierTreeRef?.activeClassifier;
    this._planarClipMask = planarClipMask;
  }

  public collectGraphics(context: SceneContext, target: PlanarClassifierTarget): void {
    this._classifierGraphics.length = this._maskGraphics.length = 0;
    if (undefined === context.viewingSpace)
      return;

    const viewState = context.viewingSpace.view;
    if (!viewState.isSpatialView())
      return;

    this._doDebugFrustum = context.target.debugControl?.displayMaskFrustum ?? false;

    const maxTextureSize = System.instance.maxTexSizeAllow;
    const requiredHeight = maxTextureSize;
    const requiredWidth = maxTextureSize;
    if (requiredWidth !== this._width || requiredHeight !== this._height)
      this[Symbol.dispose]();

    this._width = requiredWidth;
    this._height = requiredHeight;
    const maskRange = Range3d.createNull();
    const maskTrees = this._planarClipMask?.getTileTrees(context, target.modelId, maskRange);
    if (!maskTrees && !this._classifierTreeRef)
      return;

    const allTrees = maskTrees ? maskTrees.slice() : new Array<TileTreeReference>();
    if (this._classifierTreeRef)
      allTrees.push(this._classifierTreeRef);

    const projection = PlanarTextureProjection.computePlanarTextureProjection(this._plane, context, target, allTrees, viewState, this._width, this._height, maskRange);
    if (!projection.textureFrustum || !projection.projectionMatrix || !projection.worldToViewMap)
      return;

    this._projectionMatrix = projection.projectionMatrix;
    this._frustum = projection.textureFrustum;
    this._debugFrustum = projection.debugFrustum;
    this._planarClipMaskOverrides = this._planarClipMask?.getPlanarClipMaskSymbologyOverrides(context, this._featureSymbologySource);
    if (!this._planarClipMask?.usingViewportOverrides && this._removeMe) {
      this._removeMe();
      this._removeMe = undefined;
    } else if (this._planarClipMask?.usingViewportOverrides && !this._removeMe) {
      this._removeMe = context.viewport.onFeatureOverridesChanged.addListener(() => {
        this._planarClipMaskOverrides = this._planarClipMask?.getPlanarClipMaskSymbologyOverrides(context, this._featureSymbologySource);
        context.viewport.requestRedraw();
      });
    }

    const drawTree = (treeRef: TileTreeReference, graphics: RenderGraphic[]) => {
      this._graphics = graphics;
      const frustumPlanes = this._frustum ? FrustumPlanes.fromFrustum(this._frustum) : FrustumPlanes.createEmpty();
      const drawArgs = GraphicsCollectorDrawArgs.create(context, this, treeRef, frustumPlanes, projection.worldToViewMap!);
      if (undefined !== drawArgs)
        treeRef.draw(drawArgs);

      this._graphics = undefined;
    };
    if (this._classifierTreeRef)
      drawTree(this._classifierTreeRef, this._classifierGraphics);

    if (maskTrees)
      maskTrees.forEach((maskTree) => drawTree(maskTree, this._maskGraphics));

    // Shader behaves slightly differently when classifying surfaces vs point clouds.
    this._isClassifyingPointCloud = target.isPointCloud;

    if (this._doDebugFrustum) {
      this._debugFrustumGraphic = dispose(this._debugFrustumGraphic);
      const builder = context.createSceneGraphicBuilder();

      builder.setSymbology(ColorDef.green, ColorDef.green, 2);
      builder.addFrustum(context.viewingSpace.getFrustum());
      builder.setSymbology(ColorDef.red, ColorDef.red, 2);
      builder.addFrustum(this._debugFrustum!);
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 2);
      builder.addFrustum(this._frustum);

      builder.setSymbology(ColorDef.from(0, 200, 0, 222), ColorDef.from(0, 200, 0, 222), 2);
      builder.addFrustumSides(context.viewingSpace.getFrustum());
      builder.setSymbology(ColorDef.from(200, 0, 0, 222), ColorDef.from(200, 0, 0, 222), 2);
      builder.addFrustumSides(this._debugFrustum!);
      builder.setSymbology(ColorDef.from(0, 0, 200, 222), ColorDef.from(0, 0, 200, 222), 2);
      builder.addFrustumSides(this._frustum);
      this._debugFrustumGraphic = builder.finish();
      context.outputGraphic(this._debugFrustumGraphic);
    }
  }

  public draw(target: Target) {
    if (undefined === this._frustum)
      return;

    this._contentMode = PlanarClassifierContent.None;
    let combinationBuffer: ClassifierCombinationBuffer | undefined;
    if (this._classifierGraphics.length === 0) {
      if (this._maskGraphics.length === 0) {
        return;
      } else {
        if (undefined === this._maskBuffer) {
          this._maskBuffer = MaskFrameBuffer.create(this._width, this._height);
          if (undefined === this._maskBuffer)
            return;
        }
        this._contentMode = PlanarClassifierContent.MaskOnly;
      }
    } else {
      if (undefined === this._classifierBuffers) {
        this._classifierBuffers = ClassifierFrameBuffers.create(this._width, this._height);
        if (undefined === this._classifierBuffers)
          return;
      }
      if (this._maskGraphics.length === 0) {
        if (undefined === this._classifierCombinedBuffer) {
          combinationBuffer = this._classifierCombinedBuffer = ClassifierCombinationBuffer.create(this._width, this._height, this._classifierBuffers.textures.color, this._classifierBuffers.textures.feature);
          if (undefined === this._classifierCombinedBuffer)
            return;
        }
        this._contentMode = PlanarClassifierContent.ClassifierOnly;
        combinationBuffer = this._classifierCombinedBuffer;
      } else {
        if (undefined === this._maskBuffer) {
          this._maskBuffer = MaskFrameBuffer.create(this._width, this._height);
          if (undefined === this._maskBuffer)
            return;
        }
        if (undefined === this._classifierAndMaskCombinedBuffer) {
          combinationBuffer = this._classifierAndMaskCombinedBuffer = ClassifierAndMaskCombinationBuffer.create(this._width, this._height, this._classifierBuffers.textures.color, this._classifierBuffers.textures.feature, this._maskBuffer.texture);
          if (undefined === this._classifierAndMaskCombinedBuffer)
            return;
        }
        combinationBuffer = this._classifierAndMaskCombinedBuffer;
        this._contentMode = PlanarClassifierContent.ClassifierAndMask;
      }
    }

    // Temporarily override the Target's state.
    const system = System.instance;
    const maskViewFlags = {
      renderMode: RenderMode.SmoothShade,
      wiremesh: false,
      transparency: !this.isClassifyingPointCloud, // point clouds don't support transparency.
      textures: false,
      lighting: false,
      shadows: false,
      monochrome: false,
      materials: false,
      ambientOcclusion: false,
      visibleEdges: false,
      hiddenEdges: false,
    };
    const prevState = system.currentRenderState.clone(scratchPrevRenderState);
    system.context.viewport(0, 0, this._width, this._height);
    const vf = target.currentViewFlags.copy(this._classifierTreeRef ? this._classifierTreeRef.viewFlags : maskViewFlags);

    system.applyRenderState(this._renderState);
    const prevPlan = target.plan;
    const prevOverrides = target.currentFeatureSymbologyOverrides;

    target.uniforms.style.changeBackgroundColor(this._bgColor); // Avoid white on white reversal. Will be reset in changeRenderPlan below.
    target.changeFrustum(this._frustum, this._frustum.getFraction(), true);
    this._anyTranslucent = false;

    const prevProjMatrix = target.uniforms.frustum.projectionMatrix;
    target.uniforms.frustum.changeProjectionMatrix(PlanarClassifier._postProjectionMatrix.multiplyMatrixMatrix(prevProjMatrix));
    target.uniforms.branch.changeRenderPlan(vf, target.plan.is3d, target.plan.hline);

    const addCmds = (oldCmds: DrawCommands, newCmds: DrawCommands) => {
      if (undefined === newCmds)
        return oldCmds;
      if (newCmds.length > 50000) {
      	// This method is slower for smaller array sizes, but when the size of newCmds gets larger it's performance is ok.
        return oldCmds.concat(newCmds);
      } else {
      	// This method runs faster, but gets a stack overflow when the size of newCmds is too large.
        oldCmds.push(...newCmds);
        return oldCmds;
      }
    }

    const renderCommands = this._renderCommands;
    const getDrawCommands = (graphics: RenderGraphic[]) => {
      this._batchState.reset();
      renderCommands.reset(target, this._branchStack, this._batchState);
      renderCommands.collectGraphicsForPlanarProjection(graphics);

      // Draw the classifiers into our attachments.
      // When using Display.ElementColor, the color and transparency come from the classifier geometry. Therefore we may need to draw the classified geometry
      // in a different pass - or both passes - depending on the transparency of the classifiers.
      // NB: "Outside" geometry by definition cannot take color/transparency from element...
      let cmds = renderCommands.getCommands(RenderPass.OpaquePlanar);

      // NB: We don't strictly require the classifier geometry to be planar, and sometimes (e.g., "planar" polyface/bspsurf) we do not detect planarity.
      cmds = addCmds(cmds, renderCommands.getCommands(RenderPass.OpaqueGeneral));
      cmds = addCmds(cmds, renderCommands.getCommands(RenderPass.OpaqueLinear));
      this._anyOpaque = cmds.length > 0;
      const transCmds = renderCommands.getCommands(RenderPass.Translucent);
      if (transCmds.length > 0) {
        cmds = addCmds(cmds, renderCommands.getCommands(RenderPass.Translucent));
        this._anyTranslucent = true;
      }
      return cmds;
    };

    if (this._classifierGraphics.length > 0 && this._classifierBuffers) {
      this._classifierBuffers.draw(getDrawCommands(this._classifierGraphics), target);

      // Draw any hilited classifiers.
      const hiliteCommands = renderCommands.getCommands(RenderPass.Hilite);
      this._anyHilited = 0 !== hiliteCommands.length;
      if (this._anyHilited)
        this._classifierBuffers.drawHilite(hiliteCommands, target);
    }
    if (this._maskGraphics.length > 0 && this._maskBuffer) {
      if (this._planarClipMaskOverrides)
        target.overrideFeatureSymbology(this._planarClipMaskOverrides);
      if (this._planarClipMask && this._planarClipMask.settings.transparency !== undefined && this._planarClipMask.settings.transparency > 0.0)
        this._anyTranslucent = true;

      this._maskBuffer.draw(getDrawCommands(this._maskGraphics), target);

    }
    if (combinationBuffer)
      combinationBuffer.compose(target);

    this._batchState.reset();
    target.changeRenderPlan(prevPlan);
    target.overrideFeatureSymbology(prevOverrides);

    system.applyRenderState(prevState);
    system.context.viewport(0, 0, target.viewRect.width, target.viewRect.height);
  }
}

