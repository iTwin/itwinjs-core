/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

// portions adapted from code available at https://pastebin.com/bKxFnN5i

import { AmbientOcclusionGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariablePrecision, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { System } from "../System";
import { Texture2DHandle } from "../Texture";
import { addFrustum } from "./Common";
import { decodeDepthRgb } from "./Decode";
import { addRenderOrderConstants, readDepthAndOrder } from "./FeatureSymbology";
import { addWindowToTexCoords, assignFragColor } from "./Fragment";
import { addViewport } from "./Viewport";
import { createViewportQuadBuilder } from "./ViewportQuad";

// 'PB' indicates a shader variation when only the pickbuffer is available
// 'DB' indicates a shader variation when the real floating point depth buffer is available.

const computeAmbientOcclusionPrefixPB = `
vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
vec2 depthAndOrder = readDepthAndOrder(tc);
float db = depthAndOrder.y;
`;

const computeAmbientOcclusionPrefixDB = `
vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
vec2 depthAndOrder = readDepthAndOrder(tc);
float db = readDepth(tc);
`;

const gtaoFastAcos = `
float gtaoFastAcos(float x)
{
  float res = -0.156583 * abs(x) + 1.5707963267948966192313216916398; // PI_HALF
  res *= sqrt(1.0 - abs(x));
  return x >= 0.0 ? res : 3.1415926535897932384626433832795 - res; // PI
}
`;

const integrateArc = `
float integrateArc(float h1, float h2, float n)
{
  float cosN = cos(n);
  float sinN = sin(n);
  return 0.25 * (-cos(2.0 * h1 - n) + cosN + 2.0 * h1 * sinN - cos(2.0 * h2 - n) + cosN + 2.0 * h2 * sinN);
}
`;

const getCameraVec = `
vec3 getCameraVec(vec2 uv)
{
  return vec3(uv.x * -2.0 + 1.0, uv.y * 2.0 * u_viewport.y / u_viewport.x - u_viewport.y / u_viewport.x, 1.0);
}
`;

const sliceSample = `
void sliceSample(vec2 tc_base, vec2 aoDir, int i, float targetMip, vec3 ray, vec3 v, inout float closest)
{
  float SSAO_RADIUS = u_aoSettings2.z;
  float SSAO_FALLOFF = u_aoSettings2.w;
  float SSAO_THICKNESSMIX = u_aoSettings3.x;
  vec2 uv = tc_base + aoDir * float(i);
  float depth = textureLod(u_depthBuffer, uv, targetMip).x;
  vec3 p = getCameraVec(uv) * depth - ray;
  float current = dot(v, normalize(p));
  float falloff = clamp((SSAO_RADIUS - length(p)) / SSAO_FALLOFF, 0.0, 1.0);
  if (current > closest)
      closest = mix(closest, current, falloff);
  closest = mix(closest, current, SSAO_THICKNESSMIX * falloff);
}
`;

const computeAmbientOcclusion = `
  float SSAO_LIMIT = u_aoSettings2.x;
  float SSAO_SAMPLES = u_aoSettings2.y;
  float SSAO_MAX_STRIDE = u_aoSettings3.y;

  depthAndOrder.y = unfinalizeLinearDepth(db);
  float order = depthAndOrder.x;
  if (order >= kRenderOrder_PlanarBit)
    order = order - kRenderOrder_PlanarBit;

  if (order < kRenderOrder_LitSurface || order == kRenderOrder_Linear)
    return vec4(1.0);

  float linearDepth = depthAndOrder.y;
  float nonLinearDepth = computeNonLinearDepth(db);
  if (nonLinearDepth > u_maxDistance)
    return vec4(1.0);

  vec3 viewPos = computePositionFromDepth(tc, nonLinearDepth).xyz;

  vec2 pixelSize = 1.0 / u_viewport;
  float depth = TEXTURE(u_depthBuffer, tc).r;
  vec3 ray = getCameraVec(tc) * depth;

  vec2 uv = tc + vec2(1.0 / u_viewport.x, 0.0);
  vec3 p1 = ray - getCameraVec(uv) * textureLod(u_depthBuffer, uv, 0.0).x;

  uv = tc + vec2(0.0, 1.0 / u_viewport.y);
  vec3 p2 = ray - getCameraVec(uv) * textureLod(u_depthBuffer, uv, 0.0).x;

  uv = tc + vec2(-1.0 / u_viewport.x, 0.0);
  vec3 p3 = ray - getCameraVec(uv) * textureLod(u_depthBuffer, uv, 0.0).x;

  uv = tc + vec2(0.0, -1.0 / u_viewport.y);
  vec3 p4 = ray - getCameraVec(uv) * textureLod(u_depthBuffer, uv, 0.0).x;

  vec3 normal1 = normalize(cross(p1, p2));
  vec3 normal2 = normalize(cross(p3, p4));

  vec3 viewNormal = normalize(normal1 + normal2);
  // float depth = TEXTURE(u_depthBuffer, tc).r;
  // vec3 viewNormal = computeNormalFromDepth(viewPos, tc, pixelSize);
  // vec3 ray = getCameraVec(tc) * depth;

  // viewNormal = computeNormalFromDepth(viewPos, tc, pixelSize);
  vec3 v = normalize(-ray);
  float stride = min((1.0 / float(length(ray))) * SSAO_LIMIT, SSAO_MAX_STRIDE);
  vec2 dirMult = pixelSize * stride;

  float angleOffset = u_aoSettings.x;
  float spacialOffset = u_aoSettings.y;

  float dirAngle = (3.1415926535897932384626433832795 / 16.0) * float((((int(gl_FragCoord.x) + int(gl_FragCoord.y)) & 3) << 2) + (int(gl_FragCoord.x) & 3)) + angleOffset;

  vec2 aoDir = dirMult * vec2(sin(dirAngle), cos(dirAngle));

  vec3 toDir = getCameraVec(tc + aoDir);
  vec3 planeNormal = normalize(cross(v, -toDir));
  vec3 projectedNormal = viewNormal - planeNormal * dot(viewNormal, planeNormal);

  vec3 projectedDir = normalize(normalize(toDir) + v);
  float n = gtaoFastAcos(dot(-projectedDir, normalize(projectedNormal))) - 1.5707963267948966192313216916398;

  float c1 = u_aoSettings.z;
  float c2 = u_aoSettings.w;
  vec2 tc_base = tc + aoDir * (0.25 * float((int(gl_FragCoord.y) - int(gl_FragCoord.x)) & 3) - 0.375 + spacialOffset);

  const float minMip = 0.0;
  const float maxMip = 3.0;
  const float mipScale = 1.0 / 12.0;

  float targetMip = floor(clamp(pow(stride, 1.3) * mipScale, minMip, maxMip));

  for(int i = -1; i >= -int(SSAO_SAMPLES); i--)
  {
      sliceSample(tc_base, aoDir, i, targetMip, ray, v, c1);
  }
  for(int i = 1; i <= int(SSAO_SAMPLES); i++)
  {
      sliceSample(tc_base, aoDir, i, targetMip, ray, v, c2);
  }

  float h1a = -gtaoFastAcos(c1);
  float h2a = gtaoFastAcos(c2);

  float h1 = n + max(h1a - n, -1.5707963267948966192313216916398);
  float h2 = n + min(h2a - n, 1.5707963267948966192313216916398);

  float visibility = mix(1.0, integrateArc(h1, h2, n), length(projectedNormal));
  return vec4(visibility);
;
`;

const computePositionFromDepth = `
vec4 computePositionFromDepth(vec2 tc, float nonLinearDepth) {
  if (kFrustumType_Perspective == u_frustum.z) {
    vec2 xy = vec2((tc.x * 2.0 - 1.0), ((1.0 - tc.y) * 2.0 - 1.0));
    vec4 posEC = u_invProj * vec4(xy, nonLinearDepth, 1.0);
    posEC = posEC / posEC.w;
    return posEC;
  } else {
    float top = u_frustumPlanes.x;
    float bottom = u_frustumPlanes.y;
    float left = u_frustumPlanes.z;
    float right = u_frustumPlanes.w;
    return vec4(mix(left, right, tc.x), mix(bottom, top, tc.y), nonLinearDepth, 1.0);
  }
}
`;

const computeNormalFromDepth = `
vec3 computeNormalFromDepth(vec3 viewPos, vec2 tc, vec2 pixelSize) {
  float nonLinearDepthU = computeNonLinearDepth(readDepth(tc - vec2(0.0, pixelSize.y)));
  float nonLinearDepthD = computeNonLinearDepth(readDepth(tc + vec2(0.0, pixelSize.y)));
  float nonLinearDepthL = computeNonLinearDepth(readDepth(tc - vec2(pixelSize.x, 0.0)));
  float nonLinearDepthR = computeNonLinearDepth(readDepth(tc + vec2(pixelSize.x, 0.0)));

  vec3 viewPosUp = computePositionFromDepth(tc - vec2(0.0, pixelSize.y), nonLinearDepthU).xyz;
  vec3 viewPosDown = computePositionFromDepth(tc + vec2(0.0, pixelSize.y), nonLinearDepthD).xyz;
  vec3 viewPosLeft = computePositionFromDepth(tc - vec2(pixelSize.x, 0.0), nonLinearDepthL).xyz;
  vec3 viewPosRight = computePositionFromDepth(tc + vec2(pixelSize.x, 0.0), nonLinearDepthR).xyz;

  vec3 up = viewPos.xyz - viewPosUp.xyz;
  vec3 down = viewPosDown.xyz - viewPos.xyz;
  vec3 left = viewPos.xyz - viewPosLeft.xyz;
  vec3 right = viewPosRight.xyz - viewPos.xyz;

  vec3 dx = length(left) < length(right) ? left : right;
  vec3 dy = length(up) < length(down) ? up : down;

  return normalize(cross(dy, dx));
}
`;

const computeNonLinearDepthPB = `
float computeNonLinearDepth(float linearDepth) {
  return mix(u_frustum.y, u_frustum.x, linearDepth);
}
`;
const computeNonLinearDepthDB = `
float computeNonLinearDepth(float depth) {
  return 0.0 == u_logZ.x ? depth * u_logZ.y : exp(depth * u_logZ.y) / u_logZ.x;
}
`;

const readDepthPB = `
float readDepth(vec2 tc) {
  return readDepthAndOrder(tc).y;
}
`;
const readDepthDB = `
float readDepth(vec2 tc) {
  return TEXTURE(u_depthBuffer, tc).r;
}
`;
const unfinalizeLinearDepthDB = `
  float unfinalizeLinearDepth(float depth) {
    float eyeZ = 0.0 == u_logZ.x ? depth * u_logZ.y : exp(depth * u_logZ.y) / u_logZ.x;
    float near = u_frustum.x, far = u_frustum.y;
    float depthRange = far - near;
    float linearDepth = (eyeZ - near) / depthRange;
    return 1.0 - linearDepth;
  }
`;

function _shouldUseDB() {
  return System.instance.supportsLogZBuffer;
}

/** @internal */
export function createAmbientOcclusionProgram(context: WebGL2RenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;
  const shouldUseDB = _shouldUseDB();

  addWindowToTexCoords(frag);
  frag.addFunction(decodeDepthRgb);
  frag.addFunction(readDepthAndOrder);

  if (shouldUseDB) {
    frag.addFunction(unfinalizeLinearDepthDB);
    frag.addFunction(computeNonLinearDepthDB);
    frag.addFunction(readDepthDB);
  } else {
    frag.addDefine("unfinalizeLinearDepth", "");
    frag.addFunction(computeNonLinearDepthPB);
    frag.addFunction(readDepthPB);
  }

  frag.addFunction(computePositionFromDepth);
  frag.addFunction(computeNormalFromDepth);
  frag.addFunction(gtaoFastAcos);
  frag.addFunction(integrateArc);
  frag.addFunction(getCameraVec);
  frag.addFunction(sliceSample);
  addRenderOrderConstants(frag);

  if (shouldUseDB)
    frag.addUniform("u_logZ", VariableType.Vec2, (prog) => {
      prog.addProgramUniform("u_logZ", (uniform, params) => {
        uniform.setUniform2fv(params.target.uniforms.frustum.logZ);
      });
    });

  frag.set(FragmentShaderComponent.ComputeBaseColor, shouldUseDB ?
    computeAmbientOcclusionPrefixDB + computeAmbientOcclusion :
    computeAmbientOcclusionPrefixPB + computeAmbientOcclusion);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
      const geom = params.geometry as AmbientOcclusionGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthAndOrder, TextureUnit.Zero);
    });
  });

  if (shouldUseDB)
    frag.addUniform("u_depthBuffer", VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform("u_depthBuffer", (uniform, params) => {
        const geom = params.geometry as AmbientOcclusionGeometry;
        Texture2DHandle.bindSampler(uniform, geom.depth, TextureUnit.Two);
      });
    });

  addFrustum(builder);
  addViewport(frag);

  frag.addUniform("u_invProj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_invProj", (uniform, params) => {
      const invProj = params.projectionMatrix.clone();
      invProj.invert();
      uniform.setMatrix4(invProj);
    });
  });

  frag.addUniform("u_frustumPlanes", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_frustumPlanes", (uniform, params) => {
      uniform.setUniform4fv(params.target.uniforms.frustum.planes);
    });
  });

  frag.addUniform("u_aoSettings", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_aoSettings", (uniform, params) => {
      const aoSettings1 = new Float32Array([
        params.target.ambientOcclusionSettings.angleOffset,
        params.target.ambientOcclusionSettings.spacialOffset,
        params.target.ambientOcclusionSettings.c1,
        params.target.ambientOcclusionSettings.c2,
      ]);
      uniform.setUniform4fv(aoSettings1);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_aoSettings2", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_aoSettings2", (uniform, params) => {
      const aoSettings2 = new Float32Array([
        params.target.ambientOcclusionSettings.ssaoLimit,
        params.target.ambientOcclusionSettings.ssaoSamples,
        params.target.ambientOcclusionSettings.ssaoRadius,
        params.target.ambientOcclusionSettings.ssaoFalloff,
      ]);
      uniform.setUniform4fv(aoSettings2);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_aoSettings3", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_aoSettings3", (uniform, params) => {
      const aoSettings3 = new Float32Array([
        params.target.ambientOcclusionSettings.ssaoThicknessMix,
        params.target.ambientOcclusionSettings.ssaoMaxStride,
        0.0,
        0.0,
      ]);
      uniform.setUniform4fv(aoSettings3);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_maxDistance", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_maxDistance", (uniform, params) => {
      uniform.setUniform1f(params.target.ambientOcclusionSettings.maxDistance);
    });
  }, VariablePrecision.High);

  builder.vert.headerComment = "//!V! AmbientOcclusion";
  builder.frag.headerComment = "//!F! AmbientOcclusion";

  return builder.buildProgram(context);
}
