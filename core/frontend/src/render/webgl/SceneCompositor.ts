/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FrameBuffer, DepthBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ViewportQuadGeometry, CompositeGeometry, CopyPickBufferGeometry } from "./CachedGeometry";
import { Vector3d } from "@bentley/geometry-core";
import { TechniqueId } from "./TechniqueId";
import { dispose } from "./Disposable";
import { System, RenderType } from "./System";
import { Pixel } from "../System";
import { ViewRect } from "../../Viewport";
import { assert, Id64, IDisposable } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { RenderCommands, DrawParams } from "./DrawCommand";
import { RenderState } from "./RenderState";
import { CompositeFlags, RenderPass, RenderOrder } from "./RenderFlags";

class Textures implements IDisposable {
  public accumulation?: TextureHandle;
  public revealage?: TextureHandle;
  public color?: TextureHandle;
  public idLow?: TextureHandle;
  public idHigh?: TextureHandle;
  public depthAndOrder?: TextureHandle;
  public hilite?: TextureHandle;
  private _isDisposed: boolean = true;

  public dispose() {
    if (!this._isDisposed) {
      dispose(this.accumulation);
      dispose(this.revealage);
      dispose(this.color);
      dispose(this.idLow);
      dispose(this.idHigh);
      dispose(this.depthAndOrder);
      dispose(this.hilite);
    }
    this.accumulation = undefined;
    this.revealage = undefined;
    this.color = undefined;
    this.idLow = undefined;
    this.idHigh = undefined;
    this.depthAndOrder = undefined;
    this.hilite = undefined;
    this._isDisposed = true;
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
        // ###TODO...
      }
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

    // We must check if any one of the textures were created for disposal-tracking purposes
    if (undefined !== this.accumulation
      || undefined !== this.revealage
      || undefined !== this.color
      || undefined !== this.idLow
      || undefined !== this.idHigh
      || undefined !== this.depthAndOrder
      || undefined !== this.hilite) {
      this._isDisposed = false;
    }

    return undefined !== this.accumulation
      && undefined !== this.revealage
      && undefined !== this.color
      && undefined !== this.idLow
      && undefined !== this.idHigh
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite;
  }
}

class FrameBuffers implements IDisposable {
  public opaqueAll?: FrameBuffer;
  public opaqueColor?: FrameBuffer;
  public opaqueAndCompositeAll?: FrameBuffer;
  public opaqueAndCompositeColor?: FrameBuffer;
  public depthAndOrder?: FrameBuffer;
  public pingPong?: FrameBuffer;
  public translucent?: FrameBuffer;
  public clearTranslucent?: FrameBuffer;
  public hilite?: FrameBuffer;
  private _isDisposed: boolean = true;

  public init(textures: Textures, depth: DepthBuffer): boolean {
    assert(undefined === this.opaqueAll);

    const boundColor = System.instance.frameBufferStack.currentColorBuffer;
    if (undefined === boundColor) {
      return false;
    }

    const colorAndPick = [boundColor, textures.idLow!, textures.idHigh!, textures.depthAndOrder!];
    this.opaqueAll = FrameBuffer.create(colorAndPick, depth);
    this.opaqueColor = FrameBuffer.create([boundColor], depth);

    colorAndPick[0] = textures.color!;
    this.opaqueAndCompositeAll = FrameBuffer.create(colorAndPick, depth);
    this.opaqueAndCompositeColor = FrameBuffer.create([textures.color!], depth);
    this.depthAndOrder = FrameBuffer.create([textures.depthAndOrder!]);

    const colors = [textures.accumulation!, textures.revealage!];
    this.translucent = FrameBuffer.create(colors, depth);
    this.hilite = FrameBuffer.create([textures.hilite!]);
    this.clearTranslucent = FrameBuffer.create(colors);

    // We borrow the SceneCompositor's accum, hilite, and revealage textures for the surface pass.
    // First we render edges, writing to our textures.
    // Then we copy our textures to borrowed textures.
    // Finally we render surfaces, writing to our textures and reading from borrowed textures.
    const pingPong = [textures.accumulation!, textures.hilite!, textures.revealage!];
    this.pingPong = FrameBuffer.create(pingPong);

    // We must check if any one of the FrameBuffers were created for disposal-tracking purposes
    if (undefined !== this.opaqueAll
      || undefined !== this.opaqueColor
      || undefined !== this.opaqueAndCompositeAll
      || undefined !== this.opaqueAndCompositeColor
      || undefined !== this.depthAndOrder
      || undefined !== this.pingPong
      || undefined !== this.translucent
      || undefined !== this.clearTranslucent
      || undefined !== this.hilite) {
      this._isDisposed = false;
    }

    return undefined !== this.opaqueAll
      && undefined !== this.opaqueColor
      && undefined !== this.opaqueAndCompositeAll
      && undefined !== this.opaqueAndCompositeColor
      && undefined !== this.depthAndOrder
      && undefined !== this.pingPong
      && undefined !== this.translucent
      && undefined !== this.clearTranslucent
      && undefined !== this.hilite;
  }

