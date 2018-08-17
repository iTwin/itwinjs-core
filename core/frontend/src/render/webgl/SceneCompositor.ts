/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FrameBuffer, DepthBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ViewportQuadGeometry, CompositeGeometry, CopyPickBufferGeometry, SingleTexturedViewportQuadGeometry } from "./CachedGeometry";
import { Vector3d } from "@bentley/geometry-core";
import { TechniqueId } from "./TechniqueId";
import { System, RenderType, DepthType } from "./System";
import { Pixel, DecorationList } from "../System";
import { ViewRect } from "../../Viewport";
import { assert, Id64, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { RenderCommands, DrawParams } from "./DrawCommand";
import { RenderState } from "./RenderState";
import { CompositeFlags, RenderPass, RenderOrder } from "./RenderFlags";
import { FloatRgba } from "./FloatRGBA";

// Maintains the textures used by a SceneCompositor. The textures are reallocated when the dimensions of the viewport change.
class Textures implements IDisposable {
  public accumulation?: TextureHandle;
  public revealage?: TextureHandle;
  public color?: TextureHandle;
  public idLow?: TextureHandle;
  public idHigh?: TextureHandle;
  public depthAndOrder?: TextureHandle;
  public hilite?: TextureHandle;

  public dispose() {
    this.accumulation = dispose(this.accumulation);
    this.revealage = dispose(this.revealage);
    this.color = dispose(this.color);
    this.idLow = dispose(this.idLow);
    this.idHigh = dispose(this.idHigh);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.hilite = dispose(this.hilite);
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

    // NB: All 3 of these must be of the same type, because they are borrowed by pingpong and bound to the same frame buffer.
    // Otherwise there would be no reason to use FLOAT for hilite texture.
    this.accumulation = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, pixelDataType);
    this.revealage = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, pixelDataType);
    this.hilite = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, pixelDataType);

    this.color = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    this.idLow = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.idHigh = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.depthAndOrder = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    return undefined !== this.accumulation
      && undefined !== this.revealage
      && undefined !== this.color
      && undefined !== this.idLow
      && undefined !== this.idHigh
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite;
  }
}

// Maintains the framebuffers used by a SceneCompositor. The color attachments are supplied by a Textures object.
class FrameBuffers implements IDisposable {
  public opaqueColor?: FrameBuffer;
  public opaqueAndCompositeColor?: FrameBuffer;
  public depthAndOrder?: FrameBuffer;
  public hilite?: FrameBuffer;
  public stencilSet?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    const boundColor = System.instance.frameBufferStack.currentColorBuffer;
    if (undefined === boundColor)
      return false;

    this.opaqueColor = FrameBuffer.create([boundColor], depth);
    this.opaqueAndCompositeColor = FrameBuffer.create([textures.color!], depth);
    this.depthAndOrder = FrameBuffer.create([textures.depthAndOrder!]);
    this.hilite = FrameBuffer.create([textures.hilite!]);
    if (DepthType.TextureUnsignedInt24Stencil8 === System.instance.capabilities.maxDepthType) {
      this.stencilSet = FrameBuffer.create([], depth);
    }

    return undefined !== this.opaqueColor
      && undefined !== this.opaqueAndCompositeColor
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite;
  }

  public dispose() {
    this.opaqueColor = dispose(this.opaqueColor);
    this.opaqueAndCompositeColor = dispose(this.opaqueAndCompositeColor);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.hilite = dispose(this.hilite);
    this.stencilSet = dispose(this.stencilSet);
  }
}

// Maintains the geometry used to execute screenspace operations for a SceneCompositor.
class Geometry implements IDisposable {
  public composite?: CompositeGeometry;
  public stencilCopy?: ViewportQuadGeometry;

  public init(textures: Textures): boolean {
    assert(undefined === this.composite);
    this.composite = CompositeGeometry.createGeometry(textures.color!.getHandle()!, textures.accumulation!.getHandle()!, textures.revealage!.getHandle()!, textures.hilite!.getHandle()!);
    this.stencilCopy = ViewportQuadGeometry.create(TechniqueId.CopyStencil);
    return undefined !== this.composite;
  }

