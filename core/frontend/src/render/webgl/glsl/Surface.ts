/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  ProgramBuilder,
  VariableType,
  FragmentShaderComponent,
  VertexShaderComponent,
  ShaderBuilder,
  ShaderBuilderFlags,
} from "../ShaderBuilder";
import { IsInstanced, IsAnimated, IsClassified, FeatureMode, IsShadowable, HasMaterialAtlas, TechniqueFlags } from "../TechniqueFlags";
import { assignFragColor, addFragColorWithPreMultipliedAlpha, addWhiteOnWhiteReversal, addPickBufferOutputs, addAltPickBufferOutputs } from "./Fragment";
import { addFeatureAndMaterialLookup, addProjectionMatrix, addModelViewMatrix, addNormalMatrix } from "./Vertex";
import { addAnimation } from "./Animation";
import { addUnpackAndNormalize2Bytes, unquantize2d, decodeDepthRgb } from "./Decode";
import { addColor } from "./Color";
import { addLighting } from "./Lighting";
import { addMaxAlpha, addSurfaceDiscard, FeatureSymbologyOptions, addFeatureSymbology, addSurfaceHiliter } from "./FeatureSymbology";
import { addShaderFlags, extractNthBit } from "./Common";
import { SurfaceFlags, TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { Material } from "../Material";
import { System } from "../System";
import { assert } from "@bentley/bentleyjs-core";
import { addOverrideClassifierColor, addColorPlanarClassifier, addHilitePlanarClassifier, addFeaturePlanarClassifier } from "./PlanarClassification";
import { addSolarShadowMap } from "./SolarShadowMapping";
import { AttributeMap } from "../AttributeMap";
import { TechniqueId } from "../TechniqueId";
import { unpackFloat } from "./Clipping";
import { addRenderPass } from "./RenderPass";
import { addTranslucency } from "./Translucency";
import { addMonochrome } from "./Monochrome";

// NB: Textures do not contain pre-multiplied alpha.
const sampleSurfaceTexture = `
  vec4 sampleSurfaceTexture() {
    return TEXTURE(s_texture, v_texCoord);
  }
`;

const applyMaterialColor = `
  float useMatColor = float(use_material);
  vec3 rgb = mix(baseColor.rgb, mat_rgb.rgb, useMatColor * mat_rgb.a);
  float a = mix(baseColor.a, mat_alpha.x, useMatColor * mat_alpha.y);
  return vec4(rgb, a);
`;

// if this is a raster glyph, the sampled color has already been modified - do not modify further.
// Mix diffuse color with texel based on texture weight.
// Replace with diffuse RGB if RGB overridden.
// Replace with diffuse alpha if alpha overridden.
// Multiply texel alpha with diffuse alpha if specified.
const applyTextureWeight = `
  float textureWeight = mat_texture_weight * extractSurfaceBit(kSurfaceBit_HasTexture) * (1.0 - u_applyGlyphTex);
  vec4 rgba = mix(baseColor, g_surfaceTexel, textureWeight);
  rgba.rgb = mix(rgba.rgb, v_color.rgb, extractSurfaceBit(kSurfaceBit_OverrideRgb));
  rgba.a = mix(rgba.a, v_color.a, extractSurfaceBit(kSurfaceBit_OverrideAlpha));
  rgba.a = mix(rgba.a, v_color.a * rgba.a, extractSurfaceBit(kSurfaceBit_MultiplyAlpha));
  return rgba;
`;

const decodeFragMaterialParams = `
void decodeMaterialParams(vec4 params) {
  mat_weights = unpackAndNormalize2Bytes(params.x);

  vec2 texAndSpecR = unpackAndNormalize2Bytes(params.y);
  mat_texture_weight = texAndSpecR.x;

  vec2 specGB = unpackAndNormalize2Bytes(params.z);
  mat_specular = vec4(texAndSpecR.y, specGB, params.w);
}`;

const decodeMaterialColor = `
void decodeMaterialColor(vec4 rgba) {
  mat_rgb = vec4(rgba.rgb, float(rgba.r >= 0.0));
  mat_alpha = vec2(rgba.a, float(rgba.a >= 0.0));
}`;

// defaults: (0x6699, 0xffff, 0xffff, 13.5)
const computeMaterialParams = `
  const vec4 defaults = vec4(26265.0, 65535.0, 65535.0, 13.5);
  return use_material ? getMaterialParams() : defaults;
`;
const getUniformMaterialParams = `vec4 getMaterialParams() { return u_materialParams; }`;

// The 8-bit material index is stored with the 24-bit feature index, in the high byte.
const readMaterialAtlas = `
void readMaterialAtlas() {
  float materialAtlasStart = u_vertParams.z * u_vertParams.w + u_numColors;
  float materialIndex = g_featureAndMaterialIndex.w * 4.0 + materialAtlasStart;

  vec2 tc = computeLUTCoords(materialIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 rgba = TEXTURE(u_vertLUT, tc);

  tc = computeLUTCoords(materialIndex + 1.0, u_vertParams.xy, g_vert_center, 1.0);
  vec4 weightsAndFlags = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);

  tc = computeLUTCoords(materialIndex + 2.0, u_vertParams.xy, g_vert_center, 1.0);
  vec3 specularRgb = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5).rgb;

  tc = computeLUTCoords(materialIndex + 3.0, u_vertParams.xy, g_vert_center, 1.0);
  vec4 packedSpecularExponent = TEXTURE(u_vertLUT, tc);

  float flags = weightsAndFlags.w;
  mat_rgb = vec4(rgba.rgb, float(flags == 1.0 || flags == 3.0));
  mat_alpha = vec2(rgba.a, float(flags == 2.0 || flags == 3.0));

  float specularExponent = unpackFloat(packedSpecularExponent);
  g_materialParams.x = weightsAndFlags.y + weightsAndFlags.z * 256.0;
  g_materialParams.y = 255.0 + specularRgb.r * 256.0;
  g_materialParams.z = specularRgb.g + specularRgb.b * 256.0;
  g_materialParams.w = specularExponent;
}`;
const getAtlasMaterialParams = `vec4 getMaterialParams() { return g_materialParams; }`;

function addMaterial(builder: ProgramBuilder, hasMaterialAtlas: HasMaterialAtlas): void {
  const frag = builder.frag;
  assert(undefined !== frag.find("v_surfaceFlags"));

  frag.addGlobal("mat_texture_weight", VariableType.Float);
  frag.addGlobal("mat_weights", VariableType.Vec2); // diffuse, specular
  frag.addGlobal("mat_specular", VariableType.Vec4); // rgb, exponent

  addUnpackAndNormalize2Bytes(frag);
  frag.addFunction(decodeFragMaterialParams);
  frag.addInitializer("decodeMaterialParams(v_materialParams);");

  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyTextureWeight);

  const vert = builder.vert;
  vert.addGlobal("mat_rgb", VariableType.Vec4); // a = 0 if not overridden, else 1
  vert.addGlobal("mat_alpha", VariableType.Vec2); // a = 0 if not overridden, else 1
  vert.addGlobal("use_material", VariableType.Boolean);
  vert.addInitializer("use_material = 0.0 == extractNthBit(floor(u_surfaceFlags + 0.5), kSurfaceBit_IgnoreMaterial);");

  if (vert.usesInstancedGeometry) {
    // ###TODO: Remove combination of technique flags - instances never use material atlases.
    hasMaterialAtlas = HasMaterialAtlas.No;
  } else {
    addFeatureAndMaterialLookup(vert);
  }

  if (!hasMaterialAtlas) {
    vert.addUniform("u_materialColor", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_materialColor", (uniform, params) => {
        const info = params.target.currentViewFlags.materials ? params.geometry.materialInfo : undefined;
        const mat = undefined !== info && !info.isAtlas ? info : Material.default;
        uniform.setUniform4fv(mat.rgba);
      });
    });

    vert.addUniform("u_materialParams", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_materialParams", (uniform, params) => {
        const info = params.target.currentViewFlags.materials ? params.geometry.materialInfo : undefined;
        const mat = undefined !== info && !info.isAtlas ? info : Material.default;
        uniform.setUniform4fv(mat.fragUniforms);
      });
    });

    vert.addFunction(decodeMaterialColor);
    vert.set(VertexShaderComponent.ComputeMaterial, "decodeMaterialColor(u_materialColor);");
    vert.addFunction(getUniformMaterialParams);
  } else {
    vert.addUniform("u_numColors", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_numColors", (uniform, params) => {
        const info = params.geometry.materialInfo;
        const numColors = undefined !== info && info.isAtlas ? info.vertexTableOffset : 0;
        uniform.setUniform1f(numColors);
      });
    });

    vert.addGlobal("g_materialParams", VariableType.Vec4);
    vert.addFunction(unpackFloat);
    vert.addFunction(readMaterialAtlas);
    vert.set(VertexShaderComponent.ComputeMaterial, "readMaterialAtlas();");
    vert.addFunction(getAtlasMaterialParams);
  }

  vert.set(VertexShaderComponent.ApplyMaterialColor, applyMaterialColor);
  builder.addFunctionComputedVarying("v_materialParams", VariableType.Vec4, "computeMaterialParams", computeMaterialParams);
}

