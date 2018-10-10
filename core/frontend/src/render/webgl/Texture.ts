/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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

export interface TextureMonitor {
  onTextureCreated: (texture: TextureHandle) => void;
  onTextureDisposed: (texture: TextureHandle) => void;
}

/** Associate texture data with a WebGLTexture from a canvas, image, OR a bitmap. */
function loadTexture2DImageData(handle: TextureHandle, params: Texture2DCreateParams, bytes?: Uint8Array, element?: CanvasOrImage): void {
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

function loadTextureFromBytes(handle: TextureHandle, params: Texture2DCreateParams, bytes?: Uint8Array): void { loadTexture2DImageData(handle, params, bytes); }

/** Associate cube texture data with a WebGLTexture from an image. */
function loadTextureCubeImageData(handle: TextureHandle, params: TextureCubeCreateParams, images: CanvasOrImage[]): void {
  const tex = handle.getHandle()!;
  const gl = System.instance.context;

  // Use tightly packed data
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  // Bind the texture object; make sure we do not interfere with other active textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(GL.Texture.Target.CubeMap, tex);

  const cubeTargets: number[] = [GL.Texture.Target.CubeMapPositiveX, GL.Texture.Target.CubeMapNegativeX, GL.Texture.Target.CubeMapPositiveY, GL.Texture.Target.CubeMapNegativeY, GL.Texture.Target.CubeMapPositiveZ, GL.Texture.Target.CubeMapNegativeZ];

  for (let i = 0; i < 6; i++) {
    gl.texImage2D(cubeTargets[i], 0, params.format, params.format, params.dataType, images[i]);
  }

  gl.texParameteri(GL.Texture.Target.CubeMap, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(GL.Texture.Target.CubeMap, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(GL.Texture.Target.CubeMap, gl.TEXTURE_WRAP_S, params.wrapMode);
  gl.texParameteri(GL.Texture.Target.CubeMap, gl.TEXTURE_WRAP_T, params.wrapMode);
  // gl.texParameteri(GL.Texture.Target.CubeMap, gl.TEXTURE_WRAP_R, params.wrapMode); // Unavailable in GLES2

  gl.bindTexture(GL.Texture.Target.CubeMap, null);
}

type TextureFlag = true | undefined;
type Load2DImageData = (handle: TextureHandle, params: Texture2DCreateParams) => void;
type LoadCubeImageData = (handle: TextureHandle, params: TextureCubeCreateParams) => void;

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
class Texture2DCreateParams {
  private constructor(
    public width: number,
    public height: number,
    public format: GL.Texture.Format,
    public dataType: GL.Texture.DataType,
    public wrapMode: GL.Texture.WrapMode,
    public loadImageData: Load2DImageData,
    public useMipMaps?: TextureFlag,
    public interpolate?: TextureFlag,
    public dataBytes?: Uint8Array) { }

  public static createForData(width: number, height: number, data: Uint8Array, preserveData = false, wrapMode = GL.Texture.WrapMode.ClampToEdge, format = GL.Texture.Format.Rgba) {
    return new Texture2DCreateParams(width, height, format, GL.Texture.DataType.UnsignedByte, wrapMode,
      (tex: TextureHandle, params: Texture2DCreateParams) => loadTextureFromBytes(tex, params, data), undefined, undefined, preserveData ? data : undefined);
  }

  public static createForImageBuffer(image: ImageBuffer, type: RenderTexture.Type) {
    const props = this.getImageProperties(ImageBufferFormat.Rgba === image.format, type);

    return new Texture2DCreateParams(image.width, image.height, props.format, GL.Texture.DataType.UnsignedByte, props.wrapMode,
      (tex: TextureHandle, params: Texture2DCreateParams) => loadTextureFromBytes(tex, params, image.data), props.useMipMaps, props.interpolate);
  }

  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    return new Texture2DCreateParams(width, height, format, dataType, GL.Texture.WrapMode.ClampToEdge,
      (tex: TextureHandle, params: Texture2DCreateParams) => loadTextureFromBytes(tex, params), undefined, undefined);
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

    return new Texture2DCreateParams(targetWidth, targetHeight, props.format, GL.Texture.DataType.UnsignedByte, props.wrapMode,
      (tex: TextureHandle, params: Texture2DCreateParams) => loadTexture2DImageData(tex, params, undefined, element), props.useMipMaps, props.interpolate);
  }

  private static getImageProperties(isTranslucent: boolean, type: RenderTexture.Type): TextureImageProperties {
    const isSky = RenderTexture.Type.SkyBox === type;
    const isTile = RenderTexture.Type.TileSection === type;

    const wrapMode = RenderTexture.Type.Normal === type ? GL.Texture.WrapMode.Repeat : GL.Texture.WrapMode.ClampToEdge;
    const useMipMaps: TextureFlag = (!isSky && !isTile) ? true : undefined;
    const interpolate: TextureFlag = true;
    const format = isTranslucent ? GL.Texture.Format.Rgba : GL.Texture.Format.Rgb;

    return { format, wrapMode, useMipMaps, interpolate };
  }

  public static readonly placeholderParams = new Texture2DCreateParams(1, 1, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte, GL.Texture.WrapMode.ClampToEdge,
    (_tex: TextureHandle, _params: Texture2DCreateParams) => undefined);
}

class TextureCubeCreateParams {
  private constructor(
    public dim: number,
    public format: GL.Texture.Format,
    public dataType: GL.Texture.DataType,
    public wrapMode: GL.Texture.WrapMode,
    public loadImageData: LoadCubeImageData) { }

  public static createForCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement): TextureCubeCreateParams | undefined {
    const targetDim = posX.naturalWidth;

    if (posX.naturalHeight !== targetDim) // Cube texture dimensions must match (width must equal height)
      return undefined;

    const images: HTMLImageElement[] = [posX, negX, posY, negY, posZ, negZ];

    for (let i = 1; i < images.length; i++) { // Dimensions of all six sides must match each other
      if (images[i].naturalWidth !== targetDim || images[i].naturalHeight !== targetDim)
        return undefined;
    }

    return new TextureCubeCreateParams(targetDim, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte, GL.Texture.WrapMode.ClampToEdge,
      (tex: TextureHandle, params: TextureCubeCreateParams) => loadTextureCubeImageData(tex, params, images));
  }
}

/** Wraps a WebGLTextureHandle */
export abstract class TextureHandle implements IDisposable {
  protected static _monitor?: TextureMonitor;
  public static set monitor(monitor: TextureMonitor | undefined) { this._monitor = monitor; }

  protected _glTexture?: WebGLTexture;

  public abstract get width(): number;
  public abstract get height(): number;
  public abstract get format(): GL.Texture.Format;
  public abstract get dataType(): GL.Texture.DataType;
  public abstract get dataBytes(): Uint8Array | undefined;

  /** Get the WebGLTexture for this TextureHandle. */
  public getHandle(): WebGLTexture | undefined { return this._glTexture; }

  /** Bind texture handle (if available) associated with an instantiation of this class to specified texture unit. */
  public abstract bind(_texUnit: TextureUnit): boolean;

  /** Bind this texture to a uniform sampler. */
  public abstract bindSampler(_uniform: UniformHandle, _unit: TextureUnit): void;

  public get isDisposed(): boolean { return this._glTexture === undefined; }

  public dispose() {
    if (!this.isDisposed) {
      if (undefined !== TextureHandle._monitor)
        TextureHandle._monitor.onTextureDisposed(this);

      System.instance.context.deleteTexture(this._glTexture!);
      this._glTexture = undefined;
    }
  }

  /** Create a 2D texture for use as a color attachment for rendering */
  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    return Texture2DHandle.createForAttachment(width, height, format, dataType);
  }

  /** Create a 2D texture to hold non-image data */
  public static createForData(width: number, height: number, data: Uint8Array, wantPreserveData = false, wrapMode = GL.Texture.WrapMode.ClampToEdge, format = GL.Texture.Format.Rgba) {
    return Texture2DHandle.createForData(width, height, data, wantPreserveData, wrapMode, format);
  }

  /** Create a 2D texture from a bitmap */
  public static createForImageBuffer(image: ImageBuffer, type: RenderTexture.Type) {
    return Texture2DHandle.createForImageBuffer(image, type);
  }

  /** Create a 2D texture from an HTMLImageElement. */
  public static createForImage(image: HTMLImageElement, hasAlpha: boolean, type: RenderTexture.Type) {
    return Texture2DHandle.createForImage(image, hasAlpha, type);
  }

  /** Create a cube map texture from six HTMLImageElement objects. */
  public static createForCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement) {
    return TextureCubeHandle.createForCubeImages(posX, negX, posY, negY, posZ, negZ);
  }

  // Set following to true to assign sequential numeric identifiers to WebGLTexture objects.
  // This helps in debugging issues in which e.g. the same texture is bound as an input and output.
  public static wantDebugIds: boolean = false;
  private static _debugId: number = 0;
  private static readonly _maxDebugId = 0xffffff;
  protected constructor(glTexture: WebGLTexture) {
    this._glTexture = glTexture;
    if (TextureHandle.wantDebugIds) {
      (glTexture as any)._debugId = ++TextureHandle._debugId;
      TextureHandle._debugId %= TextureHandle._maxDebugId;
    }
  }
}

