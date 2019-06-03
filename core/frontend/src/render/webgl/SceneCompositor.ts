/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FrameBuffer, DepthBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ViewportQuadGeometry, CompositeGeometry, CopyPickBufferGeometry, SingleTexturedViewportQuadGeometry, CachedGeometry, AmbientOcclusionGeometry, BlurGeometry } from "./CachedGeometry";
import { Vector2d, Vector3d } from "@bentley/geometry-core";
import { TechniqueId } from "./TechniqueId";
import { System, RenderType, DepthType } from "./System";
import { PackedFeatureTable, Pixel, GraphicList } from "../System";
import { ViewRect } from "../../Viewport";
import { assert, Id64, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { RenderCommands, ShaderProgramParams, DrawParams, DrawCommands, BatchPrimitiveCommand } from "./DrawCommand";
import { RenderState } from "./RenderState";
import { CompositeFlags, RenderPass, RenderOrder } from "./RenderFlags";
import { BatchState } from "./BranchState";
import { Feature } from "@bentley/imodeljs-common";
import { Debug } from "./Diagnostics";

let progParams: ShaderProgramParams | undefined;
let drawParams: DrawParams | undefined;

/** @internal */
export function getDrawParams(target: Target, geometry: CachedGeometry): DrawParams {
  if (undefined === progParams) {
    progParams = new ShaderProgramParams();
    drawParams = new DrawParams();
  }

  progParams.init(target);
  drawParams!.init(progParams, geometry);
  return drawParams!;
}

// Maintains the textures used by a SceneCompositor. The textures are reallocated when the dimensions of the viewport change.
class Textures implements IDisposable {
  public accumulation?: TextureHandle;
  public revealage?: TextureHandle;
  public color?: TextureHandle;
  public featureId?: TextureHandle;
  public depthAndOrder?: TextureHandle;
  public hilite?: TextureHandle;
  public occlusion?: TextureHandle;
  public occlusionBlur?: TextureHandle;

  public dispose() {
    this.accumulation = dispose(this.accumulation);
    this.revealage = dispose(this.revealage);
    this.color = dispose(this.color);
    this.featureId = dispose(this.featureId);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.hilite = dispose(this.hilite);
    this.occlusion = dispose(this.occlusion);
    this.occlusionBlur = dispose(this.occlusionBlur);
  }

  public init(width: number, height: number): boolean {
    assert(undefined === this.accumulation);

    let pixelDataType: GL.Texture.DataType = GL.Texture.DataType.UnsignedByte;
    switch (System.instance.capabilities.maxRenderType) {
      case RenderType.TextureFloat: {
        pixelDataType = GL.Texture.DataType.Float;
        break;
      }
      case RenderType.TextureHalfFloat: {
        const ext = System.instance.capabilities.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float");
        if (undefined !== ext) {
          pixelDataType = ext.HALF_FLOAT_OES;
          break;
        }
      }
      /* falls through */
      case RenderType.TextureUnsignedByte: {
        break;
      }
    }

    // NB: Both of these must be of the same type, because they are borrowed by pingpong and bound to the same frame buffer.
    this.accumulation = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, pixelDataType);
    this.revealage = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, pixelDataType);

    // Hilite texture is a simple on-off, but the smallest texture format WebGL allows us to use as output is RGBA with a byte per component.
    this.hilite = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    this.color = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    this.featureId = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.depthAndOrder = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    return undefined !== this.accumulation
      && undefined !== this.revealage
      && undefined !== this.color
      && undefined !== this.featureId
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite;
  }

  public enableOcclusion(width: number, height: number): boolean {
    assert(undefined === this.occlusion && undefined === this.occlusionBlur);
    this.occlusion = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.occlusionBlur = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    return undefined !== this.occlusion && undefined !== this.occlusionBlur;
  }

  public disableOcclusion(): void {
    assert(undefined !== this.occlusion && undefined !== this.occlusionBlur);
    this.occlusion = dispose(this.occlusion);
    this.occlusionBlur = dispose(this.occlusionBlur);
  }
}

// Maintains the framebuffers used by a SceneCompositor. The color attachments are supplied by a Textures object.
class FrameBuffers implements IDisposable {
  public opaqueColor?: FrameBuffer;
  public opaqueAndCompositeColor?: FrameBuffer;
  public depthAndOrder?: FrameBuffer;
  public hilite?: FrameBuffer;
  public hiliteUsingStencil?: FrameBuffer;
  public stencilSet?: FrameBuffer;
  public occlusion?: FrameBuffer;
  public occlusionBlur?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    const boundColor = System.instance.frameBufferStack.currentColorBuffer;
    if (undefined === boundColor)
      return false;

    this.opaqueColor = FrameBuffer.create([boundColor], depth);
    this.opaqueAndCompositeColor = FrameBuffer.create([textures.color!], depth);
    this.depthAndOrder = FrameBuffer.create([textures.depthAndOrder!], depth);
    this.hilite = FrameBuffer.create([textures.hilite!]);
    this.hiliteUsingStencil = FrameBuffer.create([textures.hilite!], depth);

    if (DepthType.TextureUnsignedInt24Stencil8 === System.instance.capabilities.maxDepthType)
      this.stencilSet = FrameBuffer.create([], depth);

    return undefined !== this.opaqueColor
      && undefined !== this.opaqueAndCompositeColor
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite
      && undefined !== this.hiliteUsingStencil;
  }

  public toggleOcclusion(textures: Textures): void {
    if (undefined !== textures.occlusion) {
      assert(undefined !== textures.occlusionBlur);
      this.occlusion = FrameBuffer.create([textures.occlusion]);
      this.occlusionBlur = FrameBuffer.create([textures.occlusionBlur!]);
    } else {
      assert(undefined === textures.occlusionBlur);
      this.occlusion = dispose(this.occlusion);
      this.occlusionBlur = dispose(this.occlusionBlur);
    }
  }

  public dispose() {
    this.opaqueColor = dispose(this.opaqueColor);
    this.opaqueAndCompositeColor = dispose(this.opaqueAndCompositeColor);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.hilite = dispose(this.hilite);
    this.hiliteUsingStencil = dispose(this.hiliteUsingStencil);
    this.stencilSet = dispose(this.stencilSet);
    this.occlusion = dispose(this.occlusion);
    this.occlusionBlur = dispose(this.occlusionBlur);
  }
}

// Maintains the geometry used to execute screenspace operations for a SceneCompositor.
class Geometry implements IDisposable {
  public composite?: CompositeGeometry;
  public stencilCopy?: ViewportQuadGeometry;
  public occlusion?: AmbientOcclusionGeometry;
  public occlusionXBlur?: BlurGeometry;
  public occlusionYBlur?: BlurGeometry;

  public init(textures: Textures): boolean {
    assert(undefined === this.composite);
    this.composite = CompositeGeometry.createGeometry(
      textures.color!.getHandle()!,
      textures.accumulation!.getHandle()!,
      textures.revealage!.getHandle()!, textures.hilite!.getHandle()!);

    this.stencilCopy = ViewportQuadGeometry.create(TechniqueId.CopyStencil);

    return undefined !== this.composite;
  }

