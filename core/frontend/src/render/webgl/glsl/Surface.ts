/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ColorDef } from "@bentley/imodeljs-common";
import {
  ProgramBuilder,
  FragmentShaderBuilder,
  VariableType,
  FragmentShaderComponent,
  VertexShaderComponent,
  ShaderBuilder,
  ShaderBuilderFlags,
} from "../ShaderBuilder";
import { IsInstanced, IsAnimated, FeatureMode } from "../TechniqueFlags";
import { GLSLFragment, addWhiteOnWhiteReversal, addPickBufferOutputs } from "./Fragment";
import { addProjectionMatrix, addModelViewMatrix, addNormalMatrix } from "./Vertex";
import { addAnimation } from "./Animation";
import { GLSLDecode } from "./Decode";
import { addColor } from "./Color";
import { addLighting } from "./Lighting";
import { FloatPreMulRgba } from "../FloatRGBA";
import { addSurfaceDiscard, FeatureSymbologyOptions, addFeatureSymbology, addSurfaceHiliter } from "./FeatureSymbology";
import { addShaderFlags, GLSLCommon } from "./Common";
import { SurfaceFlags, TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { Material } from "../Material";
import { System } from "../System";
import { assert } from "@bentley/bentleyjs-core";

const sampleSurfaceTexture = `
  vec4 sampleSurfaceTexture() {
    // Textures do NOT contain premultiplied alpha. Multiply in shader.
    vec4 texColor = TEXTURE(s_texture, v_texCoord);
    return applyPreMultipliedAlpha(texColor);
  }
`;

// u_matRgb.a = 1.0 if color overridden by material, 0.0 otherwise.
// u_matAlpha.y = 1.0 if alpha overridden by material.
// if this is a raster glyph, the sampled color has already been modified - do not modify further.
const applyMaterialOverrides = `
  float useMatColor = 1.0 - extractSurfaceBit(kSurfaceBit_IgnoreMaterial);
  vec4 matColor = mix(baseColor, vec4(u_matRgb.rgb * baseColor.a, baseColor.a), useMatColor * u_matRgb.a);
  matColor = mix(matColor, adjustPreMultipliedAlpha(matColor, u_matAlpha.x), useMatColor * u_matAlpha.y);
  float textureWeight = u_textureWeight * extractSurfaceBit(kSurfaceBit_HasTexture) * (1.0 - u_applyGlyphTex);
  return mix(matColor, g_surfaceTexel, textureWeight);
`;

export function addMaterial(frag: FragmentShaderBuilder): void {
  // ###TODO: We could pack rgb, alpha, and override flags into two floats.
  frag.addFunction(GLSLFragment.revertPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.adjustPreMultipliedAlpha);
  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyMaterialOverrides);

  frag.addUniform("u_matRgb", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_matRgb", (uniform, params) => {
      const mat: Material = params.target.currentViewFlags.materials && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform4fv(mat.diffuseUniform);
    });
  });
  frag.addUniform("u_matAlpha", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_matAlpha", (uniform, params) => {
      const mat = params.target.currentViewFlags.materials && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform2fv(mat.alphaUniform);
    });
  });
  frag.addUniform("u_textureWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_textureWeight", (uniform, params) => {
      const mat = params.target.currentViewFlags.materials && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform1f(mat.textureWeight);
    });
  });
}

const computePosition = `
  vec4 pos = MAT_MV * rawPos;
  v_pos = pos.xyz;
  return u_proj * pos;
`;

function createCommon(instanced: IsInstanced, animated: IsAnimated): ProgramBuilder {
  const builder = new ProgramBuilder(instanced ? ShaderBuilderFlags.InstancedVertexTable : ShaderBuilderFlags.VertexTable);
  const vert = builder.vert;

  if (animated)
    addAnimation(vert, true);

  addProjectionMatrix(vert);
  addModelViewMatrix(vert);
  builder.addVarying("v_pos", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);

  return builder;
}

export function createSurfaceHiliter(instanced: IsInstanced): ProgramBuilder {
  const builder = createCommon(instanced, IsAnimated.No);

  addSurfaceFlags(builder, true);
  addTexture(builder, IsAnimated.No);
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

  builder.addConstant("kSurfaceMask_None", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceMask_HasTexture", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceMask_ApplyLighting", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceMask_HasNormals", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceMask_IgnoreMaterial", VariableType.Float, "8.0");
  builder.addConstant("kSurfaceMask_TransparencyThreshold", VariableType.Float, "16.0");
  builder.addConstant("kSurfaceMask_BackgroundFill", VariableType.Float, "32.0");
  builder.addConstant("kSurfaceMask_HasColorAndNormal", VariableType.Float, "64.0");

  builder.addFunction(GLSLCommon.extractNthBit);
  builder.addFunction(extractSurfaceBit);
  builder.addFunction(isSurfaceBitSet);
}

