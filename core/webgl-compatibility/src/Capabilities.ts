/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Compatibility
 */

import { ProcessDetector } from "@itwin/core-bentley";
import type {
  GraphicsDriverBugs, WebGLContext, WebGLRenderCompatibilityInfo} from "./RenderCompatibility";
import { WebGLFeature, WebGLRenderCompatibilityStatus,
} from "./RenderCompatibility";

/** @internal */
export type WebGLExtensionName =
  "WEBGL_draw_buffers" | "OES_element_index_uint" | "OES_texture_float" | "OES_texture_float_linear" |
  "OES_texture_half_float" | "OES_texture_half_float_linear" | "EXT_texture_filter_anisotropic" | "WEBGL_depth_texture" |
  "EXT_color_buffer_float" | "EXT_shader_texture_lod" | "ANGLE_instanced_arrays" | "OES_vertex_array_object" | "WEBGL_lose_context" |
  "EXT_frag_depth" | "EXT_disjoint_timer_query" | "EXT_disjoint_timer_query_webgl2" | "OES_standard_derivatives" | "EXT_float_blend";

const knownExtensions: WebGLExtensionName[] = [
  "WEBGL_draw_buffers",
  "OES_element_index_uint",
  "OES_texture_float",
  "OES_texture_float_linear",
  "OES_texture_half_float",
  "OES_texture_half_float_linear",
  "EXT_texture_filter_anisotropic",
  "WEBGL_depth_texture",
  "EXT_color_buffer_float",
  "EXT_shader_texture_lod",
  "EXT_frag_depth",
  "ANGLE_instanced_arrays",
  "OES_vertex_array_object",
  "WEBGL_lose_context",
  "EXT_disjoint_timer_query",
  "EXT_disjoint_timer_query_webgl2",
  "OES_standard_derivatives",
  "EXT_float_blend",
];

/** Describes the type of a render target. Used by Capabilities to represent maximum precision render target available on host system.
 * @internal
 */
export enum RenderType {
  TextureUnsignedByte,
  TextureHalfFloat,
  TextureFloat,
}

/**
 * Describes the type of a depth buffer. Used by Capabilities to represent maximum depth buffer precision available on host system.
 * Note: the commented-out values are unimplemented but left in place for reference, in case desired for future implementation.
 * @internal
 */
export enum DepthType {
  RenderBufferUnsignedShort16,     // core to WebGL1
  // TextureUnsignedShort16,       // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureUnsignedInt24,         // core to WebGL2
  TextureUnsignedInt24Stencil8,    // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  TextureUnsignedInt32,            // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureFloat32,               // core to WebGL2
  // TextureFloat32Stencil8,       // core to WeBGL2
}

const maxTexSizeAllowed = 4096; // many devices and browsers have issues with source textures larger than this

