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
import { addEyeSpace } from "./Common";

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

// Access a gradient texture at the specified index.
// A stepped gradient texture is arranged with single unique color pixels for each step. The dimension of a stepped gradient texture is stepCount.
// A smooth gradient texture is arranged with blended color pixels across the entire span of the texture. The dimension of a smooth gradient texture is the system's maximum texture size.
const getColor = `
vec3 getColor(float ndx) {
  if (ndx < 0.0 || ndx > 1.0)
    return u_marginColor;

  return TEXTURE(s_texture, vec2(0.0, ndx)).rgb;
}
`;

// Access a stepped gradient texture at the specified index taking into account isolines.
// The texture format is exactly as described above for stepped mode.  We just access the gradient differently,
// specifically to ensure that the texels sampled result in lines of overall singular colors - no stepping into the
// neighboring bands.
const getIsoLineColor = `
vec3 getIsoLineColor(float ndx, float stepCount) {
  if (ndx < 0.01 || ndx > 0.99)
    return u_marginColor;

  ndx += 0.5 / stepCount; // center on step pixels
  return TEXTURE(s_texture, vec2(0.0, ndx)).rgb;
}
`;

const fwidthWhenAvailable = `\nfloat _universal_fwidth(float coord) { return fwidth(coord); }\n`;
const fwidthWhenNotAvailable = `\nfloat _universal_fwidth(float coord) { return coord; }\n`; // ###TODO: can we do something reasonable in this case?

const slopeAndHillShadeShader = ` else if (kThematicDisplayMode_Slope == u_thematicDisplayMode) {
    float d = dot(v_n, u_thematicAxis);
    if (d < 0.0)
      d = -d;

    // The range of d is now 0 to 1 (90 degrees to 0 degrees).
    // However, the range from 0 to 1 is not linear. Therefore, we use acos() to find the actual angle in radians.
    d = acos(d);

    // range of d is currently 1.5708 to 0 radians.
    if (d < u_thematicRange.x || d > u_thematicRange.y)
      d = -1.0; // use marginColor if outside the requested range
    else { // convert d from radians to 0 to 1 using requested range
      d -= u_thematicRange.x;
      d /= (u_thematicRange.y - u_thematicRange.x);
    }

    ndx = d;
  } else if (kThematicDisplayMode_HillShade == u_thematicDisplayMode) {
    float d = dot(v_n, u_thematicSunDirection);

    // In the case of HillShade, v_thematicIndex contains the normal's z in world space.
    if (!gl_FrontFacing && v_thematicIndex < 0.0)
      d = -d;

    ndx = max(0.0, d);
  }`;

// Access the appropriate gradient texel for a particular index based on display mode and gradient mode.
const applyThematicColorPrelude = `
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
  }`;

const applyThematicColorPostlude = `
  float gradientMode = u_thematicSettings.x;
  float stepCount = u_thematicSettings.z;

  vec4 rgba = vec4((kThematicGradientMode_IsoLines == gradientMode) ? getIsoLineColor(ndx, stepCount) : getColor(ndx), baseColor.a);
  rgba = mix(rgba, baseColor, u_thematicColorMix);

  if (kThematicGradientMode_IsoLines == gradientMode) {
    float coord = v_thematicIndex * stepCount;
    float line = abs(fract(coord - 0.5) - 0.5) / _universal_fwidth(coord);
    rgba.a = 1.0 - min(line, 1.0);
    if (u_discardBetweenIsolines && 0.0 == rgba.a)
      discard;
  } else if (kThematicGradientMode_SteppedWithDelimiter == gradientMode) {
    float coord = v_thematicIndex * stepCount;
    float line = abs(fract(coord - 0.5) - 0.5) / _universal_fwidth(coord);
    float value = min(line, 1.0);
    rgba.rgb *= value;
  }

  return rgba;
`;

