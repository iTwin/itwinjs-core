/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { assert } from "@bentley/bentleyjs-core";
import { VariableType, ProgramBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { addModelMatrix } from "./Vertex";
import { Vector3d } from "@bentley/geometry-core";

const computeShadowPos = "vec4 shadowProj = u_shadowProj * MAT_MODEL * rawPosition; v_shadowPos = shadowProj.xyz/shadowProj.w;";
const scratchShadowParams = new Float32Array(4);   // Color RGB, Shadow bias.
const scratchShadowDir = new Float32Array(3);
const scratchDirection = new Vector3d();

const applySolarShadowMap = `
  if (v_shadowPos.x < 0.0 || v_shadowPos.x > 1.0 || v_shadowPos.y < 0.0 || v_shadowPos.y > 1.0 || v_shadowPos.x < 0.0 || v_shadowPos.z < 0.0)
    return baseColor;

  float cosTheta = clamp(abs(dot(normalize(v_n), u_shadowDir)), 0.0, 1.0);
  float biasScale = isSurfaceBitSet(kSurfaceBit_HasNormals) ? (.1 + max(tan(acos(cosTheta)), 10.0)) : 1.0;

  float shadowDepth = 1.0 - biasScale * u_shadowParams.w  - TEXTURE(s_shadowSampler, v_shadowPos.xy).r;
  return (v_shadowPos.z > shadowDepth) ?  baseColor : vec4(u_shadowParams.rgb * baseColor.rgb, baseColor.a);
  `;

/** @internal */
export function addSolarShadowMap(builder: ProgramBuilder) {
  const frag = builder.frag;
  const vert = builder.vert;

  frag.addUniform("s_shadowSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_shadowSampler", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap!;
      assert(undefined !== shadowMap && undefined !== shadowMap.depthTexture);
      shadowMap.depthTexture!.texture.bindSampler(uniform, TextureUnit.ShadowMap);
    });
  });

  frag.addUniform("u_shadowParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_shadowParams", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap!;
      assert(undefined !== shadowMap);
      const colors = shadowMap.settings.color.colors;
      scratchShadowParams[0] = colors.r / 255.0;
      scratchShadowParams[1] = colors.g / 255.0;
      scratchShadowParams[2] = colors.b / 255.0;
      scratchShadowParams[3] = shadowMap.settings.bias;
      uniform.setUniform4fv(scratchShadowParams);
    });
  });
  frag.addUniform("u_shadowDir", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_shadowDir", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap!;
      const mv = params.modelViewMatrix;
      const worldDirection = shadowMap.direction!;
      scratchDirection.x = mv.m00 * worldDirection.x + mv.m01 * worldDirection.y + mv.m02 * worldDirection.z;
      scratchDirection.y = mv.m10 * worldDirection.x + mv.m11 * worldDirection.y + mv.m12 * worldDirection.z;
      scratchDirection.z = mv.m20 * worldDirection.x + mv.m21 * worldDirection.y + mv.m22 * worldDirection.z;
      scratchDirection.normalizeInPlace();

      scratchShadowDir[0] = scratchDirection.x;
      scratchShadowDir[1] = scratchDirection.y;
      scratchShadowDir[2] = scratchDirection.z;
      uniform.setUniform3fv(scratchShadowDir);
    });
  });

  vert.addUniform("u_shadowProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_shadowProj", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap!;
      assert(undefined !== shadowMap);
      uniform.setMatrix4(shadowMap.projectionMatrix);
    });
  });

  addModelMatrix(vert);

  builder.addInlineComputedVarying("v_shadowPos", VariableType.Vec3, computeShadowPos);
  frag.set(FragmentShaderComponent.ApplySolarShadowMap, applySolarShadowMap);
}