const computePosition = `
  vec4 pos = MAT_MV * rawPos;
  v_eyeSpace = pos.xyz;
  return u_proj * pos;
`;

function createCommon(instanced: IsInstanced, animated: IsAnimated, shadowable: IsShadowable): ProgramBuilder {
  const attrMap = AttributeMap.findAttributeMap(TechniqueId.Surface, IsInstanced.Yes === instanced);
  const builder = new ProgramBuilder(attrMap, instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  if (animated)
    addAnimation(vert, true);

  if (shadowable)
    addSolarShadowMap(builder);

  addProjectionMatrix(vert);
  addModelViewMatrix(vert);
  builder.addVarying("v_eyeSpace", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);

  return builder;
}

/** @internal */
export function createSurfaceHiliter(instanced: IsInstanced, classified: IsClassified): ProgramBuilder {
  const builder = createCommon(instanced, IsAnimated.No, IsShadowable.No);

  addSurfaceFlags(builder, true, false);
  addTexture(builder, IsAnimated.No);
  if (classified) {
    addHilitePlanarClassifier(builder);
    builder.vert.addGlobal("feature_ignore_material", VariableType.Boolean, "false");
    builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  } else {
    addSurfaceHiliter(builder);
  }

  return builder;
}

// nvidia hardware incorrectly interpolates varying floats when we send the same exact value for every vertex...
const extractSurfaceBit = `
float extractSurfaceBit(float flag) { return extractNthBit(floor(v_surfaceFlags + 0.5), flag); }
`;

const isSurfaceBitSet = `
bool isSurfaceBitSet(float flag) { return 0.0 != extractSurfaceBit(flag); }
`;

/** @internal */
export function addSurfaceFlagsLookup(builder: ShaderBuilder) {
  builder.addConstant("kSurfaceBit_HasTexture", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceBit_ApplyLighting", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceBit_HasNormals", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceBit_IgnoreMaterial", VariableType.Float, "3.0");
  builder.addConstant("kSurfaceBit_TransparencyThreshold", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceBit_BackgroundFill", VariableType.Float, "5.0");
  builder.addConstant("kSurfaceBit_HasColorAndNormal", VariableType.Float, "6.0");
  builder.addConstant("kSurfaceBit_OverrideAlpha", VariableType.Float, "7.0");
  builder.addConstant("kSurfaceBit_OverrideRgb", VariableType.Float, "8.0");
  builder.addConstant("kSurfaceBit_NoFaceFront", VariableType.Float, "9.0");
  builder.addConstant("kSurfaceBit_MultiplyAlpha", VariableType.Float, "10.0");
  // MultiplyAlpha must be highest value - insert additional above it, not here.

  builder.addConstant("kSurfaceMask_None", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceMask_HasTexture", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceMask_ApplyLighting", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceMask_HasNormals", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceMask_IgnoreMaterial", VariableType.Float, "8.0");
  builder.addConstant("kSurfaceMask_TransparencyThreshold", VariableType.Float, "16.0");
  builder.addConstant("kSurfaceMask_BackgroundFill", VariableType.Float, "32.0");
  builder.addConstant("kSurfaceMask_HasColorAndNormal", VariableType.Float, "64.0");
  builder.addConstant("kSurfaceMask_OverrideAlpha", VariableType.Float, "128.0");
  builder.addConstant("kSurfaceMask_OverrideRgb", VariableType.Float, "256.0");
  builder.addConstant("kSurfaceMask_NoFaceFront", VariableType.Float, "512.0");
  builder.addConstant("kSurfaceMask_MultiplyAlpha", VariableType.Float, "1024.0");
  // MultiplyAlpha must be highest value - insert additional above it, not here.

  builder.addFunction(extractNthBit);
  builder.addFunction(extractSurfaceBit);
  builder.addFunction(isSurfaceBitSet);
}

const getSurfaceFlags = "return u_surfaceFlags;";

const computeBaseSurfaceFlags = `
  float flags = u_surfaceFlags;
  bool hasTexture = 0.0 != fract(flags / 2.0); // kSurfaceMask_HasTexture = 1.0...
  if (feature_ignore_material) {
    if (hasTexture) {
      hasTexture = false;
      flags -= kSurfaceMask_HasTexture;
      if (flags >= kSurfaceMask_MultiplyAlpha) // NB: This only works if MultiplyAlpha is the largest flag!!!
        flags -= kSurfaceMask_MultiplyAlpha;
    }

    flags += kSurfaceMask_IgnoreMaterial;
  }
`;

// Textured surfaces (including raster glyphs) always *multiply* the sampled alpha by the alpha override.
const computeColorSurfaceFlags = `
  if (feature_rgb.r >= 0.0)
    flags += kSurfaceMask_OverrideRgb;

  if (feature_alpha >= 0.0) {
    if (!hasTexture) {
      flags += kSurfaceMask_OverrideAlpha;
      if (flags >= kSurfaceMask_MultiplyAlpha) // NB: This only works if MultiplyAlpha is the largest flag!!!
        flags -= kSurfaceMask_MultiplyAlpha;
    } else if (flags < kSurfaceMask_MultiplyAlpha) {
      flags += kSurfaceMask_MultiplyAlpha;
    }
  }
`;

const returnSurfaceFlags = `
  return flags;
`;

const computeSurfaceFlags = computeBaseSurfaceFlags + returnSurfaceFlags;
const computeSurfaceFlagsWithColor = computeBaseSurfaceFlags + computeColorSurfaceFlags + returnSurfaceFlags;

/** @internal */
export const octDecodeNormal = `
vec3 octDecodeNormal(vec2 e) {
  e = e / 255.0 * 2.0 - 1.0;
  vec3 n = vec3(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
  if (n.z < 0.0) {
    vec2 signNotZero = vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    n.xy = (1.0 - abs(n.yx)) * signNotZero;
  }

  return normalize(n);
}
`;

const computeNormal = `
  vec2 tc = g_vertexBaseCoords;
  tc.x += 3.0 * g_vert_stepX;
  vec4 enc = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec2 normal = mix(g_vertexData2, enc.xy, extractSurfaceBit(kSurfaceBit_HasColorAndNormal));
  return mix(vec3(0.0), normalize(MAT_NORM * octDecodeNormal(normal)), extractSurfaceBit(kSurfaceBit_HasNormals));
`;

const computeAnimatedNormal = `
  if (u_animNormalParams.x >= 0.0)
    return normalize(MAT_NORM * computeAnimationNormal(u_animNormalParams.x, u_animNormalParams.y, u_animNormalParams.z));
` + computeNormal;

const applyBackgroundColor = `
  return mix(baseColor, vec4(u_bgColor.rgb, 1.0), extractSurfaceBit(kSurfaceBit_BackgroundFill));
`;

const computeTexCoord = `
  vec2 tc = g_vertexBaseCoords;
  tc.x += 3.0 * g_vert_stepX;  vec4 rgba = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec2 qcoords = vec2(decodeUInt16(rgba.xy), decodeUInt16(rgba.zw));
  return mix(vec2(0.0), unquantize2d(qcoords, u_qTexCoordParams), extractSurfaceBit(kSurfaceBit_HasTexture));
`;
const computeAnimatedTexCoord = `
  if (u_animScalarQParams.x >= 0.0)
    return computeAnimationParam(u_animScalarParams.x, u_animScalarParams.y, u_animScalarParams.z, u_animScalarQParams.x, u_animScalarQParams.y);
` + computeTexCoord;
const getSurfaceColor = `
vec4 getSurfaceColor() { return v_color; }
`;

// If we have texture weight < 1.0 we must compute the element/material color first then mix with texture color
// in ApplyMaterialOverrides(). Do the sample once, here, and store in a global variable for possible later use.
// If a glyph texture, must mix getSurfaceColor() with texture color so texture color alpha is applied 100% and
// surface color rgb is scaled by texture color rgb (latter is full white originally but stretched via mipmapping).
const computeBaseColor = `
  g_surfaceTexel = sampleSurfaceTexture();
  vec4 surfaceColor = getSurfaceColor();

  // Compute color for raster glyph.
  vec4 glyphColor = surfaceColor;
  const vec3 white = vec3(1.0);
  const vec3 epsilon = vec3(0.0001);
  vec3 color = glyphColor.rgb;
  vec3 delta = (color + epsilon) - white;

  // set to black if almost white
  glyphColor.rgb *= float(u_reverseWhiteOnWhite <= 0.5 || delta.x <= 0.0 || delta.y <= 0.0 || delta.z <= 0.0);
  glyphColor = vec4(glyphColor.rgb * g_surfaceTexel.rgb, g_surfaceTexel.a);

  // Choose glyph color or unmodified texture sample
  vec4 texColor = mix(g_surfaceTexel, glyphColor, u_applyGlyphTex);

  // If untextured, or textureWeight < 1.0, choose surface color.
  return mix(surfaceColor, texColor, extractSurfaceBit(kSurfaceBit_HasTexture) * floor(mat_texture_weight));
`;

/** @internal */
export function addSurfaceFlags(builder: ProgramBuilder, withFeatureOverrides: boolean, withFeatureColor: boolean) {
  const compute = withFeatureOverrides ? (withFeatureColor ? computeSurfaceFlagsWithColor : computeSurfaceFlags) : getSurfaceFlags;
  builder.addFunctionComputedVarying("v_surfaceFlags", VariableType.Float, "computeSurfaceFlags", compute);

  addSurfaceFlagsLookup(builder.vert);
  addSurfaceFlagsLookup(builder.frag);

  builder.addUniform("u_surfaceFlags", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_surfaceFlags", (uniform, params) => {
      assert(undefined !== params.geometry.asSurface);
      const mesh = params.geometry.asSurface!;
      const surfFlags = mesh.computeSurfaceFlags(params.programParams);
      uniform.setUniform1f(surfFlags);
    });
  });
}