  public toggleOcclusion(textures: Textures): void {
    if (undefined !== textures.occlusion) {
      assert(undefined !== textures.occlusionBlur);
      this.composite!.occlusion = textures.occlusion.getHandle();
      this.occlusion = AmbientOcclusionGeometry.createGeometry(textures.depthAndOrder!.getHandle()!);
      this.occlusionXBlur = BlurGeometry.createGeometry(textures.occlusion!.getHandle()!, textures.depthAndOrder!.getHandle()!, new Vector2d(1.0, 0.0));
      this.occlusionYBlur = BlurGeometry.createGeometry(textures.occlusionBlur!.getHandle()!, textures.depthAndOrder!.getHandle()!, new Vector2d(0.0, 1.0));
    } else {
      assert(undefined === textures.occlusionBlur);
      this.composite!.occlusion = undefined;
      this.occlusion = dispose(this.occlusion);
      this.occlusionXBlur = dispose(this.occlusionXBlur);
      this.occlusionYBlur = dispose(this.occlusionYBlur);
    }
  }

  public dispose() {
    this.composite = dispose(this.composite);
    this.stencilCopy = dispose(this.stencilCopy);
    this.occlusion = dispose(this.occlusion);
    this.occlusionXBlur = dispose(this.occlusionXBlur);
    this.occlusionYBlur = dispose(this.occlusionYBlur);
  }
}

// Represents a view of data read from a region of the frame buffer.
class PixelBuffer implements Pixel.Buffer {
  private readonly _rect: ViewRect;
  private readonly _selector: Pixel.Selector;
  private readonly _featureId?: Uint32Array;
  private readonly _depthAndOrder?: Uint32Array;
  private readonly _batchState: BatchState;

  private get _numPixels(): number { return this._rect.width * this._rect.height; }

  private getPixelIndex(x: number, y: number): number {
    if (x < this._rect.left || y < this._rect.top)
      return this._numPixels;

    x -= this._rect.left;
    y -= this._rect.top;
    if (x >= this._rect.width || y >= this._rect.height)
      return this._numPixels;

    // NB: View coords have origin at top-left; GL at bottom-left. So our rows are upside-down.
    y = this._rect.height - 1 - y;
    return y * this._rect.width + x;
  }

  private getPixel32(data: Uint32Array, pixelIndex: number): number | undefined {
    return pixelIndex < data.length ? data[pixelIndex] : undefined;
  }

  private getFeature(pixelIndex: number): Feature | undefined {
    const featureId = this.getFeatureId(pixelIndex);
    return undefined !== featureId ? this._batchState.getFeature(featureId) : undefined;
  }

  private getFeatureId(pixelIndex: number): number | undefined {
    return undefined !== this._featureId ? this.getPixel32(this._featureId, pixelIndex) : undefined;
  }

  private getFeatureTable(pixelIndex: number): PackedFeatureTable | undefined {
    const featureId = this.getFeatureId(pixelIndex);
    if (undefined !== featureId) {
      const batch = this._batchState.find(featureId);
      if (undefined !== batch)
        return batch.featureTable;
    }

    return undefined;
  }

  private readonly _scratchUint32Array = new Uint32Array(1);
  private readonly _scratchUint8Array = new Uint8Array(this._scratchUint32Array.buffer);
  private readonly _scratchVector3d = new Vector3d();
  private readonly _mult = new Vector3d(1.0, 1.0 / 255.0, 1.0 / 65025.0);
  private decodeDepthRgba(depthAndOrder: number): number {
    this._scratchUint32Array[0] = depthAndOrder;
    const bytes = this._scratchUint8Array;
    const fpt = Vector3d.create(bytes[1] / 255.0, bytes[2] / 255.0, bytes[3] / 255.0, this._scratchVector3d);
    let depth = fpt.dotProduct(this._mult);

    assert(0.0 <= depth);
    assert(1.01 >= depth); // rounding error...

    depth = Math.min(1.0, depth);
    depth = Math.max(0.0, depth);

    return depth;
  }

  private decodeRenderOrderRgba(depthAndOrder: number): RenderOrder {
    this._scratchUint32Array[0] = depthAndOrder;
    const encByte = this._scratchUint8Array[0];
    const enc = encByte / 255.0;
    const dec = Math.floor(16.0 * enc + 0.5);
    return dec;
  }

  private readonly _invalidPixelData = new Pixel.Data();
  public getPixel(x: number, y: number): Pixel.Data {
    const px = this._invalidPixelData;
    const index = this.getPixelIndex(x, y);
    if (index >= this._numPixels)
      return px;

    // Initialize to the defaults...
    let distanceFraction = px.distanceFraction;
    let geometryType = px.type;
    let planarity = px.planarity;

    const haveFeatureIds = Pixel.Selector.None !== (this._selector & Pixel.Selector.Feature);
    const feature = haveFeatureIds ? this.getFeature(index) : undefined;
    const featureTable = haveFeatureIds ? this.getFeatureTable(index) : undefined;
    if (Pixel.Selector.None !== (this._selector & Pixel.Selector.GeometryAndDistance) && undefined !== this._depthAndOrder) {
      const depthAndOrder = this.getPixel32(this._depthAndOrder, index);
      if (undefined !== depthAndOrder) {
        distanceFraction = this.decodeDepthRgba(depthAndOrder);

        const orderWithPlanarBit = this.decodeRenderOrderRgba(depthAndOrder);
        const order = orderWithPlanarBit & ~RenderOrder.PlanarBit;
        planarity = (orderWithPlanarBit === order) ? Pixel.Planarity.NonPlanar : Pixel.Planarity.Planar;
        switch (order) {
          case RenderOrder.None:
            geometryType = Pixel.GeometryType.None;
            planarity = Pixel.Planarity.None;
            break;
          case RenderOrder.BlankingRegion:
          case RenderOrder.Surface:
            geometryType = Pixel.GeometryType.Surface;
            break;
          case RenderOrder.Linear:
            geometryType = Pixel.GeometryType.Linear;
            break;
          case RenderOrder.Edge:
            geometryType = Pixel.GeometryType.Edge;
            break;
          case RenderOrder.Silhouette:
            geometryType = Pixel.GeometryType.Silhouette;
            break;
          default:
            // ###TODO: may run into issues with point clouds - they are not written correctly in C++.
            assert(false, "Invalid render order");
            geometryType = Pixel.GeometryType.None;
            planarity = Pixel.Planarity.None;
            break;
        }
      }
    }

    return new Pixel.Data(feature, distanceFraction, geometryType, planarity, featureTable);
  }

  private constructor(rect: ViewRect, selector: Pixel.Selector, compositor: SceneCompositor) {
    this._rect = rect.clone();
    this._selector = selector;
    this._batchState = compositor.target.batchState;

    if (Pixel.Selector.None !== (selector & Pixel.Selector.GeometryAndDistance)) {
      const depthAndOrderBytes = compositor.readDepthAndOrder(rect);
      if (undefined !== depthAndOrderBytes)
        this._depthAndOrder = new Uint32Array(depthAndOrderBytes.buffer);
      else
        this._selector &= ~Pixel.Selector.GeometryAndDistance;
    }

    if (Pixel.Selector.None !== (selector & Pixel.Selector.Feature)) {
      const features = compositor.readFeatureIds(rect);
      if (undefined !== features)
        this._featureId = new Uint32Array(features.buffer);
      else
        this._selector &= ~Pixel.Selector.Feature;
    }
  }

