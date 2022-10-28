/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
/* eslint-disable no-restricted-syntax */

/** Ordered list of render passes which produce a rendered frame.
 * [[RenderCommands]] organizes its [[DrawCommands]] into a list indexed by RenderPass.
 * @see [[Pass]] for the type from which the RenderPass for a [[Primitive]] is derived.
 * @internal
 */
export const enum RenderPass {
  None = 0xff,
  Background = 0,
  OpaqueLayers,       // XY planar models render without depth-testing in order based on priority
  OpaqueLinear,       // Linear geometry that is opaque and needs to be written to the pick data buffers
  OpaquePlanar,       // Planar surface geometry that is opaque and needs to be written to the pick data buffers
  OpaqueGeneral,      // All other opaque geometry (including point clouds and reality meshes) which are not written to the pick data buffers
  Classification,     // Stencil volumes for normal processing of reality data classification.
  TranslucentLayers,  // like Layers but drawn without depth write, blending with opaque
  Translucent,
  HiddenEdge,
  Hilite,
  OverlayLayers,      // Like Layers, but drawn atop all other geometry
  WorldOverlay,       // Decorations
  ViewOverlay,        // Decorations
  SkyBox,
  BackgroundMap,
  HiliteClassification,  // Secondary hilite pass for stencil volumes to process hilited classifiers for reality data
  ClassificationByIndex, // Stencil volumes for processing classification one classifier at a time (used for generating pick data Ids and flashing a single classifier).
  HilitePlanarClassification,
  PlanarClassification,
  VolumeClassifiedRealityData,
  COUNT,
}

/** Describes the [[RenderPass]]es in which a [[Primitive]] wants to be rendered.
 * Generally, each Pass corresponds to a single RenderPass. However a couple of passes specify that the primitive should be rendered
 * twice, in two different render passes.
 * [[RenderCommands.addPrimitive]] may ignore the requested Pass. For example, edges typically draw in RenderPass.OpaqueLinear, but
 * may also draw in RenderPass.HiddenEdge; and translucent geometry may sometimes be rendered in an opaque render pass instead.
 * @see [[CachedGeometry.getPass]].
 * @internal
 */
export type Pass =
  "skybox" | // SkyBox
  "opaque" | // OpaqueGeneral
  "opaque-linear" | // OpaqueLinear
  "opaque-planar" | // OpaquePlanar
  "translucent" | // Translucent
  "view-overlay" | // ViewOverlay
  "classification" | // Classification
  "none" | // None
  // The following apply to textured meshes when the texture image contains a mix of opaque and transparent pixels.
  // The mesh requests to be rendered in both opaque and transparent passes, with each pass discarding pixels that don't match that pass.
  // (i.e., discard transparent pixels during opaque pass and vice-versa).
  "opaque-translucent" | // OpaqueGeneral and Translucent
  "opaque-planar-translucent"; // OpaquePlanar and Translucent

/** [[Pass]]es that map to two [[RenderPass]]es.
 * @internal
 */
export type DoublePass = "opaque-translucent" | "opaque-planar-translucent";

/** [[Pass]]es that map to a single [[RenderPass]].
 * @internal */
export type SinglePass = Exclude<Pass, DoublePass>;

/** Describes the type of geometry rendered by a ShaderProgram.
 * @internal
 */
export const enum GeometryType {
  IndexedTriangles,
  IndexedPoints,
  ArrayedPoints,
}

/** @internal */
export namespace Pass { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Return the RenderPass corresponding to the specified Pass. */
  export function toRenderPass(pass: SinglePass): RenderPass {
    switch (pass) {
      case "skybox": return RenderPass.SkyBox;
      case "opaque": return RenderPass.OpaqueGeneral;
      case "opaque-linear": return RenderPass.OpaqueLinear;
      case "opaque-planar": return RenderPass.OpaquePlanar;
      case "translucent": return RenderPass.Translucent;
      case "view-overlay": return RenderPass.ViewOverlay;
      case "classification": return RenderPass.Classification;
      case "none": return RenderPass.None;
    }
  }