function addNormal(builder: ProgramBuilder, animated: IsAnimated) {
  addNormalMatrix(builder.vert);

  builder.vert.addFunction(octDecodeNormal);
  builder.addFunctionComputedVarying("v_n", VariableType.Vec3, "computeLightingNormal", animated ? computeAnimatedNormal : computeNormal);
}

function addTexture(builder: ProgramBuilder, animated: IsAnimated) {
  builder.vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", animated ? computeAnimatedTexCoord : computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const surfGeom = params.geometry.asSurface!;
      const surfFlags: SurfaceFlags = surfGeom.computeSurfaceFlags(params.programParams);
      if (SurfaceFlags.None !== (SurfaceFlags.HasTexture & surfFlags)) {
        const uvQParams = surfGeom.lut.uvQParams;
        if (undefined !== uvQParams) {
          uniform.setUniform4fv(uvQParams);
        }
      }
    });
  });

  builder.frag.addFunction(sampleSurfaceTexture);
  builder.frag.addUniform("s_texture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_texture", (uniform, params) => {
      const surfGeom = params.geometry.asSurface!;
      const surfFlags = surfGeom.computeSurfaceFlags(params.programParams);
      if (SurfaceFlags.None !== (SurfaceFlags.HasTexture & surfFlags)) {
        const texture = (params.geometry.hasAnimation && params.target.analysisTexture) ? (params.target.analysisTexture as Texture) : surfGeom.texture;
        assert(undefined !== texture);
        texture!.texture.bindSampler(uniform, TextureUnit.SurfaceTexture);
      } else {
        System.instance.ensureSamplerBound(uniform, TextureUnit.SurfaceTexture);
      }
    });
  });
}

