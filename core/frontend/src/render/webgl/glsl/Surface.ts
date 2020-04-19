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
import { IsInstanced, IsAnimated, IsClassified, FeatureMode, IsShadowable, HasMaterialAtlas, TechniqueFlags, IsThematic } from "../TechniqueFlags";
import { assignFragColor, addFragColorWithPreMultipliedAlpha, addWhiteOnWhiteReversal, addPickBufferOutputs, addAltPickBufferOutputs } from "./Fragment";
import { addFeatureAndMaterialLookup, addProjectionMatrix, addModelViewMatrix, addNormalMatrix } from "./Vertex";
import { addAnimation } from "./Animation";
import { addUnpackAndNormalize2Bytes, unquantize2d, decodeDepthRgb } from "./Decode";
import { addColor } from "./Color";
import { addLighting } from "./Lighting";
import { addMaxAlpha, addSurfaceDiscard, FeatureSymbologyOptions, addFeatureSymbology, addSurfaceHiliter } from "./FeatureSymbology";
import { addShaderFlags, addExtractNthBit, addChooseWithBitFlagFunctions } from "./Common";
import { SurfaceBitIndex, TextureUnit } from "../RenderFlags";
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
import { addSurfaceMonochrome } from "./Monochrome";
import { addThematicDisplay, getComputeThematicIndex } from "./Thematic";

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
  rgba.rgb = chooseVec3WithBitFlag(rgba.rgb, v_color.rgb, surfaceFlags, kSurfaceBit_OverrideRgb);
  rgba.a = chooseFloatWithBitFlag(rgba.a, v_color.a, surfaceFlags, kSurfaceBit_OverrideAlpha);
  rgba.a = chooseFloatWithBitFlag(rgba.a, v_color.a * rgba.a, surfaceFlags, kSurfaceBit_MultiplyAlpha);
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

  addChooseWithBitFlagFunctions(frag);
  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyTextureWeight);

  const vert = builder.vert;
  vert.addGlobal("mat_rgb", VariableType.Vec4); // a = 0 if not overridden, else 1
  vert.addGlobal("mat_alpha", VariableType.Vec2); // a = 0 if not overridden, else 1
  vert.addGlobal("use_material", VariableType.Boolean);
  if (System.instance.capabilities.isWebGL2)
    vert.addInitializer("use_material = (0u == (surfaceFlags & kSurfaceBit_IgnoreMaterial));");
  else
    vert.addInitializer("use_material = !nthBitSet(surfaceFlags, kSurfaceBit_IgnoreMaterial);");

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