  public dispose() {
    this.composite = dispose(this.composite);
    this.stencilCopy = dispose(this.stencilCopy);
  }
}

// Represents a view of data read from a region of the frame buffer.
class PixelBuffer implements Pixel.Buffer {
  private readonly _rect: ViewRect;
  private readonly _selector: Pixel.Selector;
  private readonly _elemIdLow?: Uint32Array;
  private readonly _elemIdHi?: Uint32Array;
  private readonly _depthAndOrder?: Uint32Array;

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

  private getElementId(pixelIndex: number): Id64 | undefined {
    if (undefined === this._elemIdLow || undefined === this._elemIdHi)
      return undefined;

    const lo = this.getPixel32(this._elemIdLow, pixelIndex);
    const hi = this.getPixel32(this._elemIdHi, pixelIndex);
    return undefined !== lo && undefined !== hi ? Id64.fromUint32Pair(lo, hi) : undefined;
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

    const elemId = Pixel.Selector.None !== (this._selector & Pixel.Selector.ElementId) ? this.getElementId(index) : undefined;

    if (undefined !== this._depthAndOrder) {
      const wantDistance = Pixel.Selector.None !== (this._selector & Pixel.Selector.Distance);
      const wantGeometry = Pixel.Selector.None !== (this._selector & Pixel.Selector.Geometry);

      const depthAndOrder = wantDistance || wantGeometry ? this.getPixel32(this._depthAndOrder, index) : undefined;
      if (undefined !== depthAndOrder) {
        if (wantDistance)
          distanceFraction = this.decodeDepthRgba(depthAndOrder);

        if (wantGeometry) {
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
    }

    return new Pixel.Data(elemId, distanceFraction, geometryType, planarity);
  }

  private constructor(rect: ViewRect, selector: Pixel.Selector, compositor: SceneCompositor) {
    this._rect = rect.clone();
    this._selector = selector;

    if (Pixel.Selector.None !== (selector & Pixel.Selector.GeometryAndDistance)) {
      const depthAndOrderBytes = compositor.readDepthAndOrder(rect);
      if (undefined !== depthAndOrderBytes)
        this._depthAndOrder = new Uint32Array(depthAndOrderBytes.buffer);
      else
        this._selector &= ~Pixel.Selector.GeometryAndDistance;
    }

    if (Pixel.Selector.None !== (selector & Pixel.Selector.ElementId)) {
      const loBytes = compositor.readElementIds(false, rect);
      const hiBytes = undefined !== loBytes ? compositor.readElementIds(true, rect) : undefined;
      if (undefined !== loBytes && undefined !== hiBytes) {
        this._elemIdLow = new Uint32Array(loBytes.buffer);
        this._elemIdHi = new Uint32Array(hiBytes.buffer);
      } else {
        this._selector &= ~Pixel.Selector.ElementId;
      }
    }
  }

  public get isEmpty(): boolean { return Pixel.Selector.None === this._selector; }

  public static create(rect: ViewRect, selector: Pixel.Selector, compositor: SceneCompositor): Pixel.Buffer | undefined {
    const pdb = new PixelBuffer(rect, selector, compositor);
    return pdb.isEmpty ? undefined : pdb;
  }
}

// Orchestrates rendering of the scene on behalf of a Target.
// This base class exists only so we don't have to export all the types of the shared Compositor members like Textures, FrameBuffers, etc.
export abstract class SceneCompositor implements IDisposable {
  public abstract get currentRenderTargetIndex(): number;
  public abstract dispose(): void;
  public abstract draw(_commands: RenderCommands): void;
  public abstract drawForReadPixels(_commands: RenderCommands, overlays?: DecorationList): void;
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined;
  public abstract readDepthAndOrder(rect: ViewRect): Uint8Array | undefined;
  public abstract readElementIds(high: boolean, rect: ViewRect): Uint8Array | undefined;

  public abstract get elementId0(): TextureHandle;
  public abstract get elementId1(): TextureHandle;
  public abstract get depthAndOrder(): TextureHandle;

  protected constructor() { }

  public static create(target: Target): SceneCompositor {
    return System.instance.capabilities.supportsDrawBuffers ? new MRTCompositor(target) : new MPCompositor(target);
  }
}

// The actual base class. Specializations are provided based on whether or not multiple render targets are supported.
abstract class Compositor extends SceneCompositor {
  protected _target: Target;
  protected _width: number = -1;
  protected _height: number = -1;
  protected _textures = new Textures();
  protected _depth?: DepthBuffer;
  protected _frameBuffers: FrameBuffers;
  protected _geom: Geometry;
  protected _readPickDataFromPingPong: boolean = true;
  protected _opaqueRenderState = new RenderState();
  protected _translucentRenderState = new RenderState();
  protected _noDepthMaskRenderState = new RenderState();
  protected _stencilSetRenderState = new RenderState();
  protected _stencilCopyRenderState = new RenderState();
  protected _debugStencilRenderState = new RenderState();
  protected _debugStencil: number = 0; // 0 to draw stencil volumes normally, 1 to draw as opaque, 2 to draw blended

  public abstract get currentRenderTargetIndex(): number;

  protected abstract clearOpaque(_needComposite: boolean): void;
  protected abstract renderOpaque(_commands: RenderCommands, _needComposite: boolean, _renderForReadPixels: boolean): void;
  protected abstract clearTranslucent(): void;
  protected abstract renderTranslucent(_commands: RenderCommands): void;
  protected abstract getBackgroundFbo(_needComposite: boolean): FrameBuffer;
  protected abstract pingPong(): void;

  protected constructor(target: Target, fbos: FrameBuffers, geometry: Geometry) {
    super();

    this._target = target;
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
    this._stencilSetRenderState.stencil.frontOperation.fail = GL.StencilOperation.Keep;
    this._stencilSetRenderState.stencil.frontOperation.zFail = GL.StencilOperation.IncrWrap;
    this._stencilSetRenderState.stencil.frontOperation.zPass = GL.StencilOperation.Keep;
    this._stencilSetRenderState.stencil.backFunction.function = GL.StencilFunction.Always;
    this._stencilSetRenderState.stencil.backOperation.fail = GL.StencilOperation.Keep;
    this._stencilSetRenderState.stencil.backOperation.zFail = GL.StencilOperation.DecrWrap;
    this._stencilSetRenderState.stencil.backOperation.zPass = GL.StencilOperation.Keep;

    this._stencilCopyRenderState.flags.depthTest = false;
    this._stencilCopyRenderState.flags.depthMask = false;
    this._stencilCopyRenderState.flags.colorWrite = true;
    this._stencilCopyRenderState.flags.stencilTest = true;
    this._stencilCopyRenderState.stencil.frontFunction.function = GL.StencilFunction.Equal;
    this._stencilCopyRenderState.stencil.frontOperation.zFail = GL.StencilOperation.Zero;
    this._stencilCopyRenderState.stencil.frontOperation.zPass = GL.StencilOperation.Zero;
    this._stencilCopyRenderState.stencil.backFunction.function = GL.StencilFunction.Equal;
    this._stencilCopyRenderState.stencil.backOperation.zFail = GL.StencilOperation.Zero;
    this._stencilCopyRenderState.stencil.backOperation.zPass = GL.StencilOperation.Zero;
    this._stencilCopyRenderState.flags.blend = true;
    this._stencilCopyRenderState.blend.setBlendFunc(GL.BlendFactor.Zero, GL.BlendFactor.ConstColor);
    this._stencilCopyRenderState.blend.color = [0.5, 0.5, 0.5, 1.0];
    if (this._debugStencil > 0) {
      this._debugStencilRenderState.flags.depthTest = true;
      this._debugStencilRenderState.flags.blend = true;
      this._debugStencilRenderState.blend.setBlendFunc(GL.BlendFactor.OneMinusConstColor, GL.BlendFactor.ConstColor);
      this._debugStencilRenderState.blend.color = [0.67, 0.67, 0.67, 1.0];
    }
  }

  public update(): boolean {
    const rect = this._target.viewRect;
    const width = rect.width;
    const height = rect.height;

    if (this._textures.accumulation !== undefined && width === this._width && height === this._height) {
      return true;
    }

    this._width = width;
    this._height = height;

    const result = this.init();
    assert(result);
    return result;
  }

  public draw(commands: RenderCommands) {
    if (!this.update()) {
      assert(false);
      return;
    }

    const flags = commands.compositeFlags;
    const needTranslucent = CompositeFlags.None !== (flags & CompositeFlags.Translucent);
    const needHilite = CompositeFlags.None !== (flags & CompositeFlags.Hilite);
    const needComposite = needTranslucent || needHilite;

    // Clear output targets
    this.clearOpaque(needComposite);

    // Render the background
    this.renderBackground(commands, needComposite);
    this._target.setFrameTime();

    // Render the sky box
    this.renderSkyBox(commands, needComposite);
    this._target.setFrameTime();

    // Render the terrain
    this.renderTerrain(commands, needComposite);
    this._target.setFrameTime();

    // Enable clipping
    this._target.pushActiveVolume();
    this._target.setFrameTime();

    // Render opaque geometry
    this.renderOpaque(commands, needComposite, false);
    this.renderStencilVolumes(commands, needComposite);
    this._target.setFrameTime();

    if (needComposite) {
      this._geom.composite!.update(flags);
      this.clearTranslucent();
      this.renderTranslucent(commands);
      this._target.setFrameTime();
      this.renderHilite(commands);
      this._target.setFrameTime();
      this.composite();
    } else {
      this._target.setFrameTime();
      this._target.setFrameTime();
    }
    this._target.popActiveVolume();
  }

  public get fullHeight(): number { return this._target.viewRect.height; }

  public drawForReadPixels(commands: RenderCommands, overlays?: DecorationList) {
    if (!this.update()) {
      assert(false);
      return;
    }

    this.clearOpaque(false);

    // On entry the RenderCommands has been initialized for all scene graphics and pickable decorations with the exception of world overlays.
    // It's possible we have no pickable scene graphics or decorations, but do have pickable world overlays.
    const haveRenderCommands = !commands.isEmpty;
    if (haveRenderCommands) {
      this._target.pushActiveVolume();
      this.renderOpaque(commands, false, true);
      this._target.popActiveVolume();
    }

    if (undefined === overlays || 0 === overlays.list.length)
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
    this.renderOpaque(commands, false, true);
  }
  public readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    return PixelBuffer.create(rect, selector, this);
  }

  public readDepthAndOrder(rect: ViewRect): Uint8Array | undefined { return this.readFrameBuffer(rect, this._frameBuffers.depthAndOrder); }

  public readElementIds(high: boolean, rect: ViewRect): Uint8Array | undefined {
    const tex = high ? this._textures.idHigh : this._textures.idLow;
    if (undefined === tex)
      return undefined;

    const fbo = FrameBuffer.create([tex]);
    const result = this.readFrameBuffer(rect, fbo);

    dispose(fbo);

    return result;
  }

  private readFrameBuffer(rect: ViewRect, fbo?: FrameBuffer): Uint8Array | undefined {
    if (undefined === fbo || !fbo.isValid)
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
    dispose(this._textures);
    dispose(this._frameBuffers);
    dispose(this._geom);
  }

  private init(): boolean {
    this.dispose();
    this._depth = System.instance.createDepthBuffer(this._width, this._height);
    if (this._depth !== undefined) {
      return this._textures.init(this._width, this._height) && this._frameBuffers.init(this._textures, this._depth) && this._geom.init(this._textures);
    }
    return false;
  }

  private renderTerrain(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.Terrain);
    if (0 === cmds.length) {
      return;
    }

    this._target.plan!.selectTerrainFrustum();
    this._target.changeFrustum(this._target.plan!);

    const fbStack = System.instance.frameBufferStack;
    const fbo = this.getBackgroundFbo(needComposite);
    fbStack.execute(fbo, true, () => {
      System.instance.applyRenderState(this.getRenderState(RenderPass.Terrain));
      this._target.techniques.execute(this._target, cmds, RenderPass.Terrain);
    });

    this._target.plan!.selectViewFrustum();
    this._target.changeFrustum(this._target.plan!);
  }

