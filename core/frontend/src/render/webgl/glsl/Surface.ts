/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ProgramBuilder,
  FragmentShaderBuilder,
  VariableType,
  FragmentShaderComponent,
  VertexShaderComponent,
  ShaderBuilder,
  ShaderBuilderFlags,
} from "../ShaderBuilder";
import { IsInstanced, IsAnimated, IsClassified, FeatureMode, IsShadowable, TechniqueFlags } from "../TechniqueFlags";
import { GLSLFragment, addWhiteOnWhiteReversal, addPickBufferOutputs, addAltPickBufferOutputs } from "./Fragment";
import { addProjectionMatrix, addModelViewMatrix, addNormalMatrix } from "./Vertex";
import { addAnimation } from "./Animation";
import { GLSLDecode } from "./Decode";
import { addColor } from "./Color";
import { addLighting } from "./Lighting";
import { addSurfaceDiscard, FeatureSymbologyOptions, addFeatureSymbology, addSurfaceHiliter } from "./FeatureSymbology";
import { addShaderFlags, GLSLCommon } from "./Common";
import { SurfaceFlags, TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { Material } from "../Material";
import { System } from "../System";
import { assert } from "@bentley/bentleyjs-core";
import { addColorPlanarClassifier, addHilitePlanarClassifier, addFeaturePlanarClassifier } from "./PlanarClassification";
import { addSolarShadowMap } from "./SolarShadowMapping";
import { FloatRgb, FloatRgba } from "../FloatRGBA";
import { ColorDef } from "@bentley/imodeljs-common";

// NB: Textures do not contain pre-multiplied alpha.
const sampleSurfaceTexture = `
  vec4 sampleSurfaceTexture() {
    return TEXTURE(s_texture, v_texCoord);
  }
`;

const applyMaterialColor = `
  float useMatColor = 1.0 - extractSurfaceBit(kSurfaceBit_IgnoreMaterial);
  vec3 rgb = mix(baseColor.rgb, mat_rgb.rgb, useMatColor * mat_rgb.a);
  float a = mix(baseColor.a, mat_alpha.x, useMatColor * mat_alpha.y);
  return vec4(rgb, a);
`;

// if this is a raster glyph, the sampled color has already been modified - do not modify further.
const applyTextureWeight = `
  float textureWeight = mat_texture_weight * extractSurfaceBit(kSurfaceBit_HasTexture) * (1.0 - u_applyGlyphTex);
  vec4 rgba = mix(baseColor, g_surfaceTexel, textureWeight);
  rgba.rgb = mix(rgba.rgb, v_color.rgb, extractSurfaceBit(kSurfaceBit_OverrideRgb));
  rgba.a = mix(rgba.a, v_color.a, extractSurfaceBit(kSurfaceBit_OverrideAlpha));
  return rgba;
`;

const unpackMaterialParam = `
vec3 unpackMaterialParam(float f) {
  vec3 v;
  v.z = floor(f / 256.0 / 256.0);
  v.y = floor((f - v.z * 256.0 * 256.0) / 256.0);
  v.x = floor(f - v.z * 256.0 * 256.0 - v.y * 256.0);
  return v;
}`;

const unpackAndNormalizeMaterialParam = `
vec3 unpackAndNormalizeMaterialParam(float f) {
  return unpackMaterialParam(f) / 255.0;
}`;

const decodeFragMaterialParams = `
void decodeMaterialParams(vec3 params) {
  mat_specular = vec4(unpackAndNormalizeMaterialParam(params.x), params.y);

  vec3 weights = unpackAndNormalizeMaterialParam(params.z);
  mat_weights = weights.xy;
  mat_texture_weight = weights.z;
}`;

const decodeMaterialColor = `
void decodeMaterialColor(vec4 rgba) {
  mat_rgb = vec4(rgba.rgb, float(rgba.r >= 0.0));
  mat_alpha = vec2(rgba.a, float(rgba.a >= 0.0));
}`;

const computeMaterialParams = `
  const vec3 defaults = vec3(16777215.0, 13.5, 16737945.0);
  if (isSurfaceBitSet(kSurfaceBit_IgnoreMaterial))
    return defaults;
  else
    return u_materialParams;
`;

/** @internal */
export function addMaterial(builder: ProgramBuilder): void {
  const frag = builder.frag;
  assert(undefined !== frag.find("v_surfaceFlags"));

  frag.addGlobal("mat_texture_weight", VariableType.Float);
  frag.addGlobal("mat_weights", VariableType.Vec2); // diffuse, specular
  frag.addGlobal("mat_specular", VariableType.Vec4); // rgb, exponent

  frag.addFunction(unpackMaterialParam);
  frag.addFunction(unpackAndNormalizeMaterialParam);
  frag.addFunction(decodeFragMaterialParams);
  frag.addInitializer("decodeMaterialParams(v_materialParams);");

  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyTextureWeight);

  const vert = builder.vert;
  vert.addGlobal("mat_rgb", VariableType.Vec4); // a = 0 if not overridden, else 1
  vert.addGlobal("mat_alpha", VariableType.Vec2); // a = 0 if not overridden, else 1

  vert.addUniform("u_materialColor", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_materialColor", (uniform, params) => {
      const info = params.target.currentViewFlags.materials ? params.geometry.materialInfo : undefined;
      const mat = undefined !== info && !info.isAtlas ? info : Material.default;
      uniform.setUniform4fv(mat.rgba);
    });
  });

  vert.addUniform("u_materialParams", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_materialParams", (uniform, params) => {
      const info = params.target.currentViewFlags.materials ? params.geometry.materialInfo : undefined;
      const mat = undefined !== info && !info.isAtlas ? info : Material.default;
      uniform.setUniform3fv(mat.fragUniforms);
    });
  });

  vert.addFunction(decodeMaterialColor);
  vert.addInitializer("decodeMaterialColor(u_materialColor);");
  vert.set(VertexShaderComponent.ApplyMaterialColor, applyMaterialColor);

  builder.addFunctionComputedVarying("v_materialParams", VariableType.Vec3, "computeMaterialParams", computeMaterialParams);
}