const discardClassifiedByAlpha = `
  if (u_no_classifier_discard)
    return false;

  bool hasAlpha = alpha <= s_maxAlpha;
  bool isOpaquePass = (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  bool isTranslucentPass = kRenderPass_Translucent == u_renderPass;
  return (isOpaquePass && hasAlpha) || (isTranslucentPass && !hasAlpha);
`;

// Target.readPixels() renders everything in opaque pass. It turns off textures for normal surfaces but keeps them for things like 3d view attachment tiles.
// We want to discard fully-transparent pixels of those things during readPixels() so that we don't locate the attachment unless the cursor is over a
// non-transparent pixel of it.
const discardTransparentTexel = `return isSurfaceBitSet(kSurfaceBit_HasTexture) && alpha < (1.0 / 255.0);`;

/** @internal */
export function createSurfaceBuilder(flags: TechniqueFlags): ProgramBuilder {
  const builder = createCommon(flags.isInstanced, flags.isAnimated, flags.isShadowable);
  addShaderFlags(builder);

  const feat = flags.featureMode;
  let opts = FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None;
  if (flags.isClassified) {
    opts &= ~FeatureSymbologyOptions.Alpha;
    addColorPlanarClassifier(builder, flags.isTranslucent);
  }

  addFeatureSymbology(builder, feat, opts);
  addSurfaceFlags(builder, FeatureMode.Overrides === feat, true);
  addSurfaceDiscard(builder, flags);
  addNormal(builder, flags.isAnimated);

  // In HiddenLine mode, we must compute the base color (plus feature overrides etc) in order to get the alpha, then replace with background color (preserving alpha for the transparency threshold test).
  builder.frag.set(FragmentShaderComponent.FinalizeBaseColor, applyBackgroundColor);
  builder.frag.addUniform("u_bgColor", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      params.target.uniforms.style.bindBackgroundRgb(uniform);
    });
  });

  addTexture(builder, flags.isAnimated);

  builder.frag.addUniform("u_applyGlyphTex", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_applyGlyphTex", (uniform, params) => {
      const surfGeom = params.geometry.asSurface!;
      const surfFlags: SurfaceFlags = surfGeom.computeSurfaceFlags(params.programParams);
      let isGlyph = false;
      if (SurfaceFlags.None !== (SurfaceFlags.HasTexture & surfFlags))
        isGlyph = surfGeom.isGlyph;

      uniform.setUniform1f(isGlyph ? 1 : 0);
    });
  });

  // Fragment and Vertex
  addColor(builder);

  // Fragment
  builder.frag.addFunction(getSurfaceColor);
  addLighting(builder);
  addWhiteOnWhiteReversal(builder.frag);

  if (flags.isTranslucent) {
    addTranslucency(builder);
  } else {
    if (FeatureMode.None === feat) {
      addFragColorWithPreMultipliedAlpha(builder.frag);
    } else {
      builder.frag.set(FragmentShaderComponent.DiscardByAlpha, discardTransparentTexel);
      if (!flags.isClassified)
        addOverrideClassifierColor(builder);
      else
        addFeaturePlanarClassifier(builder);

      builder.frag.addFunction(decodeDepthRgb);
      if (flags.isEdgeTestNeeded || flags.isClassified)
        addPickBufferOutputs(builder.frag);
      else
        addAltPickBufferOutputs(builder.frag);
    }
  }

  builder.frag.addGlobal("g_surfaceTexel", VariableType.Vec4);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  if (flags.isClassified) {
    // For unclassified geometry, we need to render in both the translucent and opaque passes if any feature transparency overrides are applied that would change the default render pass used.
    // Those shaders compute the transparency in the vertex shader and discard the vertex in one pass or the other.
    // For classified geometry, the transparency comes from the classifier geometry (when using Display.ElementColor), so even if there are no feature overrides, we may need to draw in both passes.
    // Since the transparency is not known until the fragment shader, we must perform the discard there instead.
    addMaxAlpha(builder.frag);
    addRenderPass(builder.frag);

    // Do not discard transparent classified geometry if we're trying to do a pick...
    builder.frag.addUniform("u_no_classifier_discard", VariableType.Boolean, (prog) => {
      prog.addProgramUniform("u_no_classifier_discard", (uniform, params) => {
        uniform.setUniform1i(params.target.isReadPixelsInProgress ? 1 : 0);
      });
    });

    builder.frag.set(FragmentShaderComponent.DiscardByAlpha, discardClassifiedByAlpha);
  }

  addMonochrome(builder.frag);
  addMaterial(builder, flags.hasMaterialAtlas);

  return builder;
}
