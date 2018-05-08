/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, IDisposable } from "@bentley/bentleyjs-core";
import { ImageSourceFormat } from "@bentley/imodeljs-common";
// import { Texture, TextureCreateParams } from "@bentley/imodeljs-common";
import { GL } from "./GL";
import { System, Capabilities } from "./System";
import { UniformHandle } from "./Handle";
import { TextureUnit } from "./RenderFlags";

/** A callback when a TextureHandle is finished loading.  Only relevant for createForImage creation method. */
export type TextureLoadCallback = (t: TextureHandle) => void;

/** A private enum used to track certain desired texture creation parameters. */
const enum TextureFlags {
  None = 0,
  UseMipMaps = 1 << 0,
  Interpolate = 1 << 1,
  PreserveData = 1 << 2,
}

/** A private utility class used by TextureHandle to internally create textures with differing proprties. */
class TextureCreateParams {
  public imageBytes?: Uint8Array = undefined;
  public imageCanvas?: HTMLCanvasElement = undefined;
  public imageFormat?: ImageSourceFormat = undefined;
  public loadCallback?: TextureLoadCallback = undefined;
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
  public readonly imageBytes?: Uint8Array = undefined;
  public readonly imageCanvas?: HTMLCanvasElement = undefined;
  private loadCallback?: TextureLoadCallback;

  private _glTexture?: WebGLTexture;

  /** Retrieves actual WebGLTexture object associated with this texture. */
  public getHandle(): WebGLTexture | undefined { return this._glTexture; }

  /** Binds texture handle (if available) associated with an instantiation of this class to specified texture unit. */
  public bind(texUnit: TextureUnit): boolean {
    if (undefined === this._glTexture)
      return false;
    TextureHandle.bindTexture(texUnit, this._glTexture);
    return true;
  }

  /** Binds specified texture handle to specified texture unit. */
  public static bindTexture(texUnit: TextureUnit, glTex: WebGLTexture | undefined) {
    const gl: WebGLRenderingContext = System.instance.context;
    gl.activeTexture(texUnit);
    gl.bindTexture(gl.TEXTURE_2D, glTex !== undefined ? glTex : null);
  }

  /** Binds this texture to a uniform sampler2D */
  public bindSampler(uniform: UniformHandle, unit: TextureUnit): void {
    if (undefined !== this._glTexture)
      TextureHandle.bindSampler(uniform, this._glTexture, unit);
  }

  /** Binds the specified texture to a uniform sampler2D */
  public static bindSampler(uniform: UniformHandle, tex: WebGLTexture, unit: TextureUnit): void {
    this.bindTexture(unit, tex);
    uniform.setUniform1i(unit);
  }

  /**
   * Creates a texture for a jpeg or png image.  Will not be really loaded until loadCallback is called.  If
   * you do not specify a loadCallback, you cannot rely on the texture being loaded at any particular time.
   * A 1x1 opaque white texture will be bound until the image is loaded and the real texture is fully generated.
   */
  public static createForImage(width: number, height: number, imageBytes: Uint8Array, imageFormat: ImageSourceFormat, isTranslucent: boolean, loadCallback?: TextureLoadCallback, useMipMaps = true, isGlyph = false, isTileSection = false, wantPreserveData = false) {
    const glTex: WebGLTexture | undefined = this.createTextureHandle();
    if (undefined === glTex) {
      return undefined;
    }

    const caps: Capabilities = System.instance.capabilities;

    const params: TextureCreateParams = new TextureCreateParams();
    params.format = isTranslucent ? GL.Texture.Format.Rgba : GL.Texture.Format.Rgb;
    params.width = width;
    params.height = height;
    params.imageBytes = imageBytes;
    params.imageFormat = imageFormat;
    params.wrapMode = isTileSection ? GL.Texture.WrapMode.ClampToEdge : GL.Texture.WrapMode.Repeat;
    params.wantUseMipMaps = useMipMaps;
    params.wantPreserveData = wantPreserveData;
    params.loadCallback = loadCallback;

    let targetWidth: number = params.width;
    let targetHeight: number = params.height;

    if (isGlyph) {
      params.wrapMode = GL.Texture.WrapMode.ClampToEdge;
      params.wantUseMipMaps = true; // in order to always use mipmaps, must resize to power of 2
      targetWidth = TextureHandle.nextHighestPowerOfTwo(targetWidth);
      targetHeight = TextureHandle.nextHighestPowerOfTwo(targetHeight);
    } else if (!caps.supportsNonPowerOf2Textures && (!TextureHandle.isPowerOfTwo(targetWidth) || !TextureHandle.isPowerOfTwo(targetHeight))) {
      if (GL.Texture.WrapMode.ClampToEdge === params.wrapMode) {
        // NPOT are supported but not mipmaps
        // Probably on poor hardware so I choose to disable mipmaps for lower memory usage over quality. If quality is required we need to resize the image to a pow of 2.
        // Above comment is not necessarily true - WebGL doesn't support NPOT mipmapping, only supporting base NPOT caps
        params.wantUseMipMaps = false;
      } else if (GL.Texture.WrapMode.Repeat === params.wrapMode) {
        targetWidth = TextureHandle.nextHighestPowerOfTwo(targetWidth);
        targetHeight = TextureHandle.nextHighestPowerOfTwo(targetHeight);
      }
    }

    if (isTileSection) {
      // Largely for sheet tiles.  In some extreme cases, mipmapping lowers quality significantly due to a stretched view
      // and fuzziness introduced by combining the layers.  A straight GL_LINEAR blend gives a better picture.
      params.wantUseMipMaps = false;
      params.wantInterpolate = true;
    }

    // must convert image bytes to canvas object - also resize if needed (this is deferred to constructor)
    params.imageCanvas = document.createElement("canvas");
    params.imageCanvas.width = targetWidth;
    params.imageCanvas.height = targetHeight;

    assert(0 < params.height);
    assert(Math.floor(params.height) === params.height);

    return new TextureHandle(glTex, params);
  }