function createCommon(instanced: IsInstanced, animated: IsAnimated, shadowable: IsShadowable, isThematic: IsThematic): ProgramBuilder {
  const attrMap = AttributeMap.findAttributeMap(TechniqueId.Surface, IsInstanced.Yes === instanced);
  const builder = new ProgramBuilder(attrMap, instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  if (animated)
    addAnimation(vert, true, isThematic);

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
  const builder = createCommon(instanced, IsAnimated.No, IsShadowable.No, IsThematic.No);

  addSurfaceFlags(builder, true, false);
  addTexture(builder, IsAnimated.No, IsThematic.No);
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
float extractSurfaceBit(float flag) { return extractNthBit(surfaceFlags, flag); }
`;
const extractSurfaceBit2 = `
float extractSurfaceBit(uint flag) { return mix(0.0, 1.0, 0u != (surfaceFlags & flag)); }
`;

const isSurfaceBitSet = `
bool isSurfaceBitSet(float flag) { return nthBitSet(surfaceFlags, flag); }
`;
const isSurfaceBitSet2 = `
bool isSurfaceBitSet(uint flag) { return 0u != (surfaceFlags & flag); }
`;

/** @internal */
function addSurfaceFlagsLookup(builder: ShaderBuilder) {
  builder.addConstant("kSurfaceBitIndex_HasTexture", VariableType.Int, "0");
  builder.addConstant("kSurfaceBitIndex_ApplyLighting", VariableType.Int, "1");
  builder.addConstant("kSurfaceBitIndex_HasNormals", VariableType.Int, "2");
  builder.addConstant("kSurfaceBitIndex_IgnoreMaterial", VariableType.Int, "3");
  builder.addConstant("kSurfaceBitIndex_TransparencyThreshold", VariableType.Int, "4");
  builder.addConstant("kSurfaceBitIndex_BackgroundFill", VariableType.Int, "5");
  builder.addConstant("kSurfaceBitIndex_HasColorAndNormal", VariableType.Int, "6");
  builder.addConstant("kSurfaceBitIndex_OverrideAlpha", VariableType.Int, "7");
  builder.addConstant("kSurfaceBitIndex_OverrideRgb", VariableType.Int, "8");
  builder.addConstant("kSurfaceBitIndex_NoFaceFront", VariableType.Int, "9");
  builder.addConstant("kSurfaceBitIndex_MultiplyAlpha", VariableType.Int, "10");
  // MultiplyAlpha must be highest value - insert additional above it, not here.

  // Surface flags which get modified in vertex shader are still passed to fragment shader as a single float & are thus
  // used differently there & so require different constants.  Unused constants are commented out.
  builder.addBitFlagConstant("kSurfaceBit_HasTexture", 0);
  // builder.addBitFlagConstant("kSurfaceBit_ApplyLighting", 1);
  // builder.addBitFlagConstant("kSurfaceBit_HasNormals", 2);
  builder.addBitFlagConstant("kSurfaceBit_IgnoreMaterial", 3);
  // builder.addBitFlagConstant("kSurfaceBit_TransparencyThreshold", 4);
  // builder.addBitFlagConstant("kSurfaceBit_BackgroundFill", 5);
  // builder.addBitFlagConstant("kSurfaceBit_HasColorAndNormal", 6);
  builder.addBitFlagConstant("kSurfaceBit_OverrideAlpha", 7);
  builder.addBitFlagConstant("kSurfaceBit_OverrideRgb", 8);
  // builder.addBitFlagConstant("kSurfaceBit_NoFaceFront", 9);
  builder.addBitFlagConstant("kSurfaceBit_MultiplyAlpha", 10);

  if (System.instance.capabilities.isWebGL2) { // only need masks for flags modified in vertex shader
    // builder.addConstant("kSurfaceMask_None", VariableType.Uint, "0u");
    builder.addConstant("kSurfaceMask_HasTexture", VariableType.Uint, "1u");
    // builder.addConstant("kSurfaceMask_ApplyLighting", VariableType.Uint, "2u");
    // builder.addConstant("kSurfaceMask_HasNormals", VariableType.Uint, "4u");
    builder.addConstant("kSurfaceMask_IgnoreMaterial", VariableType.Uint, "8u");
    // builder.addConstant("kSurfaceMask_TransparencyThreshold", VariableType.Uint, "16u");
    // builder.addConstant("kSurfaceMask_BackgroundFill", VariableType.Uint, "32u");
    // builder.addConstant("kSurfaceMask_HasColorAndNormal", VariableType.Uint, "64u");
    builder.addConstant("kSurfaceMask_OverrideAlpha", VariableType.Uint, "128u");
    builder.addConstant("kSurfaceMask_OverrideRgb", VariableType.Uint, "256u");
    // builder.addConstant("kSurfaceMask_NoFaceFront", VariableType.Uint, "512u");
    builder.addConstant("kSurfaceMask_MultiplyAlpha", VariableType.Uint, "1024u");
  } else {
    // builder.addConstant("kSurfaceMask_None", VariableType.Float, "0.0");
    builder.addConstant("kSurfaceMask_HasTexture", VariableType.Float, "1.0");
    // builder.addConstant("kSurfaceMask_ApplyLighting", VariableType.Float, "2.0");
    // builder.addConstant("kSurfaceMask_HasNormals", VariableType.Float, "4.0");
    builder.addConstant("kSurfaceMask_IgnoreMaterial", VariableType.Float, "8.0");
    // builder.addConstant("kSurfaceMask_TransparencyThreshold", VariableType.Float, "16.0");
    // builder.addConstant("kSurfaceMask_BackgroundFill", VariableType.Float, "32.0");
    // builder.addConstant("kSurfaceMask_HasColorAndNormal", VariableType.Float, "64.0");
    builder.addConstant("kSurfaceMask_OverrideAlpha", VariableType.Float, "128.0");
    builder.addConstant("kSurfaceMask_OverrideRgb", VariableType.Float, "256.0");
    // builder.addConstant("kSurfaceMask_NoFaceFront", VariableType.Float, "512.0");
    builder.addConstant("kSurfaceMask_MultiplyAlpha", VariableType.Float, "1024.0");
  }

  addExtractNthBit(builder);
  if (System.instance.capabilities.isWebGL2) {
    builder.addFunction(extractSurfaceBit2);
    builder.addFunction(isSurfaceBitSet2);
    builder.addGlobal("surfaceFlags", VariableType.Uint);
  } else {
    builder.addFunction(extractSurfaceBit);
    builder.addFunction(isSurfaceBitSet);
    builder.addGlobal("surfaceFlags", VariableType.Float);
  }
}

const initSurfaceFlags = `
  surfaceFlags = u_surfaceFlags[kSurfaceBitIndex_HasTexture] ? kSurfaceMask_HasTexture : 0.0;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_MultiplyAlpha] ? kSurfaceMask_MultiplyAlpha : 0.0;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_IgnoreMaterial] ? kSurfaceMask_IgnoreMaterial : 0.0;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_OverrideAlpha] ? kSurfaceMask_OverrideAlpha : 0.0;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_OverrideRgb] ? kSurfaceMask_OverrideRgb : 0.0;
 `;
const initSurfaceFlags2 = `
  surfaceFlags = u_surfaceFlags[kSurfaceBitIndex_HasTexture] ? kSurfaceMask_HasTexture : 0u;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_MultiplyAlpha] ? kSurfaceMask_MultiplyAlpha : 0u;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_IgnoreMaterial] ? kSurfaceMask_IgnoreMaterial : 0u;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_OverrideAlpha] ? kSurfaceMask_OverrideAlpha : 0u;
  surfaceFlags += u_surfaceFlags[kSurfaceBitIndex_OverrideRgb] ? kSurfaceMask_OverrideRgb : 0u;
 `;

const getSurfaceFlags = `
  return surfaceFlags;
