/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { FrameBuffer, DepthBuffer } from "./FrameBuffer";
import { TextureHandle } from "./Texture";
import { Target } from "./Target";
import { ViewportQuadGeometry, CompositeGeometry, CopyPickBufferGeometry } from "./CachedGeometry";
import { TechniqueId } from "./TechniqueId";
import { dispose } from "./Disposable";
import { System, RenderType } from "./System";
import { assert } from "@bentley/bentleyjs-core";
import { GL } from "./GL";

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
    this.accumulation = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, pixelDataType);
    this.revealage = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, pixelDataType);
    this.hilite = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, pixelDataType);

    this.color = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

    this.idLow = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.idHigh = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
    this.depthAndOrder = TextureHandle.createForColor(width, height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);

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
  private _width: number = -1;
  private _height: number = -1;
  private _textures = new Textures();
  private _depth?: DepthBuffer;
  private _fbos = new FrameBuffers();
  private _geometry = new Geometry();
  private _readPickDataFromPingPong: boolean = true;

  public constructor() {
    assert(this._readPickDataFromPingPong); // ###TODO currently unused...
  }

  public update(target: Target): boolean {
    const rect = target.viewRect;
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

  private reset() {
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
}