// fwidth does not function for point clouds, so we work around the limitation with a less-than-ideal rendering of isolines and delimiters
// using a tolerance not based on neighboring fragments.
const delimiterToleranceForPointClouds = `0.025`; // / (stepCount * 40.0)`;
const applyThematicColorPostludeForPointClouds = `
  float gradientMode = u_thematicSettings.x;
  float stepCount = u_thematicSettings.z;

  vec4 rgba = vec4((kThematicGradientMode_IsoLines == gradientMode) ? getIsoLineColor(ndx, stepCount) : getColor(ndx), baseColor.a);
  rgba = mix(rgba, baseColor, u_thematicColorMix);

  if (kThematicGradientMode_IsoLines == gradientMode) {
    float coord = v_thematicIndex * stepCount;
    float line = abs(fract(coord - 0.5) - 0.5);
    if (line > ${delimiterToleranceForPointClouds})
      discard;
  } else if (kThematicGradientMode_SteppedWithDelimiter == gradientMode) {
    float coord = v_thematicIndex * stepCount;
    float line = abs(fract(coord - 0.5) - 0.5);
    float value = min(line, 1.0);
    if (line < ${delimiterToleranceForPointClouds} && value < 1.0)
      rgba.rgb *= 0.0;
  }

  return rgba;
`;

function _getShader(isPointCloud: boolean) {
  return isPointCloud ?
    applyThematicColorPrelude + applyThematicColorPostludeForPointClouds : // do not include slope and hillshade for point clouds
    applyThematicColorPrelude + slopeAndHillShadeShader + applyThematicColorPostlude; // include all modes for everything else
}

// Compute the value for the varying to be interpolated to the fragment shader in order to access the color in the thematic gradient texture
// We will project a vector onto another vector using this equation: proju = (v . u) / (v . v) * v
export function getComputeThematicIndex(instanced: boolean, skipSlopeAndHillShade: boolean, decodeNormal: boolean): string {
  const modelPos = instanced ? "(g_instancedRtcMatrix * rawPosition)" : "rawPosition";
  const heightMode = `
  if (kThematicDisplayMode_Height == u_thematicDisplayMode) {
    vec3 u = (u_modelToWorld * ${modelPos}).xyz;
    vec3 v = u_thematicAxis;
    vec3 proju = (dot(v, u) / dot(v, v)) * v;
    vec3 a = v * u_thematicRange.s;
    vec3 b = v * u_thematicRange.t;
    vec3 c = proju;
    v_thematicIndex = findFractionalPositionOnLine(a, b, c);
  }`;
  const hillShadeMode = ` else if (kThematicDisplayMode_HillShade == u_thematicDisplayMode) {
    vec2 tc = g_vertexBaseCoords;
    tc.x += 3.0 * g_vert_stepX;
    vec4 enc = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
    vec2 normal = u_surfaceFlags[kSurfaceBitIndex_HasColorAndNormal] ? enc.xy : g_vertexData2;
    vec3 norm = u_surfaceFlags[kSurfaceBitIndex_HasNormals] ? octDecodeNormal(normal) : vec3(0.0);
    v_thematicIndex = norm.z;
  }`;
  const hillShadeMode2 = ` else if (kThematicDisplayMode_HillShade == u_thematicDisplayMode) {
    v_thematicIndex = g_hillshadeIndex;
  }`;
  return skipSlopeAndHillShade ? heightMode : heightMode + (decodeNormal ? hillShadeMode : hillShadeMode2);
}

// Determine the fractional position of c on line segment ab.  Assumes the three points are aligned on the same axis.
const findFractionalPositionOnLine = `
  float abDist = distance(a, b);
  return dot(b - a, c - a) / (abDist * abDist);
`;

function addThematicDisplayModeConstants(builder: ShaderBuilder) {
  builder.addDefine("kThematicDisplayMode_Height", ThematicDisplayMode.Height.toFixed(1));
  builder.addDefine("kThematicDisplayMode_InverseDistanceWeightedSensors", ThematicDisplayMode.InverseDistanceWeightedSensors.toFixed(1));
  builder.addDefine("kThematicDisplayMode_Slope", ThematicDisplayMode.Slope.toFixed(1));
  builder.addDefine("kThematicDisplayMode_HillShade", ThematicDisplayMode.HillShade.toFixed(1));
}

