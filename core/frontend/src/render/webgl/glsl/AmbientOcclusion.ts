/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { TextureUnit } from "../RenderFlags";
import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
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
  vec3 posInView = computePositionFromDepth(tc, nonLinearDepth, linearDepth).xyz;

  vec2 pixelSize = 1.0 / u_viewport.zw; // could use uniform for this
  vec3 normal = computeNormalFromDepth(posInView, tc, pixelSize);

  vec2 sampleDirection = vec2(1.0, 0.0);
  float gapAngle = 90.0 * 0.017453292519943295; // radians per degree

  // Grab some random noise
  // Multiply screen UV (range 0..1) with size of viewport divided by 4 in order to tile the 4x4 noise texture across the screen.
  // Multiply the random 0..1 vec3 by 2 and then substract 1.  This puts the components of the vec3 in the range -1..1.
  vec3 noiseVec = (TEXTURE(u_noise, tc * vec2(u_viewport.z / 4.0, u_viewport.w / 4.0)).rgb + 1.0) / 2.0;

  const float stepSize = 1.0; // how many pixels to step?  I would keep this as a constant, not a uniform.  1.0 seems a good value in Cesium and here.

  // From Cesium docs:
  // intensity is a scalar value used to lighten or darken the shadows exponentially. Higher values make the shadows darker. The default value is 3.0.
  // bias is a scalar value representing an angle in radians. If the dot product between the normal of the sample and the vector to the camera is less than this value, sampling stops in the current direction. This is used to remove shadows from near planar edges. The default value is 0.1.
  // lengthCap is a scalar value representing a length in meters. If the distance from the current sample to first sample is greater than this value, sampling stops in the current direction. The default value is 0.26.
  // stepSize is a scalar value indicating the distance to the next texel sample in the current direction. The default value is 1.95.
  // frustumLength is a scalar value in meters. If the current fragment has a distance from the camera greater than this value, ambient occlusion is not computed for the fragment. The default value is 1000.0.
  // ambientOcclusionOnly is a boolean value. When true, only the shadows generated are written to the output. When false, the input texture is modulated with the ambient occlusion. This is a useful debug option for seeing the effects of changing the uniform values. The default value is false.

  // ###TODO - these need to be uniforms
  float bias = 0.25; // default 0.25, range: 0 to 1: if dot product between normal of sample and vector to the camera is less than this value, sampling stops (removes shadows from near planar edges)
  float softDepthCutoff = 0.0025; // how close items must be in linear Z in order to affect one another with regard to ambient occlusion, range: 0 to 1 (will smoothly transition as moving in and out of this range)
  float intensity = 3.0; // raise the occlusion to the power of this value

  float tOcclusion = 0.0;

  // loop for each direction
  for (int i = 0; i < 4; i++) {
    float newGapAngle = gapAngle * (float(i) + noiseVec.x);
    float cosVal = cos(newGapAngle);
    float sinVal = sin(newGapAngle);

    // rotate sampling direction
    vec2 rotatedSampleDirection = vec2(cosVal * sampleDirection.x - sinVal * sampleDirection.y, sinVal * sampleDirection.x + cosVal * sampleDirection.y);
    float curOcclusion = 0.0;
    float curStepSize = stepSize; // 1.0 = stepsize, StepSize should be specified by uniform - what are good values?

    // loop for each step
    for (int j = 0; j < 6; j++) {
      vec2 directionWithStep = vec2(rotatedSampleDirection.x * curStepSize * pixelSize.x, rotatedSampleDirection.y * curStepSize * pixelSize.y);
      vec2 newCoords = directionWithStep + tc;

      // do not repeat around the depth texture
      if(newCoords.x > 1.0 || newCoords.y > 1.0 || newCoords.x < 0.0 || newCoords.y < 0.0) {
          break;
      }

      float linearStepDepthInfo;
      float stepDepthInfo = readDepthAndOrder(newCoords).y;  linearStepDepthInfo = stepDepthInfo;  stepDepthInfo = computeNonLinearDepth(stepDepthInfo);
      vec3 stepPosInCamera = computePositionFromDepth(newCoords, stepDepthInfo, linearStepDepthInfo).xyz;
      vec3 diffVec = stepPosInCamera.xyz - posInView.xyz;
      float len = length(diffVec);

      float linearDepth0 = linearStepDepthInfo;
      float linearDepth1 = linearDepth;

      float rangeCheck = smoothstep(0.0, 1.0, softDepthCutoff / abs(linearDepth0 - linearDepth1));
      float dotVal = clamp(dot(normal, normalize(diffVec)), 0.0, 1.0);

      if (dotVal < bias) {
          dotVal = 0.0;
      }

      curOcclusion = max(curOcclusion, dotVal) * rangeCheck;
      curStepSize += stepSize; // 1.0 = stepsize
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
vec4 computePositionFromDepth(vec2 tc, float depth, float linearDepth) {
  vec2 xy = vec2((tc.x * 2.0 - 1.0), ((1.0 - tc.y) * 2.0 - 1.0));
  if (kFrustumType_Perspective == u_frustum.z) {
    vec4 posEC = u_invProj * vec4(xy, depth, 1.0);
    posEC = posEC / posEC.w;
    return posEC;
  } else {
    return vec4(xy.x, xy.y, linearDepth * 2.0 - 1.0, 1.0);
  }
}
`;

const computeNormalFromDepth = `
vec3 computeNormalFromDepth(vec3 posInView, vec2 tc, vec2 pixelSize) {
  float linearDepthU = readDepthAndOrder(tc - vec2(0.0, pixelSize.y)).y;  float nonLinearDepthU = computeNonLinearDepth(linearDepthU);
  float linearDepthD = readDepthAndOrder(tc + vec2(0.0, pixelSize.y)).y;  float nonLinearDepthD = computeNonLinearDepth(linearDepthD);
  float linearDepthL = readDepthAndOrder(tc - vec2(pixelSize.x, 0.0)).y;  float nonLinearDepthL = computeNonLinearDepth(linearDepthL);
  float linearDepthR = readDepthAndOrder(tc + vec2(pixelSize.x, 0.0)).y;  float nonLinearDepthR = computeNonLinearDepth(linearDepthR);

  vec3 posInViewUp = computePositionFromDepth(tc - vec2(0.0, pixelSize.y), nonLinearDepthU, linearDepthU).xyz;
  vec3 posInViewDown = computePositionFromDepth(tc + vec2(0.0, pixelSize.y), nonLinearDepthD, linearDepthD).xyz;
  vec3 posInViewLeft = computePositionFromDepth(tc - vec2(pixelSize.x, 0.0), nonLinearDepthL, linearDepthL).xyz;
  vec3 posInViewRight = computePositionFromDepth(tc + vec2(pixelSize.x, 0.0), nonLinearDepthR, linearDepthR).xyz;

  vec3 up = posInView.xyz - posInViewUp.xyz;
  vec3 down = posInViewDown.xyz - posInView.xyz;
  vec3 left = posInView.xyz - posInViewLeft.xyz;
  vec3 right = posInViewRight.xyz - posInView.xyz;

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

  return builder.buildProgram(context);
}