  public get isEmpty(): boolean { return Pixel.Selector.None === this._selector; }

  public static create(rect: ViewRect, selector: Pixel.Selector, compositor: SceneCompositor): Pixel.Buffer | undefined {
    const pdb = new PixelBuffer(rect, selector, compositor);
    return pdb.isEmpty ? undefined : pdb;
  }
}

/** Orchestrates rendering of the scene on behalf of a Target.
 * This base class exists only so we don't have to export all the types of the shared Compositor members like Textures, FrameBuffers, etc.
 * @internal
 */
export abstract class SceneCompositor implements IDisposable {
  public readonly target: Target;

  public abstract get currentRenderTargetIndex(): number;
  public abstract set currentRenderTargetIndex(_index: number);
  public abstract dispose(): void;
  public abstract draw(_commands: RenderCommands): void;
  public abstract drawForReadPixels(_commands: RenderCommands, overlays?: GraphicList): void;
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined;
  public abstract readDepthAndOrder(rect: ViewRect): Uint8Array | undefined;
  public abstract readFeatureIds(rect: ViewRect): Uint8Array | undefined;

  public abstract get featureIds(): TextureHandle;
  public abstract get depthAndOrder(): TextureHandle;

  protected constructor(target: Target) { this.target = target; }

  public static create(target: Target): SceneCompositor {
    return System.instance.capabilities.supportsDrawBuffers ? new MRTCompositor(target) : new MPCompositor(target);
  }
}

// The actual base class. Specializations are provided based on whether or not multiple render targets are supported.
abstract class Compositor extends SceneCompositor {
  protected _width: number = -1;
  protected _height: number = -1;
  protected _includeOcclusion: boolean = false;
  protected _textures = new Textures();
  protected _depth?: DepthBuffer;
  protected _frameBuffers: FrameBuffers;
  protected _geom: Geometry;
  protected _readPickDataFromPingPong: boolean = true;
  protected _opaqueRenderState = new RenderState();
  protected _translucentRenderState = new RenderState();
  protected _noDepthMaskRenderState = new RenderState();
  protected _stencilSetRenderState = new RenderState();
  protected _classifyColorRenderState = new RenderState();
  protected _classifyPickDataRenderState = new RenderState();
  protected _debugStencilRenderState = new RenderState();
  protected _debugStencil: number = 0; // 0 to draw stencil volumes normally, 1 to draw as opaque, 2 to draw blended

  public abstract get currentRenderTargetIndex(): number;
  public abstract set currentRenderTargetIndex(_index: number);

  protected abstract clearOpaque(_needComposite: boolean): void;
  protected abstract renderOpaque(_commands: RenderCommands, _compositeFlags: CompositeFlags, _renderForReadPixels: boolean): void;
  protected abstract renderIndexedClassifierForReadPixels(_commands: DrawCommands, index: number, state: RenderState, _needComposite: boolean): void;
  protected abstract clearTranslucent(): void;
  protected abstract renderTranslucent(_commands: RenderCommands): void;
  protected abstract getBackgroundFbo(_needComposite: boolean): FrameBuffer;
  protected abstract pingPong(): void;

  /** This function generates a texture that contains ambient occlusion information to be applied later. */
  protected renderAmbientOcclusion() {
    const system = System.instance;

    // Render unblurred ambient occlusion based on depth buffer
    let fbo = this._frameBuffers.occlusion!;
    system.frameBufferStack.execute(fbo, true, () => {
      System.instance.applyRenderState(RenderState.defaults);
      const params = getDrawParams(this.target, this._geom.occlusion!);
      this.target.techniques.draw(params);
    });
    this.target.recordPerformanceMetric("Compute AO");

    // Render the X-blurred ambient occlusion based on unblurred ambient occlusion
    fbo = this._frameBuffers.occlusionBlur!;
    system.frameBufferStack.execute(fbo, true, () => {
      System.instance.applyRenderState(RenderState.defaults);
      const params = getDrawParams(this.target, this._geom.occlusionXBlur!);
      this.target.techniques.draw(params);
    });
    this.target.recordPerformanceMetric("Blur AO X");

    // Render the Y-blurred ambient occlusion based on X-blurred ambient occlusion (render into original occlusion framebuffer)
    fbo = this._frameBuffers.occlusion!;
    system.frameBufferStack.execute(fbo, true, () => {
      System.instance.applyRenderState(RenderState.defaults);
      const params = getDrawParams(this.target, this._geom.occlusionYBlur!);
      this.target.techniques.draw(params);
    });
    this.target.recordPerformanceMetric("Blur AO Y");
  }

  protected constructor(target: Target, fbos: FrameBuffers, geometry: Geometry) {
    super(target);

    this._frameBuffers = fbos;
    this._geom = geometry;

    this._opaqueRenderState.flags.depthTest = true;

    this._translucentRenderState.flags.depthMask = false;
    this._translucentRenderState.flags.blend = this._translucentRenderState.flags.depthTest = true;
    this._translucentRenderState.blend.setBlendFuncSeparate(GL.BlendFactor.One, GL.BlendFactor.Zero, GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);

    this._noDepthMaskRenderState.flags.depthMask = false;

    this._stencilSetRenderState.flags.depthTest = true;
    this._stencilSetRenderState.flags.depthMask = false;
    this._stencilSetRenderState.flags.colorWrite = false;
    this._stencilSetRenderState.flags.stencilTest = true;
    this._stencilSetRenderState.depthFunc = GL.DepthFunc.LessOrEqual;
    this._stencilSetRenderState.stencil.frontFunction.function = GL.StencilFunction.Always;
    this._stencilSetRenderState.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    this._stencilSetRenderState.stencil.backFunction.function = GL.StencilFunction.Always;
    this._stencilSetRenderState.stencil.backOperation.zFail = GL.StencilOperation.DecrWrap;

    this._classifyPickDataRenderState.flags.depthTest = false;
    this._classifyPickDataRenderState.flags.depthMask = false;
    this._classifyPickDataRenderState.flags.colorWrite = true;
    this._classifyPickDataRenderState.flags.stencilTest = true;
    this._classifyPickDataRenderState.flags.cull = true;
    this._classifyPickDataRenderState.cullFace = GL.CullFace.Front;
    this._classifyPickDataRenderState.stencil.backFunction.function = GL.StencilFunction.NotEqual;
    this._classifyPickDataRenderState.stencil.backOperation.zPass = GL.StencilOperation.Zero; // this will clear the stencil
    // Let all of the operations remain at Keep so that the stencil will remain in tact for the subsequent blend draw to the color buffer.

    this._classifyColorRenderState.flags.depthTest = false;
    this._classifyColorRenderState.flags.depthMask = false;
    this._classifyColorRenderState.flags.colorWrite = true;
    this._classifyColorRenderState.flags.stencilTest = true;
    this._classifyColorRenderState.stencil.frontFunction.function = GL.StencilFunction.NotEqual;
    this._classifyColorRenderState.stencil.frontOperation.fail = GL.StencilOperation.Zero;
    this._classifyColorRenderState.stencil.frontOperation.zFail = GL.StencilOperation.Zero;
    this._classifyColorRenderState.stencil.frontOperation.zPass = GL.StencilOperation.Zero; // this will clear the stencil
    this._classifyColorRenderState.stencil.backFunction.function = GL.StencilFunction.NotEqual;
    this._classifyColorRenderState.stencil.backOperation.fail = GL.StencilOperation.Zero;
    this._classifyColorRenderState.stencil.backOperation.zFail = GL.StencilOperation.Zero;
    this._classifyColorRenderState.stencil.backOperation.zPass = GL.StencilOperation.Zero; // this will clear the stencil
    this._classifyColorRenderState.flags.blend = true; // blend func will be set before using

    if (this._debugStencil > 0) {
      this._debugStencilRenderState.flags.depthTest = true;
      this._debugStencilRenderState.flags.blend = true;
      this._debugStencilRenderState.blend.setBlendFunc(GL.BlendFactor.OneMinusConstColor, GL.BlendFactor.ConstColor);
      this._debugStencilRenderState.blend.color = [0.67, 0.67, 0.67, 1.0];
    }
  }

