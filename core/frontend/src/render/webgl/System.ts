/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { RenderGraphic, GraphicBranch, RenderSystem, RenderTarget } from "../System";
import { OnScreenTarget } from "./Target";
import { GraphicBuilderCreateParams, GraphicBuilder } from "../GraphicBuilder";
import { PrimitiveBuilder } from "../primitives/Geometry";
import { GraphicsList, Branch } from "./Graphic";
import { IModelConnection } from "../../IModelConnection";
import { BentleyStatus, assert } from "@bentley/bentleyjs-core";
import { Techniques } from "./Technique";
import { IModelApp } from "../../IModelApp";

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

  private _extensionMap: {[key: string]: any} = {}; // Use this map to store actual extension objects retrieved from GL.

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

export class System extends RenderSystem {
  private readonly _canvas: HTMLCanvasElement;
  public readonly context: WebGLRenderingContext;

  public readonly techniques: Techniques;
  public readonly capabilities: Capabilities;

  public readonly drawBuffersExtension?: WEBGL_draw_buffers;

  public static get instance() { return IModelApp.renderSystem as System; }

  public static create(canvas?: HTMLCanvasElement): System | undefined {
    if (undefined === canvas) {
      return undefined;
    }

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

  public createTarget(): RenderTarget { return new OnScreenTarget(); }
  public createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder { return new PrimitiveBuilder(this, params); }
  public createGraphicList(primitives: RenderGraphic[], imodel: IModelConnection): RenderGraphic { return new GraphicsList(primitives, imodel); }
  public createBranch(branch: GraphicBranch, imodel: IModelConnection, transform: Transform, clips?: ClipVector): RenderGraphic { return new Branch(imodel, branch, transform, clips); }

  private constructor(canvas: HTMLCanvasElement, context: WebGLRenderingContext, techniques: Techniques, capabilities: Capabilities) {
    super();
    this._canvas = canvas;
    this.context = context;
    this.techniques = techniques;
    this.capabilities = capabilities;
    this.drawBuffersExtension = capabilities.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
    // Silence unused variable warnings...
    assert(undefined !== this._canvas);
    assert(undefined !== this.context);
  }
}