  /** Return true if the specified Pass renders during RenderPass.Translucent.
   * @note It is possible for both [[rendersTranslucent]] and [[rendersOpaque]] to return true (or false) for a given Pass.
   */
  export function rendersTranslucent(pass: Pass): boolean {
    switch (pass) {
      case "translucent":
      case "opaque-translucent":
      case "opaque-planar-translucent":
        return true;
      default:
        return false;
    }
  }

  /** Return true if the specified Pass renders during one of the opaque RenderPasses.
   * @note It is possible for both [[rendersTranslucent]] and [[rendersOpaque]] to return true for a given Pass.
   */
  export function rendersOpaque(pass: Pass): boolean {
    switch (pass) {
      case "opaque-translucent":
      case "opaque-planar-translucent":
      case "opaque":
      case "opaque-planar":
      case "opaque-linear":
        return true;
      default:
        return false;
    }
  }

  /** Return true if the specified Pass renders both during RenderPass.Translucent and one of the opaque RenderPasses. */
  export function rendersOpaqueAndTranslucent(pass: Pass): pass is DoublePass {
    return "opaque-translucent" === pass || "opaque-planar-translucent" === pass;
  }

  export function toOpaquePass(pass: DoublePass): RenderPass {
    return "opaque-translucent" === pass ? RenderPass.OpaqueGeneral : RenderPass.OpaquePlanar;
  }
}

/** Reserved texture units for specific sampler variables, to avoid conflicts between shader components which each have their own textures.
 * WebGL 1 guarantees a minimum of 8 vertex texture units, and iOS provides no more than that.
 * WebGL 2 guarantees a minimum of 15 vertex texture units.
 * @internal
 */
export enum TextureUnit {
  // For shaders which know exactly which textures will be used
  Zero = WebGLRenderingContext.TEXTURE0,
  One = WebGLRenderingContext.TEXTURE1,
  Two = WebGLRenderingContext.TEXTURE2,
  Three = WebGLRenderingContext.TEXTURE3,
  Four = WebGLRenderingContext.TEXTURE4,
  Five = WebGLRenderingContext.TEXTURE5,
  Six = WebGLRenderingContext.TEXTURE6,
  Seven = WebGLRenderingContext.TEXTURE7, // Last one guaranteed available for WebGL 1

  ClipVolume = Zero,
  FeatureSymbology = One,
  SurfaceTexture = Two,
  LineCode = Two,

  PickFeatureId = Three,
  PickDepthAndOrder = Four,

  VertexLUT = Five,

  // Texture unit 6 is overloaded. Therefore classification, hilite classification, and aux channel are all mutually exclusive.
  AuxChannelLUT = Six,
  PlanarClassification = Six,
  PlanarClassificationHilite = Six,

  // Texture unit 7 is overloaded. Therefore receiving shadows and thematic display are mutually exclusive.
  ShadowMap = Seven,
  ThematicSensors = Seven,

  // Textures used for up to 3 background or overlay map layers.
  RealityMesh0 = Two,
  RealityMesh1 = VertexLUT, // Reality meshes do not use VertexLUT.
  RealityMesh2 = ShadowMap, //  Shadow map when picking -- PickDepthAndOrder otherwise....

  // If more than 8 texture units are available, 3 additional background or overlay map layers.
  RealityMesh3 = WebGLRenderingContext.TEXTURE8,
  RealityMesh4 = WebGLRenderingContext.TEXTURE9,
  RealityMesh5 = WebGLRenderingContext.TEXTURE10,

  RealityMeshThematicGradient = WebGLRenderingContext.TEXTURE11,

  // Lookup table for indexed edges - used only if WebGL 2 is available.
  EdgeLUT = WebGLRenderingContext.TEXTURE12,
}

/**
 * Defines the order in which primitives are rendered within a GLESList. This is chiefly
 * used to sort primitives which originate from the same element. e.g., the blanking fill
 * associated with a text field must always render behind the text; the edges of a surface
 * must render in front of the surface; etc.
 * An exception to the 'same element' rule is provided for planar surfaces and edges thereof
 * sketched onto non-planar surfaces. When the depth test is ambiguous the planar geometry
 * is always on top of the non-planar surface. This addresses z-fighting when shapes are
 * sketched onto surfaces, e.g. as part of push-pull modeling workflows.
 * @internal
 */