  public update(): boolean {
    const rect = this.target.viewRect;
    const width = rect.width;
    const height = rect.height;
    const includeOcclusion = this.target.wantAmbientOcclusion;

    // If not yet initialized, or dimensions changed, initialize.
    if (undefined === this._textures.accumulation || width !== this._width || height !== this._height) {
      this._width = width;
      this._height = height;

      // init() first calls dispose(), which releases all of our fbos, textures, etc, and resets the _includeOcclusion flag.
      if (!this.init()) {
        assert(false, "Failed to initialize scene compositor");
        return false;
      }
    }

    // Allocate or free ambient occlusion-related resources if necessary
    if (includeOcclusion !== this._includeOcclusion) {
      this._includeOcclusion = includeOcclusion;
      if (includeOcclusion) {
        if (!this._textures.enableOcclusion(width, height)) {
          assert(false, "Failed to initialize occlusion textures");
          return false;
        }
      } else {
        this._textures.disableOcclusion();
      }

      this._frameBuffers.toggleOcclusion(this._textures);
      this._geom.toggleOcclusion(this._textures);
    }

    return true;
  }

  public draw(commands: RenderCommands) {
    if (!this.update()) {
      assert(false);
      return;
    }

    const compositeFlags = commands.compositeFlags;
    const needComposite = CompositeFlags.None !== compositeFlags;

    // Clear output targets
    this.clearOpaque(needComposite);

    // Render the background
    this.renderBackground(commands, needComposite);
    this.target.recordPerformanceMetric("Render Background");

    // Render the sky box
    this.renderSkyBox(commands, needComposite);
    this.target.recordPerformanceMetric("Render SkyBox");

    // Render the background map graphics
    this.renderBackgroundMap(commands, needComposite);
    this.target.recordPerformanceMetric("Render BackgroundMap (background map)");

    // Enable clipping
    this.target.pushActiveVolume();
    this.target.recordPerformanceMetric("Enable Clipping");

    // Render opaque geometry
    this.renderOpaque(commands, compositeFlags, false);
    this.target.recordPerformanceMetric("Render Opaque");

    // Render stencil volumes
    this.renderClassification(commands, needComposite, false);
    this.target.recordPerformanceMetric("Render Stencils");

    if (needComposite) {
      this._geom.composite!.update(compositeFlags);
      this.clearTranslucent();
      this.renderTranslucent(commands);
      this.target.recordPerformanceMetric("Render Translucent");
      this.renderHilite(commands);
      this.target.recordPerformanceMetric("Render Hilite");
      this.composite();
      this.target.recordPerformanceMetric("Composite");
    }
    this.target.popActiveVolume();
  }

  public get fullHeight(): number { return this.target.viewRect.height; }

  public drawForReadPixels(commands: RenderCommands, overlays?: GraphicList) {
    if (!this.update()) {
      assert(false);
      return;
    }

    this.clearOpaque(false);
    this.target.recordPerformanceMetric("Render Background");

    // On entry the RenderCommands has been initialized for all scene graphics and pickable decorations with the exception of world overlays.
    // It's possible we have no pickable scene graphics or decorations, but do have pickable world overlays.
    const haveRenderCommands = !commands.isEmpty;
    if (haveRenderCommands) {
      this.target.pushActiveVolume();
      this.target.recordPerformanceMetric("Enable Clipping");
      this.renderOpaque(commands, CompositeFlags.None, true);
      this.target.recordPerformanceMetric("Render Opaque");
      this.renderClassification(commands, false, true);
      this.target.recordPerformanceMetric("Render Stencils");
      this.target.popActiveVolume();
    }

    if (undefined === overlays || 0 === overlays.length)
      return;

    // Now populate the opaque passes with any pickable world overlays
    commands.initForPickOverlays(overlays);
    if (commands.isEmpty)
      return;

    // Clear the depth buffer so that overlay decorations win the depth test.
    // (If *only* overlays exist, then clearOpaque() above already took care of this).
    if (haveRenderCommands) {
      const system = System.instance;
      system.frameBufferStack.execute(this._frameBuffers.opaqueColor!, true, () => {
        system.applyRenderState(RenderState.defaults);
        system.context.clearDepth(1.0);
        system.context.clear(GL.BufferBit.Depth);
      });
    }

    // Render overlays as opaque into the pick buffers
    this.renderOpaque(commands, CompositeFlags.None, true);
    this.target.recordPerformanceMetric("Overlay Draws");
  }

