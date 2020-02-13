/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  ColorDef,
  ElementAlignedBox3d,
  Gradient,
  IModelError,
  ImageBuffer,
  PackedFeatureTable,
  QParams3d,
  QPoint3d,
  QPoint3dList,
  RenderMaterial,
  RenderTexture,
} from "@bentley/imodeljs-common";
import {
  ClipUtilities,
  ClipVector,
  HalfEdge,
  HalfEdgeGraph,
  HalfEdgeMask,
  IndexedPolyface,
  IndexedPolyfaceVisitor,
  Point2d,
  Point3d,
  PolyfaceBuilder,
  Range3d,
  StrokeOptions,
  Transform,
  Triangulator,
} from "@bentley/geometry-core";
import {
  GraphicBranch,
  GraphicBranchOptions,
} from "../GraphicBranch";
import {
  GraphicList,
  RenderGraphic,
  RenderGraphicOwner,
} from "../RenderGraphic";
import { InstancedGraphicParams } from "../InstancedGraphicParams";
import { RenderClipVolume } from "../RenderClipVolume";
import { RenderTarget } from "../RenderTarget";
import {
  GLTimerResultCallback,
  RenderDiagnostics,
  RenderMemory,
  RenderSystem,
  RenderSystemDebugControl,
  WebGLExtensionName,
} from "../RenderSystem";
import { SkyBox } from "../../DisplayStyleState";
import { OnScreenTarget, OffScreenTarget } from "./Target";
import { GraphicBuilder, GraphicType } from "../GraphicBuilder";
import { PrimitiveBuilder } from "../primitives/geometry/GeometryListBuilder";
import { PointCloudArgs } from "../primitives/PointCloudPrimitive";
import { PointStringParams, MeshParams, PolylineParams } from "../primitives/VertexTable";
import { MeshArgs } from "../primitives/mesh/MeshPrimitives";
import {
  Batch,
  Branch,
  Graphic,
  GraphicOwner,
  GraphicsArray,
} from "./Graphic";
import {
  Layer,
  LayerContainer,
} from "./Layer";
import { IModelConnection } from "../../IModelConnection";
import { assert, BentleyStatus, Dictionary, dispose, Id64String } from "@bentley/bentleyjs-core";
import { Techniques } from "./Technique";
import { IModelApp } from "../../IModelApp";
import { Viewport } from "../../Viewport";
import { ViewRect } from "../../ViewRect";
import { WebGLFeature, WebGLRenderCompatibilityInfo, WebGLRenderCompatibilityStatus } from "../../RenderCompatibility";
import { RenderState } from "./RenderState";
import { FrameBufferStack, DepthBuffer } from "./FrameBuffer";
import { RenderBuffer } from "./RenderBuffer";
import { TextureHandle, Texture } from "./Texture";
import { GL } from "./GL";
import { GLTimer } from "./GLTimer";
import { PolylineGeometry } from "./Polyline";
import { PointStringGeometry } from "./PointString";
import { MeshGraphic } from "./Mesh";
import { PointCloudGeometry } from "./PointCloud";
import { LineCode } from "./EdgeOverrides";
import { Material } from "./Material";
import { CachedGeometry, SkyBoxQuadsGeometry, SkySphereViewportQuadGeometry } from "./CachedGeometry";
import { SkyCubePrimitive, SkySpherePrimitive, Primitive } from "./Primitive";
import { ClipPlanesVolume, ClipMaskVolume } from "./ClipVolume";
import { TextureUnit } from "./RenderFlags";
import { UniformHandle } from "./Handle";
import { Debug } from "./Diagnostics";
import { BackgroundMapTileTreeReference, TileTreeReference } from "../../tile/internal";
import { BackgroundMapDrape } from "./BackgroundMapDrape";
import { ToolAdmin } from "../../tools/ToolAdmin";
import { WebGLDisposable } from "./Disposable";

// tslint:disable:no-const-enum

/** @internal */
export const enum ContextState {
  Uninitialized,
  Success,
  Error,
}

/** Describes the type of a render target. Used by Capabilities to represent maximum precision render target available on host system.
 * @internal
 */
export const enum RenderType {
  TextureUnsignedByte,
  TextureHalfFloat,
  TextureFloat,
}

/**
 * Describes the type of a depth buffer. Used by Capabilities to represent maximum depth buffer precision available on host system.
 * Note: the commented-out values are unimplemented but left in place for reference, in case desired for future implementation.
 * @internal
 */
export const enum DepthType {
  RenderBufferUnsignedShort16,     // core to WebGL1
  // TextureUnsignedShort16,       // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureUnsignedInt24,         // core to WebGL2
  TextureUnsignedInt24Stencil8,    // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  TextureUnsignedInt32,            // core to WebGL2; available to WebGL1 via WEBGL_depth_texture
  // TextureFloat32,               // core to WebGL2
  // TextureFloat32Stencil8,       // core to WeBGL2
}

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
];
/** Describes WebGL extension methods.
 * @internal
 */
abstract class WebGLExtensions {
  private _system: System;
  public constructor(system: System) {
    this._system = system;
  }
  public get system() { return this._system; }
  public abstract setDrawBuffers(attachments: GLenum[]): void;
  public abstract vertexAttribDivisor(index: number, divisor: number): void;
  public abstract drawArraysInst(type: GL.PrimitiveType, first: number, count: number, numInstances: number): void;
}

/** Describes WebGL1 extension methods.
 * @internal
 */
class WebGL1Extensions extends WebGLExtensions {
  private readonly _drawBuffersExtension?: WEBGL_draw_buffers;
  private readonly _instancingExtension?: ANGLE_instanced_arrays;