export class Texture2DHandle extends TextureHandle {
  private _width: number;
  private _height: number;
  private _format: GL.Texture.Format;
  private _dataType: GL.Texture.DataType;
  private _dataBytes?: Uint8Array;

  public get width(): number { return this._width; }
  public get height(): number { return this._height; }
  public get format(): GL.Texture.Format { return this._format; }
  public get dataType(): GL.Texture.DataType { return this._dataType; }
  public get dataBytes(): Uint8Array | undefined { return this._dataBytes; }

  /** Bind specified texture handle to specified texture unit. */
  public static bindTexture(texUnit: TextureUnit, glTex: WebGLTexture | undefined) {
    assert(!(glTex instanceof TextureHandle));
    const gl: WebGLRenderingContext = System.instance.context;
    gl.activeTexture(texUnit);
    gl.bindTexture(gl.TEXTURE_2D, glTex !== undefined ? glTex : null);
    if (this.wantDebugIds)
      debugPrint("Texture Unit " + (texUnit - TextureUnit.Zero) + " = " + (glTex ? (glTex as any)._debugId : "null"));
  }

  /** Bind the specified texture to a uniform sampler2D */
  public static bindSampler(uniform: UniformHandle, tex: WebGLTexture, unit: TextureUnit): void {
    assert(!(tex instanceof TextureHandle));
    this.bindTexture(unit, tex);
    uniform.setUniform1i(unit - TextureUnit.Zero);
  }

