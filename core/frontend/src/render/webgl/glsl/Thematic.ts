/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ThematicDisplayMode, ThematicGradientMode } from "@bentley/imodeljs-common";
import { FragmentShaderComponent, ProgramBuilder, ShaderBuilder, VariableType } from "../ShaderBuilder";
import { System } from "../System";
import { unpackFloat } from "./Clipping";
import { addRenderPass } from "./RenderPass";
import { addInstancedRtcMatrix, addProjectionMatrix } from "./Vertex";
import { TextureUnit } from "../RenderFlags";

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

// Convert a thematic index to an index that takes into account a stepped gradient texture.
// A stepped gradient texture is arranged like this: {single color pixel for each color step}..., {U=1; marginColor}
// The dimension of a stepped gradient texture is stepCount + 1.
const getSteppedIndex = `
float getSteppedIndex(float ndxIn, float stepCount) {
  if (ndxIn < 0.0 || ndxIn > 1.0)
    return 1.0;

  float ndxOut = clamp(ndxIn, 0.0, 1.0);
  float max = 1.0 - 1.0 / (stepCount + 1.0);
  return ndxOut * max;
}
`;

// Convert a thematic index to an index that takes into account a stepped gradient texture specifically for isolines.
// The texture format is exactly as described above for stepped mode.  We just access the gradient differently,
// specifically to ensure that the texels sampled result in lines of overall singular colors - no stepping into the
// neighboring bands.
const getIsoLineIndex = `
float getIsoLineIndex(float ndxIn, float stepCount) {
  if (ndxIn < 0.01 || ndxIn > 0.99)
    return 1.0;

  return clamp(ndxIn, 1.0 / (stepCount + 1.0), 1.0);
}
`;

// Convert a thematic index to an index that takes into account a smooth gradient texture.
// A smooth gradient texture is arranged like this: {U=0; marginColor}, {smoothed color pixel along entire texture dimensions}..., {U=1; marginColor}
// The dimension of a smoothed gradient texture is system maximum texture size.
const getSmoothIndex = `
float getSmoothIndex(float ndxIn) {
  return clamp(ndxIn, 0.0, 1.0);
}
`;

const fwidthWhenAvailable = `float _universal_fwidth(float coord) { return fwidth(coord); }`;
const fwidthWhenNotAvailable = `float _universal_fwidth(float coord) { return coord; }`; // ###TODO: can we do something reasonable in this case?

// Access the gradient texture for the calculated index.
const applyThematicHeight = `
float ndx = v_thematicIndex;

if (kThematicDisplayMode_InverseDistanceWeightedSensors == u_thematicDisplayMode) {
  float sensorSum = 0.0;
  float contributionSum = 0.0;

  vec3 sensorPos;
  float sensorValue;
  float sensorWeight;

  ndx = -1.0; // default index = marginColor

  float distanceCutoff = u_thematicSettings.y;

  for (int i = 0; i < 8192; i++) { // ###TODO: set maximum number of sensors during an incremental form of shader construction
    if (i >= u_numSensors)
      break;

    vec4 sensor = getSensor(i);

    float dist = distance(v_eyeSpace, sensor.xyz);

    bool skipThisSensor = (distanceCutoff > 0.0 && dist > distanceCutoff);
    if (!skipThisSensor) {
      float contribution = 1.0 / pow(dist, 2.0);
      sensorSum += sensor.w * contribution;
      contributionSum += contribution;
    }
  }

  if (contributionSum > 0.0) // avoid division by zero
    ndx = sensorSum / contributionSum;
}

float gradientMode = u_thematicSettings.x;
float stepCount = u_thematicSettings.z;

if (kThematicGradientMode_Smooth == gradientMode)
  ndx = getSmoothIndex(ndx);
else if (kThematicGradientMode_IsoLines == gradientMode)
  ndx = getIsoLineIndex(ndx, stepCount);
else // stepped / stepped delimiter
  ndx = getSteppedIndex(ndx, stepCount);

vec4 rgba = vec4(TEXTURE(s_texture, vec2(0.0, ndx)).rgb, baseColor.a);

if (kThematicGradientMode_IsoLines == gradientMode) {
  float coord = v_thematicIndex * stepCount;
  float line = abs(fract(coord - 0.5) - 0.5) / _universal_fwidth(coord);
  rgba.a = 1.0 - min(line, 1.0);
} else if (kThematicGradientMode_SteppedWithDelimiter == gradientMode) {
  float coord = v_thematicIndex * stepCount;
  float line = abs(fract(coord - 0.5) - 0.5) / _universal_fwidth(coord);
  float value = min(line, 1.0);
  rgba.rgb *= value;
}

return rgba;
`;