  public constructor(system: System, drawBuffersExt: WEBGL_draw_buffers | undefined, instancingExt: ANGLE_instanced_arrays | undefined) {
    super(system);
    this._drawBuffersExtension = drawBuffersExt;
    this._instancingExtension = instancingExt;
  }

  public setDrawBuffers(attachments: GLenum[]): void {
    // NB: The WEBGL_draw_buffers member is not exported directly because that type name is not available in some contexts (e.g. test-imodel-service).
    if (undefined !== this._drawBuffersExtension)
      this._drawBuffersExtension.drawBuffersWEBGL(attachments);
  }

  public vertexAttribDivisor(index: number, divisor: number): void {
    assert(undefined !== this._instancingExtension);
    this._instancingExtension!.vertexAttribDivisorANGLE(index, divisor);
  }

  public drawArraysInst(type: GL.PrimitiveType, first: number, count: number, numInstances: number): void {
    if (undefined !== this._instancingExtension) {
      this._instancingExtension.drawArraysInstancedANGLE(type, first, count, numInstances);
    }
  }
}

/** Describes WebGL2 extension methods.
 * @internal
 */
class WebGL2Extensions extends WebGLExtensions {
  private _context: WebGL2RenderingContext;
  public constructor(system: System) {
    super(system);
    this._context = system.context as WebGL2RenderingContext;
  }

  public setDrawBuffers(attachments: GLenum[]): void {
    this._context.drawBuffers(attachments);
  }

  public vertexAttribDivisor(index: number, divisor: number): void {
    this._context.vertexAttribDivisor(index, divisor);
  }

