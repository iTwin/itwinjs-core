/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, IDisposable } from "@bentley/bentleyjs-core";
// import { Texture, TextureCreateParams } from "@bentley/imodeljs-common";
import { GL } from "./GL";
import { System } from "./System";

export const enum TextureFlags {
  None = 0,
  UseMipMaps = 1 << 0,
  Interpolate = 1 << 1,
  PreserveData = 1 << 2,
}

export class TextureParams {
  private readonly _data?: Uint8Array;
  public readonly width: number;
  public readonly height: number;
  public readonly format: GL.Texture.Format;
  public readonly dataType: GL.Texture.DataType;
  public wrapMode: GL.Texture.WrapMode;
  private _flags = TextureFlags.None;
  public isGlyph = false;
  public isTileSection = false;

  public get hasTranslucency() { return GL.Texture.Format.Rgba === this.format; }
  public get wantPreserveData() { return TextureFlags.None !== (this._flags & TextureFlags.PreserveData); }
  public set wantPreserveData(want: boolean) { this.setFlag(TextureFlags.PreserveData, want); }
  public get wantInterpolate() { return TextureFlags.None !== (this._flags & TextureFlags.Interpolate); }
  public set wantInterpolate(want: boolean) { this.setFlag(TextureFlags.Interpolate, want); }
  public get wantUseMipMaps() { return TextureFlags.None !== (this._flags & TextureFlags.UseMipMaps); }
  public set wantUseMipMaps(want: boolean) { this.setFlag(TextureFlags.UseMipMaps, want); }

  public static create(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType, wrap = GL.Texture.WrapMode.Repeat, flags = TextureFlags.Interpolate) {
    return new TextureParams(width, height, format, dataType, wrap, flags);
  }

  public static createForImage(width: number, imageBytes: Uint8Array, isTranslucent: boolean, wrap = GL.Texture.WrapMode.Repeat, flags = TextureFlags.Interpolate) {
    const format = isTranslucent ? GL.Texture.Format.Rgba : GL.Texture.Format.Rgb;
    const bytesPer = isTranslucent ? 4 : 3;
    const height = imageBytes.length / (width * bytesPer);
    assert(0 < height);
    assert(Math.floor(height) === height);
    return new TextureParams(width, height, format, GL.Texture.DataType.UnsignedByte, wrap, flags, imageBytes);
  }

  private constructor(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType, wrap: GL.Texture.WrapMode, flags: TextureFlags, data?: Uint8Array) {
    assert(0 < width && 0 < height);

    this._data = data;
    this.width = width;
    this.height = height;
    this.format = format;
    this.dataType = dataType;
    this.wrapMode = wrap;
    this._flags = flags;

    // silence unused variable warnings...
    assert(undefined === this._data || 0 > this._data.length);
  }

  private setFlag(flag: TextureFlags, enable: boolean) {
    if (enable)
      this._flags |= flag;
    else
      this._flags &= ~flag;
  }
}

// A handle to a WebGLTexture object.
export class TextureHandle implements IDisposable {
  private readonly _params: TextureParams;
  private _glTexture?: WebGLTexture;
  private _isValid = true;

  // ###TODO: Do gl.createTexture() immediately - we only did that lazily in C++ because of threading concerns...
  public constructor(params: TextureParams) {
    this._params = params;

    // silence unused variable warnings...
    assert(undefined === this._glTexture);
    assert(this._isValid);
    assert(0 < this._params.width);
  }

  public dispose() {
    if (undefined !== this._glTexture) {
      System.instance.context.deleteTexture(this._glTexture);
      this._glTexture = undefined;
      this._isValid = false;
    }
  }
}
