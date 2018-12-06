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
import { AmbientOcclusionGeometry, AmbientOcclusionBlurGeometry } from "../CachedGeometry";
import { Texture2DHandle } from "../Texture";
import { GLSLDecode } from "./Decode";
import { readDepthAndOrder } from "./FeatureSymbology";
import { addViewport } from "./Viewport";
import { addFrustum } from "./Common";

const computeAmbientOcclusion = `
  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 depthAndOrder = readDepthAndOrder(tc);
  float nonLinearDepth = computeNonLinearDepth(depthAndOrder.y);
  vec3 posInView = computePositionFromNonLinearDepth(tc, nonLinearDepth).xyz;

  vec2 pixelSize = 1.0 / u_viewport.zw; // could use uniform for this
  vec3 normal = computeNormalFromNonLinearDepth(posInView, tc, pixelSize);

  vec2 sampleDirection = vec2(1.0, 0.0);
  float gapAngle = 90.0 * 0.017453292519943295; // radians per degree

  // Grab some random noise
  // Multiply screen UV (range 0..1) with size of viewport divided by 4 in order to tile the 4x4 noise texture across the screen.
  // Multiply the random 0..1 vec3 by 2 and then substract 1.  This puts the components of the vec3 in the range -1..1.
  vec3 noiseVec = (TEXTURE(u_noise, tc * vec2(u_viewport.z / 4.0, u_viewport.w / 4.0)).rgb + 1.0) / 2.0;

  float bias = 0.5; // default 0.1     ###TODO - uniforms - need values
  float stepSize = 1.0;
  float lengthCap = 0.03; // default 0.03 - this determines how close surfaces need to be to cast shadows on each other
  float depthCutoff = 0.08; // how close items must be in linear Z in order to affect one another with regard to ambient occlusion
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
      vec3 stepPosInCamera = computePositionFromNonLinearDepth(newCoords, stepDepthInfo).xyz;
      vec3 diffVec = posInView.xyz - stepPosInCamera.xyz;
      float len = length(diffVec);

      float linearDepth0 = linearStepDepthInfo;
      float linearDepth1 = depthAndOrder.y;
      if (abs(linearDepth0 - linearDepth1) > depthCutoff)
        break;

      float dotVal = clamp(dot(normal, normalize(diffVec)), 0.0, 1.0);

      if (dotVal < bias) {
          dotVal = 0.0;
      }

      curOcclusion = max(curOcclusion, dotVal);
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
  return mix(u_frustum.x, u_frustum.y, linearDepth);
}
`;

const computePositionFromNonLinearDepth = `
vec4 computePositionFromNonLinearDepth(vec2 tc, float depth) {
  vec2 xy = vec2((tc.x * 2.0 - 1.0), ((1.0 - tc.y) * 2.0 - 1.0));
  vec4 posEC = u_invProj * vec4(xy, depth, 1.0);
  posEC = posEC / posEC.w;
  return posEC;
}
`;

const computeNormalFromNonLinearDepth = `
vec3 computeNormalFromNonLinearDepth(vec3 posInView, vec2 tc, vec2 pixelSize) {
  float depthU = readDepthAndOrder(tc - vec2(0.0, pixelSize.y)).y;  depthU = computeNonLinearDepth(depthU);
  float depthD = readDepthAndOrder(tc + vec2(0.0, pixelSize.y)).y;  depthD = computeNonLinearDepth(depthD);
  float depthL = readDepthAndOrder(tc - vec2(pixelSize.x, 0.0)).y;  depthL = computeNonLinearDepth(depthL);
  float depthR = readDepthAndOrder(tc + vec2(pixelSize.x, 0.0)).y;  depthR = computeNonLinearDepth(depthR);

  vec3 posInViewUp = computePositionFromNonLinearDepth(tc - vec2(0.0, pixelSize.y), depthU).xyz;
  vec3 posInViewDown = computePositionFromNonLinearDepth(tc + vec2(0.0, pixelSize.y), depthD).xyz;
  vec3 posInViewLeft = computePositionFromNonLinearDepth(tc - vec2(pixelSize.x, 0.0), depthL).xyz;
  vec3 posInViewRight = computePositionFromNonLinearDepth(tc + vec2(pixelSize.x, 0.0), depthR).xyz;

  vec3 up = posInView.xyz - posInViewUp.xyz;
  vec3 down = posInViewDown.xyz - posInView.xyz;
  vec3 left = posInView.xyz - posInViewLeft.xyz;
  vec3 right = posInViewRight.xyz - posInView.xyz;

  vec3 dx = length(left) < length(right) ? left : right;
  vec3 dy = length(up) < length(down) ? up : down;

  return normalize(cross(dy, dx));
}
`;

const computeAmbientOcclusionBlur = `
  const int blurSize = 16; // make this a uniform (4 default?)

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 texelSize = 1.0 / u_viewport.zw; // could use uniform for this
  float result = 0.0;
  vec2 hlim = vec2(float(-blurSize) * 0.5 + 0.5);
  for (int i = 0; i < blurSize; i++) {
     for (int j = 0; j < blurSize; j++) {
        vec2 offset = (hlim + vec2(float(i), float(j))) * texelSize;
        result += TEXTURE(u_occlusion, tc + offset).r;
     }
  }

  result /= float(blurSize * blurSize);
  return vec4(result, result, result, 1.0);
`;

export function createAmbientOcclusionProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);
  frag.addFunction(GLSLDecode.depthRgb);
  frag.addFunction(readDepthAndOrder);
  frag.addFunction(computeNonLinearDepth);
  frag.addFunction(computePositionFromNonLinearDepth);
  frag.addFunction(computeNormalFromNonLinearDepth);
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

export function createAmbientOcclusionBlurProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  addWindowToTexCoords(frag);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeAmbientOcclusionBlur);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);

  frag.addUniform("u_occlusion", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_occlusion", (uniform, params) => {
      const geom = params.geometry as AmbientOcclusionBlurGeometry;
      Texture2DHandle.bindSampler(uniform, geom.occlusion, TextureUnit.Zero);
    });
  });

  addViewport(frag);

  return builder.buildProgram(context);
}