`;
const getSurfaceFlags2 = `
  return float(surfaceFlags);
 `;

const computeBaseSurfaceFlags = `
  bool hasTexture = u_surfaceFlags[kSurfaceBitIndex_HasTexture];
  if (feature_ignore_material) {
    if (hasTexture) {
      hasTexture = false;
      surfaceFlags -= kSurfaceMask_HasTexture;
      if (surfaceFlags >= kSurfaceMask_MultiplyAlpha) // NB: This only works if MultiplyAlpha is the largest flag!!!
      surfaceFlags -= kSurfaceMask_MultiplyAlpha;
    }

    surfaceFlags += kSurfaceMask_IgnoreMaterial;
  }
`;

// Textured surfaces (including raster glyphs) always *multiply* the sampled alpha by the alpha override.
const computeColorSurfaceFlags = `
  if (feature_rgb.r >= 0.0)
    surfaceFlags += kSurfaceMask_OverrideRgb;

  if (feature_alpha >= 0.0) {
    if (!hasTexture) {
      surfaceFlags += kSurfaceMask_OverrideAlpha;
      if (surfaceFlags >= kSurfaceMask_MultiplyAlpha) // NB: This only works if MultiplyAlpha is the largest flag!!!
      surfaceFlags -= kSurfaceMask_MultiplyAlpha;
    } else if (surfaceFlags < kSurfaceMask_MultiplyAlpha) {
      surfaceFlags += kSurfaceMask_MultiplyAlpha;
    }
  }
`;

const returnSurfaceFlags = `
  return surfaceFlags;
`;
const returnSurfaceFlags2 = `
  return float(surfaceFlags);
`;

const computeSurfaceFlags = computeBaseSurfaceFlags;
const computeSurfaceFlagsWithColor = computeBaseSurfaceFlags + computeColorSurfaceFlags;

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
  vec2 normal = u_surfaceFlags[kSurfaceBitIndex_HasColorAndNormal] ? enc.xy : g_vertexData2;
  return u_surfaceFlags[kSurfaceBitIndex_HasNormals] ? normalize(MAT_NORM * octDecodeNormal(normal)) : vec3(0.0);
`;

const computeAnimatedNormal = `
  if (u_animNormalParams.x >= 0.0)
    return normalize(MAT_NORM * computeAnimationNormal(u_animNormalParams.x, u_animNormalParams.y, u_animNormalParams.z));
` + computeNormal;

const applyBackgroundColor = `
  return u_surfaceFlags[kSurfaceBitIndex_BackgroundFill] ? vec4(u_bgColor.rgb, 1.0) : baseColor;
`;

