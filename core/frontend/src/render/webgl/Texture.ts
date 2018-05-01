/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, IDisposable } from "@bentley/bentleyjs-core";
// import { Texture, TextureCreateParams } from "@bentley/imodeljs-common";
import { GL } from "./GL";
import { System, Capabilities } from "./System";

/** A private enum used to track certain desired texture creation parameters. */
const enum TextureFlags {
  None = 0,
  UseMipMaps = 1 << 0,
  Interpolate = 1 << 1,
  PreserveData = 1 << 2,
}

/** A private utility class used by TextureHandle to internally create textures with differing proprties. */
class TextureCreateParams {
  public data?: Uint8Array;
  public width: number = 0;
  public height: number = 0;
  public format: GL.Texture.Format = GL.Texture.Format.Rgb;
  public dataType: GL.Texture.DataType = GL.Texture.DataType.UnsignedByte;
  public wrapMode: GL.Texture.WrapMode = GL.Texture.WrapMode.ClampToEdge;
  private _flags = TextureFlags.None;

  public get hasTranslucency() { return GL.Texture.Format.Rgba === this.format; }
  public get wantPreserveData() { return TextureFlags.None !== (this._flags & TextureFlags.PreserveData); }
  public set wantPreserveData(want: boolean) { this.setFlag(TextureFlags.PreserveData, want); }
  public get wantInterpolate() { return TextureFlags.None !== (this._flags & TextureFlags.Interpolate); }
  public set wantInterpolate(want: boolean) { this.setFlag(TextureFlags.Interpolate, want); }
  public get wantUseMipMaps() { return TextureFlags.None !== (this._flags & TextureFlags.UseMipMaps); }
  public set wantUseMipMaps(want: boolean) { this.setFlag(TextureFlags.UseMipMaps, want); }

  private setFlag(flag: TextureFlags, enable: boolean) {
    if (enable)
      this._flags |= flag;
    else
      this._flags &= ~flag;
  }
}

/** Encapsulates a handle to a WebGLTexture object created based on desired parameters. */
export class TextureHandle implements IDisposable {
  public readonly width: number;
  public readonly height: number;
  public readonly format: GL.Texture.Format;
  public readonly dataType: GL.Texture.DataType;
  public readonly data?: Uint8Array;

  private _glTexture?: WebGLTexture;

  /** Retrieves actual WebGLTexture object associated with this texture. */
  public getHandle(): WebGLTexture | undefined { return this._glTexture; }

  /** Creates a texture for an image based on certain parameters. */
  public static createForImage(width: number, imageBytes: Uint8Array, isTranslucent: boolean, wrap = GL.Texture.WrapMode.Repeat, wantInterpolate = true, isGlyph = false, isTileSection = false) {
    const glTex: WebGLTexture | undefined = this.createTextureHandle();
    if (undefined === glTex) {
      return undefined;
    }

    const caps: Capabilities = System.instance.capabilities;

    const params: TextureCreateParams = new TextureCreateParams();
    params.format = isTranslucent ? GL.Texture.Format.Rgba : GL.Texture.Format.Rgb;
    params.width = width;
    params.height = imageBytes.length / (width * (isTranslucent ? 4 : 3));
    params.data = imageBytes;
    params.wrapMode = wrap;
    params.wantInterpolate = wantInterpolate;
    params.wantPreserveData = false; // ###TODO: When is this true?

    let targetWidth: number = params.width;
    let targetHeight: number = params.height;

    if (isGlyph) {
      params.wrapMode = GL.Texture.WrapMode.ClampToEdge;
      params.wantUseMipMaps = true; // in order to always use mipmaps, must resize to power of 2
      targetWidth = TextureHandle.roundToMultipleOfTwo(targetWidth);
      targetHeight = TextureHandle.roundToMultipleOfTwo(targetHeight);
    } else if (!caps.supportsNonPowerOf2Textures && (!TextureHandle.isPowerOfTwo(targetWidth) || !TextureHandle.isPowerOfTwo(targetHeight))) {
      if (GL.Texture.WrapMode.ClampToEdge === params.wrapMode) {
        // NPOT are supported but not mipmaps
        // Probably on poor hardware so I choose to disable mimpaps for lower memory usage over quality. If quality is required we need to resize the image to a pow of 2.
        // Above comment is not necessarily true - WebGL doesn't support NPOT mipmapping, only supporting base NPOT caps
        params.wantUseMipMaps = false;
      } else if (GL.Texture.WrapMode.Repeat === params.wrapMode) {
        targetWidth = TextureHandle.roundToMultipleOfTwo(targetWidth);
        targetHeight = TextureHandle.roundToMultipleOfTwo(targetHeight);
      }
    }

    if (isTileSection) {
      // Largely for sheet tiles.  In some extreme cases, mipmapping lowers quality significantly due to a stretched view
      // and fuzziness introduced by combining the layers.  A straight GL_LINEAR blend gives a better picture.
      params.wantUseMipMaps = false;
      params.wantInterpolate = true;
    }

    if (targetWidth !== params.width || targetWidth !== params.height) {
      // ###TODO: resize the image
    }

    assert(0 < params.height);
    assert(Math.floor(params.height) === params.height);

    return new TextureHandle(glTex, params);
  }

  public dispose() {
    if (undefined !== this._glTexture) {
      System.instance.context.deleteTexture(this._glTexture);
      this._glTexture = undefined;
    }
  }

  private constructor(glTex: WebGLTexture, params: TextureCreateParams) {
      const gl: WebGLRenderingContext = System.instance.context;

      this.width = params.width;
      this.height = params.height;
      this.format = params.format;
      this.dataType = params.dataType;
      if (params.wantPreserveData)
        this.data = params.data;

      this._glTexture = glTex;

      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // use tightly packed data

      gl.activeTexture(gl.TEXTURE0); // bind the texture object; make sure we do not interfere with other active textures
      gl.bindTexture(gl.TEXTURE_2D, glTex);
      assert(this.width > 0 && this.height > 0);

      // send the texture data
      const pixels: ArrayBufferView | null = params.data !== undefined ? params.data as ArrayBufferView : null;
      gl.texImage2D(gl.TEXTURE_2D, 0, params.format, params.width, params.height, 0, params.format, params.dataType, pixels);

      if (params.wantUseMipMaps) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, params.wantInterpolate ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, params.wantInterpolate ? gl.LINEAR : gl.NEAREST);
      }

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, params.wrapMode);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, params.wrapMode);

      gl.bindTexture(gl.TEXTURE_2D, 0);
    }

  public bind(texUnit: GL.Texture.Unit): boolean {
    if (undefined === this._glTexture)
      return false;
    TextureHandle.bindTexture(texUnit, this._glTexture);
    return true;
  }

  public static bindTexture(texUnit: GL.Texture.Unit, glTex: WebGLTexture | undefined) {
    const gl: WebGLRenderingContext = System.instance.context;
    gl.activeTexture(texUnit);
    gl.bindTexture(gl.TEXTURE_2D, glTex !== undefined ? glTex : null); // ###TODO: might need to set the shader sampler handler here
  }

  private static createTextureHandle(): WebGLTexture | undefined {
    const glTex: WebGLTexture | null = System.instance.context.createTexture();
    if (glTex === null)
      return undefined;
    return glTex;
  }

  private static roundToMultipleOfTwo(num: number): number {
    --num;
    for (let i = 1; i < 32; i <<= 1) {
        num = num | num >> i;
    }
    return num + 1;
  }

  private static isPowerOfTwo(num: number): boolean {
      return (num & (num - 1)) === 0;
  }
}