const getSurfaceFlags = "return u_surfaceFlags;";

const computeSurfaceFlags = `
  float flags = u_surfaceFlags;
  if (feature_ignore_material) {
    bool hasTexture = 0.0 != fract(flags / 2.0); // kSurfaceMask_HasTexture = 1.0...
    if (hasTexture)
      flags -= kSurfaceMask_HasTexture;

    flags += kSurfaceMask_IgnoreMaterial;
  }

  return flags;
`;

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
  return mix(vec3(0.0), normalize(u_nmx * octDecodeNormal(normal)), extractSurfaceBit(kSurfaceBit_HasNormals));
`;

const computeAnimatedNormal = `
  if (u_animNormalParams.x >= 0.0)
    return normalize(u_nmx * computeAnimationNormal(u_animNormalParams.x, u_animNormalParams.y, u_animNormalParams.z));
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
  vec3 color = glyphColor.rgb / max(0.0001, glyphColor.a); // revert premultiplied alpha
  vec3 delta = (color + epsilon) - white;

  // set to black if almost white
  glyphColor.rgb *= float(u_reverseWhiteOnWhite <= 0.5 || delta.x <= 0.0 || delta.y <= 0.0 || delta.z <= 0.0);
  glyphColor = vec4(glyphColor.rgb * g_surfaceTexel.rgb, g_surfaceTexel.a);

  // Choose glyph color or unmodified texture sample
  vec4 texColor = mix(g_surfaceTexel, glyphColor, u_applyGlyphTex);

  // If untextured, or textureWeight < 1.0, choose surface color.
  return mix(surfaceColor, texColor, extractSurfaceBit(kSurfaceBit_HasTexture) * floor(u_textureWeight));
`;

function addSurfaceFlags(builder: ProgramBuilder, withFeatureOverrides: boolean) {
  builder.addFunctionComputedVarying("v_surfaceFlags", VariableType.Float, "computeSurfaceFlags", withFeatureOverrides ? computeSurfaceFlags : getSurfaceFlags);

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

  builder.frag.addFunction(GLSLFragment.applyPreMultipliedAlpha);
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

export function createSurfaceBuilder(feat: FeatureMode, isInstanced: IsInstanced, isAnimated: IsAnimated): ProgramBuilder {
  const builder = createCommon(isInstanced, isAnimated);
  addShaderFlags(builder);

  addFeatureSymbology(builder, feat, FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None);
  addSurfaceFlags(builder, FeatureMode.Overrides === feat);
  addSurfaceDiscard(builder, feat);
  addNormal(builder, isAnimated);

  // In HiddenLine mode, we must compute the base color (plus feature overrides etc) in order to get the alpha, then replace with background color (preserving alpha for the transparency threshold test).
  builder.frag.set(FragmentShaderComponent.FinalizeBaseColor, applyBackgroundColor);
  builder.frag.addUniform("u_bgColor", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      const bgColor: ColorDef = params.target.bgColor;
      const rgbColor: FloatPreMulRgba = FloatPreMulRgba.fromColorDef(bgColor);
      uniform.setUniform3fv(new Float32Array([rgbColor.red, rgbColor.green, rgbColor.blue]));
    });
  });

  addTexture(builder, isAnimated);

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
    builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  } else {
    builder.frag.addFunction(GLSLDecode.depthRgb);
    addPickBufferOutputs(builder.frag);
  }

  builder.frag.addGlobal("g_surfaceTexel", VariableType.Vec4);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  return builder;
}

// Target.readPixels() renders everything in opaque pass. It turns off textures for normal surfaces but keeps them for things like 3d view attachment tiles.
// We want to discard fully-transparent pixels of those things during readPixels() so that we don't locate the attachment unless the cursor is over a
// non-transparent pixel of it.
const discardTransparentTexel = `return isSurfaceBitSet(kSurfaceBit_HasTexture) && alpha == 0.0;`;

export function addSurfaceDiscardByAlpha(frag: FragmentShaderBuilder): void {
  frag.set(FragmentShaderComponent.DiscardByAlpha, discardTransparentTexel);
}
