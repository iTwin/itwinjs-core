/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import {
  ProgramBuilder,
  FragmentShaderBuilder,
  VariableType,
  FragmentShaderComponent,
  VertexShaderComponent,
  ShaderBuilder } from "../ShaderBuilder";
import { FeatureMode, WithClipVolume } from "../TechniqueFlags";
import { GLSLFragment } from "./Fragment";
import { addProjectionMatrix, addModelViewMatrix } from "./Vertex";
import { addClipping } from "./Clipping";
import { FloatRgba } from "../FloatRGBA";
import { addHiliter, addSurfaceDiscard } from "./FeatureSymbology";
import { addShaderFlags, GLSLCommon } from "./Common";
import { SurfaceGeometry } from "../Surface";
import { assert } from "@bentley/bentleyjs-core";

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
  vec4 texColor = TEXTURE(s_texture, v_texCoord);
  baseColor = mix(baseColor, texColor, u_textureWeight);
}

return baseColor;`;

export function addMaterial(frag: FragmentShaderBuilder): void {
  // ###TODO: We could pack rgb, alpha, and override flags into two floats.
  frag.addFunction(GLSLFragment.revertPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.applyPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.adjustPreMultipliedAlpha);
  frag.set(FragmentShaderComponent.ApplyMaterialOverrides, applyMaterialOverrides);

  frag.addUniform("u_matRgb", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_matRgb", (uniform, _params) => {
      // ###TODO Materials...
      const matRgb = new FloatRgba(0, 0, 0, 0);
      matRgb.bind(uniform);
    });
  });
  frag.addUniform("u_matAlpha", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_matAlpha", (uniform, _params) => {
      // ###TODO Materials...
      const matAlpha = [ 1, 1 ];
      uniform.setUniform2fv(matAlpha);
    });
  });
  frag.addUniform("u_textureWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_textureWeight", (uniform, _params) => {
      // ###TODO Materials...
      uniform.setUniform1f(1.0);
    });
  });
}

const computePosition = `
// ###TODO if (u_animParams.z > 0.0)
// ###TODO   rawPos.xyz += computeAnimatedDisplacement(u_animValue * u_animParams.z).xyz;
vec4 pos = u_mv * rawPos;
v_pos = pos.xyz;
return u_proj * pos;`;

function createCommon(clip: WithClipVolume): ProgramBuilder {
  const builder = new ProgramBuilder(true);
  const vert = builder.vert;

  // ###TODO Animation.AddCommon(vert);

  if (WithClipVolume.Yes === clip)
    addClipping(builder);

  addProjectionMatrix(vert);
  addModelViewMatrix(vert);
  builder.addVarying("v_pos", VariableType.Vec3);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);

  return builder;
}

export function createSurfaceHiliter(clip: WithClipVolume): ProgramBuilder {
  const builder = createCommon(clip);
  addHiliter(builder);
  return builder;
}

// nvidia hardware incorrectly interpolates varying floats when we send the same exact value for every vertex...
const isSurfaceBitSet = `
bool isSurfaceBitSet(float flag) {
  return 0.0 != extractNthBit(floor(v_surfaceFlags + 0.5), flag);
}`;

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

const getSurfaceFlags = `return u_surfaceFlags;`;
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

export function createSurfaceBuilder(feat: FeatureMode, clip: WithClipVolume): ProgramBuilder {
  const builder = createCommon(clip);
  addShaderFlags(builder);

  addSurfaceFlags(builder, FeatureMode.Overrides === feat);
  addSurfaceDiscard(builder, feat);

  // ###TODO: Finish this function...

  return builder;
}
