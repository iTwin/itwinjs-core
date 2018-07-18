/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ImageBuffer, ImageBufferFormat, isPowerOfTwo, nextHighestPowerOfTwo, RenderTexture } from "@bentley/imodeljs-common";
import { GL } from "./GL";
import { System } from "./System";
import { UniformHandle } from "./Handle";
import { TextureUnit, OvrFlags } from "./RenderFlags";
import { debugPrint } from "./debugPrint";

type CanvasOrImage = HTMLCanvasElement | HTMLImageElement;

/** Associate texture data with a WebGLTexture from a canvas, image, OR a bitmap. */
function loadTextureImageData(handle: TextureHandle, params: TextureCreateParams, bytes?: Uint8Array, element?: CanvasOrImage): void {
  const tex = handle.getHandle()!;
  const gl = System.instance.context;

  // Use tightly packed data
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Bind the texture object; make sure we do not interfere with other active textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // send the texture data
  if (undefined !== element) {
    gl.texImage2D(gl.TEXTURE_2D, 0, params.format, params.format, params.dataType, element);
  } else {
    const pixelData = undefined !== bytes ? bytes : null;
    gl.texImage2D(gl.TEXTURE_2D, 0, params.format, params.width, params.height, 0, params.format, params.dataType, pixelData);
  }

  if (params.useMipMaps) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, params.interpolate ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, params.interpolate ? gl.LINEAR : gl.NEAREST);
  }

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, params.wrapMode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, params.wrapMode);

  gl.bindTexture(gl.TEXTURE_2D, null);
}

function loadTextureFromBytes(handle: TextureHandle, params: TextureCreateParams, bytes?: Uint8Array): void { loadTextureImageData(handle, params, bytes); }

type TextureFlag = true | undefined;
type LoadImageData = (handle: TextureHandle, params: TextureCreateParams) => void;

interface TextureImageProperties {
  wrapMode: GL.Texture.WrapMode;
  useMipMaps: TextureFlag;
  interpolate: TextureFlag;
  format: GL.Texture.Format;
}

/** Wrapper class for a WebGL texture handle and parameters specific to an individual texture. */
export class Texture extends RenderTexture {
  public readonly texture: TextureHandle;

  public constructor(params: RenderTexture.Params, texture: TextureHandle) {
    super(params);
    this.texture = texture;
  }

  /** Free this object in the WebGL wrapper. */
  public dispose() {
    dispose(this.texture);
  }

  public get hasTranslucency(): boolean { return GL.Texture.Format.Rgba === this.texture.format; }
}

/** Parameters used internally to define how to create a texture for use with WebGL. */
class TextureCreateParams {
  private constructor(
    public width: number,
    public height: number,
    public format: GL.Texture.Format,
    public dataType: GL.Texture.DataType,
    public wrapMode: GL.Texture.WrapMode,
    public loadImageData: LoadImageData,
    public useMipMaps?: TextureFlag,
    public interpolate?: TextureFlag,
    public dataBytes?: Uint8Array) { }

  public static createForData(width: number, height: number, data: Uint8Array, preserveData = false, wrapMode = GL.Texture.WrapMode.ClampToEdge, format = GL.Texture.Format.Rgba) {
    return new TextureCreateParams(width, height, format, GL.Texture.DataType.UnsignedByte, wrapMode,
      (tex: TextureHandle, params: TextureCreateParams) => loadTextureFromBytes(tex, params, data), undefined, undefined, preserveData ? data : undefined);
  }