  private renderSkyBox(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.SkyBox);
    if (0 === cmds.length) {
      return;
    }

    const fbStack = System.instance.frameBufferStack;
    const fbo = this.getBackgroundFbo(needComposite);
    fbStack.execute(fbo, true, () => {
      this._target.pushState(this._target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.SkyBox));
      this._target.techniques.execute(this._target, cmds, RenderPass.SkyBox);
      this._target.popBranch();
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
      this._target.pushState(this._target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.Background));
      this._target.techniques.execute(this._target, cmds, RenderPass.Background);
      this._target.popBranch();
    });
  }

  private renderStencilVolumes(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.StencilVolume);
    if (0 === cmds.length) {
      return;
    }

    if (this._debugStencil > 0) {
      System.instance.frameBufferStack.execute(this.getBackgroundFbo(needComposite), true, () => {
        if (1 === this._debugStencil) {
          System.instance.applyRenderState(this.getRenderState(RenderPass.OpaqueGeneral));
          this._target.techniques.execute(this._target, cmds, RenderPass.OpaqueGeneral);
        } else {
          this._target.pushState(this._target.decorationState);
          System.instance.applyRenderState(this._debugStencilRenderState);
          this._target.techniques.execute(this._target, cmds, RenderPass.StencilVolume);
          this._target.popBranch();
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
    fbStack.execute(fboSet!, true, () => {
      System.instance.context.clearStencil(0);
      System.instance.context.clear(GL.BufferBit.Stencil);
    });

    // Set the stencil using the stencil command list.
    fbStack.execute(fboSet!, true, () => {
      this._target.pushState(this._target.decorationState);
      System.instance.applyRenderState(this._stencilSetRenderState);
      this._target.techniques.execute(this._target, cmds, RenderPass.StencilVolume);
      this._target.popBranch();
    });

    // Process the stencil volumes, blending into the current color buffer.
    fbStack.execute(fboCopy!, true, () => {
      this._target.pushState(this._target.decorationState);
      System.instance.applyRenderState(this._stencilCopyRenderState);
      const params = new DrawParams(this._target, this._geom.stencilCopy!);
      this._target.techniques.draw(params);
      this._target.popBranch();
    });

  }

  private renderHilite(commands: RenderCommands) {
    // Clear the hilite buffer.
    const system = System.instance;
    system.frameBufferStack.execute(this._frameBuffers.hilite!, true, () => {
      system.context.clearColor(0, 0, 0, 0);
      system.context.clear(GL.BufferBit.Color);

      this.drawPass(commands, RenderPass.Hilite);
    });
  }

  private composite() {
    System.instance.applyRenderState(RenderState.defaults);
    const params = new DrawParams(this._target, this._geom.composite!);
    this._target.techniques.draw(params);
  }

  private getRenderState(pass: RenderPass): RenderState {
    switch (pass) {
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
      case RenderPass.OpaqueGeneral:
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
    this._target.techniques.execute(this._target, cmds, pass);
  }
}

class MRTFrameBuffers extends FrameBuffers {
  public opaqueAll?: FrameBuffer;
  public opaqueAndCompositeAll?: FrameBuffer;
  public pingPong?: FrameBuffer;
  public translucent?: FrameBuffer;
  public clearTranslucent?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    if (!super.init(textures, depth))
      return false;

    assert(undefined === this.opaqueAll);

    const boundColor = System.instance.frameBufferStack.currentColorBuffer;
    if (undefined === boundColor)
      return false;

    const colorAndPick = [boundColor, textures.idLow!, textures.idHigh!, textures.depthAndOrder!];
    this.opaqueAll = FrameBuffer.create(colorAndPick, depth);

    colorAndPick[0] = textures.color!;
    this.opaqueAndCompositeAll = FrameBuffer.create(colorAndPick, depth);

    const colors = [textures.accumulation!, textures.revealage!];
    this.translucent = FrameBuffer.create(colors, depth);
    this.clearTranslucent = FrameBuffer.create(colors);

    // We borrow the SceneCompositor's accum, hilite, and revealage textures for the surface pass.
    // First we render edges, writing to our textures.
    // Then we copy our textures to borrowed textures.
    // Finally we render surfaces, writing to our textures and reading from borrowed textures.
    const pingPong = [textures.accumulation!, textures.hilite!, textures.revealage!];
    this.pingPong = FrameBuffer.create(pingPong);

    return undefined !== this.opaqueAll
      && undefined !== this.opaqueAndCompositeAll
      && undefined !== this.pingPong
      && undefined !== this.translucent
      && undefined !== this.clearTranslucent;
  }

  public dispose(): void {
    super.dispose();

    this.opaqueAll = dispose(this.opaqueAll);
    this.opaqueAndCompositeAll = dispose(this.opaqueAndCompositeAll);
    this.pingPong = dispose(this.pingPong);
    this.translucent = dispose(this.translucent);
    this.clearTranslucent = dispose(this.clearTranslucent);
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

    this.copyPickBuffers = CopyPickBufferGeometry.createGeometry(textures.idLow!.getHandle()!, textures.idHigh!.getHandle()!, textures.depthAndOrder!.getHandle()!);
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

  public get elementId0(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 0 : 1); }
  public get elementId1(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 1 : 2); }
  public get depthAndOrder(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 2 : 3); }

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
      const params = new DrawParams(this._target, this._geometry.clearPickAndColor!);
      this._target.techniques.draw(params);

      // Clear depth buffer
      system.applyRenderState(RenderState.defaults); // depthMask == true.
      system.context.clearDepth(1.0);
      system.context.clear(GL.BufferBit.Depth);
    });
  }

  protected renderOpaque(commands: RenderCommands, needComposite: boolean, renderForReadPixels: boolean) {
    // Output the first 2 passes to color and pick data buffers. (All 3 in the case of rendering for readPixels()).
    this._readPickDataFromPingPong = true;

    let fbStack = System.instance.frameBufferStack;
    fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeAll! : this._fbos.opaqueAll!, true, () => {
      this.drawPass(commands, RenderPass.OpaqueLinear);
      this.drawPass(commands, RenderPass.OpaquePlanar, true);
      if (renderForReadPixels) {
        this.drawPass(commands, RenderPass.OpaqueGeneral, true);
      }
    });
    this._readPickDataFromPingPong = false;

    // The general pass (and following) will not bother to write to pick buffers and so can read from the actual pick buffers.
    if (!renderForReadPixels) {
      fbStack = System.instance.frameBufferStack;
      fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!, true, () => {
        this.drawPass(commands, RenderPass.OpaqueGeneral, false);
        this.drawPass(commands, RenderPass.HiddenEdge, false);
      });
    }
  }

  protected clearTranslucent() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);
    System.instance.frameBufferStack.execute(this._fbos.clearTranslucent!, true, () => {
      const params = new DrawParams(this._target, this._geometry.clearTranslucent!);
      this._target.techniques.draw(params);
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
      const params = new DrawParams(this._target, this._geometry.copyPickBuffers!);
      this._target.techniques.draw(params);
    });
  }

  protected getBackgroundFbo(needComposite: boolean): FrameBuffer { return needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!; }

  private get _samplerFbo(): FrameBuffer { return this._readPickDataFromPingPong ? this._fbos.pingPong! : this._fbos.opaqueAll!; }
  private getSamplerTexture(index: number) { return this._samplerFbo.getColor(index); }
}