  public readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    return PixelBuffer.create(rect, selector, this);
  }

  public readDepthAndOrder(rect: ViewRect): Uint8Array | undefined { return this.readFrameBuffer(rect, this._frameBuffers.depthAndOrder); }

  public readFeatureIds(rect: ViewRect): Uint8Array | undefined {
    const tex = this._textures.featureId;
    if (undefined === tex)
      return undefined;

    const fbo = FrameBuffer.create([tex]);
    const result = this.readFrameBuffer(rect, fbo);

    dispose(fbo);

    return result;
  }

  private readFrameBuffer(rect: ViewRect, fbo?: FrameBuffer): Uint8Array | undefined {
    if (undefined === fbo || !Debug.isValidFrameBuffer)
      return undefined;

    // NB: ViewRect origin at top-left; GL origin at bottom-left
    const bottom = this.fullHeight - rect.bottom;
    const gl = System.instance.context;
    const bytes = new Uint8Array(rect.width * rect.height * 4);
    let result: Uint8Array | undefined = bytes;
    System.instance.frameBufferStack.execute(fbo, true, () => {
      try {
        gl.readPixels(rect.left, bottom, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      } catch (e) {
        result = undefined;
      }
    });

    return result;
  }

  public dispose() {
    this._depth = dispose(this._depth);
    this._includeOcclusion = false;
    dispose(this._textures);
    dispose(this._frameBuffers);
    dispose(this._geom);
  }

  private init(): boolean {
    this.dispose();
    this._depth = System.instance.createDepthBuffer(this._width, this._height);
    if (this._depth !== undefined) {
      return this._textures.init(this._width, this._height)
        && this._frameBuffers.init(this._textures, this._depth)
        && this._geom.init(this._textures);
    }
    return false;
  }

  private renderBackgroundMap(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.BackgroundMap);
    if (0 === cmds.length) {
      return;
    }

    this.target.plan!.selectExpandedFrustum();
    this.target.changeFrustum(this.target.plan!.frustum, this.target.plan!.fraction, this.target.plan!.is3d);

    const fbStack = System.instance.frameBufferStack;
    const fbo = this.getBackgroundFbo(needComposite);
    fbStack.execute(fbo, true, () => {
      System.instance.applyRenderState(this.getRenderState(RenderPass.BackgroundMap));
      this.target.techniques.execute(this.target, cmds, RenderPass.BackgroundMap);
    });

    this.target.plan!.selectViewFrustum();
    this.target.changeFrustum(this.target.plan!.frustum, this.target.plan!.fraction, this.target.plan!.is3d);
  }

  private renderSkyBox(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.SkyBox);
    if (0 === cmds.length) {
      return;
    }

    const fbStack = System.instance.frameBufferStack;
    const fbo = this.getBackgroundFbo(needComposite);
    fbStack.execute(fbo, true, () => {
      this.target.pushState(this.target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.SkyBox));
      this.target.techniques.execute(this.target, cmds, RenderPass.SkyBox);
      this.target.popBranch();
    });
  }

  private renderBackground(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.Background);
    if (0 === cmds.length) {
      return;
    }

    const fbStack = System.instance.frameBufferStack;
    const fbo = this.getBackgroundFbo(needComposite);
    fbStack.execute(fbo, true, () => {
      this.target.pushState(this.target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.Background));
      this.target.techniques.execute(this.target, cmds, RenderPass.Background);
      this.target.popBranch();
    });
  }

  private findFlashedClassifier(cmdsByIndex: DrawCommands): number {
    if (!Id64.isValid(this.target.flashedId))
      return -1; // nothing flashed

    for (let i = 1; i < cmdsByIndex.length; i += 3) {
      const command = cmdsByIndex[i];
      if (command.isPrimitiveCommand) {
        if (command instanceof BatchPrimitiveCommand) {
          const batch = command as BatchPrimitiveCommand;
          if (batch.computeIsFlashed(this.target.flashedId)) {
            return (i - 1) / 3;
          }
        }
      }
    }

    return -1; // couldn't find it
  }

  private renderIndexedClassifier(cmdsByIndex: DrawCommands, index: number, needComposite: boolean) {
    // Set the stencil for the given classifier stencil volume.
    System.instance.frameBufferStack.execute(this._frameBuffers.stencilSet!, false, () => {
      this.target.pushState(this.target.decorationState);
      System.instance.applyRenderState(this._stencilSetRenderState);
      this.target.techniques.executeForIndexedClassifier(this.target, cmdsByIndex, RenderPass.Classification, index);
      this.target.popBranch();
    });

    // Process the stencil for the pick data.
    this.renderIndexedClassifierForReadPixels(cmdsByIndex, index, this._classifyPickDataRenderState, needComposite);
  }

  private renderClassification(commands: RenderCommands, needComposite: boolean, renderForReadPixels: boolean) {
    const cmds = commands.getCommands(RenderPass.Classification);
    const cmdsByIndex = commands.getCommands(RenderPass.ClassificationByIndex);
    if (0 === cmds.length || 0 === cmdsByIndex.length)
      return;

    if (this._debugStencil > 0) {
      System.instance.frameBufferStack.execute(this.getBackgroundFbo(needComposite), true, () => {
        if (1 === this._debugStencil) {
          System.instance.applyRenderState(this.getRenderState(RenderPass.OpaqueGeneral));
          this.target.techniques.execute(this.target, cmds, RenderPass.OpaqueGeneral);
        } else {
          this.target.pushState(this.target.decorationState);
          System.instance.applyRenderState(this._debugStencilRenderState);
          this.target.techniques.execute(this.target, cmds, RenderPass.Classification);
          this.target.popBranch();
        }
      });

      return;
    }

    const fbStack = System.instance.frameBufferStack;
    const fboSet = this._frameBuffers.stencilSet;
    const fboCopy = this.getBackgroundFbo(needComposite);
    if (undefined === fboSet || undefined === fboCopy)
      return;

    // Clear the stencil.
    fbStack.execute(fboSet!, false, () => {
      System.instance.context.clearStencil(0);
      System.instance.context.clear(GL.BufferBit.Stencil);
    });

    if (renderForReadPixels) {
      // We need to render the classifier stencil volumes one at a time, so first count them then render them in a loop.
      const numClassifiers = cmdsByIndex.length / 3;
      for (let i = 0; i < numClassifiers; ++i)
        this.renderIndexedClassifier(cmdsByIndex, i, needComposite);

      return;
    }

    const flashedClassifier = this.findFlashedClassifier(cmdsByIndex);

    // Process the selected classifiers.
    const cmdsH = commands.getCommands(RenderPass.HiliteClassification);
    if (cmds.length > 0) {
      // Set the stencil for the given classifier stencil volume.
      fbStack.execute(fboSet, false, () => {
        this.target.pushState(this.target.decorationState);
        System.instance.applyRenderState(this._stencilSetRenderState);
        this.target.techniques.execute(this.target, cmdsH, RenderPass.Hilite);
        this.target.popBranch();
      });

      // Process the stencil volumes, blending into the current color buffer.
      fbStack.execute(fboCopy!, true, () => {
        this.target.pushState(this.target.decorationState);
        this._classifyColorRenderState.blend.color = [1.0, 1.0, 1.0, 0.2];
        this._classifyColorRenderState.blend.setBlendFunc(GL.BlendFactor.ConstAlpha, GL.BlendFactor.OneMinusConstAlpha); // Mix with select/hilite color
        System.instance.applyRenderState(this._classifyColorRenderState);
        const params = getDrawParams(this.target, this._geom.stencilCopy!);
        this.target.techniques.draw(params);
        this.target.popBranch();
      });
    }

    // Process the flashed classifier if there is one.
    if (flashedClassifier !== -1) {
      // Set the stencil for this one classifier.
      fbStack.execute(this._frameBuffers.stencilSet!, false, () => {
        this.target.pushState(this.target.decorationState);
        System.instance.applyRenderState(this._stencilSetRenderState);
        this.target.techniques.executeForIndexedClassifier(this.target, cmdsByIndex, RenderPass.Classification, flashedClassifier);
        this.target.popBranch();
      });

      // Process the stencil.
      fbStack.execute(fboCopy!, true, () => {
        this.target.pushState(this.target.decorationState);
        this._classifyColorRenderState.blend.color = [1.0, 1.0, 1.0, this.target.flashIntensity * 0.5];
        this._classifyColorRenderState.blend.setBlendFuncSeparate(GL.BlendFactor.ConstAlpha, GL.BlendFactor.ConstAlpha, GL.BlendFactor.One, GL.BlendFactor.OneMinusConstAlpha); // want to just add flash color
        System.instance.applyRenderState(this._classifyColorRenderState);
        this.target.techniques.executeForIndexedClassifier(this.target, cmdsByIndex, RenderPass.OpaquePlanar, flashedClassifier);
        this.target.popBranch();
      });
    }

    // Process the area outside the classifiers.
    // ###TODO: Need a way to only do this to reality mesh and point cloud data
    // Set the stencil using the stencil command list.
    fbStack.execute(fboSet!, false, () => {
      this.target.pushState(this.target.decorationState);
      System.instance.applyRenderState(this._stencilSetRenderState);
      this.target.techniques.execute(this.target, cmds, RenderPass.Classification);
      this.target.popBranch();
    });

    // Process the stencil volumes, blending into the current color buffer.
    fbStack.execute(fboCopy!, true, () => {
      this.target.pushState(this.target.decorationState);
      this._classifyColorRenderState.stencil.frontFunction.function = GL.StencilFunction.Equal;
      this._classifyColorRenderState.stencil.backFunction.function = GL.StencilFunction.Equal;
      this._classifyColorRenderState.blend.color = [1.0, 1.0, 1.0, 0.4];
      this._classifyColorRenderState.blend.setBlendFuncSeparate(GL.BlendFactor.Zero, GL.BlendFactor.Zero, GL.BlendFactor.ConstAlpha, GL.BlendFactor.One); // want to just darken dest. color
      System.instance.applyRenderState(this._classifyColorRenderState);
      this._classifyColorRenderState.stencil.frontFunction.function = GL.StencilFunction.NotEqual;
      this._classifyColorRenderState.stencil.backFunction.function = GL.StencilFunction.NotEqual;
      const params = getDrawParams(this.target, this._geom.stencilCopy!);
      this.target.techniques.draw(params);
      this.target.popBranch();
    });
  }

  private renderHilite(commands: RenderCommands) {
    const system = System.instance;
    system.frameBufferStack.execute(this._frameBuffers.hilite!, true, () => {
      // Clear the hilite buffer.
      system.context.clearColor(0, 0, 0, 0);
      system.context.clear(GL.BufferBit.Color);
      // Draw the normal hilite geometry.
      this.drawPass(commands, RenderPass.Hilite);
    });

    // Process planar classifiers
    const planarClassifierCmds = commands.getCommands(RenderPass.HilitePlanarClassification);
    if (0 !== planarClassifierCmds.length) {
      system.frameBufferStack.execute(this._frameBuffers.hiliteUsingStencil!, true, () => {
        system.applyRenderState(this._opaqueRenderState);
        system.context.clearDepth(1.0);
        system.context.clear(GL.BufferBit.Depth);
        system.context.clearColor(0, 0, 0, 0);
        system.context.clear(GL.BufferBit.Color);
        this.target.techniques.execute(this.target, planarClassifierCmds, RenderPass.HilitePlanarClassification);
      });
    }

    // Process the hilite stencil volumes.
    const cmds = commands.getCommands(RenderPass.HiliteClassification);
    if (0 === cmds.length) {
      return;
    }
    // Set the stencil for the given classifier stencil volume.
    system.frameBufferStack.execute(this._frameBuffers.stencilSet!, false, () => {
      this.target.pushState(this.target.decorationState);
      system.applyRenderState(this._stencilSetRenderState);
      this.target.techniques.execute(this.target, cmds, RenderPass.Hilite);
      this.target.popBranch();
    });

    // Process the stencil for the hilite data.
    system.frameBufferStack.execute(this._frameBuffers.hiliteUsingStencil!, true, () => {
      system.applyRenderState(this._classifyPickDataRenderState);
      this.target.techniques.execute(this.target, cmds, RenderPass.Hilite);
    });
  }

  private composite() {
    System.instance.applyRenderState(RenderState.defaults);
    const params = getDrawParams(this.target, this._geom.composite!);
    this.target.techniques.draw(params);
  }

  protected getRenderState(pass: RenderPass): RenderState {
    switch (pass) {
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
      case RenderPass.OpaqueGeneral:
      case RenderPass.HilitePlanarClassification:
        return this._opaqueRenderState;
      case RenderPass.Translucent:
        return this._translucentRenderState;
      default:
        return this._noDepthMaskRenderState;
    }
  }

  protected drawPass(commands: RenderCommands, pass: RenderPass, pingPong: boolean = false) {
    const cmds = commands.getCommands(pass);
    if (0 === cmds.length) {
      return;
    } else if (pingPong) {
      this.pingPong();
    }

    System.instance.applyRenderState(this.getRenderState(pass));
    this.target.techniques.execute(this.target, cmds, pass);
  }
}