  /** Bind texture handle (if available) associated with an instantiation of this class to specified texture unit. */
  public bind(texUnit: TextureUnit): boolean {
    if (undefined === this._glTexture)
      return false;
    Texture2DHandle.bindTexture(texUnit, this._glTexture);
    return true;
  }

  /** Bind this texture to a uniform sampler2D */
  public bindSampler(uniform: UniformHandle, unit: TextureUnit): void {
    if (undefined !== this._glTexture)
      Texture2DHandle.bindSampler(uniform, this._glTexture, unit);
  }

  /** Update the 2D texture contents. */
  public update(updater: Texture2DDataUpdater): boolean {
    if (0 === this.width || 0 === this.height || undefined === this._dataBytes || 0 === this._dataBytes.length) {
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
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, this._format, this._dataType, this._dataBytes);

    return true;
  }

  private static create(params: Texture2DCreateParams): TextureHandle | undefined {
    const glTex = System.instance.context.createTexture();
    return null !== glTex ? new Texture2DHandle(glTex, params) : undefined;
  }

  /** Create a texture for use as a color attachment for rendering */
  public static createForAttachment(width: number, height: number, format: GL.Texture.Format, dataType: GL.Texture.DataType) {
    return this.create(Texture2DCreateParams.createForAttachment(width, height, format, dataType));
  }

  /** Create a texture to hold non-image data */
  public static createForData(width: number, height: number, data: Uint8Array, wantPreserveData = false, wrapMode = GL.Texture.WrapMode.ClampToEdge, format = GL.Texture.Format.Rgba) {
    return this.create(Texture2DCreateParams.createForData(width, height, data, wantPreserveData, wrapMode, format));
  }

