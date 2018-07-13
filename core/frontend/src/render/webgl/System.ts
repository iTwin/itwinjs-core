/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { IModelError, RenderTexture, RenderMaterial, Gradient, ImageBuffer, ImageSource, FeatureTable, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { RenderGraphic, GraphicBranch, RenderSystem, RenderTarget } from "../System";
import { OnScreenTarget, OffScreenTarget } from "./Target";
import { GraphicBuilderCreateParams, GraphicBuilder } from "../GraphicBuilder";
import { PrimitiveBuilder } from "../primitives/geometry/GeometryListBuilder";
import { PolylineArgs, MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { GraphicsList, Branch, Batch } from "./Graphic";
import { IModelConnection } from "../../IModelConnection";
import { BentleyStatus, assert, Dictionary, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { Techniques } from "./Technique";
import { IModelApp } from "../../IModelApp";
import { ViewRect } from "../../Viewport";
import { RenderState } from "./RenderState";
import { FrameBufferStack, DepthBuffer } from "./FrameBuffer";
import { RenderBuffer } from "./RenderBuffer";
import { TextureHandle, Texture } from "./Texture";
import { GL } from "./GL";
import { PolylinePrimitive } from "./Polyline";
import { PointStringPrimitive } from "./PointString";
import { MeshGraphic } from "./Mesh";
import { PointCloudGraphic } from "./PointCloud";
import { LineCode } from "./EdgeOverrides";
import { Material } from "./Material";

export const enum ContextState {
  Uninitialized,
  Success,
  Error,
}

/** Describes the type of a render target. Used by Capabilities to represent maximum precision render target available on host system. */
export const enum RenderType {
  TextureUnsignedByte,
  TextureHalfFloat,
  TextureFloat,
}

/**
 * Describes the type of a depth buffer. Used by Capabilities to represent maximum depth buffer precision available on host system.
 * Note: the commented-out values are unimplemented but left in place for reference, in case desired for future implementation.
 */
export const enum DepthType {
  RenderBufferUnsignedShort16,     // core to WebGL1
  // TextureUnsignedShort16,       // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureUnsignedInt24,         // core to WebGL2
  // TextureUnsignedInt24Stencil8, // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  TextureUnsignedInt32,            // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureFloat32,               // core to WebGL2
  // TextureFloat32Stencil8,       // core to WeBGL2
}

/** Describes the rendering capabilities of the host system. */
export class Capabilities {
  private _maxRenderType: RenderType = RenderType.TextureUnsignedByte;
  private _maxDepthType: DepthType = DepthType.RenderBufferUnsignedShort16;
  private _maxTextureSize: number = 0;
  private _maxColorAttachments: number = 0;
  private _maxDrawBuffers: number = 0;
  private _maxFragTextureUnits: number = 0;
  private _maxVertTextureUnits: number = 0;
  private _maxVertAttribs: number = 0;
  private _maxVertUniformVectors: number = 0;
  private _maxVaryingVectors: number = 0;
  private _maxFragUniformVectors: number = 0;

  private _extensionMap: { [key: string]: any } = {}; // Use this map to store actual extension objects retrieved from GL.

  public get maxRenderType(): RenderType { return this._maxRenderType; }
  public get maxDepthType(): DepthType { return this._maxDepthType; }
  public get maxTextureSize(): number { return this._maxTextureSize; }
  public get maxColorAttachments(): number { return this._maxColorAttachments; }
  public get maxDrawBuffers(): number { return this._maxDrawBuffers; }
  public get maxFragTextureUnits(): number { return this._maxFragTextureUnits; }
  public get maxVertTextureUnits(): number { return this._maxVertTextureUnits; }
  public get maxVertAttribs(): number { return this._maxVertAttribs; }
  public get maxVertUniformVectors(): number { return this._maxVertUniformVectors; }
  public get maxVaryingVectors(): number { return this._maxVaryingVectors; }
  public get maxFragUniformVectors(): number { return this._maxFragUniformVectors; }

  /** These getters check for existence of extension objects to determine availability of features.  In WebGL2, could just return true for some. */
  public get supportsNonPowerOf2Textures(): boolean { return false; }
  public get supportsDrawBuffers(): boolean { return this.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers") !== undefined; }
  public get supports32BitElementIndex(): boolean { return this.queryExtensionObject<OES_element_index_uint>("OES_element_index_uint") !== undefined; }
  public get supportsTextureFloat(): boolean { return this.queryExtensionObject<OES_texture_float>("OES_texture_float") !== undefined; }
  public get supportsTextureHalfFloat(): boolean { return this.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float") !== undefined; }
  public get supportsShaderTextureLOD(): boolean { return this.queryExtensionObject<EXT_shader_texture_lod>("EXT_shader_texture_lod") !== undefined; }

  /** Queries an extension object if available.  This is necessary for other parts of the system to access some constants within extensions. */
  public queryExtensionObject<T>(ext: string): T | undefined {
    const extObj: any = this._extensionMap[ext];
    return (null !== extObj) ? extObj as T : undefined;
  }

  /** Initializes the capabilities based on a GL context. Must be called first. */
  public init(gl: WebGLRenderingContext): boolean {
    this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this._maxFragTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this._maxVertTextureUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this._maxVertAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    this._maxVertUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this._maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
    this._maxFragUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);

    const extensions = gl.getSupportedExtensions(); // This just retrieves a list of available extensions (not necessarily enabled).
    if (extensions) {
      for (const ext of extensions) {
        if (ext === "WEBGL_draw_buffers" || ext === "OES_element_index_uint" || ext === "OES_texture_float" ||
          ext === "OES_texture_half_float" || ext === "WEBGL_depth_texture" || ext === "EXT_color_buffer_float" ||
          ext === "EXT_shader_texture_lod") {
          const extObj: any = gl.getExtension(ext); // This call enables the extension and returns a WebGLObject containing extension instance.
          if (null !== extObj)
            this._extensionMap[ext] = extObj;
        }
      }
    }

    const dbExt: WEBGL_draw_buffers | undefined = this.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
    this._maxColorAttachments = dbExt !== undefined ? gl.getParameter(dbExt.MAX_COLOR_ATTACHMENTS_WEBGL) : 1;
    this._maxDrawBuffers = dbExt !== undefined ? gl.getParameter(dbExt.MAX_DRAW_BUFFERS_WEBGL) : 1;

    // Determine the maximum color-renderable attachment type.
    if (this.isTextureRenderable(gl, gl.FLOAT))
      this._maxRenderType = RenderType.TextureFloat;
    else {
      const hfExt: OES_texture_half_float | undefined = this.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float");
      this._maxRenderType = (hfExt !== undefined && this.isTextureRenderable(gl, hfExt.HALF_FLOAT_OES)) ? RenderType.TextureHalfFloat : RenderType.TextureUnsignedByte;
    }

    // Determine the maximum depth attachment type.
    this._maxDepthType = this.queryExtensionObject("WEBGL_depth_texture") !== undefined ? DepthType.TextureUnsignedInt32 : DepthType.RenderBufferUnsignedShort16;

    // Return based on currently-required features.  This must change if the amount used is increased or decreased.
    return this.hasRequiredFeatures && this.hasRequiredDrawTargets && this.hasRequiredTextureUnits;
  }

  public static create(gl: WebGLRenderingContext): Capabilities | undefined {
    const caps = new Capabilities();
    return caps.init(gl) ? caps : undefined;
  }

  /** Determines if a particular texture type is color-renderable on the host system. */
  private isTextureRenderable(gl: WebGLRenderingContext, texType: number): boolean {
    const tex: WebGLTexture | null = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, texType, null);

    const fb: WebGLFramebuffer | null = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const fbStatus: number = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);

    gl.getError(); // clear any errors

    return fbStatus === gl.FRAMEBUFFER_COMPLETE;
  }

  /** Determines if the required features are supported (list could change).  These are not necessarily extensions (looking toward WebGL2). */
  private get hasRequiredFeatures(): boolean {
    return this.supportsDrawBuffers && this.supports32BitElementIndex;
  }

  /** Determines if the required number of draw targets are supported (could change). */
  private get hasRequiredDrawTargets(): boolean {
    return this.maxColorAttachments > 3 && this.maxDrawBuffers > 3;
  }

  /** Determines if the required number of texture units are supported in vertex and fragment shader (could change). */
  private get hasRequiredTextureUnits(): boolean {
    return this.maxFragTextureUnits > 4 && this.maxVertTextureUnits > 5;
  }
}

/** Id map holds key value pairs for both materials and textures, useful for caching such objects. */
export class IdMap implements IDisposable {
  /** Mapping of materials by their key values. */
  public readonly materialMap: Map<string, RenderMaterial>;
  /** Mapping of textures by their key values. */
  public readonly textureMap: Map<string, RenderTexture>;
  /** Mapping of textures using gradient symbology. */
  public readonly gradientMap: Dictionary<Gradient.Symb, RenderTexture>;
  /** Array of textures without key values (unnamed). */
  public readonly keylessTextures: RenderTexture[] = [];

  public constructor() {
    this.materialMap = new Map<string, RenderMaterial>();
    this.textureMap = new Map<string, RenderTexture>();
    this.gradientMap = new Dictionary<Gradient.Symb, RenderTexture>(Gradient.Symb.compareSymb);
  }

  public dispose() {
    const textureArr = Array.from(this.textureMap.values());
    const gradientArr = this.gradientMap.extractArrays().values;
    for (const texture of textureArr)
      dispose(texture);
    for (const gradient of gradientArr)
      dispose(gradient);
    for (const texture of this.keylessTextures)
      dispose(texture);
    this.textureMap.clear();
    this.gradientMap.clear();
    this.keylessTextures.length = 0;
  }

  /** Add a material to this IdMap, given that it has a valid key. */
  public addMaterial(material: RenderMaterial) {
    if (material.key)
      this.materialMap.set(material.key, material);
  }

  /** Add a texture to this IdMap, given that it has a valid key. */
  public addTexture(texture: RenderTexture) {
    if (texture.key)
      this.textureMap.set(texture.key, texture);
    else
      this.keylessTextures.push(texture);
  }

  /** Add a texture to this IdMap using gradient symbology. */
  public addGradient(gradientSymb: Gradient.Symb, texture: RenderTexture) {
    this.gradientMap.set(gradientSymb, texture);
  }

  /** Find a cached material using its key. If not found, returns undefined. */
  public findMaterial(key: string): RenderMaterial | undefined {
    return this.materialMap.get(key);
  }

  /** Find a cached gradient using the gradient symbology. If not found, returns undefined. */
  public findGradient(symb: Gradient.Symb): RenderTexture | undefined {
    return this.gradientMap.get(symb);
  }

  /** Find or create a new material given material parameters. This will cache the material if its key is valid. */
  public getMaterial(params: RenderMaterial.Params): RenderMaterial {
    if (!params.key)
      return new Material(params);

    let material = this.materialMap.get(params.key);
    if (!material) {
      material = new Material(params);
      this.materialMap.set(params.key, material);
    }
    return material;
  }

  private createTexture(params: RenderTexture.Params, handle?: TextureHandle): Texture | undefined {
    if (undefined === handle)
      return undefined;

    const texture = new Texture(params, handle);
    this.addTexture(texture);
    return texture;
  }

  /** Attempt to create and return a new texture from an ImageBuffer. This will cache the texture if its key is valid */
  private createTextureFromImageBuffer(img: ImageBuffer, params: RenderTexture.Params): RenderTexture | undefined {
    return this.createTexture(params, TextureHandle.createForImageBuffer(img, params.type));
  }

  /** Attempt to create and return a new texture from an ImageSource. This will cache the texture if its key is valid. */
  private createTextureFromImageSource(imgSrc: ImageSource, width: number, height: number, params: RenderTexture.Params): RenderTexture | undefined {
    return this.createTexture(params, TextureHandle.createForImageSource(width, height, imgSrc, params.type));
  }

  private createTextureFromImage(image: HTMLImageElement, params: RenderTexture.Params): RenderTexture | undefined {
    return this.createTexture(params, TextureHandle.createForImage(image, params.type));
  }

  public findTexture(key?: string): RenderTexture | undefined { return undefined !== key ? this.textureMap.get(key) : undefined; }

  /** Find or attempt to create a new texture using an ImageSource. If a new texture was created, it will be cached provided its key is valid. */
  public getTextureFromImageSource(imgSrc: ImageSource, width: number, height: number, params: RenderTexture.Params): RenderTexture | undefined {
    const tex = this.findTexture(params.key);
    return undefined !== tex ? tex : this.createTextureFromImageSource(imgSrc, width, height, params);
  }

  /** Find or attempt to create a new texture using an ImageBuffer. If a new texture was created, it will be cached provided its key is valid. */
  public getTexture(img: ImageBuffer, params: RenderTexture.Params): RenderTexture | undefined {
    const tex = this.findTexture(params.key);
    return undefined !== tex ? tex : this.createTextureFromImageBuffer(img, params);
  }

  public getTextureFromImage(image: HTMLImageElement, params: RenderTexture.Params): RenderTexture | undefined {
    const tex = this.findTexture(params.key);
    return undefined !== tex ? tex : this.createTextureFromImage(image, params);
  }

  /** Find or attempt to create a new texture using gradient symbology. If a new texture was created, it will be cached using the gradient. */
  public getGradient(grad: Gradient.Symb): RenderTexture | undefined {
    const existingGrad = this.gradientMap.get(grad);
    if (existingGrad)
      return existingGrad;

    const image: ImageBuffer = grad.getImage(0x100, 0x100);

    const textureHandle = TextureHandle.createForImageBuffer(image, RenderTexture.Type.Normal);
    if (!textureHandle)
      return undefined;

    const texture = new Texture(Texture.Params.defaults, textureHandle);
    this.addGradient(grad, texture);
    return texture;
  }
}

export class System extends RenderSystem {
  private readonly _currentRenderState = new RenderState();
  public readonly context: WebGLRenderingContext;
  public readonly frameBufferStack = new FrameBufferStack();  // frame buffers are not owned by the system (only a storage device)
  public readonly techniques: Techniques;
  public readonly capabilities: Capabilities;
  private readonly _drawBuffersExtension?: WEBGL_draw_buffers;
  private _lineCodeTexture: TextureHandle | undefined;
  public readonly resourceCache: Map<IModelConnection, IdMap>;

  public static identityTransform = Transform.createIdentity();

  public static get instance() { return IModelApp.renderSystem as System; }

  public get lineCodeTexture() { return this._lineCodeTexture; }

  public setDrawBuffers(attachments: GLenum[]): void {
    // NB: The WEBGL_draw_buffers member is not exported directly because that type name is not available in some contexts (e.g. test-imodel-service).
    if (undefined !== this._drawBuffersExtension)
      this._drawBuffersExtension.drawBuffersWEBGL(attachments);
  }

  public static create(): System {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas)
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");

    let context = canvas.getContext("webgl");
    if (null === context) {
      context = canvas.getContext("experimental-webgl"); // IE, Edge...
      if (null === context) {
        throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGL context");
      }
    }

    const techniques = Techniques.create(context);
    if (undefined === techniques) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to initialize rendering techniques");
    }

    const capabilities = Capabilities.create(context);
    if (undefined === capabilities) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to initialize rendering capabilities");
    }

    return new System(canvas, context, techniques, capabilities);
  }

  // Note: FrameBuffers inside of the FrameBufferStack are not owned by the System, and are only used as a central storage device
  public dispose() {
    dispose(this.techniques);

    // We must attempt to dispose of each idmap in the resourceCache (if idmap is already disposed, has no effect)
    this.resourceCache.forEach((idMap: IdMap) => {
      dispose(idMap);
    });

    this.resourceCache.clear();
    IModelConnection.onClose.removeListener(this.removeIModelMap);
  }

  public onInitialized(): void {
    this._lineCodeTexture = TextureHandle.createForData(LineCode.size, LineCode.count, new Uint8Array(LineCode.lineCodeData), false, GL.Texture.WrapMode.Repeat, GL.Texture.Format.Luminance);
    assert(undefined !== this._lineCodeTexture, "System.lineCodeTexture not created.");
  }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget { return new OnScreenTarget(canvas); }
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new OffScreenTarget(rect); }
  public createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return new PrimitiveBuilder(this, params); }
  public createIndexedPolylines(args: PolylineArgs): RenderGraphic | undefined {
    if (args.flags.isDisjoint)
      return PointStringPrimitive.create(args);
    else
      return PolylinePrimitive.create(args);
  }
  public createTriMesh(args: MeshArgs) { return MeshGraphic.create(args); }
  public createPointCloud(args: PointCloudArgs): RenderGraphic | undefined { return PointCloudGraphic.create(args); }
  public createGraphicList(primitives: RenderGraphic[]): RenderGraphic { return new GraphicsList(primitives); }
  public createBranch(branch: GraphicBranch, transform: Transform, clips?: ClipVector): RenderGraphic { return new Branch(branch, transform, clips); }
  public createBatch(graphic: RenderGraphic, features: FeatureTable, range: ElementAlignedBox3d): RenderGraphic { return new Batch(graphic, features, range); }

  public applyRenderState(newState: RenderState) {
    newState.apply(this._currentRenderState);
    this._currentRenderState.copyFrom(newState);
  }

  public createDepthBuffer(width: number, height: number): DepthBuffer | undefined {
    // Note: The buffer/texture created here have ownership passed to the caller (system will not dispose of these)
    switch (this.capabilities.maxDepthType) {
      case DepthType.RenderBufferUnsignedShort16: {
        return RenderBuffer.create(width, height);
      }
      case DepthType.TextureUnsignedInt32: {
        return TextureHandle.createForAttachment(width, height, GL.Texture.Format.DepthComponent, GL.Texture.DataType.UnsignedInt);
      }
      default: {
        assert(false);
        return undefined;
      }
    }
  }

  /** Find a rendering map using an IModelConnection. Returns undefined if not found. */
  public findIModelMap(imodel: IModelConnection): IdMap | undefined {
    return this.resourceCache.get(imodel);
  }

  /** Returns the corresponding IdMap for an IModelConnection. Creates a new one if it doesn't exist. */
  public createIModelMap(imodel: IModelConnection): IdMap {
    let idMap = this.resourceCache.get(imodel);
    if (!idMap) {
      idMap = new IdMap();
      this.resourceCache.set(imodel, idMap);
    }
    return idMap;
  }

  /** Removes an IModelConnection-IdMap pairing from the system's resource cache. */
  private removeIModelMap(imodel: IModelConnection) {
    const idMap = this.resourceCache.get(imodel);
    if (idMap === undefined)
      return;
    dispose(idMap);
    this.resourceCache.delete(imodel);
  }

  /**
   * Creates a material and adds it to the corresponding IdMap for that iModel. If the material already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public createMaterial(params: RenderMaterial.Params, imodel: IModelConnection): RenderMaterial | undefined {
    const idMap = this.getIdMap(imodel);
    const material = idMap.getMaterial(params);
    return material;
  }

  /** Given a key and an iModel, returns the corresponding material for that key in the iModel's IdMap. Returns undefined if none found. */
  public findMaterial(key: string, imodel: IModelConnection): RenderMaterial | undefined {
    const idMap = this.resourceCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findMaterial(key);
  }

  /** Creates a texture using an ImageBuffer and adds it to the given iModel's IdMap. Returns the texture if it already exists. */
  public createTextureFromImageBuffer(image: ImageBuffer, imodel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    return this.getIdMap(imodel).getTexture(image, params);
  }

  /**
   * Creates a texture using an ImageSource and adds it to the iModel's render map. If the texture already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public createTextureFromImageSource(source: ImageSource, width: number, height: number, imodel: IModelConnection | undefined, params: RenderTexture.Params): RenderTexture | undefined {
    // if imodel is undefined, caller is responsible for disposing texture. It will not be associated with an IModelConnection
    if (undefined === imodel) {
      const textureHandle = TextureHandle.createForImageSource(width, height, source, params.type);
      return (textureHandle === undefined) ? undefined : new Texture(params, textureHandle);
    }

    return this.getIdMap(imodel).getTextureFromImageSource(source, width, height, params);
  }

  public createTextureFromImage(image: HTMLImageElement, imodel: IModelConnection | undefined, params: RenderTexture.Params): RenderTexture | undefined {
    // if imodel is undefined, caller is responsible for disposing texture. It will not be associated with an IModelConnection
    if (undefined === imodel) {
      const textureHandle = TextureHandle.createForImage(image, params.type);
      return undefined !== textureHandle ? new Texture(params, textureHandle) : undefined;
    }

    return this.getIdMap(imodel).getTextureFromImage(image, params);
  }

  /** Creates a texture using gradient symbology and adds it to the given iModel's IdMap. Returns the texture if it already exists. */
  public getGradientTexture(symb: Gradient.Symb, imodel: IModelConnection): RenderTexture | undefined {
    const idMap = this.getIdMap(imodel);
    const texture = idMap.getGradient(symb);
    return texture;
  }

  /** Given a key and an iModel, returns the corresponding texture for that key in the iModel's IdMap. Returns undefined if none found. */
  public findTexture(key: string, imodel: IModelConnection): RenderTexture | undefined {
    const idMap = this.resourceCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findTexture(key);
  }

  private constructor(canvas: HTMLCanvasElement, context: WebGLRenderingContext, techniques: Techniques, capabilities: Capabilities) {
    super(canvas);
    this.context = context;
    this.techniques = techniques;
    this.capabilities = capabilities;
    this._drawBuffersExtension = capabilities.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
    this.resourceCache = new Map<IModelConnection, IdMap>();

    // Make this System a subscriber to the the IModelConnection onClose event
    IModelConnection.onClose.addListener(this.removeIModelMap.bind(this));
  }

  private getIdMap(imodel: IModelConnection): IdMap {
    const map = this.resourceCache.get(imodel);
    return undefined !== map ? map : this.createIModelMap(imodel);
  }
}

Object.freeze(System.identityTransform);