class MRTFrameBuffers extends FrameBuffers {
  public opaqueAll?: FrameBuffer;
  public opaqueAndCompositeAll?: FrameBuffer;
  public pingPong?: FrameBuffer;
  public translucent?: FrameBuffer;
  public clearTranslucent?: FrameBuffer;
  public idOnly?: FrameBuffer;
  public idOnlyAndComposite?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    if (!super.init(textures, depth))
      return false;

    assert(undefined === this.opaqueAll);

    const boundColor = System.instance.frameBufferStack.currentColorBuffer;
    if (undefined === boundColor)
      return false;

    const colorAndPick = [boundColor, textures.featureId!, textures.depthAndOrder!];
    this.opaqueAll = FrameBuffer.create(colorAndPick, depth);

    colorAndPick[0] = textures.color!;
    this.opaqueAndCompositeAll = FrameBuffer.create(colorAndPick, depth);

    const colors = [textures.accumulation!, textures.revealage!];
    this.translucent = FrameBuffer.create(colors, depth);
    this.clearTranslucent = FrameBuffer.create(colors);

    // We borrow the SceneCompositor's accum and revealage textures for the surface pass.
    // First we render edges, writing to our textures.
    // Then we copy our textures to borrowed textures.
    // Finally we render surfaces, writing to our textures and reading from borrowed textures.
    const pingPong = [textures.accumulation!, textures.revealage!];
    this.pingPong = FrameBuffer.create(pingPong);

    const ids = [boundColor, textures.featureId!];
    this.idOnly = FrameBuffer.create(ids, depth);
    colorAndPick[0] = textures.color!;
    this.idOnlyAndComposite = FrameBuffer.create(ids, depth);

    return undefined !== this.opaqueAll
      && undefined !== this.opaqueAndCompositeAll
      && undefined !== this.pingPong
      && undefined !== this.translucent
      && undefined !== this.clearTranslucent
      && undefined !== this.idOnly
      && undefined !== this.idOnlyAndComposite;
  }

  public dispose(): void {
    super.dispose();

    this.opaqueAll = dispose(this.opaqueAll);
    this.opaqueAndCompositeAll = dispose(this.opaqueAndCompositeAll);
    this.pingPong = dispose(this.pingPong);
    this.translucent = dispose(this.translucent);
    this.clearTranslucent = dispose(this.clearTranslucent);
    this.idOnly = dispose(this.idOnly);
    this.idOnlyAndComposite = dispose(this.idOnlyAndComposite);
  }
}

class MRTGeometry extends Geometry {
  public copyPickBuffers?: CopyPickBufferGeometry;
  public clearTranslucent?: ViewportQuadGeometry;
  public clearPickAndColor?: ViewportQuadGeometry;

