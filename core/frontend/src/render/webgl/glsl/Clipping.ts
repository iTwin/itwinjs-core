/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType } from "../ShaderBuilder";
import { addEyeSpace, addFrustum } from "./Common";
import { addPixelWidthFactor } from "./FeatureSymbology";
import { computeAlphaWeight, computeOutputs } from "./Translucency";
import { addModelViewMatrix } from "./Vertex";

const getClipPlaneFloat = `
vec4 getClipPlane(int index) {
  return texelFetch(s_clipSampler, ivec2(0, index), 0);
}
`;

export const unpackFloat = `
float unpackFloat(vec4 v) {
  const float bias = 38.0;
  v = floor(v * 255.0 + 0.5);
  float temp = v.w / 2.0;
  float exponent = floor(temp);
  float sign = (temp - exponent) * 2.0;
  exponent = exponent - bias;
  sign = -(sign * 2.0 - 1.0);
  float unpacked = dot(sign * v.xyz, vec3(1.0 / 256.0, 1.0 / 65536.0, 1.0 / 16777216.0)); // shift x right 8, y right 16 and z right 24
  return unpacked * pow(10.0, exponent);
}
`;

const calcClipPlaneDist = `
float calcClipPlaneDist(vec3 camPos, vec4 plane) {
  return dot(vec4(camPos, 1.0), plane);
}
`;

const applyClipPlanesLoop = `
    for (int i = u_clipParams[0]; i < u_clipParams[1]; i++) {
`;

const applyClipPlanesLoopBody = `
      vec4 plane = getClipPlane(i);
      if (plane.x == 2.0) { // indicates start of new UnionOfConvexClipPlaneSets
        if (numSetsClippedBy + int(clippedByCurrentPlaneSet) == numPlaneSets)
          break;

        numPlaneSets = 1;
        numSetsClippedBy = 0;
        clippedByCurrentPlaneSet = false;
      } else if (plane.xyz == vec3(0.0)) { // indicates start of new clip plane set
        numPlaneSets = numPlaneSets + 1;
        numSetsClippedBy += int(clippedByCurrentPlaneSet);
        clippedByCurrentPlaneSet = false;
      } else if (!clippedByCurrentPlaneSet && calcClipPlaneDist(v_eyeSpace, plane) < 0.0) {
        clippedByCurrentPlaneSet = true;
      }
`;

const applyClipPlanesIntersectionLoopBody = `
      if ((i <= u_clipParams[1] - 2) && (!clippedByCurrentPlaneSet)) {

        //Obtaining closest point on plane to current frag in eyespace
        vec3 pointOnPlane = v_eyeSpace - (abs(calcClipPlaneDist(v_eyeSpace, plane)) * plane.xyz);

        //determining whether to colorize
        if (distance(v_eyeSpace, pointOnPlane) <= (kFrustumType_Perspective == u_frustum.z ? -pointOnPlane.z * widthFactor : widthFactor)) {
          colorizeIntersection = true;
        }
      }
    }

    //Need to pull this condition out of the loop for when there are multiple clip planes defined
    if (colorizeIntersection && !clippedByCurrentPlaneSet) {
      g_clipColor = u_clipIntersection.rgb;
      return bvec2(true, true);
    }
`;

const applyClipPlanesPrelude = `
  int numPlaneSets = 1;
  int numSetsClippedBy = 0;
  bool clippedByCurrentPlaneSet = false;
  bool colorizeIntersection = false;
  if (u_colorizeIntersection) {
    float widthFactor = u_pixelWidthFactor * 2.0 * u_clipIntersection.a;
    ${applyClipPlanesLoop}${applyClipPlanesLoopBody}${applyClipPlanesIntersectionLoopBody}
  } else {
    ${applyClipPlanesLoop}${applyClipPlanesLoopBody}    }\n
  }
`;

const applyClipPlanesPostlude = `

  numSetsClippedBy += int(clippedByCurrentPlaneSet);
  if (numSetsClippedBy == numPlaneSets) {
    if (u_outsideRgba.a > 0.0) {
      g_clipColor = u_outsideRgba.rgb;
      return bvec2(true,false);
    } else {
      discard;
    }
  } else if (u_insideRgba.a > 0.0) {
    g_clipColor = u_insideRgba.rgb;
    return bvec2(true,false);
  }

  return bvec2(false,false);
`;

const assignFragData = `
  if (g_hasClipColor.y) {
    vec4 output0 = vec4(g_clipColor, 1.0);
    vec4 output1 = vec4(1.0, 1.0, 0.0, 1.0);

    FragColor0 = output0;
    FragColor1 = output1;
  } else {
    ${computeOutputs}

    FragColor0 = output0;
    FragColor1 = output1;
  }
`;

const applyClipPlanes = applyClipPlanesPrelude + applyClipPlanesPostlude;

const clipParams = new Int32Array(3);

/** @internal */
export function addClipping(prog: ProgramBuilder) {
  const frag = prog.frag;
  const vert = prog.vert;

  addEyeSpace(prog);

  prog.addUniform("u_outsideRgba", VariableType.Vec4, (program) => {
    program.addGraphicUniform("u_outsideRgba", (uniform, params) => {
      params.target.uniforms.branch.clipStack.outsideColor.bind(uniform);
    });
  });

  prog.addUniform("u_insideRgba", VariableType.Vec4, (program) => {
    program.addGraphicUniform("u_insideRgba", (uniform, params) => {
      params.target.uniforms.branch.clipStack.insideColor.bind(uniform);
    });
  });

  addFrustum(prog);
  addPixelWidthFactor(frag);

  addModelViewMatrix(vert);

  // [0] = index of first plane
  // [1] = index of last plane (one past the end)
  // [2] = texture height

  prog.frag.addGlobal("g_hasClipColor", VariableType.BVec2);

  prog.addUniformArray("u_clipParams", VariableType.Int, 3, (program) => {
    program.addGraphicUniform("u_clipParams", (uniform, params) => {
      // Set this to false to visualize pre-shader culling of geometry.
      const doClipping = true;

      const stack = params.target.uniforms.branch.clipStack;
      clipParams[0] = stack.startIndex;
      clipParams[1] = stack.endIndex;
      clipParams[2] = doClipping ? stack.textureHeight : 0;
      assert(clipParams[2] > 0 || !doClipping);
      uniform.setUniform1iv(clipParams);
    });
  });

  prog.frag.addUniform("u_colorizeIntersection", VariableType.Boolean, (program) => {
    program.addProgramUniform("u_colorizeIntersection", (uniform, params) => {
      uniform.setUniform1i(params.target.uniforms.branch.clipStack.colorizeIntersection ? 1 : 0);
    });
  });

  prog.frag.addUniform("u_clipIntersection", VariableType.Vec4, (program) => {
    program.addGraphicUniform("u_clipIntersection", (uniform, params) => {
      params.target.uniforms.branch.clipStack.intersectionStyle.bind(uniform);
    });
  });

  frag.addFunction(getClipPlaneFloat);

  frag.addFunction(calcClipPlaneDist);
  frag.addUniform("s_clipSampler", VariableType.Sampler2D, (program) => {
    program.addGraphicUniform("s_clipSampler", (uniform, params) => {
      const texture = params.target.uniforms.branch.clipStack.texture;
      assert(texture !== undefined);
      if (texture !== undefined)
        texture.bindSampler(uniform, TextureUnit.ClipVolume);
    });
  }, VariablePrecision.High);

  frag.set(FragmentShaderComponent.ApplyClipping, applyClipPlanes);

  // modify translucent shaders
  if (frag.findFunction(computeAlphaWeight))
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
}