  public dispose() {
    if (!this._isDisposed) {
      dispose(this.opaqueAll);
      dispose(this.opaqueColor);
      dispose(this.opaqueAndCompositeAll);
      dispose(this.opaqueAndCompositeColor);
      dispose(this.depthAndOrder);
      dispose(this.pingPong);
      dispose(this.translucent);
      dispose(this.clearTranslucent);
      dispose(this.hilite);
    }
    this.opaqueAll = undefined;
    this.opaqueColor = undefined;
    this.opaqueAndCompositeAll = undefined;
    this.opaqueAndCompositeColor = undefined;
    this.depthAndOrder = undefined;
    this.pingPong = undefined;
    this.translucent = undefined;
    this.clearTranslucent = undefined;
    this.hilite = undefined;
    this._isDisposed = true;
  }
}

class Geometry implements IDisposable {
  public copyPickBuffers?: CopyPickBufferGeometry;
  public composite?: CompositeGeometry;
  public clearTranslucent?: ViewportQuadGeometry;
  public clearPickAndColor?: ViewportQuadGeometry;
  private _isDisposed: boolean = true;

  public init(textures: Textures): boolean {
    assert(undefined === this.copyPickBuffers);

    this.copyPickBuffers = CopyPickBufferGeometry.createGeometry(textures.idLow!.getHandle()!, textures.idHigh!.getHandle()!, textures.depthAndOrder!.getHandle()!);
    this.composite = CompositeGeometry.createGeometry(textures.color!.getHandle()!, textures.accumulation!.getHandle()!, textures.revealage!.getHandle()!, textures.hilite!.getHandle()!);
    this.clearTranslucent = ViewportQuadGeometry.create(TechniqueId.OITClearTranslucent);
    this.clearPickAndColor = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);

    this._isDisposed = false;
    return undefined !== this.composite && undefined !== this.copyPickBuffers && undefined !== this.clearTranslucent && undefined !== this.clearPickAndColor;
  }

  public dispose() {
    if (!this._isDisposed) {
      dispose(this.copyPickBuffers);
      dispose(this.composite);
      dispose(this.clearTranslucent);
      dispose(this.clearPickAndColor);
    }
    this.copyPickBuffers = undefined;
    this.composite = undefined;
    this.clearTranslucent = undefined;
    this.clearPickAndColor = undefined;
    this._isDisposed = true;
  }
}

class PixelBuffer implements Pixel.Buffer {
  private readonly _rect: ViewRect;
  private readonly _selector: Pixel.Selector;
  private readonly _elemIdLow?: Uint32Array;
  private readonly _elemIdHi?: Uint32Array;
  private readonly _depthAndOrder?: Uint32Array;

  private get numPixels(): number { return this._rect.width * this._rect.height; }