  /** Creates a texture for a framebuffer attachment (no data specified). */
  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    const glTex: WebGLTexture | undefined = this.createTextureHandle();
    if (undefined === glTex) {
      return undefined;
    }

    const params: TextureCreateParams = new TextureCreateParams();
    params.format = format;
    params.dataType = dataType;
    params.width = width;
    params.height = height;
    params.wrapMode = GL.Texture.WrapMode.ClampToEdge;
    params.wantInterpolate = true;

    return new TextureHandle(glTex, params);
  }

  /** Creates a texture for storing data accessed by shaders. */
  public static createForData(width: number, height: number, data: Uint8Array, wantPreserveData = false) {
    const glTex: WebGLTexture | undefined = this.createTextureHandle();
    if (undefined === glTex) {
      return undefined;
    }

    const params: TextureCreateParams = new TextureCreateParams();
    params.format = GL.Texture.Format.Rgba;
    params.dataType = GL.Texture.DataType.UnsignedByte;
    params.width = width;
    params.height = height;
    params.imageBytes = data;
    params.wrapMode = GL.Texture.WrapMode.ClampToEdge;
    params.wantPreserveData = wantPreserveData;

    return new TextureHandle(glTex, params);
  }

  public dispose() {
    if (undefined !== this._glTexture) {
      System.instance.context.deleteTexture(this._glTexture);
      this._glTexture = undefined;
    }
  }

  private constructor(glTex: WebGLTexture, params: TextureCreateParams) {
    this.width = params.width;
    this.height = params.height;
    this.format = params.format;
    this.dataType = params.dataType;
    this.loadCallback = params.loadCallback;
    if (params.wantPreserveData) {
      this.imageBytes = params.imageBytes;
      this.imageCanvas = params.imageCanvas;
    }
    this._glTexture = glTex;

    if (params.imageCanvas !== undefined) { // Image texture - deferred load
      // Immediately load a placeholder texture (1x1 white opaque) to use until actual image is ready.
      const whitePixel = new Uint8Array([255, 255, 255, 255]);  // opaque white
      TextureHandle.loadTexture(glTex, 1, 1, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte, whitePixel);
      this.loadImageCanvas(params); // Begin the process of loading the actual image texture.
    } else { // Regular data texture - already ready - no deferred load
      TextureHandle.loadTexture(glTex, params.width, params.height, params.format, params.dataType, params.imageBytes, undefined, params.wantUseMipMaps, params.wantInterpolate, params.wrapMode);
    }
  }

  private loadImageCanvas(params: TextureCreateParams) {
    // create an HTMLImageElement from a Blob created from the encoded bytes (jpeg or png)
    // ###TODO: Add support for Alpha image formats
    const blob = new Blob([params.imageBytes], params.imageFormat === ImageSourceFormat.Jpeg ? { type: "image/jpeg" } : { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      if (undefined === params.imageCanvas)
        return;

      const imageCanvasCtx = params.imageCanvas.getContext("2d");
      if (null === imageCanvasCtx)
        return;

      // draw the HTMLImageElement to the destination canvas, possibly resizing it
      imageCanvasCtx.drawImage(img, 0, 0, params.imageCanvas.width, params.imageCanvas.height);

      if (undefined !== this._glTexture) {
        TextureHandle.loadTexture(this._glTexture, this.width, this.height, this.format, this.dataType, undefined, params.imageCanvas, params.wantUseMipMaps, params.wantInterpolate, params.wrapMode);
        if (undefined !== this.loadCallback) {
          this.loadCallback(this);
        }
      }
    };

    img.src = url; // load the image from the URL object - will call onload above when finished
  }

  private static loadTexture(tex: WebGLTexture, width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType, bytes?: Uint8Array, canvas?: HTMLCanvasElement, wantUseMipMaps = false, wantInterpolate = false, wrapMode = GL.Texture.WrapMode.ClampToEdge) {
    const gl: WebGLRenderingContext = System.instance.context;

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // use tightly packed data

    gl.activeTexture(gl.TEXTURE0); // bind the texture object; make sure we do not interfere with other active textures
    gl.bindTexture(gl.TEXTURE_2D, tex);
    assert(width > 0 && height > 0);

    // send the texture data
    if (canvas !== undefined) {
      // Use canvas version of texImage2D
      gl.texImage2D(gl.TEXTURE_2D, 0, format, format, dataType, canvas);
    } else {
      // use regular (raw bytes) version of texImage2D
      const pixels: ArrayBufferView | null = bytes !== undefined ? bytes as ArrayBufferView : null;
      gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, dataType, pixels);
    }

    if (wantUseMipMaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, wantInterpolate ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, wantInterpolate ? gl.LINEAR : gl.NEAREST);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private static createTextureHandle(): WebGLTexture | undefined {
    const glTex: WebGLTexture | null = System.instance.context.createTexture();
    if (glTex === null)
      return undefined;
    return glTex;
  }

  private static nextHighestPowerOfTwo(num: number): number {
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