  public drawArraysInst(type: GL.PrimitiveType, first: number, count: number, numInstances: number): void { this._context.drawArraysInstanced(type, first, count, numInstances); }
}

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

  private _extensionMap: { [key: string]: any } = {}; // Use this map to store actual extension objects retrieved from GL.
  private _presentFeatures: WebGLFeature[] = []; // List of features the system can support (not necessarily dependent on extensions)

  private _isWebGL2: boolean = false;

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
  public get isWebGL2(): boolean { return this._isWebGL2; }

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

  public get supportsMRTTransparency(): boolean { return this.maxColorAttachments >= 2; }
  public get supportsMRTPickShaders(): boolean { return this.maxColorAttachments >= 3; }

  public get canRenderDepthWithoutColor(): boolean { return this._canRenderDepthWithoutColor; }

  public get supportsShadowMaps(): boolean {
    return this.supportsTextureFloat || this.supportsTextureHalfFloat;
  }

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
  public init(gl: WebGLRenderingContext | WebGL2RenderingContext, disabledExtensions?: WebGLExtensionName[]): WebGLRenderCompatibilityInfo {
    const gl2 = !(gl instanceof WebGLRenderingContext) ? gl : undefined;
    this._isWebGL2 = undefined !== gl2;

    this._maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this._maxFragTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this._maxVertTextureUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this._maxVertAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    this._maxVertUniformVectors = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this._maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
    this._maxFragUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);

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
    const allowFloatRender = undefined === disabledExtensions || -1 === disabledExtensions.indexOf("OES_texture_float");
    if (allowFloatRender && this.isTextureRenderable(gl, gl.FLOAT)) {
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

    this.debugPrint(gl, missingRequiredFeatures, missingOptionalFeatures);

    return {
      status: this._getCompatibilityStatus(missingRequiredFeatures, missingOptionalFeatures),
      missingRequiredFeatures,
      missingOptionalFeatures,
      unmaskedRenderer,
      unmaskedVendor,
      userAgent: navigator.userAgent,
    };
  }

  public static create(gl: WebGLRenderingContext | WebGL2RenderingContext, disabledExtensions?: WebGLExtensionName[]): Capabilities | undefined {
    const caps = new Capabilities();
    const compatibility = caps.init(gl, disabledExtensions);
    if (WebGLRenderCompatibilityStatus.CannotCreateContext === compatibility.status || WebGLRenderCompatibilityStatus.MissingRequiredFeatures === compatibility.status)
      return undefined;
    return caps;
  }

  /** Determines if a particular texture type is color-renderable on the host system. */
  private isTextureRenderable(gl: WebGLRenderingContext | WebGL2RenderingContext, texType: number): boolean {
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
  private isDepthRenderableWithoutColor(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
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

  private debugPrint(gl: WebGLRenderingContext | WebGL2RenderingContext, missingRequiredFeatures: WebGLFeature[], _missingOptionalFeatures: WebGLFeature[]) {
    if (!Debug.printEnabled)
      return;

    Debug.print(() => "GLES Capabilities Information:");
    Debug.print(() => "       hasRequiredFeatures : " + (0 === missingRequiredFeatures.length ? "yes" : "no"));
    Debug.print(() => "   missingOptionalFeatures : " + (missingRequiredFeatures.length > 0 ? "yes" : "no"));
    Debug.print(() => "   hasRequiredTextureUnits : " + this._hasRequiredTextureUnits);
    Debug.print(() => "                GL_VERSION : " + gl.getParameter(gl.VERSION));
    Debug.print(() => "                 GL_VENDOR : " + gl.getParameter(gl.VENDOR));
    Debug.print(() => "               GL_RENDERER : " + gl.getParameter(gl.RENDERER));
    Debug.print(() => "            maxTextureSize : " + this.maxTextureSize);
    Debug.print(() => "       maxColorAttachments : " + this.maxColorAttachments);
    Debug.print(() => "            maxDrawBuffers : " + this.maxDrawBuffers);
    Debug.print(() => "       maxFragTextureUnits : " + this.maxFragTextureUnits);
    Debug.print(() => "       maxVertTextureUnits : " + this.maxVertTextureUnits);
    Debug.print(() => "       nonPowerOf2Textures : " + (this.supportsNonPowerOf2Textures ? "yes" : "no"));
    Debug.print(() => "               drawBuffers : " + (this.supportsDrawBuffers ? "yes" : "no"));
    Debug.print(() => "                instancing : " + (this.supportsInstancing ? "yes" : "no"));
    Debug.print(() => "         32BitElementIndex : " + (this.supports32BitElementIndex ? "yes" : "no"));
    Debug.print(() => "              textureFloat : " + (this.supportsTextureFloat ? "yes" : "no"));
    Debug.print(() => "          textureHalfFloat : " + (this.supportsTextureHalfFloat ? "yes" : "no"));
    Debug.print(() => "          shaderTextureLOD : " + (this.supportsShaderTextureLOD ? "yes" : "no"));
    Debug.print(() => "                 fragDepth : " + (this.supportsFragDepth ? "yes" : "no"));
    Debug.print(() => "        disjointTimerQuery : " + (this.supportsDisjointTimerQuery ? "yes" : "no"));

    switch (this.maxRenderType) {
      case RenderType.TextureUnsignedByte:
        Debug.print(() => "             maxRenderType : TextureUnsigedByte");
        break;
      case RenderType.TextureHalfFloat:
        Debug.print(() => "             maxRenderType : TextureHalfFloat");
        break;
      case RenderType.TextureFloat:
        Debug.print(() => "             maxRenderType : TextureFloat");
        break;
      default:
        Debug.print(() => "             maxRenderType : Unknown");
    }

    switch (this.maxDepthType) {
      case DepthType.RenderBufferUnsignedShort16:
        Debug.print(() => "              maxDepthType : RenderBufferUnsignedShort16");
        break;
      case DepthType.TextureUnsignedInt24Stencil8:
        Debug.print(() => "              maxDepthType : TextureUnsignedInt24Stencil8");
        break;
      case DepthType.TextureUnsignedInt32:
        Debug.print(() => "              maxDepthType : TextureUnsignedInt32");
        break;
      default:
        Debug.print(() => "              maxDepthType : Unknown");
    }

    Debug.print(() => "canRenderDepthWithoutColor : " + (this.canRenderDepthWithoutColor ? "yes" : "no"));
  }
}

/** Id map holds key value pairs for both materials and textures, useful for caching such objects.
 * @internal
 */
export class IdMap implements WebGLDisposable {
  /** Mapping of materials by their key values. */
  public readonly materials: Map<string, RenderMaterial>;
  /** Mapping of textures by their key values. */
  public readonly textures: Map<string, RenderTexture>;
  /** Mapping of textures using gradient symbology. */
  public readonly gradients: Dictionary<Gradient.Symb, RenderTexture>;
  /** Solar shadow map (one for IModel) */
  public constructor() {
    this.materials = new Map<string, RenderMaterial>();
    this.textures = new Map<string, RenderTexture>();
    this.gradients = new Dictionary<Gradient.Symb, RenderTexture>(Gradient.Symb.compareSymb);
  }

  public get isDisposed(): boolean { return 0 === this.textures.size && 0 === this.gradients.size; }

  public dispose() {
    const textureArr = Array.from(this.textures.values());
    const gradientArr = this.gradients.extractArrays().values;

    for (const texture of textureArr)
      dispose(texture);

    for (const gradient of gradientArr)
      dispose(gradient);

    this.textures.clear();
    this.gradients.clear();
    this.materials.clear();
  }

  /** Add a material to this IdMap, given that it has a valid key. */
  public addMaterial(material: RenderMaterial) {
    if (material.key)
      this.materials.set(material.key, material);
  }

  /** Add a texture to this IdMap, given that it has a valid key. */
  public addTexture(texture: RenderTexture) {
    if (texture.key)
      this.textures.set(texture.key, texture);
  }

  /** Add a texture to this IdMap using gradient symbology. */
  public addGradient(gradientSymb: Gradient.Symb, texture: RenderTexture) {
    this.gradients.set(gradientSymb, texture);
  }

  /** Find a cached material using its key. If not found, returns undefined. */
  public findMaterial(key: string): RenderMaterial | undefined {
    return this.materials.get(key);
  }

  /** Find a cached gradient using the gradient symbology. If not found, returns undefined. */
  public findGradient(symb: Gradient.Symb): RenderTexture | undefined {
    return this.gradients.get(symb);
  }

  /** Find or create a new material given material parameters. This will cache the material if its key is valid. */
  public getMaterial(params: RenderMaterial.Params): RenderMaterial {
    if (!params.key)
      return new Material(params);

    let material = this.materials.get(params.key);
    if (!material) {
      material = new Material(params);
      this.materials.set(params.key, material);
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

  private createTextureFromImage(image: HTMLImageElement, hasAlpha: boolean, params: RenderTexture.Params): RenderTexture | undefined {
    return this.createTexture(params, TextureHandle.createForImage(image, hasAlpha, params.type));
  }

  private createTextureFromCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement, params: RenderTexture.Params) {
    return this.createTexture(params, TextureHandle.createForCubeImages(posX, negX, posY, negY, posZ, negZ));
  }

  public findTexture(key?: string): RenderTexture | undefined { return undefined !== key ? this.textures.get(key) : undefined; }

  /** Find or attempt to create a new texture using an ImageBuffer. If a new texture was created, it will be cached provided its key is valid. */
  public getTexture(img: ImageBuffer, params: RenderTexture.Params): RenderTexture | undefined {
    const tex = this.findTexture(params.key);
    return undefined !== tex ? tex : this.createTextureFromImageBuffer(img, params);
  }

  public getTextureFromImage(image: HTMLImageElement, hasAlpha: boolean, params: RenderTexture.Params): RenderTexture | undefined {
    const tex = this.findTexture(params.key);
    return undefined !== tex ? tex : this.createTextureFromImage(image, hasAlpha, params);
  }

  public getTextureFromCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement, params: RenderTexture.Params): RenderTexture | undefined {
    return this.createTextureFromCubeImages(posX, negX, posY, negY, posZ, negZ, params);
  }

  /** Find or attempt to create a new texture using gradient symbology. If a new texture was created, it will be cached using the gradient. */
  public getGradient(grad: Gradient.Symb): RenderTexture | undefined {
    const existingGrad = this.gradients.get(grad);
    if (existingGrad)
      return existingGrad;

    const image: ImageBuffer = grad.getImage(0x100, 0x100);

    const textureHandle = TextureHandle.createForImageBuffer(image, RenderTexture.Type.Normal);
    if (!textureHandle)
      return undefined;

    const params = new Texture.Params(undefined, Texture.Type.Normal, true); // gradient textures are unnamed, but owned by this IdMap.
    const texture = new Texture(params, textureHandle);
    this.addGradient(grad, texture);
    return texture;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const texture of this.textures.values())
      if (texture instanceof Texture)
        stats.addTexture(texture.bytesUsed);

    for (const gradient of this.gradients)
      if (gradient instanceof Texture)
        stats.addTexture(gradient.bytesUsed);
  }
}