class MPFrameBuffers extends FrameBuffers {
  public accumulation?: FrameBuffer;
  public revealage?: FrameBuffer;
  public idLow?: FrameBuffer;
  public idHigh?: FrameBuffer;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    if (!super.init(textures, depth))
      return false;

    assert(undefined === this.accumulation);

    this.accumulation = FrameBuffer.create([textures.accumulation!], depth);
    this.revealage = FrameBuffer.create([textures.revealage!], depth);
    this.idLow = FrameBuffer.create([textures.idLow!]);
    this.idHigh = FrameBuffer.create([textures.idHigh!]);

    return undefined !== this.accumulation && undefined !== this.revealage && undefined !== this.idLow && undefined !== this.idHigh;
  }

  public dispose(): void {
    super.dispose();

    this.accumulation = dispose(this.accumulation);
    this.revealage = dispose(this.revealage);
    this.idLow = dispose(this.idLow);
    this.idHigh = dispose(this.idHigh);
  }
}

class MPGeometry extends Geometry {
  public copyColor?: SingleTexturedViewportQuadGeometry;

  public init(textures: Textures): boolean {
    if (!super.init(textures))
      return false;

    assert(undefined === this.copyColor);
    this.copyColor = SingleTexturedViewportQuadGeometry.createGeometry(textures.idLow!.getHandle()!, TechniqueId.CopyColor);
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

  public constructor(target: Target) {
    super(target, new MPFrameBuffers(), new MPGeometry());
  }

  private get _fbos(): MPFrameBuffers { return this._frameBuffers as MPFrameBuffers; }
  private get _geometry(): MPGeometry { return this._geom as MPGeometry; }

  public get currentRenderTargetIndex(): number { return this._currentRenderTargetIndex; }
  public get elementId0(): TextureHandle { return this._readPickDataFromPingPong ? this._textures.accumulation! : this._textures.idLow!; }
  public get elementId1(): TextureHandle { return this._readPickDataFromPingPong ? this._textures.hilite! : this._textures.idHigh!; }
  public get depthAndOrder(): TextureHandle { return this._readPickDataFromPingPong ? this._textures.revealage! : this._textures.depthAndOrder!; }

  protected getBackgroundFbo(needComposite: boolean): FrameBuffer { return needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!; }

  protected clearOpaque(needComposite: boolean): void {
    const bg = FloatRgba.fromColorDef(this._target.bgColor);
    this.clearFbo(needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!, bg.red, bg.green, bg.blue, bg.alpha, true);
    this.clearFbo(this._fbos.depthAndOrder!, 0, 0, 0, 0, true);
    this.clearFbo(this._fbos.idLow!, 0, 0, 0, 0, true);
    this.clearFbo(this._fbos.idHigh!, 0, 0, 0, 0, true);
  }

  protected renderOpaque(commands: RenderCommands, needComposite: boolean, renderForReadPixels: boolean): void {
    // Output the first 2 passes to color and pick data buffers. (All 3 in the case of rendering for readPixels()).
    this._readPickDataFromPingPong = true;
    const colorFbo = needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!;
    this.drawOpaquePass(colorFbo, commands, RenderPass.OpaqueLinear, false);
    this.drawOpaquePass(colorFbo, commands, RenderPass.OpaquePlanar, true);
    if (renderForReadPixels)
      this.drawOpaquePass(colorFbo, commands, RenderPass.OpaqueGeneral, true);

    this._readPickDataFromPingPong = false;

    // The general pass (and following) will not bother to write to pick buffers and so can read from the actual pick buffers.
    if (!renderForReadPixels) {
      System.instance.frameBufferStack.execute(colorFbo, true, () => {
        this.drawPass(commands, RenderPass.OpaqueGeneral, false);
        this.drawPass(commands, RenderPass.HiddenEdge, false);
      });
    }
  }

  // ###TODO: For readPixels(), could skip rendering color...also could skip rendering depth and/or element ID depending upon selector...
  private drawOpaquePass(colorFbo: FrameBuffer, commands: RenderCommands, pass: RenderPass, pingPong: boolean): void {
    const stack = System.instance.frameBufferStack;
    stack.execute(colorFbo, true, () => this.drawPass(commands, pass, pingPong));
    this._currentRenderTargetIndex++;
    stack.execute(this._fbos.idLow!, true, () => this.drawPass(commands, pass, false));
    this._currentRenderTargetIndex++;
    stack.execute(this._fbos.idHigh!, true, () => this.drawPass(commands, pass, false));
    this._currentRenderTargetIndex++;
    stack.execute(this._fbos.depthAndOrder!, true, () => this.drawPass(commands, pass, false));
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

    this.copyFbo(this._textures.idLow!, this._fbos.accumulation!);
    this.copyFbo(this._textures.idHigh!, this._fbos.revealage!);
    this.copyFbo(this._textures.depthAndOrder!, this._fbos.hilite!);
  }

  private copyFbo(src: TextureHandle, dst: FrameBuffer): void {
    const geom = this._geometry.copyColor!;
    geom.texture = src.getHandle()!;
    System.instance.frameBufferStack.execute(dst, true, () => {
      const params = new DrawParams(this._target, geom);
      this._target.techniques.draw(params);
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