  public init(textures: Textures): boolean {
    if (!super.init(textures))
      return false;

    assert(undefined === this.copyPickBuffers);

    this.copyPickBuffers = CopyPickBufferGeometry.createGeometry(textures.featureId!.getHandle()!, textures.depthAndOrder!.getHandle()!);
    this.clearTranslucent = ViewportQuadGeometry.create(TechniqueId.OITClearTranslucent);
    this.clearPickAndColor = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);

    return undefined !== this.copyPickBuffers && undefined !== this.clearTranslucent && undefined !== this.clearPickAndColor;
  }

  public dispose() {
    super.dispose();

    this.copyPickBuffers = dispose(this.copyPickBuffers);
    this.clearTranslucent = dispose(this.clearTranslucent);
    this.clearPickAndColor = dispose(this.clearPickAndColor);
  }
}

// SceneCompositor used when multiple render targets are supported (WEBGL_draw_buffers exists and supports at least 4 color attachments).
class MRTCompositor extends Compositor {
  public constructor(target: Target) {
    super(target, new MRTFrameBuffers(), new MRTGeometry());
  }

  public get currentRenderTargetIndex(): number {
    assert(false, "MRT is supported");
    return 0;
  }
  public set currentRenderTargetIndex(_index: number) {
    assert(false, "MRT is supported");
  }

  public get featureIds(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 0 : 1); }
  public get depthAndOrder(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 1 : 2); }

  private get _fbos(): MRTFrameBuffers { return this._frameBuffers as MRTFrameBuffers; }
  private get _geometry(): MRTGeometry { return this._geom as MRTGeometry; }

  protected clearOpaque(needComposite: boolean): void {
    const fbo = needComposite ? this._fbos.opaqueAndCompositeAll! : this._fbos.opaqueAll!;
    const system = System.instance;
    system.frameBufferStack.execute(fbo, true, () => {
      // Clear pick data buffers to 0's and color buffer to background color
      // (0,0,0,0) in elementID0 and ElementID1 buffers indicates invalid element id
      // (0,0,0,0) in DepthAndOrder buffer indicates render order 0 and encoded depth of 0 (= far plane)
      system.applyRenderState(this._noDepthMaskRenderState);
      const params = getDrawParams(this.target, this._geometry.clearPickAndColor!);
      this.target.techniques.draw(params);

      // Clear depth buffer
      system.applyRenderState(RenderState.defaults); // depthMask == true.
      system.context.clearDepth(1.0);
      system.context.clear(GL.BufferBit.Depth);
    });
  }

  protected renderOpaque(commands: RenderCommands, compositeFlags: CompositeFlags, renderForReadPixels: boolean) {
    // Output the first 2 passes to color and pick data buffers. (All 3 in the case of rendering for readPixels()).
    this._readPickDataFromPingPong = true;

    const needComposite = CompositeFlags.None !== compositeFlags;
    const needAO = CompositeFlags.None !== (compositeFlags & CompositeFlags.AmbientOcclusion);

    let fbStack = System.instance.frameBufferStack;
    fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeAll! : this._fbos.opaqueAll!, true, () => {
      this.drawPass(commands, RenderPass.OpaqueLinear);
      this.drawPass(commands, RenderPass.OpaquePlanar, true);
      if (needAO || renderForReadPixels) {
        this.drawPass(commands, RenderPass.OpaqueGeneral, true);
        if (needAO)
          this.renderAmbientOcclusion();
      }
    });

    this._readPickDataFromPingPong = false;

    // The general pass (and following) will not bother to write to pick buffers and so can read from the actual pick buffers.
    if (!renderForReadPixels && !needAO) {
      fbStack = System.instance.frameBufferStack;
      fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!, true, () => {
        this.drawPass(commands, RenderPass.OpaqueGeneral, false);
        this.drawPass(commands, RenderPass.HiddenEdge, false);
      });
    }
  }

  protected renderIndexedClassifierForReadPixels(cmdsByIndex: DrawCommands, index: number, state: RenderState, needComposite: boolean) {
    this._readPickDataFromPingPong = true;
    const fbStack = System.instance.frameBufferStack;
    fbStack.execute(needComposite ? this._fbos.idOnlyAndComposite! : this._fbos.idOnly!, true, () => {
      System.instance.applyRenderState(state);
      this.target.techniques.executeForIndexedClassifier(this.target, cmdsByIndex, RenderPass.OpaqueGeneral, index);
    });
    this._readPickDataFromPingPong = false;
  }

  protected clearTranslucent() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);
    System.instance.frameBufferStack.execute(this._fbos.clearTranslucent!, true, () => {
      const params = getDrawParams(this.target, this._geometry.clearTranslucent!);
      this.target.techniques.draw(params);
    });
  }

  protected renderTranslucent(commands: RenderCommands) {
    System.instance.frameBufferStack.execute(this._fbos.translucent!, true, () => {
      this.drawPass(commands, RenderPass.Translucent);
    });
  }

  protected pingPong() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);
    System.instance.frameBufferStack.execute(this._fbos.pingPong!, true, () => {
      const params = getDrawParams(this.target, this._geometry.copyPickBuffers!);
      this.target.techniques.draw(params);
    });
  }

  protected getBackgroundFbo(needComposite: boolean): FrameBuffer { return needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!; }

  private get _samplerFbo(): FrameBuffer { return this._readPickDataFromPingPong ? this._fbos.pingPong! : this._fbos.opaqueAll!; }
  private getSamplerTexture(index: number) { return this._samplerFbo.getColor(index); }
}

class MPFrameBuffers extends FrameBuffers {
  public accumulation?: FrameBuffer;
  public revealage?: FrameBuffer;
  public featureId?: FrameBuffer;
  public featureIdWithDepth?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    if (!super.init(textures, depth))
      return false;

    assert(undefined === this.accumulation);

    this.accumulation = FrameBuffer.create([textures.accumulation!], depth);
    this.revealage = FrameBuffer.create([textures.revealage!], depth);
    this.featureId = FrameBuffer.create([textures.featureId!], depth);
    this.featureIdWithDepth = FrameBuffer.create([textures.featureId!], depth);

    return undefined !== this.accumulation && undefined !== this.revealage && undefined !== this.featureId && undefined !== this.featureIdWithDepth;
  }

  public dispose(): void {
    super.dispose();

    this.accumulation = dispose(this.accumulation);
    this.revealage = dispose(this.revealage);
    this.featureId = dispose(this.featureId);
    this.featureIdWithDepth = dispose(this.featureIdWithDepth);
  }
}

class MPGeometry extends Geometry {
  public copyColor?: SingleTexturedViewportQuadGeometry;

  public init(textures: Textures): boolean {
    if (!super.init(textures))
      return false;

    assert(undefined === this.copyColor);
    this.copyColor = SingleTexturedViewportQuadGeometry.createGeometry(textures.featureId!.getHandle()!, TechniqueId.CopyColor);
    return undefined !== this.copyColor;
  }

  public dispose(): void {
    super.dispose();
    this.copyColor = dispose(this.copyColor);
  }
}

// Compositor used when multiple render targets are not supported (WEBGL_draw_buffers not available or fewer than 4 color attachments supported).
// This falls back to multi-pass rendering in place of MRT rendering, which has obvious performance implications.
// The chief use case is iOS.
class MPCompositor extends Compositor {
  private _currentRenderTargetIndex: number = 0;
  private _drawMultiPassDepth: boolean = true;
  private readonly _opaqueRenderStateNoZWt = new RenderState();