  public static createForImageBuffer(image: ImageBuffer, type: RenderTexture.Type) {
    const props = this.getImageProperties(ImageBufferFormat.Rgba === image.format, type);

    return new TextureCreateParams(image.width, image.height, props.format, GL.Texture.DataType.UnsignedByte, props.wrapMode,
      (tex: TextureHandle, params: TextureCreateParams) => loadTextureFromBytes(tex, params, image.data), props.useMipMaps, props.interpolate);
  }

  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    return new TextureCreateParams(width, height, format, dataType, GL.Texture.WrapMode.ClampToEdge,
      (tex: TextureHandle, params: TextureCreateParams) => loadTextureFromBytes(tex, params), undefined, undefined);
  }

  public static createForImage(image: HTMLImageElement, hasAlpha: boolean, type: RenderTexture.Type) {
    const props = this.getImageProperties(hasAlpha, type);

    let targetWidth = image.naturalWidth;
    let targetHeight = image.naturalHeight;

    const caps = System.instance.capabilities;
    if (RenderTexture.Type.Glyph === type) {
      targetWidth = nextHighestPowerOfTwo(targetWidth);
      targetHeight = nextHighestPowerOfTwo(targetHeight);
    } else if (!caps.supportsNonPowerOf2Textures && (!isPowerOfTwo(targetWidth) || !isPowerOfTwo(targetHeight))) {
      if (GL.Texture.WrapMode.ClampToEdge === props.wrapMode) {
        // NPOT are supported but not mipmaps
        // Probably on poor hardware so I choose to disable mipmaps for lower memory usage over quality. If quality is required we need to resize the image to a pow of 2.
        // Above comment is not necessarily true - WebGL doesn't support NPOT mipmapping, only supporting base NPOT caps
        props.useMipMaps = undefined;
      } else if (GL.Texture.WrapMode.Repeat === props.wrapMode) {
        targetWidth = nextHighestPowerOfTwo(targetWidth);
        targetHeight = nextHighestPowerOfTwo(targetHeight);
      }
    }

    let element: CanvasOrImage = image;
    if (targetWidth !== image.naturalWidth || targetHeight !== image.naturalHeight) {
      // Resize so dimensions are powers-of-two
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      element = canvas;
    }

    return new TextureCreateParams(targetWidth, targetHeight, props.format, GL.Texture.DataType.UnsignedByte, props.wrapMode,
      (tex: TextureHandle, params: TextureCreateParams) => loadTextureImageData(tex, params, undefined, element), props.useMipMaps, props.interpolate);
  }

  private static getImageProperties(isTranslucent: boolean, type: RenderTexture.Type): TextureImageProperties {
    const isSky = RenderTexture.Type.SkyBox === type;
    const isTile = RenderTexture.Type.TileSection === type;

    const wrapMode = RenderTexture.Type.Normal === type ? GL.Texture.WrapMode.Repeat : GL.Texture.WrapMode.ClampToEdge;
    const useMipMaps: TextureFlag = (!isSky && !isTile) ? true : undefined;
    const interpolate: TextureFlag = !isSky ? true : undefined;
    const format = isTranslucent ? GL.Texture.Format.Rgba : GL.Texture.Format.Rgb;

    return { format, wrapMode, useMipMaps, interpolate };
  }

  public static readonly placeholderParams = new TextureCreateParams(1, 1, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte, GL.Texture.WrapMode.ClampToEdge,
    (_tex: TextureHandle, _params: TextureCreateParams) => undefined);
}

