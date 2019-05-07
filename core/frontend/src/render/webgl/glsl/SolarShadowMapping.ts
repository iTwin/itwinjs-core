/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { assert } from "@bentley/bentleyjs-core";
import { VariableType, ProgramBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";

const computeShadowPos = "vec4 proj = u_shadowProj * u_m * rawPosition; v_shadowPos = proj.xyz/proj.w;";
const scratchShadowParams = new Float32Array(4);   // Color RGB, Shadow bias.

const applySolarShadowMap = `
  if (v_shadowPos.x < 0.0 || v_shadowPos.x > 1.0 || v_shadowPos.y < 0.0 || v_shadowPos.y > 1.0 || v_shadowPos.x < 0.0 || v_shadowPos.z < 0.0)
    return baseColor;
  float shadowDepth = 1.0 - s_shadowParams.w  - TEXTURE(s_shadowSampler, v_shadowPos.xy).r;
  return (v_shadowPos.z > shadowDepth) ?  baseColor : vec4(s_shadowParams.rgb * baseColor.rgb, baseColor.a);
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

  frag.addUniform("s_shadowParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("s_shadowParams", (uniform, params) => {
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

  vert.addUniform("u_shadowProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_shadowProj", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap!;
      assert(undefined !== shadowMap);
      uniform.setMatrix4(shadowMap.projectionMatrix);
    });
  });

  vert.addUniform("u_m", VariableType.Mat4, (prog) => {     // TBD.  Instancing.
    prog.addGraphicUniform("u_m", (uniform, params) => {
      uniform.setMatrix4(params.modelMatrix);
    });
  });
  builder.addInlineComputedVarying("v_shadowPos", VariableType.Vec3, computeShadowPos);
  frag.set(FragmentShaderComponent.ApplySolarShadowMap, applySolarShadowMap);
}