// Compute the value for the varying to be interpolated to the fragment shader in order to access the color in the thematic gradient texture
// We will project a vector onto another vector using this equation: proju = (v . u) / (v . v) * v
export function getComputeThematicIndex(instanced: boolean): string {
  const modelPos = instanced ? "(g_instancedRtcMatrix * rawPosition).xyz" : "rawPosition.xyz";
  return `
  if (kThematicDisplayMode_Height == u_thematicDisplayMode) {
    vec3 u = u_modelToWorld + ` + modelPos + `;
    vec3 v = u_thematicAxis;
    vec3 proju = (dot(v, u) / dot(v, v)) * v;
    vec3 a = v * u_thematicRange.s;
    vec3 b = v * u_thematicRange.t;
    vec3 c = proju;
    v_thematicIndex = findFractionalPositionOnLine(a, b, c);
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

function addThematicGradientModeConstants(builder: ShaderBuilder) {
  builder.addDefine("kThematicGradientMode_Smooth", ThematicGradientMode.Smooth.toFixed(1));
  builder.addDefine("kThematicGradientMode_Stepped", ThematicGradientMode.Stepped.toFixed(1));
  builder.addDefine("kThematicGradientMode_SteppedWithDelimiter", ThematicGradientMode.SteppedWithDelimiter.toFixed(1));
  builder.addDefine("kThematicGradientMode_IsoLines", ThematicGradientMode.IsoLines.toFixed(1));
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

  addThematicGradientModeConstants(builder.frag);

  addThematicDisplayModeConstants(builder.frag);
  addThematicDisplayModeConstants(builder.vert);

  builder.addUniform("u_thematicDisplayMode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_thematicDisplayMode", (uniform, params) => {
      params.target.uniforms.thematic.bindDisplayMode(uniform);
    });
  });

  // gradientMode, distanceCutoff, stepCount
  frag.addUniform("u_thematicSettings", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_thematicSettings", (uniform, params) => {
      params.target.uniforms.thematic.bindFragSettings(uniform);
    });
  });

  frag.addUniform("u_numSensors", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_numSensors", (uniform, params) => {
      if (params.target.wantThematicSensors) {
        if (params.target.uniforms.thematic.wantGlobalSensorTexture)
          params.target.uniforms.thematic.bindNumSensors(uniform);
        else // we are batching separate sensor textures per-tile; use the number of sensors from the batch
          params.target.uniforms.batch.bindNumThematicSensors(uniform);
      } else {
        uniform.setUniform1i(0);
      }
    });
  });

  frag.addUniform("s_sensorSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_sensorSampler", (uniform, params) => {
      if (params.target.wantThematicSensors) {
        if (params.target.uniforms.thematic.wantGlobalSensorTexture) {
          params.target.uniforms.thematic.bindSensors(uniform);
        } else { // we are batching separate sensor textures per-tile; bind the batch's sensor texture
          params.target.uniforms.batch.bindThematicSensors(uniform);
        }
      } else {
        System.instance.ensureSamplerBound(uniform, TextureUnit.ThematicSensors);
      }
    });
  });

  const isWebGL2 = System.instance.capabilities.isWebGL2;
  if (isWebGL2) {
    frag.addFunction(fwidthWhenAvailable);
  } else if (System.instance.capabilities.supportsStandardDerivatives) {
    frag.addExtension("GL_OES_standard_derivatives");
    frag.addFunction(fwidthWhenAvailable);
  } else {
    frag.addFunction(fwidthWhenNotAvailable);
  }

  if (System.instance.capabilities.supportsTextureFloat) {
    frag.addFunction(getSensorFloat);
  } else {
    frag.addFunction(unpackFloat);
    frag.addFunction(unpackSensor);
  }

  frag.addFunction(getSmoothIndex);
  frag.addFunction(getSteppedIndex);
  frag.addFunction(getIsoLineIndex);

  frag.set(FragmentShaderComponent.ApplyThematicDisplay, applyThematicHeight);
}