/** Wraps a WebGLTextureHandle */
export class TextureHandle implements IDisposable {
  public readonly width: number;
  public readonly height: number;
  public readonly format: GL.Texture.Format;
  public readonly dataType: GL.Texture.DataType;
  public readonly dataBytes?: Uint8Array;
  private _glTexture?: WebGLTexture;

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
    assert(!(glTex instanceof TextureHandle));
    const gl: WebGLRenderingContext = System.instance.context;
    gl.activeTexture(texUnit);
    gl.bindTexture(gl.TEXTURE_2D, glTex !== undefined ? glTex : null);
    if (this.wantDebugIds)
      debugPrint("Texture Unit " + (texUnit - TextureUnit.Zero) + " = " + (glTex ? (glTex as any)._debugId : "null"));
  }

  /** Binds this texture to a uniform sampler2D */
  public bindSampler(uniform: UniformHandle, unit: TextureUnit): void {
    if (undefined !== this._glTexture)
      TextureHandle.bindSampler(uniform, this._glTexture, unit);
  }

  /** Binds the specified texture to a uniform sampler2D */
  public static bindSampler(uniform: UniformHandle, tex: WebGLTexture, unit: TextureUnit): void {
    assert(!(tex instanceof TextureHandle));
    this.bindTexture(unit, tex);
    uniform.setUniform1i(unit - TextureUnit.Zero);
  }

  public update(updater: TextureDataUpdater): boolean {
    if (0 === this.width || 0 === this.height || undefined === this.dataBytes || 0 === this.dataBytes.length) {
      assert(false);
      return false;
    }

    if (!updater.modified)
      return false;

    const tex = this.getHandle()!;
    if (undefined === tex)
      return false;

    const gl: WebGLRenderingContext = System.instance.context;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this.format, this.dataType, this.dataBytes);

    return true;
  }

  public get isDisposed(): boolean { return this._glTexture === undefined; }

  public dispose() {
    if (!this.isDisposed) {
      System.instance.context.deleteTexture(this._glTexture!);
      this._glTexture = undefined;
    }
  }

  private static create(params: TextureCreateParams): TextureHandle | undefined {
    const glTex = System.instance.context.createTexture();
    return null !== glTex ? new TextureHandle(glTex, params) : undefined;
  }

  /** Create a texture for use as a color attachment for rendering */
  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    return this.create(TextureCreateParams.createForAttachment(width, height, format, dataType));
  }

  /** Create a texture to hold non-image data */
  public static createForData(width: number, height: number, data: Uint8Array, wantPreserveData = false, wrapMode = GL.Texture.WrapMode.ClampToEdge, format = GL.Texture.Format.Rgba) {
    return this.create(TextureCreateParams.createForData(width, height, data, wantPreserveData, wrapMode, format));
  }

  /** Create a texture from a bitmap */
  public static createForImageBuffer(image: ImageBuffer, type: RenderTexture.Type) {
    assert(isPowerOfTwo(image.width) && isPowerOfTwo(image.height), "###TODO: Resize image dimensions to powers-of-two if necessary");
    return this.create(TextureCreateParams.createForImageBuffer(image, type));
  }

  public static createForImage(image: HTMLImageElement, hasAlpha: boolean, type: RenderTexture.Type) {
    return this.create(TextureCreateParams.createForImage(image, hasAlpha, type));
  }

  // Set following to true to assign sequential numeric identifiers to WebGLTexture objects.
  // This helps in debugging issues in which e.g. the same texture is bound as an input and output.
  public static wantDebugIds: boolean = false;
  private static _debugId: number = 0;
  private static readonly _maxDebugId = 0xffffff;
  private constructor(glTexture: WebGLTexture, params: TextureCreateParams) {
    this._glTexture = glTexture;
    this.width = params.width;
    this.height = params.height;
    this.format = params.format;
    this.dataType = params.dataType;
    this.dataBytes = params.dataBytes;
    if (TextureHandle.wantDebugIds) {
      (glTexture as any)._debugId = ++TextureHandle._debugId;
      TextureHandle._debugId %= TextureHandle._maxDebugId;
    }

    params.loadImageData(this, params);
  }
}

export class TextureDataUpdater {
  public data: Uint8Array;
  public modified: boolean = false;

  public constructor(data: Uint8Array) { this.data = data; }

  public setByteAtIndex(index: number, byte: number) {
    assert(index < this.data.length);
    if (byte !== this.data[index]) {
      this.data[index] = byte;
      this.modified = true;
    }
  }
  public setOvrFlagsAtIndex(index: number, value: OvrFlags) {
    assert(index < this.data.length);
    if (value !== this.data[index]) {
      this.data[index] = value;
      this.modified = true;
    }
  }
  public getByteAtIndex(index: number): number { assert(index < this.data.length); return this.data[index]; }
  public getFlagsAtIndex(index: number): OvrFlags { return this.getByteAtIndex(index); }
}