export type TextureBinding = WebGLTexture | undefined;

const enum VertexAttribState {
  Disabled = 0,
  Enabled = 1 << 0,
  Instanced = 1 << 2,
  InstancedEnabled = Instanced | Enabled,
}

function createPrimitive(createGeom: (viOrigin: Point3d | undefined) => CachedGeometry | undefined, instancesOrVIOrigin: InstancedGraphicParams | Point3d | undefined): RenderGraphic | undefined {
  const viOrigin = instancesOrVIOrigin instanceof Point3d ? instancesOrVIOrigin : undefined;
  const instances = undefined === viOrigin ? instancesOrVIOrigin as InstancedGraphicParams : undefined;
  return Primitive.create(() => createGeom(viOrigin), instances);
}

/** @internal */
export class System extends RenderSystem implements RenderSystemDebugControl, RenderMemory.Consumer, WebGLDisposable {
  public readonly canvas: HTMLCanvasElement;
  public readonly currentRenderState = new RenderState();
  public readonly context: WebGLRenderingContext | WebGL2RenderingContext;
  public readonly frameBufferStack = new FrameBufferStack();  // frame buffers are not owned by the system
  public readonly capabilities: Capabilities;
  public readonly resourceCache: Map<IModelConnection, IdMap>;
  public readonly glTimer: GLTimer;
  private readonly _extensions: WebGLExtensions;
  private readonly _textureBindings: TextureBinding[] = [];
  private _removeEventListener?: () => void;

  // NB: Increase the size of these arrays when the maximum number of attributes used by any one shader increases.
  private readonly _curVertexAttribStates: VertexAttribState[] = [
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
  ];
  private readonly _nextVertexAttribStates: VertexAttribState[] = [
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
    VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled, VertexAttribState.Disabled,
  ];

  // The following are initialized immediately after the System is constructed.
  private _lineCodeTexture?: TextureHandle;
  private _noiseTexture?: TextureHandle;
  private _techniques?: Techniques;

  public static get instance() { return IModelApp.renderSystem as System; }

  public get isValid(): boolean { return this.canvas !== undefined; }
  public get lineCodeTexture() { return this._lineCodeTexture; }
  public get noiseTexture() { return this._noiseTexture; }
  public get techniques() { return this._techniques!; }

  public get maxTextureSize(): number { return this.capabilities.maxTextureSize; }
  public get supportsInstancing(): boolean { return this.capabilities.supportsInstancing; }

  public setDrawBuffers(attachments: GLenum[]): void { this._extensions.setDrawBuffers(attachments); }

  /** Attempt to create a WebGLRenderingContext, returning undefined if unsuccessful. */
  public static createContext(canvas: HTMLCanvasElement, contextAttributes?: WebGLContextAttributes, useWebGL2?: boolean): WebGLRenderingContext | WebGL2RenderingContext | undefined {
    let context = null;
    if (useWebGL2) // optionally first try using a WebGL2 context
      context = canvas.getContext("webgl2", contextAttributes);
    if (null === context)
      context = canvas.getContext("webgl", contextAttributes);
    if (null === context) {
      const context2 = canvas.getContext("experimental-webgl", contextAttributes) as WebGLRenderingContext | null; // IE, Edge...
      if (null === context2) {
        return undefined;
      }
      return context2;
    }
    return context;
  }

  public static queryRenderCompatibility(): WebGLRenderCompatibilityInfo {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas)
      return { status: WebGLRenderCompatibilityStatus.CannotCreateContext, missingOptionalFeatures: [], missingRequiredFeatures: [], userAgent: navigator.userAgent };

    let errorMessage: string | undefined;
    canvas.addEventListener("webglcontextcreationerror", (event) => {
      errorMessage = (event as WebGLContextEvent).statusMessage || "webglcontextcreationerror was triggered with no error provided";
    }, false);

