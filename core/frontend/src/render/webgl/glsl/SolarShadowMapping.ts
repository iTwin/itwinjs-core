/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
import { assert } from "@itwin/core-bentley";
import { RenderType } from "@itwin/webgl-compatibility";
import { TextureUnit } from "../RenderFlags";
import type { FragmentShaderBuilder, ProgramBuilder} from "../ShaderBuilder";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { System } from "../System";
import { addInstancedRtcMatrix } from "./Vertex";

const computeShadowPos = `
  vec4 shadowProj = u_shadowProj * rawPosition;
  v_shadowPos = shadowProj.xyz/shadowProj.w;
  v_shadowPos.z = 1.0 - v_shadowPos.z;
`;
const computeInstancedShadowPos = `
  vec4 shadowProj = u_shadowProj * g_instancedRtcMatrix * rawPosition;
  v_shadowPos = shadowProj.xyz/shadowProj.w;
  v_shadowPos.z = 1.0 - v_shadowPos.z;
`;

// for 32-bit float, max exponent should be 44.36, for 16-bit should be 5.545
const evsm32Exp = 42.0;
const evsm16Exp = 5.545;

export const warpDepth = `
// Applies exponential warp to shadow map depth, input depth should be in [0, 1]
vec2 warpDepth(float depth, float exponent) {
  depth = 2.0 * depth - 1.0; // Rescale depth into [-1, 1]
  float pos =  exp( exponent * depth);
  float neg = -exp(-exponent * depth);
  return vec2(pos, neg);
}
`;

const chebyshevUpperBound = `
float chebyshevUpperBound(vec2 moments, float mean, float minVariance) {
  float variance = moments.y - (moments.x * moments.x);
  variance = max(variance, minVariance);

  // Compute probabilistic upper bound
  float d = mean - moments.x;
  float pMax = variance / (variance + (d * d));

  return (mean <= moments.x ? 1.0 : pMax);  // One-tailed Chebyshev
}
`;

const shadowMapEVSM = `
float shadowMapEVSM(vec3 shadowPos) {
  vec2 warpedDepth = warpDepth(shadowPos.z, u_evsmExponent);
  vec4 occluder = TEXTURE(s_shadowSampler, shadowPos.xy/* * 0.5*/); // shadow texture is 1/2 size (both dirs)

  // Derivative of warping at depth
  vec2 depthScale = kVSMBias * 0.01 * u_evsmExponent * warpedDepth;
  vec2 minVariance = depthScale * depthScale;

  float posContrib = chebyshevUpperBound(occluder.xz, warpedDepth.x, minVariance.x);
  float negContrib = chebyshevUpperBound(occluder.yw, warpedDepth.y, minVariance.y);
  return min(posContrib, negContrib);
}
`;

const applySolarShadowMap = `
  if (v_shadowPos.x < 0.0 || v_shadowPos.x > 1.0 || v_shadowPos.y < 0.0 || v_shadowPos.y > 1.0 || v_shadowPos.z < 0.0 || v_shadowPos.z > 1.0)
    return baseColor;
  vec3 toEye = kFrustumType_Perspective == u_frustum.z ? normalize(v_eyeSpace) : vec3(0.0, 0.0, -1.0);
  vec3 normal = normalize(v_n);
  normal = (dot(normal, toEye) > 0.0) ? -normal : normal;
  float visible = (u_surfaceFlags[kSurfaceBitIndex_HasNormals] && (dot(normal, u_sunDir) < 0.0)) ? 0.0 : shadowMapEVSM(v_shadowPos);
  return vec4(baseColor.rgb * mix(u_shadowParams.rgb, vec3(1.0), visible), baseColor.a);
`;

const applySolarShadowMapTerrain = `
  if (v_shadowPos.x < 0.0 || v_shadowPos.x > 1.0 || v_shadowPos.y < 0.0 || v_shadowPos.y > 1.0 || v_shadowPos.z < 0.0 || v_shadowPos.z > 1.0)
    return baseColor;

  float visible = shadowMapEVSM(v_shadowPos);
  return vec4(baseColor.rgb * mix(u_shadowParams.rgb, vec3(1.0), visible), baseColor.a);
`;

/** @internal */
export function addEvsmExponent(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_evsmExponent", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_evsmExponent", (uniform) => {
      uniform.setUniform1f((RenderType.TextureFloat === System.instance.capabilities.maxRenderType) ? evsm32Exp : evsm16Exp);
    });
  });
}

/** @internal */
export function addSolarShadowMap(builder: ProgramBuilder, toTerrain = false) {
  const frag = builder.frag;
  const vert = builder.vert;

  frag.addUniform("s_shadowSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_shadowSampler", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap;
      assert(undefined !== shadowMap.shadowMapTexture);
      shadowMap.shadowMapTexture.texture.bindSampler(uniform, TextureUnit.ShadowMap);
    });
  });

  frag.addUniform("u_shadowParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_shadowParams", (uniform, params) => {
      params.target.uniforms.shadow.bindColorAndBias(uniform);
    });
  });

  if (!toTerrain) {
    frag.addUniform("u_sunDir", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_sunDir", (uniform, params) => {
        params.target.uniforms.bindSunDirection(uniform);
      });
    });
  }

  vert.addUniform("u_shadowProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_shadowProj", (uniform, params) => {
      params.target.uniforms.shadow.bindProjectionMatrix(uniform);
    });
  });

  addEvsmExponent(frag);

  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);
  builder.addInlineComputedVarying("v_shadowPos", VariableType.Vec3, vert.usesInstancedGeometry ? computeInstancedShadowPos : computeShadowPos);
  /* This is the EVSM bias value, which makes tradeoffs in shadow quality.  Normally it should be set to 0.1.
     Lower values can introduce shadows where they should not be, including shadow acne. Higher values can cause Peter
     Panning effect and light bleeding. Tested 0.01 and 1.0, woth more focus on 0.1 to 0.5 inclusive, chose 0.2 for a
     while (on 9/13/19) then after having shadow tiles match view tile resolution for ones in view, retested and went
     back to 0.1 (on 11/5/19). */
  frag.addGlobal("kVSMBias", VariableType.Float, "0.1", true);
  frag.addFunction(warpDepth);
  frag.addFunction(chebyshevUpperBound);
  frag.addFunction(shadowMapEVSM);
  frag.set(FragmentShaderComponent.ApplySolarShadowMap, toTerrain ? applySolarShadowMapTerrain : applySolarShadowMap);
}