  public constructor(target: Target) {
    super(target, new MPFrameBuffers(), new MPGeometry());

    this._opaqueRenderStateNoZWt.flags.depthTest = true;
    this._opaqueRenderStateNoZWt.flags.depthMask = false;
  }

  protected getRenderState(pass: RenderPass): RenderState {
    switch (pass) {
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
      case RenderPass.OpaqueGeneral:
        return this._drawMultiPassDepth ? this._opaqueRenderState : this._opaqueRenderStateNoZWt;
    }

    return super.getRenderState(pass);
  }

  private get _fbos(): MPFrameBuffers { return this._frameBuffers as MPFrameBuffers; }
  private get _geometry(): MPGeometry { return this._geom as MPGeometry; }

  public get currentRenderTargetIndex(): number { return this._currentRenderTargetIndex; }
  public set currentRenderTargetIndex(index: number) { this._currentRenderTargetIndex = index; }
  public get featureIds(): TextureHandle { return this._readPickDataFromPingPong ? this._textures.accumulation! : this._textures.featureId!; }
  public get depthAndOrder(): TextureHandle { return this._readPickDataFromPingPong ? this._textures.revealage! : this._textures.depthAndOrder!; }

  protected getBackgroundFbo(needComposite: boolean): FrameBuffer { return needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!; }

  protected clearOpaque(needComposite: boolean): void {
    const bg = this.target.bgColor;
    this.clearFbo(needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!, bg.red, bg.green, bg.blue, bg.alpha, true);
    this.clearFbo(this._fbos.depthAndOrder!, 0, 0, 0, 0, false);
    this.clearFbo(this._fbos.featureId!, 0, 0, 0, 0, false);
  }

  protected renderOpaque(commands: RenderCommands, compositeFlags: CompositeFlags, renderForReadPixels: boolean): void {
    // Output the first 2 passes to color and pick data buffers. (All 3 in the case of rendering for readPixels()).
    this._readPickDataFromPingPong = true;
    const needComposite = CompositeFlags.None !== compositeFlags;
    const needAO = CompositeFlags.None !== (compositeFlags & CompositeFlags.AmbientOcclusion);
    const colorFbo = needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!;
    this.drawOpaquePass(colorFbo, commands, RenderPass.OpaqueLinear, false);
    this.drawOpaquePass(colorFbo, commands, RenderPass.OpaquePlanar, true);
    if (renderForReadPixels || needAO) {
      this.drawOpaquePass(colorFbo, commands, RenderPass.OpaqueGeneral, true);
      if (needAO)
        this.renderAmbientOcclusion();
    }

    this._readPickDataFromPingPong = false;

    // The general pass (and following) will not bother to write to pick buffers and so can read from the actual pick buffers.
    if (!renderForReadPixels && !needAO) {
      System.instance.frameBufferStack.execute(colorFbo, true, () => {
        this._drawMultiPassDepth = true;  // for OpaqueGeneral
        this.drawPass(commands, RenderPass.OpaqueGeneral, false);
        this.drawPass(commands, RenderPass.HiddenEdge, false);
      });
    }
  }

  protected renderIndexedClassifierForReadPixels(cmdsByIndex: DrawCommands, index: number, state: RenderState, _needComposite: boolean) {
    // Note that we only need to render to the Id textures here, no color, since the color buffer is not used in readPixels.
    this._readPickDataFromPingPong = true;
    const stack = System.instance.frameBufferStack;
    this._currentRenderTargetIndex = 1;
    stack.execute(this._fbos.featureIdWithDepth!, true, () => {
      state.stencil.backOperation.zPass = GL.StencilOperation.Zero;
      System.instance.applyRenderState(state);
      this.target.techniques.executeForIndexedClassifier(this.target, cmdsByIndex, RenderPass.OpaqueGeneral, index);
    });
    this._currentRenderTargetIndex = 0;
    this._readPickDataFromPingPong = false;
  }

  // ###TODO: For readPixels(), could skip rendering color...also could skip rendering depth and/or element ID depending upon selector...
  private drawOpaquePass(colorFbo: FrameBuffer, commands: RenderCommands, pass: RenderPass, pingPong: boolean): void {
    const stack = System.instance.frameBufferStack;
    this._drawMultiPassDepth = true;
    if (!this.target.isReadPixelsInProgress) {
      stack.execute(colorFbo, true, () => this.drawPass(commands, pass, pingPong));
      this._drawMultiPassDepth = false;
    }
    this._currentRenderTargetIndex++;
    if (!this.target.isReadPixelsInProgress || Pixel.Selector.None !== (this.target.readPixelsSelector & Pixel.Selector.Feature)) {
      stack.execute(this._fbos.featureId!, true, () => this.drawPass(commands, pass, pingPong && this._drawMultiPassDepth));
      this._drawMultiPassDepth = false;
    }
    this._currentRenderTargetIndex++;
    if (!this.target.isReadPixelsInProgress || Pixel.Selector.None !== (this.target.readPixelsSelector & Pixel.Selector.GeometryAndDistance)) {
      stack.execute(this._fbos.depthAndOrder!, true, () => this.drawPass(commands, pass, pingPong && this._drawMultiPassDepth));
    }
    this._currentRenderTargetIndex = 0;
  }

  protected clearTranslucent() {
    this.clearFbo(this._fbos.accumulation!, 0, 0, 0, 1, false);
    this.clearFbo(this._fbos.revealage!, 1, 0, 0, 1, false);
  }

  protected renderTranslucent(commands: RenderCommands) {
    System.instance.frameBufferStack.execute(this._fbos.accumulation!, true, () => {
      this.drawPass(commands, RenderPass.Translucent);
    });

    this._currentRenderTargetIndex = 1;
    System.instance.frameBufferStack.execute(this._fbos.revealage!, true, () => {
      this.drawPass(commands, RenderPass.Translucent);
    });

    this._currentRenderTargetIndex = 0;
  }

  protected pingPong() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);

    this.copyFbo(this._textures.featureId!, this._fbos.accumulation!);
    this.copyFbo(this._textures.depthAndOrder!, this._fbos.revealage!);
  }

  private copyFbo(src: TextureHandle, dst: FrameBuffer): void {
    const geom = this._geometry.copyColor!;
    geom.texture = src.getHandle()!;
    System.instance.frameBufferStack.execute(dst, true, () => {
      const params = getDrawParams(this.target, geom);
      this.target.techniques.draw(params);
    });
  }

  private clearFbo(fbo: FrameBuffer, red: number, green: number, blue: number, alpha: number, andDepth: boolean): void {
    const system = System.instance;
    const gl = system.context;
    system.frameBufferStack.execute(fbo, true, () => {
      system.applyRenderState(andDepth ? RenderState.defaults : this._noDepthMaskRenderState);
      gl.clearColor(red, green, blue, alpha);
      let bit = GL.BufferBit.Color;
      if (andDepth) {
        gl.clearDepth(1.0);
        bit |= GL.BufferBit.Depth;
      }

      gl.clear(bit);
    });
  }
}
