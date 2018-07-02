/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { IModelError, RenderTexture, RenderMaterial, Gradient, ImageBuffer, ImageSource, FeatureTable } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { RenderGraphic, GraphicBranch, RenderSystem, RenderTarget } from "../System";
import { OnScreenTarget, OffScreenTarget } from "./Target";
import { GraphicBuilderCreateParams, GraphicBuilder } from "../GraphicBuilder";
import { PrimitiveBuilder } from "../primitives/geometry/GeometryListBuilder";
import { PolylineArgs, MeshArgs } from "../primitives/mesh/MeshPrimitives";
import { GraphicsList, Branch, Batch } from "./Graphic";
import { IModelConnection } from "../../IModelConnection";
import { BentleyStatus, assert, Dictionary } from "@bentley/bentleyjs-core";
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
export class IdMap {
  /** Mapping of materials by their key values. */
  public readonly materialMap: Map<string, RenderMaterial>;
  /** Mapping of textures by their key values. */
  public readonly textureMap: Map<string, RenderTexture>;
  /** Mapping of textures using gradient symbology. */
  public readonly gradientMap: Dictionary<Gradient.Symb, RenderTexture>;
  /** Array of textures without key values (unnamed). */
  public keylessTextures: RenderTexture[] = [];

  public constructor() {
    this.materialMap = new Map<string, RenderMaterial>();
    this.textureMap = new Map<string, RenderTexture>();
    this.gradientMap = new Dictionary<Gradient.Symb, RenderTexture>(Gradient.Symb.compareSymb);
  }

  /** Add a material to the material map, given that it has a valid key. */
  public addMaterial(material: RenderMaterial) {
    if (material.key)
      this.materialMap.set(material.key, material);
  }

  /** Add a texture to the texture map, given that it has a valid key. */
  public addTexture(texture: RenderTexture) {
    if (texture.key)
      this.textureMap.set(texture.key, texture);
    else
      this.keylessTextures.push(texture);
  }

  /** Add a texture to the gradient symbology map. */
  public addGradient(gradientSymb: Gradient.Symb, texture: RenderTexture) {
    this.gradientMap.set(gradientSymb, texture);
  }

  /** Find a cached material using its key. If not found, returns undefined. */
  public findMaterial(key: string): RenderMaterial | undefined {
    return this.materialMap.get(key);
  }

  /** Find a cached texture using its key. If not found, returns undefined. */
  public findTexture(key: string): RenderTexture | undefined {
    return this.textureMap.get(key);
  }

  /** Find a cached gradient using the symbology provided. If not found, returns undefined. */
  public findGradient(symb: Gradient.Symb): RenderTexture | undefined {
    return this.gradientMap.get(symb);
  }

  /**
   * Find a material using its key. If not found, create and return it.
   * This will also add it to the map if the key was valid.
   */
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

  /**
   * Attempt to create a new texture from an ImageBuffer and insert it into this cache.
   * If the texture already exists inside the cache, or an error occurs, returns undefined.
   */
  private createTextureFromImageBuffer(img: ImageBuffer, params: RenderTexture.Params): RenderTexture | undefined {
    if (params.key && this.textureMap.get(params.key) !== undefined)
      return undefined;

    const textureHandle = TextureHandle.createForImageBuffer(img);
    if (textureHandle === undefined)
      return undefined;
    const texture = new Texture(params, textureHandle);
    if (params.key)
      this.textureMap.set(params.key, texture);
    else
      this.keylessTextures.push(texture);
    return texture;
  }

  /**
   * Attempt to create a new texture from an ImageSource and insert it into this cache.
   * If the texture already exists inside the cache, or an error occurs, returns undefined.
   */
  private createTextureFromImageSource(imgSrc: ImageSource, width: number, height: number, params: RenderTexture.Params): RenderTexture | undefined {
    if (params.key && this.textureMap.get(params.key) !== undefined)
      return undefined;

    const textureHandle = TextureHandle.createForImageSource(width, height, imgSrc);
    if (textureHandle === undefined)
      return undefined;
    const texture = new Texture(params, textureHandle);
    if (params.key)
      this.textureMap.set(params.key, texture);
    else
      this.keylessTextures.push(texture);
    return texture;
  }

