/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
} from "../ShaderBuilder";
import { FeatureMode } from "../TechniqueFlags";
import { GLSLFragment, addWhiteOnWhiteReversal } from "./Fragment";
import { addProjectionMatrix, addModelViewMatrix, addNormalMatrix } from "./Vertex";
import { GLSLDecode } from "./Decode";
import { addColor } from "./Color";
import { addLighting } from "./Lighting";
import { FloatPreMulRgba } from "../FloatRGBA";
import { addHiliter, addSurfaceDiscard, FeatureSymbologyOptions, addFeatureSymbology } from "./FeatureSymbology";
import { addShaderFlags, GLSLCommon } from "./Common";
import { SurfaceGeometry } from "../Surface";
import { SurfaceFlags, TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { assert } from "@bentley/bentleyjs-core";
import { Material } from "../Material";
import { System } from "../System";

const sampleSurfaceTexture = `
  vec4 sampleSurfaceTexture() {
    // Textures do NOT contain premultiplied alpha. Multiply in shader.
    vec4 texColor = TEXTURE(s_texture, v_texCoord);
    return applyPreMultipliedAlpha(texColor);
  }
`;

const applyMaterialOverrides = `
  bool isTextured = isSurfaceBitSet(kSurfaceBit_HasTexture);
  bool useTextureWeight = isTextured && u_textureWeight < 1.0;
  bool useMatColor = !isSurfaceBitSet(kSurfaceBit_IgnoreMaterial) && (!isTextured || useTextureWeight);

  if (useMatColor) {
    // u_matRgb.a = 1.0 if color overridden by material, 0.0 otherwise.
    if (u_matRgb.a > 0.5)
      baseColor.rgb = u_matRgb.rgb * baseColor.a;

    // u_matAlpha.y = 1.0 if alpha overridden by material.
    if (u_matAlpha.y > 0.5)
      baseColor = adjustPreMultipliedAlpha(baseColor, u_matAlpha.x);
  }

  if (useTextureWeight) {
    vec4 texColor = sampleSurfaceTexture();
    baseColor = mix(baseColor, texColor, u_textureWeight);
  }

  return baseColor;
`;

export function addMaterial(frag: FragmentShaderBuilder): void {
  // ###TODO: We could pack rgb, alpha, and override flags into two floats.
  frag.addFunction(GLSLFragment.revertPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.adjustPreMultipliedAlpha);
  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyMaterialOverrides);

  frag.addUniform("u_matRgb", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_matRgb", (uniform, params) => {
      const mat: Material = params.target.currentViewFlags.showMaterials() && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform4fv(mat.diffuseUniform);
    });
  });
  frag.addUniform("u_matAlpha", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_matAlpha", (uniform, params) => {
      const mat = params.target.currentViewFlags.showMaterials() && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform2fv(mat.alphaUniform);
    });
  });
  frag.addUniform("u_textureWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_textureWeight", (uniform, params) => {
      const mat = params.target.currentViewFlags.showMaterials() && params.geometry.material ? params.geometry.material : Material.default;
      uniform.setUniform1f(mat.textureWeight);
    });
  });
}

const computePosition = `
  // ###TODO if (u_animParams.z > 0.0)
  // ###TODO   rawPos.xyz += computeAnimatedDisplacement(u_animValue * u_animParams.z).xyz;
  vec4 pos = u_mv * rawPos;
  v_pos = pos.xyz;
  return u_proj * pos;
`;

function createCommon(): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  const vert = builder.vert;

  // ###TODO Animation.AddCommon(vert);

  addProjectionMatrix(vert);
  addModelViewMatrix(vert);
  builder.addVarying("v_pos", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);

  return builder;
}

export function createSurfaceHiliter(): ProgramBuilder {
  const builder = createCommon();
  addHiliter(builder);
  return builder;
}

// nvidia hardware incorrectly interpolates varying floats when we send the same exact value for every vertex...
const isSurfaceBitSet = `
bool isSurfaceBitSet(float flag) { return 0.0 != extractNthBit(floor(v_surfaceFlags + 0.5), flag); }
`;

