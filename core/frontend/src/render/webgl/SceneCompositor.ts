/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FrameBuffer, DepthBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ViewportQuadGeometry, CompositeGeometry, CopyPickBufferGeometry } from "./CachedGeometry";
import { TechniqueId } from "./TechniqueId";
import { dispose } from "./Disposable";
import { System, RenderType } from "./System";
import { assert } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { RenderCommands, DrawParams } from "./DrawCommand";
import { RenderState } from "./RenderState";
import { CompositeFlags, RenderPass } from "./RenderFlags";

class Textures {
  public accumulation?: TextureHandle;
  public revealage?: TextureHandle;
  public color?: TextureHandle;
  public idLow?: TextureHandle;
  public idHigh?: TextureHandle;
  public depthAndOrder?: TextureHandle;
  public hilite?: TextureHandle;

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

    return undefined !== this.accumulation
      && undefined !== this.revealage
      && undefined !== this.color
      && undefined !== this.idLow
      && undefined !== this.idHigh
      && undefined !== this.depthAndOrder
      && undefined !== this.hilite;
  }

  public reset() {
    this.accumulation = dispose(this.accumulation);
    this.revealage = dispose(this.revealage);
    this.color = dispose(this.color);
    this.idLow = dispose(this.idLow);
    this.idHigh = dispose(this.idHigh);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.hilite = dispose(this.hilite);
  }
}

class FrameBuffers {
  public opaqueAll?: FrameBuffer;
  public opaqueColor?: FrameBuffer;
  public opaqueAndCompositeAll?: FrameBuffer;
  public opaqueAndCompositeColor?: FrameBuffer;
  public depthAndOrder?: FrameBuffer;
  public pingPong?: FrameBuffer;
  public translucent?: FrameBuffer;
  public clearTranslucent?: FrameBuffer;
  public hilite?: FrameBuffer;

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

  public reset() {
    this.opaqueAll = dispose(this.opaqueAll);
    this.opaqueColor = dispose(this.opaqueColor);
    this.opaqueAndCompositeAll = dispose(this.opaqueAndCompositeAll);
    this.opaqueAndCompositeColor = dispose(this.opaqueAndCompositeColor);
    this.depthAndOrder = dispose(this.depthAndOrder);
    this.pingPong = dispose(this.pingPong);
    this.translucent = dispose(this.translucent);
    this.clearTranslucent = dispose(this.clearTranslucent);
    this.hilite = dispose(this.hilite);
  }
}

class Geometry {
  public copyPickBuffers?: CopyPickBufferGeometry;
  public composite?: CompositeGeometry;
  public clearTranslucent?: ViewportQuadGeometry;
  public clearPickAndColor?: ViewportQuadGeometry;

  public init(textures: Textures): boolean {
    assert(undefined === this.copyPickBuffers);

    this.copyPickBuffers = CopyPickBufferGeometry.createGeometry(textures.idLow!.getHandle()!, textures.idHigh!.getHandle()!, textures.depthAndOrder!.getHandle()!);
    this.composite = CompositeGeometry.createGeometry(textures.color!.getHandle()!, textures.accumulation!.getHandle()!, textures.revealage!.getHandle()!, textures.hilite!.getHandle()!);
    this.clearTranslucent = ViewportQuadGeometry.create(TechniqueId.OITClearTranslucent);
    this.clearPickAndColor = ViewportQuadGeometry.create(TechniqueId.ClearPickAndColor);

    return undefined !== this.composite && undefined !== this.copyPickBuffers && undefined !== this.clearTranslucent && undefined !== this.clearPickAndColor;
  }

  public reset() {
    /* ###TODO CachedGeometry implements IDisposable
    this.copyPickBuffers = dispose(this.copyPickBuffers);
    this.composite = dispose(this.composite);
    this.clearTranslucent = dispose(this.clearTranslucent);
    this.clearPickAndColor = dispose(this.clearPickAndColor);
     */
    this.copyPickBuffers = undefined;
    this.composite = undefined;
    this.clearTranslucent = undefined;
    this.clearPickAndColor = undefined;
  }
}

export class SceneCompositor {
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

  public constructor(target: Target) {
    this._target = target;

    this._opaqueRenderState.flags.depthTest = true;

    this._translucentRenderState.flags.depthMask = false;
    this._translucentRenderState.flags.blend = this._translucentRenderState.flags.depthTest = true;
    this._translucentRenderState.blend.setBlendFuncSeparate(GL.BlendFactor.One, GL.BlendFactor.Zero, GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);

    this._noDepthMaskRenderState.flags.depthMask = false;
  }

  public update(): boolean {
    const rect = this._target.viewRect;
    const width = rect.width;
    const height = rect.height;

    if (width === this._width && height === this._height) {
      return true;
    }

    this.reset();

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

    this.renderBackground(commands, needComposite);

    // Enable clipping
    this._target.pushActiveVolume();

    this.renderOpaque(commands, needComposite);

    if (needComposite) {
      this._geometry.composite!.update(flags);
      this.clearTranslucent();
      this.renderTranslucent(commands);
      this.renderHilite(commands);
      this.composite();
    }

    this._target.popActiveVolume();
  }

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

  public get elementId0(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 0 : 1); }
  public get elementId1(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 1 : 2); }
  public get depthAndOrder(): TextureHandle { return this.getSamplerTexture(this._readPickDataFromPingPong ? 2 : 3); }

  public reset() {
    this._depth = dispose(this._depth);
    this._textures.reset();
    this._fbos.reset();
    this._geometry.reset();
  }

  private init(): boolean {
    this._depth = System.instance.createDepthBuffer(this._width, this._height);

    return undefined !== this._depth
      && this._textures.init(this._width, this._height)
      && this._fbos.init(this._textures, this._depth)
      && this._geometry.init(this._textures);
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
    const fbStack = System.instance.frameBufferStack;
    fbStack.execute(needComposite ? this._fbos.opaqueAndCompositeAll! : this._fbos.opaqueAll!, true, () => {
      this.drawPass(commands, RenderPass.OpaqueLinear);
      this.drawPass(commands, RenderPass.OpaquePlanar, true);
      if (renderForReadPixels) {
        this.drawPass(commands, RenderPass.OpaqueGeneral, true);
      }

      this._readPickDataFromPingPong = false;
    });

    // The general pass (and following) will not bother to write to pick buffers and so can read from the actual pick buffers.
    if (!renderForReadPixels) {
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

    const fbo = needComposite ? this._fbos.opaqueAndCompositeColor! : this._fbos.opaqueColor!;
    const target = this._target;
    System.instance.frameBufferStack.execute(fbo, true, () => {
      target.pushState(target.decorationState);
      System.instance.applyRenderState(this.getRenderState(RenderPass.Background));
      target.techniques.execute(target, cmds, RenderPass.Background);
      target.popBranch();
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