export const enum RenderOrder {
  None = 0,
  Background = 1, // i.e., background map drawn without depth
  BlankingRegion = 2,
  UnlitSurface = 3, // Distinction only made for whether or not to apply ambient occlusion.
  LitSurface = 4,
  Linear = 5,
  Edge = 6,
  Silhouette = 7,

  PlanarBit = 8,

  PlanarUnlitSurface = UnlitSurface | PlanarBit,
  PlanarLitSurface = LitSurface | PlanarBit,
  PlanarLinear = Linear | PlanarBit,
  PlanarEdge = Edge | PlanarBit,
  PlanarSilhouette = Silhouette | PlanarBit,
}

/** @internal */
export function isPlanar(order: RenderOrder): boolean {
  return order >= RenderOrder.PlanarBit;
}

/** Flags indicating operations to be performed by the post-process composite step.
 * @internal
 */
export const enum CompositeFlags {
  None = 0,
  Translucent = 1 << 0,
  Hilite = 1 << 1,
  AmbientOcclusion = 1 << 2,
}

/** Location in boolean array of SurfaceFlags above.
 * @internal
 */
export const enum SurfaceBitIndex {
  HasTexture,
  ApplyLighting,
  HasNormals,
  IgnoreMaterial,
  TransparencyThreshold,
  BackgroundFill,
  HasColorAndNormal,
  OverrideRgb,
  HasNormalMap,
  HasMaterialAtlas,
  Count,
}

/** Describes attributes of a MeshGeometry object. Used to conditionally execute portion of shader programs.
 * @internal
 */
export const enum SurfaceFlags {
  None = 0,
  HasTexture = 1 << SurfaceBitIndex.HasTexture,
  ApplyLighting = 1 << SurfaceBitIndex.ApplyLighting,
  HasNormals = 1 << SurfaceBitIndex.HasNormals,

  // NB: In u_surfaceFlags provided to shader, indicates material color/specular/alpha should be ignored. Has no effect on texture.
  // If a given feature has the 'ignore material' override set, v_surfaceFlags will be modified to turn on IgnoreMaterial and turn off HasTexture.
  IgnoreMaterial = 1 << SurfaceBitIndex.IgnoreMaterial,

  // In HiddenLine and SolidFill modes, a transparency threshold is supplied; surfaces that are more transparent than the threshold are not rendered.
  TransparencyThreshold = 1 << SurfaceBitIndex.TransparencyThreshold,

  // For HiddenLine mode
  BackgroundFill = 1 << SurfaceBitIndex.BackgroundFill,

  // For textured meshes, the color index in the vertex LUT is unused - we place the normal there instead.
  // For untextured lit meshes, the normal is placed after the feature ID.
  HasColorAndNormal = 1 << SurfaceBitIndex.HasColorAndNormal,
  // For textured meshes, use rgb from v_color instead of from texture.
  OverrideRgb = 1 << SurfaceBitIndex.OverrideRgb,
  // For geometry with fixed normals (terrain meshes) we must avoid front facing normal reversal or skirts will be incorrectly lit.
  HasNormalMap = 1 << SurfaceBitIndex.HasNormalMap,
  HasMaterialAtlas = 1 << SurfaceBitIndex.HasMaterialAtlas,
}

/** 16-bit flags indicating what aspects of a feature's symbology are overridden.
 * @internal
 */
export const enum OvrFlags {
  None = 0,
  Visibility = 1 << 0,
  Rgb = 1 << 1,
  Alpha = 1 << 2,
  IgnoreMaterial = 1 << 3, // ignore material color, specular properties, and texture.
  Flashed = 1 << 4,
  NonLocatable = 1 << 5, // do not draw during pick - allows geometry beneath to be picked.
  LineCode = 1 << 6,
  Weight = 1 << 7,
  Hilited = 1 << 8,
  Emphasized = 1 << 9, // rendered with "emphasis" hilite settings (silhouette etc).
  ViewIndependentTransparency = 1 << 10,

  Rgba = Rgb | Alpha,
}

/** 8-bit flags indicating emphasis effects applied to a feature.
 * @internal
 */
export const enum EmphasisFlags {
  None = 0,
  Hilite = 1,
  Emphasized = 2,
  Flashed = 4,
  NonLocatable = 8,
}

/** @internal */
export const enum IsTranslucent { No, Yes, Maybe }
