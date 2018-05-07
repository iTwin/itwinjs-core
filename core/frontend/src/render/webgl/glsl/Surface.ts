/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ProgramBuilder, FragmentShaderBuilder, VariableType, FragmentShaderComponent, VertexShaderComponent } from "../ShaderBuilder";
import { FeatureMode, WithClipVolume } from "../TechniqueFlags";
import { GLSLFragment } from "./Fragment";
import { addProjectionMatrix, addModelViewMatrix } from "./Vertex";
import { addClipping } from "./Clipping";
import { FloatRgba } from "../FloatRGBA";
import { addHiliter } from "./FeatureSymbology";

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

export function createSurfaceBuilder(_featureMode: FeatureMode, clip: WithClipVolume): ProgramBuilder {
  return createCommon(clip); // ###TODO
}