const computePosition = `
  vec4 pos = MAT_MV * rawPos;
  v_eyeSpace = pos.xyz;
  return u_proj * pos;
`;

function createCommon(instanced: IsInstanced, animated: IsAnimated, classified: IsClassified, shadowable: IsShadowable): ProgramBuilder {
  const builder = new ProgramBuilder(instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  if (animated)
    addAnimation(vert, true);
  if (classified)
    addColorPlanarClassifier(builder);
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
  const builder = createCommon(instanced, IsAnimated.No, classified, IsShadowable.No);

  addSurfaceFlags(builder, true, false);
  addTexture(builder, IsAnimated.No);
  if (classified) {
    addHilitePlanarClassifier(builder);
    builder.vert.addGlobal("feature_ignore_material", VariableType.Boolean, "false");
    builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  } else
    addSurfaceHiliter(builder);

  return builder;
}

// nvidia hardware incorrectly interpolates varying floats when we send the same exact value for every vertex...
const extractSurfaceBit = `
float extractSurfaceBit(float flag) { return extractNthBit(floor(v_surfaceFlags + 0.5), flag); }
`;

const isSurfaceBitSet = `
bool isSurfaceBitSet(float flag) { return 0.0 != extractSurfaceBit(flag); }
`;

function addSurfaceFlagsLookup(builder: ShaderBuilder) {
  builder.addConstant("kSurfaceBit_HasTexture", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceBit_ApplyLighting", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceBit_HasNormals", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceBit_IgnoreMaterial", VariableType.Float, "3.0");
  builder.addConstant("kSurfaceBit_TransparencyThreshold", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceBit_BackgroundFill", VariableType.Float, "5.0");
  builder.addConstant("kSurfaceBit_HasColorAndNormal", VariableType.Float, "6.0");
  builder.addConstant("kSurfaceBit_OverrideAlpha", VariableType.Float, "7.0");
  builder.addConstant("kSurfaceBit_OverrideRgb", VariableType.Float, "8.");

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

  builder.addFunction(GLSLCommon.extractNthBit);
  builder.addFunction(extractSurfaceBit);
  builder.addFunction(isSurfaceBitSet);
}

const getSurfaceFlags = "return u_surfaceFlags;";

const computeBaseSurfaceFlags = `
  float flags = u_surfaceFlags;
  if (feature_ignore_material) {
    bool hasTexture = 0.0 != fract(flags / 2.0); // kSurfaceMask_HasTexture = 1.0...
    if (hasTexture)
      flags -= kSurfaceMask_HasTexture;

    flags += kSurfaceMask_IgnoreMaterial;
  }
`;

const computeColorSurfaceFlags = `
  if (feature_rgb.r >= 0.0)
    flags += kSurfaceMask_OverrideRgb;

  if (feature_alpha >= 0.0)
    flags += kSurfaceMask_OverrideAlpha;
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

function addSurfaceFlags(builder: ProgramBuilder, withFeatureOverrides: boolean, withFeatureColor: boolean) {
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
  builder.vert.addFunction(GLSLDecode.unquantize2d);
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
        const texture = (params.target.analysisTexture ? params.target.analysisTexture : surfGeom.texture) as Texture;
        assert(undefined !== texture);
        texture.texture.bindSampler(uniform, TextureUnit.SurfaceTexture);
      } else {
        System.instance.ensureSamplerBound(uniform, TextureUnit.SurfaceTexture);
      }
    });
  });
}

const scratchBgColor = FloatRgb.fromColorDef(ColorDef.white);
const blackColor = FloatRgba.fromColorDef(ColorDef.black);

/** @internal */
export function createSurfaceBuilder(flags: TechniqueFlags): ProgramBuilder {
  const builder = createCommon(flags.isInstanced, flags.isAnimated, flags.isClassified, flags.isShadowable);
  addShaderFlags(builder);

  const feat = flags.featureMode;
  addFeatureSymbology(builder, feat, FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None);
  addSurfaceFlags(builder, FeatureMode.Overrides === feat, true);
  addSurfaceDiscard(builder, feat, flags.isEdgeTestNeeded, flags.isClassified);
  addNormal(builder, flags.isAnimated);

  // In HiddenLine mode, we must compute the base color (plus feature overrides etc) in order to get the alpha, then replace with background color (preserving alpha for the transparency threshold test).
  builder.frag.set(FragmentShaderComponent.FinalizeBaseColor, applyBackgroundColor);
  builder.frag.addUniform("u_bgColor", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      const bgColor = params.target.bgColor.alpha === 0.0 ? blackColor : params.target.bgColor;
      scratchBgColor.set(bgColor.red, bgColor.green, bgColor.blue);
      scratchBgColor.bind(uniform);
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
  addColor(builder, true);

  // Fragment
  builder.frag.addFunction(getSurfaceColor);
  addLighting(builder);
  addWhiteOnWhiteReversal(builder.frag);

  if (FeatureMode.None === feat) {
    builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColorWithPreMultipliedAlpha);
  } else {
    if (flags.isClassified)
      addFeaturePlanarClassifier(builder);
    builder.frag.addFunction(GLSLDecode.depthRgb);
    if (flags.isEdgeTestNeeded || flags.isClassified)
      addPickBufferOutputs(builder.frag);
    else
      addAltPickBufferOutputs(builder.frag);
  }

  builder.frag.addGlobal("g_surfaceTexel", VariableType.Vec4);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  return builder;
}

// Target.readPixels() renders everything in opaque pass. It turns off textures for normal surfaces but keeps them for things like 3d view attachment tiles.
// We want to discard fully-transparent pixels of those things during readPixels() so that we don't locate the attachment unless the cursor is over a
// non-transparent pixel of it.
const discardTransparentTexel = `return isSurfaceBitSet(kSurfaceBit_HasTexture) && alpha == 0.0;`;

/** @internal */
export function addSurfaceDiscardByAlpha(frag: FragmentShaderBuilder): void {
  frag.set(FragmentShaderComponent.DiscardByAlpha, discardTransparentTexel);
}