  private getPixelIndex(x: number, y: number): number {
    if (x < this._rect.left || y < this._rect.top)
      return this.numPixels;

    x -= this._rect.left;
    y -= this._rect.top;
    if (x >= this._rect.width || y >= this._rect.height)
      return this.numPixels;

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
    if (index >= this.numPixels)
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

export class SceneCompositor implements IDisposable {
  private _target: Target;
  private _width: number = -1;
  private _height: number = -1;
  private _textures = new Textures();
  private _depth?: DepthBuffer;
  private _fbos = new FrameBuffers();
  private _geometry = new Geometry();
  private _readPickDataFromPingPong: boolean = true;
  private _opaqueRenderState = new RenderState();
  private _translucentRenderState = new RenderState();
  private _noDepthMaskRenderState = new RenderState();
  private _isDisposed: boolean;

  public constructor(target: Target) {
    this._target = target;

    this._opaqueRenderState.flags.depthTest = true;

    this._translucentRenderState.flags.depthMask = false;
    this._translucentRenderState.flags.blend = this._translucentRenderState.flags.depthTest = true;
    this._translucentRenderState.blend.setBlendFuncSeparate(GL.BlendFactor.One, GL.BlendFactor.Zero, GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);

    this._noDepthMaskRenderState.flags.depthMask = false;
    this._isDisposed = true;  // textures, geometry, and fbos members have not created WebGL resources yet
  }

  public update(): boolean {
    const rect = this._target.viewRect;
    const width = rect.width;
    const height = rect.height;

    if (width === this._width && height === this._height) {
      return true;
    }

    this.dispose();

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

    // Enable clipping
    this._target.pushActiveVolume();
    this._target.setFrameTime();

    // Render opaque geometry
    this.renderOpaque(commands, needComposite);
    this._target.setFrameTime();

    if (needComposite) {
      this._geometry.composite!.update(flags);
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
  public drawForReadPixels(commands: RenderCommands) {
    if (!this.update()) {
      assert(false);
      return;
    }

    this.clearOpaque(false);
    this._target.pushActiveVolume();
    this.renderOpaque(commands, false, true);
    this._target.popActiveVolume();
  }
  public readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined {
    return PixelBuffer.create(rect, selector, this);
  }
  public readDepthAndOrder(rect: ViewRect): Uint8Array | undefined { return this.readFrameBuffer(rect, this._fbos.depthAndOrder); }
  public readElementIds(high: boolean, rect: ViewRect): Uint8Array | undefined {
    const tex = high ? this._textures.idHigh : this._textures.idLow;
    if (undefined === tex)
      return undefined;

    const fbo = FrameBuffer.create([tex]);
    const result = this.readFrameBuffer(rect, fbo);

    if (undefined !== fbo)
      fbo.dispose();

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

  public get elementId0(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 0 : 1); }
  public get elementId1(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 1 : 2); }
  public get depthAndOrder(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 2 : 3); }

  public dispose() {
    if (!this._isDisposed) {
      dispose(this._depth);
      this._textures.dispose();
      this._fbos.dispose();
      this._geometry.dispose();
    }
    this._depth = undefined;
    this._isDisposed = true;
  }

  private init(): boolean {
    this._depth = System.instance.createDepthBuffer(this._width, this._height);
    if (this._depth !== undefined) {
      this._isDisposed = false;
      return this._textures.init(this._width, this._height) && this._fbos.init(this._textures, this._depth) && this._geometry.init(this._textures);
    }
    return false;
  }

  private clearOpaque(needComposite: boolean) {
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

  private renderOpaque(commands: RenderCommands, needComposite: boolean, renderForReadPixels: boolean = false) {
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

  private renderBackground(commands: RenderCommands, needComposite: boolean) {
    const cmds = commands.getCommands(RenderPass.Background);
    if (0 === cmds.length) {
      return;
    }

    const fbStack = System.instance.frameBufferStack;
    fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!, true, () => {
      this._target.pushState(this._target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.Background));
      this._target.techniques.execute(this._target, cmds, RenderPass.Background);
      this._target.popBranch();
    });
  }

  private pingPong() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);
    System.instance.frameBufferStack.execute(this._fbos.pingPong!, true, () => {
      const params = new DrawParams(this._target, this._geometry.copyPickBuffers!);
      this._target.techniques.draw(params);
    });
  }

  private clearTranslucent() {
    System.instance.applyRenderState(this._noDepthMaskRenderState);
    System.instance.frameBufferStack.execute(this._fbos.clearTranslucent!, true, () => {
      const params = new DrawParams(this._target, this._geometry.clearTranslucent!);
      this._target.techniques.draw(params);
    });
  }

  private renderTranslucent(commands: RenderCommands) {
    System.instance.frameBufferStack.execute(this._fbos.translucent!, true, () => {
      this.drawPass(commands, RenderPass.Translucent);
    });
  }

  private renderHilite(commands: RenderCommands) {
    // Clear the hilite buffer.
    const system = System.instance;
    system.frameBufferStack.execute(this._fbos.hilite!, true, () => {
      system.context.clearColor(0, 0, 0, 0);
      system.context.clear(GL.BufferBit.Color);

      this.drawPass(commands, RenderPass.Hilite);
    });
  }

  private composite() {
    System.instance.applyRenderState(RenderState.defaults);
    const params = new DrawParams(this._target, this._geometry.composite!);
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

  private drawPass(commands: RenderCommands, pass: RenderPass, pingPong: boolean = false) {
    const cmds = commands.getCommands(pass);
    if (0 === cmds.length) {
      return;
    } else if (pingPong) {
      this.pingPong();
    }

    System.instance.applyRenderState(this.getRenderState(pass));
    this._target.techniques.execute(this._target, cmds, pass);
  }

  private get samplerFbo(): FrameBuffer { return this._readPickDataFromPingPong ? this._fbos.pingPong! : this._fbos.opaqueAll!; }
  private getSamplerTexture(index: number) { return this.samplerFbo.getColor(index); }
}
