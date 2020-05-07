/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ThematicDisplayMode } from "@bentley/imodeljs-common";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, ShaderBuilder, VariableType } from "../ShaderBuilder";
import { System } from "../System";
import { unpackFloat } from "./Clipping";
import { addRenderPass } from "./RenderPass";
import { addInstancedRtcMatrix, addProjectionMatrix } from "./Vertex";

const getSensorFloat = `
  vec4 getSensor(int index) {
    float x = 0.5;
    float y = (float(index) + 0.5) / float(u_numSensors);
    return TEXTURE(s_sensorSampler, vec2(x, y));
  }
`;

const unpackSensor = `
  vec4 getSensor(int index) {
    float y = (float(index) + 0.5) / float(u_numSensors);
    float sx = 0.25;
    vec2 tc = vec2(0.125, y);
    float posX = unpackFloat(TEXTURE(s_sensorSampler, tc));
    tc.x += sx;
    float posY = unpackFloat(TEXTURE(s_sensorSampler, tc));
    tc.x += sx;
    float posZ = unpackFloat(TEXTURE(s_sensorSampler, tc));
    tc.x += sx;
    float value = unpackFloat(TEXTURE(s_sensorSampler, tc));
    return vec4(posX, posY, posZ, value);
  }
`;

// Access the gradient texture for the calculated index.
const applyThematicHeight = `
float ndx;
if (kThematicDisplayMode_Height == u_thematicDisplayMode) {
  ndx = clamp(v_thematicIndex.x, 0.0, 1.0);
} else { // kThematicDisplayMode_InverseDistanceWeightedSensors
  float sensorSum = 0.0;
  float contributionSum = 0.0;

  vec3 sensorPos;
  float sensorValue;
  float sensorWeight;

  ndx = 0.0;

  for (int i = 0; i < 8192; i++) { // ###TODO: set maximum number of sensors during an incremental form of shader construction
    if (i >= u_numSensors)
      break;

    vec4 sensor = getSensor(i);

    float dist = distance(v_thematicIndex, sensor.xyz);
    float contribution = 1.0 / pow(dist, 2.0);
    sensorSum += sensor.w * contribution;
    contributionSum += contribution;
  }

  ndx = sensorSum / contributionSum;
}

return vec4(TEXTURE(s_texture, vec2(0.0, ndx)).rgb, baseColor.a);
`;

// Compute the value for the varying to be interpolated to the fragment shader in order to access the color in the thematic gradient texture
// We will project a vector onto another vector using this equation: proju = (v . u) / (v . v) * v
export function getComputeThematicIndex(instanced: boolean): string {
  const modelPos = instanced ? "(g_instancedRtcMatrix * rawPosition).xyz" : "rawPosition.xyz";
  return `
  vec3 u = u_modelToWorld + ` + modelPos + `;

  if (kThematicDisplayMode_Height == u_thematicDisplayMode) {
    vec3 v = u_thematicAxis;
    vec3 proju = (dot(v, u) / dot(v, v)) * v;
    vec3 a = v * u_thematicRange.s;
    vec3 b = v * u_thematicRange.t;
    vec3 c = proju;
    v_thematicIndex = vec3(findFractionalPositionOnLine(a, b, c), 0.0, 0.0);
  } else { // kThematicDisplayMode_InverseDistanceWeightedSensors
    v_thematicIndex = u;
  }
  `;
}

// Determine the fractional position of c on line segment ab.  Assumes the three points are aligned on the same axis.
const findFractionalPositionOnLine = `
float abDist = distance(a, b);
return dot(b - a, c - a) / (abDist * abDist);
`;

function addThematicDisplayModeConstants(builder: ShaderBuilder) {
  builder.addDefine("kThematicDisplayMode_Height", ThematicDisplayMode.Height.toFixed(1));
  builder.addDefine("kThematicDisplayMode_InverseDistanceWeightedSensors", ThematicDisplayMode.InverseDistanceWeightedSensors.toFixed(1));
}

/** @internal */
export function addThematicDisplay(builder: ProgramBuilder) {
  const frag = builder.frag;
  const vert = builder.vert;

  addRenderPass(builder.frag);

  addProjectionMatrix(vert);
  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);

  vert.addFunction("float findFractionalPositionOnLine(vec3 a, vec3 b, vec3 c)", findFractionalPositionOnLine);

  vert.addUniform("u_modelToWorld", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_modelToWorld", (uniform, params) => {
      params.target.uniforms.branch.bindModelToWorldTransform(uniform, params.geometry, false);
    });
  });

  vert.addUniform("u_thematicRange", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_thematicRange", (uniform, params) => {
      params.target.uniforms.thematic.bindRange(uniform);
    });
  });

  vert.addUniform("u_thematicAxis", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_thematicAxis", (uniform, params) => {
      params.target.uniforms.thematic.bindAxis(uniform);
    });
  });

  addThematicDisplayModeConstants(builder.frag);
  addThematicDisplayModeConstants(builder.vert);

  builder.addUniform("u_thematicDisplayMode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_thematicDisplayMode", (uniform, params) => {
      params.target.uniforms.thematic.bindDisplayMode(uniform);
    });
  });

  frag.addUniform("u_numSensors", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_numSensors", (uniform, params) => {
      params.target.uniforms.thematic.bindNumSensors(uniform);
    });
  });

  frag.addUniform("s_sensorSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_sensorSampler", (uniform, params) => {
      params.target.uniforms.thematic.bindSensors(uniform, TextureUnit.ThematicSensors);
    });
  });

  if (System.instance.capabilities.supportsTextureFloat) {
    frag.addFunction(getSensorFloat);
  } else {
    frag.addFunction(unpackFloat);
    frag.addFunction(unpackSensor);
  }

  frag.set(FragmentShaderComponent.ApplyThematicDisplay, applyThematicHeight);
}
