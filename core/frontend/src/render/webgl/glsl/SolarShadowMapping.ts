/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { assert } from "@bentley/bentleyjs-core";
import { VariableType, ProgramBuilder, FragmentShaderBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { addInstancedRtcMatrix } from "./Vertex";
import { Vector3d, Matrix4d } from "@bentley/geometry-core";
import { RenderType, System } from "../System";
import { Matrix4 } from "../Matrix";

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

const scratchShadowParams = new Float32Array(4);   // Color RGB, Shadow bias.
const scratchShadowDir = new Float32Array(3);
const scratchDirection = new Vector3d();
const scratchMatrix = new Matrix4();
const scratchModel = Matrix4d.createIdentity();
const scratchModelProjection = Matrix4d.createIdentity();

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
  vec3 toEye = mix(vec3(0.0, 0.0, -1.0), normalize(v_eyeSpace), float(kFrustumType_Perspective == u_frustum.z));
  vec3 normal = normalize(v_n);
  normal = (dot(normal, toEye) > 0.0) ? -normal : normal;
  float visible = (isSurfaceBitSet(kSurfaceBit_HasNormals) && (dot(normal, u_shadowDir) > 0.0)) ? 0.0 : shadowMapEVSM(v_shadowPos);
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
export function addSolarShadowMap(builder: ProgramBuilder) {
  const frag = builder.frag;
  const vert = builder.vert;

  frag.addUniform("s_shadowSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_shadowSampler", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap;
      assert(undefined !== shadowMap && undefined !== shadowMap.shadowMapTexture);
      shadowMap!.shadowMapTexture!.texture.bindSampler(uniform, TextureUnit.ShadowMap);
    });
  });

  frag.addUniform("u_shadowParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_shadowParams", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap;
      assert(undefined !== shadowMap);
      assert(undefined !== shadowMap!.settings);
      const colors = shadowMap!.settings!.color.colors;
      scratchShadowParams[0] = colors.r / 255.0;
      scratchShadowParams[1] = colors.g / 255.0;
      scratchShadowParams[2] = colors.b / 255.0;
      scratchShadowParams[3] = shadowMap!.settings!.bias;
      uniform.setUniform4fv(scratchShadowParams);
    });
  });

  frag.addUniform("u_shadowDir", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_shadowDir", (uniform, params) => {
      const shadowMap = params.target.solarShadowMap;
      assert(undefined !== shadowMap);
      const mv = params.modelViewMatrix;
      const worldDirection = shadowMap!.direction!;
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
      const shadowMap = params.target.solarShadowMap;
      assert(undefined !== shadowMap);
      shadowMap!.projectionMatrix.multiplyMatrixMatrix(Matrix4d.createTransform(params.target.currentTransform, scratchModel), scratchModelProjection);
      scratchMatrix.initFromMatrix4d(scratchModelProjection);
      uniform.setMatrix4(scratchMatrix);
    });
  });

  addEvsmExponent(frag);

  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);
  builder.addInlineComputedVarying("v_shadowPos", VariableType.Vec3, vert.usesInstancedGeometry ? computeInstancedShadowPos : computeShadowPos);
  /* This is the EVSM bias value which can tweak things.  Probably should be between 0.1 and 0.4, and it is a
     tradeoff.  Lower values can introduce shadows where they should not be, including some acne. Higher values
     can cause Peter Panning and light bleeding.  Tested 0.01 and 1.0, then focused more on 0.1 to 0.5 inclusive,
     and ended up choosing 0.2 as the best tradeoffs for the various set of models tested on 9/13/19 */
  frag.addGlobal("kVSMBias", VariableType.Float, "0.2", true);
  frag.addFunction(warpDepth);
  frag.addFunction(chebyshevUpperBound);
  frag.addFunction(shadowMapEVSM);
  frag.set(FragmentShaderComponent.ApplySolarShadowMap, applySolarShadowMap);
}