function addThematicGradientModeConstants(builder: ShaderBuilder) {
  builder.addDefine("kThematicGradientMode_Smooth", ThematicGradientMode.Smooth.toFixed(1));
  builder.addDefine("kThematicGradientMode_Stepped", ThematicGradientMode.Stepped.toFixed(1));
  builder.addDefine("kThematicGradientMode_SteppedWithDelimiter", ThematicGradientMode.SteppedWithDelimiter.toFixed(1));
  builder.addDefine("kThematicGradientMode_IsoLines", ThematicGradientMode.IsoLines.toFixed(1));
}

/** @internal */
export function addThematicDisplay(builder: ProgramBuilder, isForPointClouds = false, isForTerrainMesh = false) {
  const frag = builder.frag;
  const vert = builder.vert;

  addRenderPass(builder.frag);

  if (!isForPointClouds && !isForTerrainMesh)
    addProjectionMatrix(vert);

  addEyeSpace(builder);

  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);

  vert.addFunction("float findFractionalPositionOnLine(vec3 a, vec3 b, vec3 c)", findFractionalPositionOnLine);

  vert.addUniform("u_modelToWorld", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_modelToWorld", (uniform, params) => {
      params.target.uniforms.branch.bindModelToWorldTransform(uniform, params.geometry, false);
    });
  });

  builder.addUniform("u_thematicRange", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_thematicRange", (uniform, params) => {
      params.target.uniforms.thematic.bindRange(uniform);
    });
  });

  builder.addUniform("u_thematicAxis", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_thematicAxis", (uniform, params) => {
      params.target.uniforms.thematic.bindAxis(uniform);
    });
  });

  if (!isForPointClouds) {
    builder.addUniform("u_thematicSunDirection", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_thematicSunDirection", (uniform, params) => {
        params.target.uniforms.thematic.bindSunDirection(uniform);
      });
    });
  }

  addThematicGradientModeConstants(builder.frag);

  addThematicDisplayModeConstants(builder.frag);
  addThematicDisplayModeConstants(builder.vert);

  builder.addUniform("u_thematicDisplayMode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_thematicDisplayMode", (uniform, params) => {
      params.target.uniforms.thematic.bindDisplayMode(uniform);
    });
  });

  frag.addUniform("u_marginColor", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_marginColor", (uniform, params) => {
      params.target.uniforms.thematic.bindMarginColor(uniform);
    });
  });

  // gradientMode, distanceCutoff, stepCount
  builder.addUniform("u_thematicSettings", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_thematicSettings", (uniform, params) => {
      params.target.uniforms.thematic.bindFragSettings(uniform);
    });
  });

  if (isForPointClouds || isForTerrainMesh) {
    builder.frag.addUniform("u_thematicColorMix", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_thematicColorMix", (uniform, params) => {
        uniform.setUniform1f(params.target.uniforms.thematic.thematicDisplay?.gradientSettings.colorMix || 0.0);
      });
    });
  } else {
    builder.frag.addUniform("u_thematicColorMix", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_thematicColorMix", (uniform, _params) => {
        uniform.setUniform1f(0.0);
      });
    });
  }

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

  if (!isForPointClouds) { // allows us to know when to discard between isolines to make them pickable
    builder.frag.addUniform("u_discardBetweenIsolines", VariableType.Boolean, (prog) => {
      prog.addProgramUniform("u_discardBetweenIsolines", (uniform, params) => {
        uniform.setUniform1i(params.target.isReadPixelsInProgress ? 1 : 0);
      });
    });
  }

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

  frag.addFunction(getColor);
  frag.addFunction(getIsoLineColor);

  frag.set(FragmentShaderComponent.ApplyThematicDisplay, _getShader(isForPointClouds));
}