  /** Create a texture from a bitmap */
  public static createForImageBuffer(image: ImageBuffer, type: RenderTexture.Type) {
    assert(isPowerOfTwo(image.width) && isPowerOfTwo(image.height), "###TODO: Resize image dimensions to powers-of-two if necessary");
    return this.create(Texture2DCreateParams.createForImageBuffer(image, type));
  }

  /** Create a 2D texture from an HTMLImageElement. */
  public static createForImage(image: HTMLImageElement, hasAlpha: boolean, type: RenderTexture.Type) {
    return this.create(Texture2DCreateParams.createForImage(image, hasAlpha, type));
  }

  private constructor(glTexture: WebGLTexture, params: Texture2DCreateParams) {
    super(glTexture);
    this._width = params.width;
    this._height = params.height;
    this._format = params.format;
    this._dataType = params.dataType;
    this._dataBytes = params.dataBytes;

    if (undefined !== TextureHandle._monitor)
      TextureHandle._monitor.onTextureCreated(this);

    params.loadImageData(this, params);
  }
}

export class TextureCubeHandle extends TextureHandle {
  private _dim: number; // Cubemap texture height and width must match.  This must be the same for each of the six faces.
  private _format: GL.Texture.Format; // Format must be the same for each of the six faces.
  private _dataType: GL.Texture.DataType; // Type must be the same for each of the six faces.

  public get width(): number { return this._dim; }
  public get height(): number { return this._dim; }
  public get format(): GL.Texture.Format { return this._format; }
  public get dataType(): GL.Texture.DataType { return this._dataType; }
  public get dataBytes(): Uint8Array | undefined { return undefined; }

  /** Bind specified cubemap texture handle to specified texture unit. */
  public static bindTexture(texUnit: TextureUnit, glTex: WebGLTexture | undefined) {
    assert(!(glTex instanceof TextureHandle));
    const gl: WebGLRenderingContext = System.instance.context;
    gl.activeTexture(texUnit);
    gl.bindTexture(GL.Texture.Target.CubeMap, glTex !== undefined ? glTex : null);
    if (this.wantDebugIds)
      debugPrint("Texture Unit " + (texUnit - TextureUnit.Zero) + " = " + (glTex ? (glTex as any)._debugId : "null"));
  }

  /** Bind the specified texture to a uniform sampler2D */
  public static bindSampler(uniform: UniformHandle, tex: WebGLTexture, unit: TextureUnit): void {
    assert(!(tex instanceof TextureHandle));
    this.bindTexture(unit, tex);
    uniform.setUniform1i(unit - TextureUnit.Zero);
  }

  /** Bind texture handle (if available) associated with an instantiation of this class to specified texture unit. */
  public bind(texUnit: TextureUnit): boolean {
    if (undefined === this._glTexture)
      return false;
    TextureCubeHandle.bindTexture(texUnit, this._glTexture);
    return true;
  }

  /** Bind this texture to a uniform sampler2D */
  public bindSampler(uniform: UniformHandle, unit: TextureUnit): void {
    if (undefined !== this._glTexture)
      TextureCubeHandle.bindSampler(uniform, this._glTexture, unit);
  }

  private static create(params: TextureCubeCreateParams): TextureHandle | undefined {
    const glTex = System.instance.context.createTexture();
    return null !== glTex ? new TextureCubeHandle(glTex, params) : undefined;
  }

  /** Create a cube map texture from six HTMLImageElement objects. */
  public static createForCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement) {
    const params = TextureCubeCreateParams.createForCubeImages(posX, negX, posY, negY, posZ, negZ);
    return params !== undefined ? this.create(params) : undefined;
  }

  private constructor(glTexture: WebGLTexture, params: TextureCubeCreateParams) {
    super(glTexture);
    this._dim = params.dim;
    this._format = params.format;
    this._dataType = params.dataType;

    if (undefined !== TextureHandle._monitor)
      TextureHandle._monitor.onTextureCreated(this);

    params.loadImageData(this, params);
  }
}

export class Texture2DDataUpdater {
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