    let hasMajorPerformanceCaveat = false;
    let context = System.createContext(canvas, { failIfMajorPerformanceCaveat: true });
    if (undefined === context) {
      hasMajorPerformanceCaveat = true;
      context = System.createContext(canvas); // try to create context without black-listed GPU
      if (undefined === context)
        return {
          status: WebGLRenderCompatibilityStatus.CannotCreateContext,
          missingOptionalFeatures: [],
          missingRequiredFeatures: [],
          userAgent: navigator.userAgent,
          contextErrorMessage: errorMessage,
        };
    }

    const capabilities = new Capabilities();
    const compatibility = capabilities.init(context);
    compatibility.contextErrorMessage = errorMessage;

    if (hasMajorPerformanceCaveat && compatibility.status !== WebGLRenderCompatibilityStatus.MissingRequiredFeatures)
      compatibility.status = WebGLRenderCompatibilityStatus.MajorPerformanceCaveat;

    return compatibility;
  }

  public static create(optionsIn?: RenderSystem.Options): System {
    const options: RenderSystem.Options = undefined !== optionsIn ? optionsIn : {};
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    if (null === canvas)
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");

    const useWebGL2 = (undefined === options.useWebGL2 ? false : options.useWebGL2);
    const context = System.createContext(canvas, undefined, useWebGL2);
    if (undefined === context) {
      throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGL context");
    }

    const capabilities = Capabilities.create(context, options.disabledExtensions);
    if (undefined === capabilities)
      throw new IModelError(BentleyStatus.ERROR, "Failed to initialize rendering capabilities");

    // set actual gl state to match desired state defaults
    context.depthFunc(GL.DepthFunc.Default);  // LessOrEqual

    if (!capabilities.supportsShadowMaps)
      options.displaySolarShadows = false;
    if (!capabilities.supportsFragDepth)
      options.logarithmicDepthBuffer = false;
    if (!capabilities.supportsTextureFilterAnisotropic) {
      options.filterMapTextures = false;
      options.filterMapDrapeTextures = false;
    }
    return new System(canvas, context, capabilities, options);
  }

  public get isDisposed(): boolean {
    return undefined === this._techniques
      && undefined === this._lineCodeTexture
      && undefined === this._noiseTexture;
  }

  // Note: FrameBuffers inside of the FrameBufferStack are not owned by the System, and are only used as a central storage device
  public dispose() {
    this._techniques = dispose(this._techniques);
    this._lineCodeTexture = dispose(this._lineCodeTexture);
    this._noiseTexture = dispose(this._noiseTexture);

    // We must attempt to dispose of each idmap in the resourceCache (if idmap is already disposed, has no effect)
    this.resourceCache.forEach((idMap: IdMap) => {
      dispose(idMap);
    });

    this.resourceCache.clear();
    if (undefined !== this._removeEventListener) {
      this._removeEventListener();
      this._removeEventListener = undefined;
    }
  }

  public onInitialized(): void {
    this._techniques = Techniques.create(this.context);

    const noiseDim = 4;
    const noiseArr = new Uint8Array([152, 235, 94, 173, 219, 215, 115, 176, 73, 205, 43, 201, 10, 81, 205, 198]);
    this._noiseTexture = TextureHandle.createForData(noiseDim, noiseDim, noiseArr, false, GL.Texture.WrapMode.Repeat, GL.Texture.Format.Luminance);
    assert(undefined !== this._noiseTexture, "System.noiseTexture not created.");

    this._lineCodeTexture = TextureHandle.createForData(LineCode.size, LineCode.count, new Uint8Array(LineCode.lineCodeData), false, GL.Texture.WrapMode.Repeat, GL.Texture.Format.Luminance);
    assert(undefined !== this._lineCodeTexture, "System.lineCodeTexture not created.");
  }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget { return new OnScreenTarget(canvas); }
  public createOffscreenTarget(rect: ViewRect): RenderTarget { return new OffScreenTarget(rect); }
  public createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): GraphicBuilder { return new PrimitiveBuilder(this, type, viewport, placement, pickableId); }

  public createMesh(params: MeshParams, instances?: InstancedGraphicParams | Point3d): RenderGraphic | undefined { return MeshGraphic.create(params, instances); }
  public createPolyline(params: PolylineParams, instances?: InstancedGraphicParams | Point3d): RenderGraphic | undefined {
    return createPrimitive((viOrigin) => PolylineGeometry.create(params, viOrigin), instances);
  }
  public createPointString(params: PointStringParams, instances?: InstancedGraphicParams | Point3d): RenderGraphic | undefined {
    return createPrimitive((viOrigin) => PointStringGeometry.create(params, viOrigin), instances);
  }
  public createPointCloud(args: PointCloudArgs): RenderGraphic | undefined { return Primitive.create(() => new PointCloudGeometry(args)); }

  public createGraphicList(primitives: RenderGraphic[]): RenderGraphic { return new GraphicsArray(primitives); }
  public createGraphicBranch(branch: GraphicBranch, transform: Transform, options?: GraphicBranchOptions): RenderGraphic {
    return new Branch(branch, transform, undefined, options);
  }

  public createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d, tileId?: string): RenderGraphic { return new Batch(graphic, features, range, tileId); }

  public createGraphicOwner(owned: RenderGraphic): RenderGraphicOwner {
    return new GraphicOwner(owned as Graphic);
  }

  public createGraphicLayer(graphic: RenderGraphic, layerId: string) {
    return new Layer(graphic as Graphic, layerId);
  }
  public createGraphicLayerContainer(graphic: RenderGraphic, drawAsOverlay: boolean, transparency: number) {
    return new LayerContainer(graphic as Graphic, drawAsOverlay, transparency);
  }

  public createSkyBox(params: SkyBox.CreateParams): RenderGraphic | undefined {
    if (undefined !== params.cube) {
      return SkyCubePrimitive.create(() => SkyBoxQuadsGeometry.create(params.cube!));
    } else {
      assert(undefined !== params.sphere || undefined !== params.gradient);
      return SkySpherePrimitive.create(() => SkySphereViewportQuadGeometry.createGeometry(params));
    }
  }

  public applyRenderState(newState: RenderState) {
    newState.apply(this.currentRenderState);
    this.currentRenderState.copyFrom(newState);
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
      case DepthType.TextureUnsignedInt24Stencil8: {
        if (this.capabilities.isWebGL2) {
          const context2 = this.context as WebGL2RenderingContext;
          return TextureHandle.createForAttachment(width, height, GL.Texture.Format.DepthStencil, context2.UNSIGNED_INT_24_8);
        } else {
          const dtExt: WEBGL_depth_texture | undefined = this.capabilities.queryExtensionObject<WEBGL_depth_texture>("WEBGL_depth_texture");
          return TextureHandle.createForAttachment(width, height, GL.Texture.Format.DepthStencil, dtExt!.UNSIGNED_INT_24_8_WEBGL);
        }
      }
      default: {
        assert(false);
        return undefined;
      }
    }
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

  /** Attempt to create a material for the given iModel using a set of material parameters. */
  public createMaterial(params: RenderMaterial.Params, imodel: IModelConnection): RenderMaterial | undefined {
    const idMap = this.getIdMap(imodel);
    const material = idMap.getMaterial(params);
    return material;
  }

  /** Using its key, search for an existing material of an open iModel. */
  public findMaterial(key: string, imodel: IModelConnection): RenderMaterial | undefined {
    const idMap = this.resourceCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findMaterial(key);
  }

  /** Attempt to create a texture for the given iModel using an ImageBuffer. */
  public createTextureFromImageBuffer(image: ImageBuffer, imodel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    return this.getIdMap(imodel).getTexture(image, params);
  }

  /** Attempt to create a texture for the given iModel using an HTML image element. */
  public createTextureFromImage(image: HTMLImageElement, hasAlpha: boolean, imodel: IModelConnection | undefined, params: RenderTexture.Params): RenderTexture | undefined {
    // if imodel is undefined, caller is responsible for disposing texture. It will not be associated with an IModelConnection
    if (undefined === imodel) {
      const textureHandle = TextureHandle.createForImage(image, hasAlpha, params.type);
      return undefined !== textureHandle ? new Texture(params, textureHandle) : undefined;
    }

    return this.getIdMap(imodel).getTextureFromImage(image, hasAlpha, params);
  }

  /** Attempt to create a texture from a cube of HTML images. */
  public createTextureFromCubeImages(posX: HTMLImageElement, negX: HTMLImageElement, posY: HTMLImageElement, negY: HTMLImageElement, posZ: HTMLImageElement, negZ: HTMLImageElement, imodel: IModelConnection, params: RenderTexture.Params): RenderTexture | undefined {
    return this.getIdMap(imodel).getTextureFromCubeImages(posX, negX, posY, negY, posZ, negZ, params);
  }

  /** Attempt to create a texture using gradient symbology. */
  public getGradientTexture(symb: Gradient.Symb, imodel: IModelConnection): RenderTexture | undefined {
    const idMap = this.getIdMap(imodel);
    const texture = idMap.getGradient(symb);
    return texture;
  }

  /** Using its key, search for an existing texture of an open iModel. */
  public findTexture(key: string, imodel: IModelConnection): RenderTexture | undefined {
    const idMap = this.resourceCache.get(imodel);
    if (!idMap)
      return undefined;
    return idMap.findTexture(key);
  }

  public createClipVolume(clipVector: ClipVector): RenderClipVolume | undefined {
    let clipVolume: RenderClipVolume | undefined = ClipMaskVolume.create(clipVector);
    if (undefined === clipVolume)
      clipVolume = ClipPlanesVolume.create(clipVector);

    return clipVolume;
  }
  public createBackgroundMapDrape(drapedTree: TileTreeReference, mapTree: BackgroundMapTileTreeReference) {
    return BackgroundMapDrape.create(drapedTree, mapTree);
  }

  private constructor(canvas: HTMLCanvasElement, context: WebGLRenderingContext | WebGL2RenderingContext, capabilities: Capabilities, options: RenderSystem.Options) {
    super(options);
    this.canvas = canvas;
    this.context = context;
    this.capabilities = capabilities;
    this.resourceCache = new Map<IModelConnection, IdMap>();
    this.glTimer = GLTimer.create(this);
    if (capabilities.isWebGL2)
      this._extensions = new WebGL2Extensions(this);
    else {
      const drawBuffersExtension = capabilities.queryExtensionObject<WEBGL_draw_buffers>("WEBGL_draw_buffers");
      const instancingExtension = capabilities.queryExtensionObject<ANGLE_instanced_arrays>("ANGLE_instanced_arrays");
      this._extensions = new WebGL1Extensions(this, drawBuffersExtension, instancingExtension);
    }

    // Make this System a subscriber to the the IModelConnection onClose event
    this._removeEventListener = IModelConnection.onClose.addListener((imodel) => this.removeIModelMap(imodel));

    canvas.addEventListener("webglcontextlost", () => this.handleContextLoss(), false);
  }

  private async handleContextLoss(): Promise<void> {
    const msg = IModelApp.i18n.translate("iModelJs:Errors.WebGLContextLost");
    return ToolAdmin.exceptionHandler(msg);
  }

  private getIdMap(imodel: IModelConnection): IdMap {
    const map = this.resourceCache.get(imodel);
    return undefined !== map ? map : this.createIModelMap(imodel);
  }

  public createSheetTilePolyfaces(corners: Point3d[], clip?: ClipVector): IndexedPolyface[] {
    const sheetTilePolys: IndexedPolyface[] = [];

    // Texture params for this sheet tile will always go from (0,0) to (1,1). However, we may be dealing with a tile that is a sub-division. Store the
    // lower-left corner to subtract from point values later to get UV params.
    const sheetTileRange = Range3d.createArray(corners);
    const sheetTileScale = 1 / (sheetTileRange.high.x - sheetTileRange.low.x);
    const sheetTileOrigin = sheetTileRange.low;

    let clippedPolygons: Point3d[][];
    if (clip !== undefined)
      clippedPolygons = ClipUtilities.clipPolygonToClipShape(corners, clip.clips[0]); // ###TODO: Currently assume that there is only one shape...
    else
      clippedPolygons = [corners];

    if (clippedPolygons.length === 0)
      return sheetTilePolys;    // return empty

    // The result of clipping will be several polygons, which may lie next to each other, or be detached, and can be of any length. Let's stitch these into a single polyface.
    const strokeOptions = new StrokeOptions();
    strokeOptions.needParams = true;
    strokeOptions.shouldTriangulate = true;
    const polyfaceBuilder = PolyfaceBuilder.create(strokeOptions);

    for (const polygon of clippedPolygons) {
      if (polygon.length < 3)
        continue;
      else if (polygon.length === 3) {
        const params: Point2d[] = [];
        for (const point of polygon) {
          const paramUnscaled = point.minus(sheetTileOrigin);
          params.push(Point2d.create(paramUnscaled.x * sheetTileScale, paramUnscaled.y * sheetTileScale));
        }
        polyfaceBuilder.addTriangleFacet(polygon, params);

      } else if (polygon.length === 4) {
        const params: Point2d[] = [];
        for (const point of polygon) {
          const paramUnscaled = point.minus(sheetTileOrigin);
          params.push(Point2d.create(paramUnscaled.x * sheetTileScale, paramUnscaled.y * sheetTileScale));
        }
        polyfaceBuilder.addQuadFacet(polygon, params);

      } else {
        // ### TODO: There are a lot of inefficiencies here (what if it is a simple convex polygon... we must adjust UV params ourselves afterwards, a PolyfaceVisitor....)
        // We are also assuming that when we use the polyface visitor, it will iterate over the points in order of the entire array
        const triangulatedPolygon = Triangulator.createTriangulatedGraphFromSingleLoop(polygon);
        Triangulator.flipTriangles(triangulatedPolygon);

        triangulatedPolygon.announceFaceLoops((_graph: HalfEdgeGraph, edge: HalfEdge): boolean => {
          if (!edge.isMaskSet(HalfEdgeMask.EXTERIOR)) {
            const trianglePoints: Point3d[] = [];
            const params: Point2d[] = [];

            edge.collectAroundFace((node: HalfEdge) => {
              const point = Point3d.create(node.x, node.y, 0.5);
              trianglePoints.push(point);
              const paramUnscaled = point.minus(sheetTileOrigin);
              params.push(Point2d.create(paramUnscaled.x * sheetTileScale, paramUnscaled.y * sheetTileScale));
            });

            assert(trianglePoints.length === 3);
            polyfaceBuilder.addTriangleFacet(trianglePoints, params);
          }
          return true;
        });
      }
    }

    sheetTilePolys.push(polyfaceBuilder.claimPolyface());
    return sheetTilePolys;
  }

  public createSheetTile(tile: RenderTexture, polyfaces: IndexedPolyface[], tileColor: ColorDef): GraphicList {
    const sheetTileGraphics: GraphicList = [];

    for (const polyface of polyfaces) {
      const rawParams = polyface.data.param;
      if (rawParams === undefined)
        return sheetTileGraphics;   // return empty

      const meshArgs = new MeshArgs();
      const pts = polyface.data.point.getPoint3dArray();

      meshArgs.points = new QPoint3dList(QParams3d.fromRange(Range3d.createArray(pts)));  // use these point params
      for (const point of pts)
        meshArgs.points.push(QPoint3d.create(point, meshArgs.points.params));

      const uvs: Point2d[] = rawParams.getPoint2dArray();

      const pointIndices: number[] = [];
      const uvIndices: number[] = [];
      const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
      while (visitor.moveToNextFacet()) {
        for (let i = 0; i < 3; i++) {
          pointIndices.push(visitor.clientPointIndex(i));
          uvIndices.push(visitor.clientParamIndex(i));
        }
      }

      // make uv arrangement and indices match that of points
      // this is necessary because MeshArgs assumes vertIndices refers to both points and UVs
      // output uvsOut to clippedTile
      let j = 0;
      const uvsOut: Point2d[] = [];
      for (const pointIdx of pointIndices)
        uvsOut[pointIdx] = uvs[uvIndices[j++]];   // passing the reference should not matter

      meshArgs.textureUv = uvsOut;
      meshArgs.vertIndices = pointIndices;
      meshArgs.texture = tile;
      meshArgs.material = undefined;
      meshArgs.isPlanar = true;
      meshArgs.colors.initUniform(tileColor);

      const mesh = this.createTriMesh(meshArgs);
      if (mesh !== undefined)
        sheetTileGraphics.push(mesh);
    }

    return sheetTileGraphics;
  }

  private bindTexture(unit: TextureUnit, target: GL.Texture.Target, texture: TextureBinding, makeActive: boolean): void {
    const index = unit - TextureUnit.Zero;
    if (this._textureBindings[index] === texture) {
      if (makeActive)
        this.context.activeTexture(unit);

      return;
    }

    this._textureBindings[index] = texture;
    this.context.activeTexture(unit);
    this.context.bindTexture(target, undefined !== texture ? texture : null);
  }

  /** Bind the specified texture to the specified unit. This may *or may not* make the texture *active* */
  public bindTexture2d(unit: TextureUnit, texture: TextureBinding) { this.bindTexture(unit, GL.Texture.Target.TwoDee, texture, false); }
  /** Bind the specified texture to the specified unit. This may *or may not* make the texture *active* */
  public bindTextureCubeMap(unit: TextureUnit, texture: TextureBinding) { this.bindTexture(unit, GL.Texture.Target.CubeMap, texture, false); }
  /** Bind the specified texture to the specified unit. This *always* makes the texture *active* */
  public activateTexture2d(unit: TextureUnit, texture: TextureBinding) { this.bindTexture(unit, GL.Texture.Target.TwoDee, texture, true); }
  /** Bind the specified texture to the specified unit. This *always* makes the texture *active* */
  public activateTextureCubeMap(unit: TextureUnit, texture: TextureBinding) { this.bindTexture(unit, GL.Texture.Target.CubeMap, texture, true); }

  // Ensure *something* is bound to suppress 'no texture assigned to unit x' warnings.
  public ensureSamplerBound(uniform: UniformHandle, unit: TextureUnit): void {
    this.lineCodeTexture!.bindSampler(uniform, unit);
  }

  public disposeTexture(texture: WebGLTexture) {
    System.instance.context.deleteTexture(texture);
    for (let i = 0; i < this._textureBindings.length; i++) {
      if (this._textureBindings[i] === texture) {
        this._textureBindings[i] = undefined;
        break;
      }
    }
  }

  // System keeps track of current enabled state of vertex attribute arrays.
  // This prevents errors caused by leaving a vertex attrib array enabled after disposing of the buffer bound to it;
  // also prevents unnecessarily 'updating' the enabled state of a vertex attrib array when it hasn't actually changed.
  public enableVertexAttribArray(id: number, instanced: boolean): void {
    assert(id < this._nextVertexAttribStates.length, "if you add new vertex attributes you must update array length");
    assert(id < this._curVertexAttribStates.length, "if you add new vertex attributes you must update array length");

    this._nextVertexAttribStates[id] = instanced ? VertexAttribState.InstancedEnabled : VertexAttribState.Enabled;
  }

  public updateVertexAttribArrays(): void {
    const cur = this._curVertexAttribStates;
    const next = this._nextVertexAttribStates;
    const context = this.context;

    for (let i = 0; i < next.length; i++) {
      const oldState = cur[i];
      const newState = next[i];
      if (oldState !== newState) {
        // Update the enabled state if it changed.
        const wasEnabled = 0 !== (VertexAttribState.Enabled & oldState);
        const nowEnabled = 0 !== (VertexAttribState.Enabled & newState);
        if (wasEnabled !== nowEnabled) {
          if (nowEnabled) {
            context.enableVertexAttribArray(i);
          } else {
            context.disableVertexAttribArray(i);
          }
        }

        // Only update the divisor if the attribute is enabled.
        if (nowEnabled) {
          const wasInstanced = 0 !== (VertexAttribState.Instanced & oldState);
          const nowInstanced = 0 !== (VertexAttribState.Instanced & newState);
          if (wasInstanced !== nowInstanced) {
            this.vertexAttribDivisor(i, nowInstanced ? 1 : 0);
          }
        }

        cur[i] = newState;
      }

      // Set the attribute back to disabled, but preserve the divisor.
      next[i] &= ~VertexAttribState.Enabled;
    }
  }

  public vertexAttribDivisor(index: number, divisor: number) { this._extensions.vertexAttribDivisor(index, divisor); }

  public drawArrays(type: GL.PrimitiveType, first: number, count: number, numInstances: number): void {
    if (0 !== numInstances) {
      this._extensions.drawArraysInst(type, first, count, numInstances);
    } else {
      this.context.drawArrays(type, first, count);
    }
  }

  public enableDiagnostics(enable: RenderDiagnostics): void {
    Debug.printEnabled = RenderDiagnostics.None !== (enable & RenderDiagnostics.DebugOutput);
    Debug.evaluateEnabled = RenderDiagnostics.None !== (enable & RenderDiagnostics.WebGL);
  }

  // RenderSystemDebugControl
  public get debugControl(): RenderSystemDebugControl { return this; }
  private _drawSurfacesAsWiremesh = false;
  public get drawSurfacesAsWiremesh() { return this._drawSurfacesAsWiremesh; }
  public set drawSurfacesAsWiremesh(asWiremesh: boolean) { this._drawSurfacesAsWiremesh = asWiremesh; }
  public loseContext(): boolean {
    const ext = this.capabilities.queryExtensionObject<WEBGL_lose_context>("WEBGL_lose_context");
    if (undefined === ext)
      return false;

    ext.loseContext();
    return true;
  }

  public compileAllShaders(): boolean {
    return this.techniques.compileShaders();
  }

  public get isGLTimerSupported(): boolean { return this.glTimer.isSupported; }
  public set resultsCallback(callback: GLTimerResultCallback | undefined) {
    this.glTimer.resultsCallback = callback;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._lineCodeTexture)
      stats.addTexture(this._lineCodeTexture.bytesUsed);

    if (undefined !== this._noiseTexture)
      stats.addTexture(this._noiseTexture.bytesUsed);

    for (const idMap of this.resourceCache.values())
      idMap.collectStatistics(stats);
  }
}
