/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { TextureUnit } from "../RenderFlags";
import { VariableType, FragmentShaderComponent, VariablePrecision } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { AmbientOcclusionGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { GLSLDecode } from "./Decode";
import { readDepthAndOrder } from "./FeatureSymbology";
import { addViewport } from "./Viewport";
import { addFrustum } from "./Common";

const computeAmbientOcclusion = `
  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  float linearDepth = readDepthAndOrder(tc).y;
  float nonLinearDepth = computeNonLinearDepth(linearDepth);
  vec3 viewPos = computePositionFromDepth(tc, nonLinearDepth).xyz;

  vec2 pixelSize = 1.0 / u_viewport.zw; // could use uniform for this
  vec3 viewNormal = computeNormalFromDepth(viewPos, tc, pixelSize);

  vec2 sampleDirection = vec2(1.0, 0.0);
  float gapAngle = 90.0 * 0.017453292519943295; // radians per degree

  // Grab some random noise
  // Multiply screen UV (range 0..1) with size of viewport divided by 4 in order to tile the 4x4 noise texture across the screen.
  // Multiply the random 0..1 vec3 by 2 and then substract 1.  This puts the components of the vec3 in the range -1..1.
  vec3 noiseVec = (TEXTURE(u_noise, tc * vec2(u_viewport.z / 4.0, u_viewport.w / 4.0)).rgb + 1.0) / 2.0;

  // ###TODO: frustumLength (If the current fragment has a distance from the camera greater than this value, ambient occlusion is not computed for the fragment.)

  float bias = u_hbaoSettings.x; // Represents an angle in radians. If the dot product between the normal of the sample and the vector to the camera is less than this value, sampling stops in the current direction. This is used to remove shadows from near planar edges.
  float zLengthCap = u_hbaoSettings.y; // If the distance in linear Z from the current sample to first sample is greater than this value, sampling stops in the current direction.
  float intensity = u_hbaoSettings.z; // Raise the final occlusion to the power of this value.  Larger values make the ambient shadows darker.
  float texelStepSize = u_hbaoSettings.w; // texelStepSize indicates the distance to the next texel sample in the current direction.

  float tOcclusion = 0.0;

  // loop for each direction
  for (int i = 0; i < 4; i++) {
    float newGapAngle = gapAngle * (float(i) + noiseVec.x);
    float cosVal = cos(newGapAngle);
    float sinVal = sin(newGapAngle);

    // rotate sampling direction
    vec2 rotatedSampleDirection = vec2(cosVal * sampleDirection.x - sinVal * sampleDirection.y, sinVal * sampleDirection.x + cosVal * sampleDirection.y);
    float curOcclusion = 0.0;
    float curStepSize = texelStepSize; // 1.0 = stepsize, StepSize should be specified by uniform - what are good values?

    // loop for each step
    for (int j = 0; j < 6; j++) {
      vec2 directionWithStep = vec2(rotatedSampleDirection.x * curStepSize * pixelSize.x, rotatedSampleDirection.y * curStepSize * pixelSize.y);
      vec2 newCoords = directionWithStep + tc;

      // do not repeat around the depth texture
      if(newCoords.x > 1.0 || newCoords.y > 1.0 || newCoords.x < 0.0 || newCoords.y < 0.0) {
          break;
      }

      float curLinearDepth = readDepthAndOrder(newCoords).y;
      float curNonLinearDepth = computeNonLinearDepth(curLinearDepth);
      vec3 curViewPos = computePositionFromDepth(newCoords, curNonLinearDepth).xyz;
      vec3 diffVec = curViewPos.xyz - viewPos.xyz;
      float zLength = abs(curLinearDepth - linearDepth);

      float dotVal = clamp(dot(viewNormal, normalize(diffVec)), 0.0, 1.0);
      float weight = smoothstep(0.0, 1.0, zLengthCap / zLength);

      if (dotVal < bias) {
          dotVal = 0.0;
      }

      curOcclusion = max(curOcclusion, dotVal) * weight;
      curStepSize += texelStepSize;
    }
    tOcclusion += curOcclusion;
  }

  tOcclusion /= 4.0;
  tOcclusion = 1.0 - clamp(tOcclusion, 0.0, 1.0);
  tOcclusion = pow(tOcclusion, intensity);

  return vec4(tOcclusion, tOcclusion, tOcclusion, 1.0);
`;

const computeNonLinearDepth = `
float computeNonLinearDepth(float linearDepth) {
  return mix(u_frustum.y, u_frustum.x, linearDepth);
}
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
  float nonLinearDepthU = computeNonLinearDepth(readDepthAndOrder(tc - vec2(0.0, pixelSize.y)).y);
  float nonLinearDepthD = computeNonLinearDepth(readDepthAndOrder(tc + vec2(0.0, pixelSize.y)).y);
  float nonLinearDepthL = computeNonLinearDepth(readDepthAndOrder(tc - vec2(pixelSize.x, 0.0)).y);
  float nonLinearDepthR = computeNonLinearDepth(readDepthAndOrder(tc + vec2(pixelSize.x, 0.0)).y);

  vec3 viewPosUp = computePositionFromDepth(tc - vec2(0.0, pixelSize.y), nonLinearDepthU).xyz;
  vec3 viewPosDown = computePositionFromDepth(tc + vec2(0.0, pixelSize.y), nonLinearDepthD).xyz;
  vec3 viewPostLeft = computePositionFromDepth(tc - vec2(pixelSize.x, 0.0), nonLinearDepthL).xyz;
  vec3 viewPosRight = computePositionFromDepth(tc + vec2(pixelSize.x, 0.0), nonLinearDepthR).xyz;

  vec3 up = viewPos.xyz - viewPosUp.xyz;
  vec3 down = viewPosDown.xyz - viewPos.xyz;
  vec3 left = viewPos.xyz - viewPostLeft.xyz;
  vec3 right = viewPosRight.xyz - viewPos.xyz;

  vec3 dx = length(left) < length(right) ? left : right;
  vec3 dy = length(up) < length(down) ? up : down;

  return normalize(cross(dy, dx));
}
`;

export function createAmbientOcclusionProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);
  frag.addFunction(GLSLDecode.depthRgb);
  frag.addFunction(readDepthAndOrder);
  frag.addFunction(computeNonLinearDepth);
  frag.addFunction(computePositionFromDepth);
  frag.addFunction(computeNormalFromDepth);
  frag.addFunction(GLSLFragment.computeLinearDepth);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeAmbientOcclusion);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
      const geom = params.geometry as AmbientOcclusionGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthAndOrder, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_noise", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_noise", (uniform, params) => {
      const geom = params.geometry as AmbientOcclusionGeometry;
      Texture2DHandle.bindSampler(uniform, geom.noise, TextureUnit.One);
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
      uniform.setUniform4fv(params.target.frustumUniforms.frustumPlanes);
    });
  });

  frag.addUniform("u_hbaoSettings", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_hbaoSettings", (uniform, _params) => {
      const hbaoSettings = new Float32Array([0.25, 0.0025, 3.0, 1.0]);
      uniform.setUniform4fv(hbaoSettings); // x = bias, y = zLengthCap, z = intensity, w = texelStepSize
      // ###TODO: Actually retrieve HBAO settings from params.
    });
  }, VariablePrecision.High);

  return builder.buildProgram(context);
}