  /**
   * Find a texture using its key. If not found, create one using an ImageSource and return it.
   * This will also add it to the map if the key was valid.
   */
  public getTextureFromImageSource(imgSrc: ImageSource, width: number, height: number, params: RenderTexture.Params): RenderTexture | undefined {
    if (params.key) {
      const existingTexture = this.textureMap.get(params.key);
      if (existingTexture)
        return existingTexture;
    }

    // const image = this.extractImage(imgSrc);
    return this.createTextureFromImageSource(imgSrc, width, height, params);
  }

  /**
   * Find a texture using its key. If not found, create one using an ImageBuffer and return it.
   * This will also add it to the map if the key was valid. Returns undefined if we were unable to create the texture.
   */
  public getTexture(img: ImageBuffer, params: RenderTexture.Params): RenderTexture | undefined {
    if (params.key) {
      const existingTexture = this.textureMap.get(params.key);
      if (existingTexture)
        return existingTexture;
    }

    return this.createTextureFromImageBuffer(img, params);
  }

  /**
   * Find a gradient using its symbology. If the gradient does not exist, create it by constructing a texture
   * derived from an image of given height and width. This will also add it to the map.
   */
  public getGradient(grad: Gradient.Symb): RenderTexture | undefined {
    const existingGrad = this.gradientMap.get(grad);
    if (existingGrad)
      return existingGrad;

    const image: ImageBuffer = grad.getImage(0x100, 0x100);

    const textureHandle = TextureHandle.createForImageBuffer(image);
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
  public readonly frameBufferStack = new FrameBufferStack();

  public readonly techniques: Techniques;
  public readonly capabilities: Capabilities;

  public readonly drawBuffersExtension?: WEBGL_draw_buffers;

  private _lineCodeTexture: TextureHandle | undefined;
  public get lineCodeTexture() { return this._lineCodeTexture; }

  public readonly renderCache: Dictionary<IModelConnection, IdMap>;

  public static get instance() { return IModelApp.renderSystem as System; }

  public static identityTransform = Transform.createIdentity();

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

  public onInitialized(): void {
    this._lineCodeTexture = TextureHandle.createForData(LineCode.size, LineCode.count, new Uint8Array(LineCode.lineCodeData), false, GL.Texture.WrapMode.Repeat, GL.Texture.Format.Luminance);
    assert(undefined !== this._lineCodeTexture, "System.lineCodeTexture not created.");
  }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget { return new OnScreenTarget(canvas); }
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new OffScreenTarget(rect); }
  public createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return new PrimitiveBuilder(this, params); }
  public createIndexedPolylines(args: PolylineArgs, imodel: IModelConnection): RenderGraphic | undefined {
    if (args.flags.isDisjoint)
      return PointStringPrimitive.create(args, imodel);
    else
      return PolylinePrimitive.create(args, imodel);
  }
  public createTriMesh(args: MeshArgs, iModel: IModelConnection) { return MeshGraphic.create(args, iModel); }
  public createGraphicList(primitives: RenderGraphic[], imodel: IModelConnection): RenderGraphic { return new GraphicsList(primitives, imodel); }
  public createBranch(branch: GraphicBranch, imodel: IModelConnection, transform: Transform, clips?: ClipVector): RenderGraphic { return new Branch(imodel, branch, transform, clips); }
  public createBatch(graphic: RenderGraphic, features: FeatureTable): RenderGraphic { return new Batch(graphic, features); }

  public applyRenderState(newState: RenderState) {
    newState.apply(this._currentRenderState);
    this._currentRenderState.copyFrom(newState);
  }

  public createDepthBuffer(width: number, height: number): DepthBuffer | undefined {
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

  /** Find an imodel rendering map using an IModelConnection. Returns undefined if not found. */
  public findIModelMap(imodel: IModelConnection): IdMap | undefined {
    return this.renderCache.get(imodel);
  }

  /**
   * Find an imodel rendering map using an IModelConnection. If not found, as long as the id
   * is valid, create and return a new one, adding it to the dictionary.
   */
  public createIModelMap(imodel: IModelConnection): IdMap | undefined {
    let idMap = this.renderCache.get(imodel);
    if (!idMap) {
      if (!imodel.iModelToken.iModelId)
        return undefined;
      idMap = new IdMap();  // This currently starts empty, no matter the current contents of the imodel
      this.renderCache.set(imodel, idMap);
    }
    return idMap;
  }

  /**
   * Removes an imodel map from the renderCache. This function is called when the onClose event occurs on an iModel.
   * Note that this does not remove
   */
  private removeIModelMap(imodel: IModelConnection) {
    // First, 'free' all textures in the idMap for this imodel
    const idMap = this.renderCache.get(imodel);
    if (idMap === undefined)
      return;
    const textureArr = Array.from(idMap.textureMap.values()).concat(idMap.keylessTextures);
    const gradientArr = idMap.gradientMap.extractArrays().values;
    for (const texture of textureArr) {
      texture.dispose();
    }
    for (const gradient of gradientArr) {
      gradient.dispose();
    }
    this.renderCache.delete(imodel);
  }

  /**
   * Actions to perform when the IModelApp shuts down. Release all imodel apps that were involved in the shutdown.
   */
  public onShutDown() {
    // First, 'free' all textures that are used by a WebGL wrapper
    const imodelArr = this.renderCache.extractArrays().values;
    for (const idMap of imodelArr) {
      const textureArr = Array.from(idMap.textureMap.values()).concat(idMap.keylessTextures);
      const gradientArr = idMap.gradientMap.extractArrays().values;
      for (const texture of textureArr) {
        texture.dispose();
      }
      for (const gradient of gradientArr) {
        gradient.dispose();
      }
    }

    this.renderCache.clear();
    IModelConnection.onClose.removeListener(this.removeIModelMap);
  }

  /**
   * Creates a material and adds it to the iModel's render map. If the material already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public createMaterial(params: RenderMaterial.Params, imodel: IModelConnection): RenderMaterial | undefined {
    let idMap = this.renderCache.get(imodel);
    if (!idMap) {
      idMap = new IdMap();
      this.renderCache.insert(imodel, idMap);
    }
    return idMap.getMaterial(params);
  }

  /** Searches through the iModel's render map for a material, given its key. Returns undefined if none found. */
  public findMaterial(key: string, imodel: IModelConnection): RenderMaterial | undefined {
    const idMap = this.renderCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findMaterial(key);
  }

  /**
   * Creates a texture using an ImageBuffer and adds it to the iModel's render map. If the texture already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public createTextureFromImageBuffer(image: ImageBuffer, imodel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    let idMap = this.renderCache.get(imodel);
    if (!idMap) {
      idMap = new IdMap();
      this.renderCache.insert(imodel, idMap);
    }
    return idMap.getTexture(image, params);
  }

  /**
   * Creates a texture using an ImageSource and adds it to the iModel's render map. If the texture already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public createTextureFromImageSource(source: ImageSource, width: number, height: number, imodel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    let idMap = this.renderCache.get(imodel);
    if (!idMap) {
      idMap = new IdMap();
      this.renderCache.insert(imodel, idMap);
    }
    return idMap.getTextureFromImageSource(source, width, height, params);
  }

  /**
   * Creates a texture using gradient symbology and adds it to the iModel's render map. If the texture already exists in the map, simply return it.
   * If no render map exists for the imodel, returns undefined.
   */
  public getGradientTexture(symb: Gradient.Symb, imodel: IModelConnection): RenderTexture | undefined {
    let idMap = this.renderCache.get(imodel);
    if (!idMap) {
      idMap = new IdMap();
      this.renderCache.insert(imodel, idMap);
    }
    return idMap.getGradient(symb);
  }

  /** Searches through the iModel's render map for a texture, given its key. Returns undefined if none found. */
  public findTexture(key: string, imodel: IModelConnection): RenderTexture | undefined {
    const idMap = this.renderCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findTexture(key);
  }

  private constructor(canvas: HTMLCanvasElement, context: WebGLRenderingContext, techniques: Techniques, capabilities: Capabilities) {
    super(canvas);
    this.context = context;
    this.techniques = techniques;
    this.capabilities = capabilities;
    this.drawBuffersExtension = capabilities.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
    this.renderCache = new Dictionary<IModelConnection, IdMap>((lhs: IModelConnection, rhs: IModelConnection): number => {
      if (lhs.iModelToken.iModelId !== rhs.iModelToken.iModelId) {
        if (lhs.iModelToken.iModelId === undefined || rhs.iModelToken.iModelId === undefined)
          return -1;
        if (lhs.iModelToken.iModelId < rhs.iModelToken.iModelId!)
          return -1;
        return 1;
      }
      return 0;
    });
    // Make this System a subscriber to the the IModelConnection onClose event
    IModelConnection.onClose.addListener(this.removeIModelMap.bind(this));
  }
}

Object.freeze(System.identityTransform);