function addSurfaceFlagsLookup(builder: ShaderBuilder) {
  builder.addConstant("kSurfaceBit_HasTexture", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceBit_ApplyLighting", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceBit_HasNormals", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceBit_IgnoreMaterial", VariableType.Float, "3.0");
  builder.addConstant("kSurfaceBit_TransparencyThreshold", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceBit_BackgroundFill", VariableType.Float, "5.0");
  builder.addConstant("kSurfaceBit_HasColorAndNormal", VariableType.Float, "6.0");
  builder.addConstant("kSurfaceBit_EnvironmentMap", VariableType.Float, "7.0");

  builder.addConstant("kSurfaceMask_None", VariableType.Float, "0.0");
  builder.addConstant("kSurfaceMask_HasTexture", VariableType.Float, "1.0");
  builder.addConstant("kSurfaceMask_ApplyLighting", VariableType.Float, "2.0");
  builder.addConstant("kSurfaceMask_HasNormals", VariableType.Float, "4.0");
  builder.addConstant("kSurfaceMask_IgnoreMaterial", VariableType.Float, "8.0");
  builder.addConstant("kSurfaceMask_TransparencyThreshold", VariableType.Float, "16.0");
  builder.addConstant("kSurfaceMask_BackgroundFill", VariableType.Float, "32.0");
  builder.addConstant("kSurfaceMask_HasColorAndNormal", VariableType.Float, "64.0");
  builder.addConstant("kSurfaceMask_EnvironmentMap", VariableType.Float, "128.0");

  builder.addFunction(GLSLCommon.extractNthBit);
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
  if (!isSurfaceBitSet(kSurfaceBit_HasNormals))
    return vec3(0.0);

  vec2 normal = g_vertexData2;
  if (isSurfaceBitSet(kSurfaceBit_HasColorAndNormal)) {
    vec2 tc = g_vertexBaseCoords;
    tc.x += 3.0 * g_vert_stepX;
    vec4 enc = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
    normal = enc.xy;
  }

  return normalize(u_nmx * octDecodeNormal(normal));
`;

const isBelowTransparencyThreshold = `
  return alpha < u_transparencyThreshold && isSurfaceBitSet(kSurfaceBit_TransparencyThreshold);
`;

const applyBackgroundColor = `
  if (isSurfaceBitSet(kSurfaceBit_BackgroundFill))
    baseColor.rgb = u_bgColor.rgb;

  return baseColor;
`;

const computeTexCoord = `
  if (!isSurfaceBitSet(kSurfaceBit_HasTexture))
    return vec2(0.0);

  // ###TODO if (u_animParams.w > 0.0)
  // ###TODO   return computeAnimatedTextureParam(u_animValue * u_animParams.w);

  vec2 tc = g_vertexBaseCoords;
  tc.x += 3.0 * g_vert_stepX;
  vec4 rgba = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  vec2 qcoords = vec2(decodeUInt16(rgba.xy), decodeUInt16(rgba.zw));
  return unquantize2d(qcoords, u_qTexCoordParams);
`;

const getSurfaceColor = `
vec4 getSurfaceColor() { return v_color; }
`;

const computeBaseColor = `
  if (isSurfaceBitSet(kSurfaceBit_HasTexture) && u_textureWeight >= 1.0) {
    // if a glyph texture, must mix getSurfaceColor() with texCol so texCol.a is applied 100% and
    // surfCol.rgb is scaled by texCol.rgb (texCol.rgb = full white originally but stretched via mipMapping)
    if (u_applyGlyphTex > 0) {
      vec4 surfCol = getSurfaceColor();
      const vec3 white = vec3(1.0);
      const vec3 epsilon = vec3(0.0001);
      vec3 color = surfCol.a > 0.0 ? surfCol.rgb / surfCol.a : surfCol.rgb; // revert premultiplied alpha
      vec3 delta = (color + epsilon) - white;
      if (u_reverseWhiteOnWhite > 0.5 && delta.x > 0.0 && delta.y > 0.0 && delta.z > 0.0)
        surfCol.rgb = vec3(0.0);

      vec4 texCol = sampleSurfaceTexture();
      return vec4(surfCol.rgb * texCol.rgb, texCol.a);
    } else {
      return sampleSurfaceTexture();
    }
  } else {
    return getSurfaceColor(); // if textured, compute surface/material color first then mix with texture in applyMaterialOverrides...
  }
`;

function addSurfaceFlags(builder: ProgramBuilder, withFeatureOverrides: boolean) {
  builder.addFunctionComputedVarying("v_surfaceFlags", VariableType.Float, "computeSurfaceFlags", withFeatureOverrides ? computeSurfaceFlags : getSurfaceFlags);

  addSurfaceFlagsLookup(builder.vert);
  addSurfaceFlagsLookup(builder.frag);
  builder.addUniform("u_surfaceFlags", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_surfaceFlags", (uniform, params) => {
      assert(params.geometry instanceof SurfaceGeometry);
      const mesh = params.geometry as SurfaceGeometry;
      const surfFlags = mesh.computeSurfaceFlags(params);
      uniform.setUniform1f(surfFlags);
    });
  });
}

function addNormal(builder: ProgramBuilder) {
  addNormalMatrix(builder.vert);

  builder.vert.addFunction(octDecodeNormal);
  builder.addFunctionComputedVarying("v_n", VariableType.Vec3, "computeLightingNormal", computeNormal);
}

function addTransparencyThreshold(frag: FragmentShaderBuilder) {
  frag.addUniform("u_transparencyThreshold", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_transparencyThreshold", (uniform, params) => {
      uniform.setUniform1f(params.target.transparencyThreshold);
    });
  });

  frag.set(FragmentShaderComponent.DiscardByAlpha, isBelowTransparencyThreshold);
}

export function createSurfaceBuilder(feat: FeatureMode): ProgramBuilder {
  const builder = createCommon();
  addShaderFlags(builder);

  addFeatureSymbology(builder, feat, FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None);
  addSurfaceFlags(builder, FeatureMode.Overrides === feat);
  addSurfaceDiscard(builder, feat);
  addNormal(builder);

  // NB: We need the transparency threshold in translucent *and* opaque passes.
  // Opaque because we must compute the alpha in order to decide whether to discard or render opaque.
  addTransparencyThreshold(builder.frag);

  // In HiddenLine mode, we must compute the base color (plus feature overrides etc) in order to get the alpha, then replace with background color (preserving alpha for the transparency threshold test).
  builder.frag.set(FragmentShaderComponent.FinalizeBaseColor, applyBackgroundColor);
  builder.frag.addUniform("u_bgColor", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      const bgColor: ColorDef = params.target.bgColor;
      const rgbColor: FloatPreMulRgba = FloatPreMulRgba.fromColorDef(bgColor);
      uniform.setUniform3fv(new Float32Array([rgbColor.red, rgbColor.green, rgbColor.blue]));
    });
  });

  // Vertex
  builder.vert.addFunction(GLSLDecode.unquantize2d);
  // ###TODO: Animation.addTextureParam(builder.vert);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const surfGeom: SurfaceGeometry = params.geometry as SurfaceGeometry;
      const surfFlags: SurfaceFlags = surfGeom.computeSurfaceFlags(params);
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
      const surfGeom = params.geometry as SurfaceGeometry;
      const surfFlags = surfGeom.computeSurfaceFlags(params);
      if (SurfaceFlags.None !== (SurfaceFlags.HasTexture & surfFlags)) {
        assert(undefined !== surfGeom.texture);
        const texture = surfGeom.texture! as Texture;
        texture.texture.bindSampler(uniform, TextureUnit.Zero);
      } else if (undefined !== System.instance && undefined !== System.instance.lineCodeTexture) {
        // Bind the linecode texture just so that we have something bound to this texture unit for the shader.
        System.instance.lineCodeTexture.bindSampler(uniform, TextureUnit.Zero);
      }
    });
  });
  builder.frag.addUniform("u_applyGlyphTex", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_applyGlyphTex", (uniform, params) => {
      const surfGeom = params.geometry as SurfaceGeometry;
      const surfFlags: SurfaceFlags = surfGeom.computeSurfaceFlags(params);
      if (SurfaceFlags.None !== (SurfaceFlags.HasTexture & surfFlags)) {
        uniform.setUniform1i(surfGeom.isGlyph ? 1 : 0);
      }
    });
  });

  // Fragment and Vertex
  addColor(builder);

  // Fragment
  builder.frag.addFunction(getSurfaceColor);
  addLighting(builder);
  addWhiteOnWhiteReversal(builder.frag);

  if (FeatureMode.None === feat || !System.instance.capabilities.supportsPickShaders) {
    builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  } else {
    builder.frag.addExtension("GL_EXT_draw_buffers");
    builder.frag.addFunction(GLSLDecode.depthRgb);
    builder.frag.addFunction(GLSLDecode.encodeDepthRgb);
    builder.frag.addFunction(GLSLFragment.computeLinearDepth);
    builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragData);
  }

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  return builder;
}