const computeTexCoord = `
  vec2 tc = g_vertexBaseCoords;
  tc.x += 3.0 * g_vert_stepX;  vec4 rgba = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec2 qcoords = vec2(decodeUInt16(rgba.xy), decodeUInt16(rgba.zw));
  return chooseVec2WithBitFlag(vec2(0.0), unquantize2d(qcoords, u_qTexCoordParams), surfaceFlags, kSurfaceBit_HasTexture);
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

const surfaceFlagArray = new Int32Array(SurfaceBitIndex.Count);

/** @internal */
export function addSurfaceFlags(builder: ProgramBuilder, withFeatureOverrides: boolean, withFeatureColor: boolean) {
  addSurfaceFlagsLookup(builder.vert);
  addSurfaceFlagsLookup(builder.frag);

  let compute: string;
  if (System.instance.capabilities.isWebGL2) {
    compute = initSurfaceFlags2 + (withFeatureOverrides ? (withFeatureColor ? computeSurfaceFlagsWithColor : computeSurfaceFlags) + returnSurfaceFlags2 : getSurfaceFlags2);
  } else {
    compute = initSurfaceFlags + (withFeatureOverrides ? (withFeatureColor ? computeSurfaceFlagsWithColor : computeSurfaceFlags) + returnSurfaceFlags : getSurfaceFlags);
  }
  builder.addFunctionComputedVarying("v_surfaceFlags", VariableType.Float, "computeSurfaceFlags", compute);

  if (System.instance.capabilities.isWebGL2)
    builder.frag.addInitializer("surfaceFlags = uint(floor(v_surfaceFlags + 0.5));");
  else
    builder.frag.addInitializer("surfaceFlags = floor(v_surfaceFlags + 0.5);");

  builder.addUniformArray("u_surfaceFlags", VariableType.Boolean, SurfaceBitIndex.Count, (prog) => {
    prog.addGraphicUniform("u_surfaceFlags", (uniform, params) => {
      assert(undefined !== params.geometry.asSurface);
      const mesh = params.geometry.asSurface!;
      mesh.computeSurfaceFlags(params.programParams, surfaceFlagArray);
      uniform.setUniform1iv(surfaceFlagArray);
    });
  });
}

function addNormal(builder: ProgramBuilder, animated: IsAnimated) {
  addNormalMatrix(builder.vert);

  builder.vert.addFunction(octDecodeNormal);
  addChooseWithBitFlagFunctions(builder.vert);
  builder.addFunctionComputedVarying("v_n", VariableType.Vec3, "computeLightingNormal", animated ? computeAnimatedNormal : computeNormal);
}

function addTexture(builder: ProgramBuilder, animated: IsAnimated, isThematic: IsThematic) {
  if (isThematic)
    builder.addInlineComputedVarying("v_thematicIndex", VariableType.Float, getComputeThematicIndex(builder.vert.usesInstancedGeometry));
  else {
    builder.vert.addFunction(unquantize2d);
    addChooseWithBitFlagFunctions(builder.vert);
    builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", animated ? computeAnimatedTexCoord : computeTexCoord);
    builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
        const surfGeom = params.geometry.asSurface!;
        if (surfGeom.useTexture(params.programParams)) {
          const uvQParams = surfGeom.lut.uvQParams;
          if (undefined !== uvQParams) {
            uniform.setUniform4fv(uvQParams);
          }
        }
      });
    });
    builder.frag.addFunction(sampleSurfaceTexture);
  }

  builder.frag.addUniform("s_texture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_texture", (uniform, params) => {
      const surfGeom = params.geometry.asSurface!;
      if (params.geometry.supportsThematicDisplay && params.target.wantThematicDisplay) { // NB: if thematic display is enabled, bind the thematic texture and ignore any applied surface textures
        params.target.uniforms.thematic.bindTexture(uniform, TextureUnit.SurfaceTexture);
      } else if (surfGeom.useTexture(params.programParams)) {
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
  const builder = createCommon(flags.isInstanced, flags.isAnimated, flags.isShadowable, flags.isThematic);
  addShaderFlags(builder);

  const feat = flags.featureMode;
  let opts = FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None;
  if (flags.isClassified) {
    opts &= ~FeatureSymbologyOptions.Alpha;
    addColorPlanarClassifier(builder, flags.isTranslucent, flags.isThematic);
  }

  if (flags.isThematic) {
    addThematicDisplay(builder);
  }

  addFeatureSymbology(builder, feat, opts);
  addSurfaceFlags(builder, FeatureMode.Overrides === feat, true);
  addSurfaceDiscard(builder, flags);
  addNormal(builder, flags.isAnimated);

  // In HiddenLine mode, we must compute the base color (plus feature overrides etc) in order to get the alpha, then replace with background color (preserving alpha for the transparency threshold test).
  addChooseWithBitFlagFunctions(builder.frag);
  builder.frag.set(FragmentShaderComponent.FinalizeBaseColor, applyBackgroundColor);
  builder.frag.addUniform("u_bgColor", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      params.target.uniforms.style.bindBackgroundRgb(uniform);
    });
  });

  addTexture(builder, flags.isAnimated, flags.isThematic);

  builder.frag.addUniform("u_applyGlyphTex", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_applyGlyphTex", (uniform, params) => {
      const surfGeom = params.geometry.asSurface!;
      uniform.setUniform1f(surfGeom.useTexture(params.programParams) && surfGeom.isGlyph ? 1 : 0);
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
        addOverrideClassifierColor(builder, flags.isThematic);
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
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, (flags.isThematic === IsThematic.No) ? computeBaseColor : "return getSurfaceColor();");

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

  addSurfaceMonochrome(builder.frag);
  addMaterial(builder, flags.hasMaterialAtlas);

  return builder;
}