// Regexes to match Intel UHD/HD 620/630 integrated GPUS that suffer from GraphicsDriverBugs.fragDepthDoesNotDisableEarlyZ.
const buggyIntelMatchers = [
  // Original unmasked renderer string when workaround we implemented.
  /ANGLE \(Intel\(R\) (U)?HD Graphics 6(2|3)0 Direct3D11/,
  // New unmasked renderer string circa October 2021.
  /ANGLE \(Intel, Intel\(R\) (U)?HD Graphics 6(2|3)0 Direct3D11/,
];

/** Describes the rendering capabilities of the host system.
 * @internal
 */
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
  private _canRenderDepthWithoutColor: boolean = false;
  private _maxAnisotropy?: number;
  private _maxAntialiasSamples: number = 1;
  private _supportsCreateImageBitmap: boolean = false;
  private _maxTexSizeAllow: number = maxTexSizeAllowed;

  private _extensionMap: { [key: string]: any } = {}; // Use this map to store actual extension objects retrieved from GL.
  private _presentFeatures: WebGLFeature[] = []; // List of features the system can support (not necessarily dependent on extensions)

  private _isWebGL2: boolean = false;
  private _isMobile: boolean = false;
  private _driverBugs: GraphicsDriverBugs = {};

  public get maxRenderType(): RenderType { return this._maxRenderType; }
  public get maxDepthType(): DepthType { return this._maxDepthType; }
  public get maxTextureSize(): number { return this._maxTextureSize; }
  public get maxTexSizeAllow(): number { return this._maxTexSizeAllow; }
  public get supportsCreateImageBitmap(): boolean { return this._supportsCreateImageBitmap; }
  public get maxColorAttachments(): number { return this._maxColorAttachments; }
  public get maxDrawBuffers(): number { return this._maxDrawBuffers; }
  public get maxFragTextureUnits(): number { return this._maxFragTextureUnits; }
  public get maxVertTextureUnits(): number { return this._maxVertTextureUnits; }
  public get maxVertAttribs(): number { return this._maxVertAttribs; }
  public get maxVertUniformVectors(): number { return this._maxVertUniformVectors; }
  public get maxVaryingVectors(): number { return this._maxVaryingVectors; }
  public get maxFragUniformVectors(): number { return this._maxFragUniformVectors; }
  public get maxAntialiasSamples(): number { return this._maxAntialiasSamples; }
  public get isWebGL2(): boolean { return this._isWebGL2; }
  public get driverBugs(): GraphicsDriverBugs { return this._driverBugs; }

  /** These getters check for existence of extension objects to determine availability of features.  In WebGL2, could just return true for some. */
  public get supportsNonPowerOf2Textures(): boolean { return false; }
  public get supportsDrawBuffers(): boolean { return this._isWebGL2 || this.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers") !== undefined; }
  public get supportsInstancing(): boolean { return this._isWebGL2 || this.queryExtensionObject<ANGLE_instanced_arrays>("ANGLE_instanced_arrays") !== undefined; }
  public get supports32BitElementIndex(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_element_index_uint>("OES_element_index_uint") !== undefined; }
  public get supportsTextureFloat(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_texture_float>("OES_texture_float") !== undefined; }
  public get supportsTextureFloatLinear(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_texture_float_linear>("OES_texture_float_linear") !== undefined; }
  public get supportsTextureHalfFloat(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float") !== undefined; }
  public get supportsTextureHalfFloatLinear(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_texture_half_float_linear>("OES_texture_half_float_linear") !== undefined; }
  public get supportsTextureFilterAnisotropic(): boolean { return this.queryExtensionObject<EXT_texture_filter_anisotropic>("EXT_texture_filter_anisotropic") !== undefined; }
  public get supportsShaderTextureLOD(): boolean { return this._isWebGL2 || this.queryExtensionObject<EXT_shader_texture_lod>("EXT_shader_texture_lod") !== undefined; }
  public get supportsVertexArrayObjects(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_vertex_array_object>("OES_vertex_array_object") !== undefined; }
  public get supportsFragDepth(): boolean { return this._isWebGL2 || this.queryExtensionObject<EXT_frag_depth>("EXT_frag_depth") !== undefined; }
  public get supportsDisjointTimerQuery(): boolean { return (this._isWebGL2 && this.queryExtensionObject<any>("EXT_disjoint_timer_query_webgl2") !== undefined) || this.queryExtensionObject<any>("EXT_disjoint_timer_query") !== undefined; }
  public get supportsStandardDerivatives(): boolean { return this._isWebGL2 || this.queryExtensionObject<OES_standard_derivatives>("OES_standard_derivatives") !== undefined; }

  public get supportsMRTTransparency(): boolean { return this.maxColorAttachments >= 2; }
  public get supportsMRTPickShaders(): boolean { return this.maxColorAttachments >= 3; }

  public get canRenderDepthWithoutColor(): boolean { return this._canRenderDepthWithoutColor; }

  public get supportsShadowMaps(): boolean {
    return this.supportsTextureFloat || this.supportsTextureHalfFloat;
  }

  public get supportsAntiAliasing(): boolean { return this._isWebGL2 && this.maxAntialiasSamples > 1; }

  public get isMobile(): boolean { return this._isMobile; }

  private findExtension(name: WebGLExtensionName): any {
    const ext = this._extensionMap[name];
    return null !== ext ? ext : undefined;
  }

  /** Queries an extension object if available.  This is necessary for other parts of the system to access some constants within extensions. */
  public queryExtensionObject<T>(ext: WebGLExtensionName): T | undefined {
    return this.findExtension(ext) as T;
  }

  public static readonly optionalFeatures: WebGLFeature[] = [
    WebGLFeature.MrtTransparency,
    WebGLFeature.MrtPick,
    WebGLFeature.DepthTexture,
    WebGLFeature.FloatRendering,
    WebGLFeature.Instancing,
    WebGLFeature.ShadowMaps,
    WebGLFeature.FragDepth,
    WebGLFeature.StandardDerivatives,
    WebGLFeature.AntiAliasing,
  ];
  public static readonly requiredFeatures: WebGLFeature[] = [
    WebGLFeature.UintElementIndex,
    WebGLFeature.MinimalTextureUnits,
  ];

  private get _hasRequiredTextureUnits(): boolean { return this.maxFragTextureUnits >= 4 && this.maxVertTextureUnits >= 5; }

  /** Return an array containing any features not supported by the system as compared to the input array. */
  private _findMissingFeatures(featuresToSeek: WebGLFeature[]): WebGLFeature[] {
    const missingFeatures: WebGLFeature[] = [];
    for (const featureName of featuresToSeek) {
      if (-1 === this._presentFeatures.indexOf(featureName))
        missingFeatures.push(featureName);
    }
    return missingFeatures;
  }

  /** Populate and return an array containing features that this system supports. */
  private _gatherFeatures(): WebGLFeature[] {
    const features: WebGLFeature[] = [];

    // simply check for presence of various extensions if that gives enough information
    if (this._isWebGL2 || this._extensionMap["OES_element_index_uint" as WebGLExtensionName] !== undefined)
      features.push(WebGLFeature.UintElementIndex);
    if (this._isWebGL2 || this._extensionMap["ANGLE_instanced_arrays" as WebGLExtensionName] !== undefined)
      features.push(WebGLFeature.Instancing);

    if (this.supportsMRTTransparency)
      features.push(WebGLFeature.MrtTransparency);
    if (this.supportsMRTPickShaders)
      features.push(WebGLFeature.MrtPick);
    if (this.supportsShadowMaps)
      features.push(WebGLFeature.ShadowMaps);
    if (this._hasRequiredTextureUnits)
      features.push(WebGLFeature.MinimalTextureUnits);
    if (this.supportsFragDepth)
      features.push(WebGLFeature.FragDepth);
    if (this.supportsStandardDerivatives)
      features.push(WebGLFeature.StandardDerivatives);
    if (this.supportsAntiAliasing)
      features.push(WebGLFeature.AntiAliasing);

    if (DepthType.TextureUnsignedInt24Stencil8 === this._maxDepthType)
      features.push(WebGLFeature.DepthTexture);

    // check if at least half-float rendering is available based on maximum discovered renderable target
    if (RenderType.TextureUnsignedByte !== this._maxRenderType)
      features.push(WebGLFeature.FloatRendering);

    return features;
  }

  /** Retrieve compatibility status based on presence of various features. */
  private _getCompatibilityStatus(missingRequiredFeatures: WebGLFeature[], missingOptionalFeatures: WebGLFeature[]): WebGLRenderCompatibilityStatus {
    let status: WebGLRenderCompatibilityStatus = WebGLRenderCompatibilityStatus.AllOkay;
    if (missingOptionalFeatures.length > 0)
      status = WebGLRenderCompatibilityStatus.MissingOptionalFeatures;
    if (missingRequiredFeatures.length > 0)
      status = WebGLRenderCompatibilityStatus.MissingRequiredFeatures;
    return status;
  }

  /** Initializes the capabilities based on a GL context. Must be called first. */
  public init(gl: WebGLContext, disabledExtensions?: WebGLExtensionName[]): WebGLRenderCompatibilityInfo {
    const gl2 = !(gl instanceof WebGLRenderingContext) ? gl : undefined;
    this._isWebGL2 = undefined !== gl2;

    this._isMobile = ProcessDetector.isMobileBrowser;

    this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this._supportsCreateImageBitmap = typeof createImageBitmap === "function" && ProcessDetector.isChromium && !ProcessDetector.isIOSBrowser;
    this._maxTexSizeAllow = Math.min(this._maxTextureSize, maxTexSizeAllowed);
    this._maxFragTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this._maxVertTextureUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this._maxVertAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    this._maxVertUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this._maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
    this._maxFragUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
    this._maxAntialiasSamples = (this._isWebGL2 && undefined !== gl2 ? gl.getParameter(gl2.MAX_SAMPLES) : 1);

    const extensions = gl.getSupportedExtensions(); // This just retrieves a list of available extensions (not necessarily enabled).
    if (extensions) {
      for (const extStr of extensions) {
        const ext = extStr as WebGLExtensionName;
        if (-1 === knownExtensions.indexOf(ext))
          continue;
        else if (undefined !== disabledExtensions && -1 !== disabledExtensions.indexOf(ext))
          continue;

        const extObj: any = gl.getExtension(ext); // This call enables the extension and returns a WebGLObject containing extension instance.
        if (null !== extObj)
          this._extensionMap[ext] = extObj;
      }
    }

    if (this._isWebGL2 && undefined !== gl2) {
      this._maxColorAttachments = gl.getParameter(gl2.MAX_COLOR_ATTACHMENTS);
      this._maxDrawBuffers = gl.getParameter(gl2.MAX_DRAW_BUFFERS);
    } else {
      const dbExt: WEBGL_draw_buffers | undefined = this.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
      this._maxColorAttachments = dbExt !== undefined ? gl.getParameter(dbExt.MAX_COLOR_ATTACHMENTS_WEBGL) : 1;
      this._maxDrawBuffers = dbExt !== undefined ? gl.getParameter(dbExt.MAX_DRAW_BUFFERS_WEBGL) : 1;
    }

    // Determine the maximum color-renderable attachment type.
    // Note: iOS>=15 allows full-float rendering. However, it does not actually work on non-M1 devices. Because of this, for now we disallow full float rendering on iOS devices.
    // ###TODO: Re-assess this after future iOS updates.
    const allowFloatRender = (undefined === disabledExtensions || -1 === disabledExtensions.indexOf("OES_texture_float")) && !ProcessDetector.isIOSBrowser;
    if (allowFloatRender && undefined !== this.queryExtensionObject("EXT_float_blend") && this.isTextureRenderable(gl, gl.FLOAT)) {
      this._maxRenderType = RenderType.TextureFloat;
    } else if (this.isWebGL2) {
      this._maxRenderType = (this.isTextureRenderable(gl, (gl as WebGL2RenderingContext).HALF_FLOAT)) ? RenderType.TextureHalfFloat : RenderType.TextureUnsignedByte;
    } else {
      const hfExt: OES_texture_half_float | undefined = this.queryExtensionObject<OES_texture_half_float>("OES_texture_half_float");
      this._maxRenderType = (hfExt !== undefined && this.isTextureRenderable(gl, hfExt.HALF_FLOAT_OES)) ? RenderType.TextureHalfFloat : RenderType.TextureUnsignedByte;
    }

    // Determine the maximum depth attachment type.
    // this._maxDepthType = this.queryExtensionObject("WEBGL_depth_texture") !== undefined ? DepthType.TextureUnsignedInt32 : DepthType.RenderBufferUnsignedShort16;
    this._maxDepthType = this._isWebGL2 || this.queryExtensionObject("WEBGL_depth_texture") !== undefined ? DepthType.TextureUnsignedInt24Stencil8 : DepthType.RenderBufferUnsignedShort16;

    this._canRenderDepthWithoutColor = this._maxDepthType === DepthType.TextureUnsignedInt24Stencil8 ? this.isDepthRenderableWithoutColor(gl) : false;

    this._presentFeatures = this._gatherFeatures();
    const missingRequiredFeatures = this._findMissingFeatures(Capabilities.requiredFeatures);
    const missingOptionalFeatures = this._findMissingFeatures(Capabilities.optionalFeatures);

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const unmaskedRenderer = debugInfo !== null ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : undefined;
    const unmaskedVendor = debugInfo !== null ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : undefined;

    this._driverBugs = {};
    if (unmaskedRenderer && buggyIntelMatchers.some((x) => x.test(unmaskedRenderer)))
      this._driverBugs.fragDepthDoesNotDisableEarlyZ = true;

    return {
      status: this._getCompatibilityStatus(missingRequiredFeatures, missingOptionalFeatures),
      missingRequiredFeatures,
      missingOptionalFeatures,
      unmaskedRenderer,
      unmaskedVendor,
      driverBugs: { ...this._driverBugs },
      userAgent: navigator.userAgent,
      createdContext: gl,
    };
  }

  public static create(gl: WebGLContext, disabledExtensions?: WebGLExtensionName[]): Capabilities | undefined {
    const caps = new Capabilities();
    const compatibility = caps.init(gl, disabledExtensions);
    if (WebGLRenderCompatibilityStatus.CannotCreateContext === compatibility.status || WebGLRenderCompatibilityStatus.MissingRequiredFeatures === compatibility.status)
      return undefined;
    return caps;
  }

  /** Determines if a particular texture type is color-renderable on the host system. */
  private isTextureRenderable(gl: WebGLContext, texType: number): boolean {
    const tex: WebGLTexture | null = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.isWebGL2) {
      if (gl.FLOAT === texType)
        gl.texImage2D(gl.TEXTURE_2D, 0, (gl as WebGL2RenderingContext).RGBA32F, 1, 1, 0, gl.RGBA, texType, null);
      else
        gl.texImage2D(gl.TEXTURE_2D, 0, (gl as WebGL2RenderingContext).RGBA16F, 1, 1, 0, gl.RGBA, texType, null);
    } else
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

  /** Determines if depth textures can be rendered without also having a color attachment bound on the host system. */
  private isDepthRenderableWithoutColor(gl: WebGLContext): boolean {
    const dtExt = this.queryExtensionObject<WEBGL_depth_texture>("WEBGL_depth_texture");
    if (dtExt === undefined)
      return false;

    const tex: WebGLTexture | null = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_STENCIL, 1, 1, 0, gl.DEPTH_STENCIL, dtExt.UNSIGNED_INT_24_8_WEBGL, null);

    const fb: WebGLFramebuffer | null = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, tex, 0);

    const fbStatus: number = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    gl.deleteTexture(tex);

    gl.getError(); // clear any errors

    return fbStatus === gl.FRAMEBUFFER_COMPLETE;
  }

  public setMaxAnisotropy(desiredMax: number | undefined, gl: WebGLContext): void {
    const ext = this.queryExtensionObject<EXT_texture_filter_anisotropic>("EXT_texture_filter_anisotropic");
    if (undefined === ext)
      return;

    if (undefined === this._maxAnisotropy)
      this._maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;

    const max = (undefined !== desiredMax) ? Math.min(desiredMax, this._maxAnisotropy) : this._maxAnisotropy;
    gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
  }
}
