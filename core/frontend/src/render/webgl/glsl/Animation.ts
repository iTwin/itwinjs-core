/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { AnalysisStyleDisplacement, AnalysisStyleThematic, ThematicGradientSettings } from "@itwin/core-common";
import { AuxChannel, AuxDisplacementChannel, AuxParamChannel } from "../../primitives/AuxChannelTable";
import { DrawParams } from "../DrawCommand";
import { TextureUnit } from "../RenderFlags";
import { VariableType, VertexShaderBuilder, VertexShaderComponent } from "../ShaderBuilder";
import { IsThematic } from "../TechniqueFlags";
import { octDecodeNormal } from "./Surface";

const initialize = `
  g_anim_step = vec2(1.0) / u_animLUTParams.xy;
  g_anim_center = g_anim_step * 0.5;
`;

// The vertex index is an integer in [0..numVertices].
// The frame index is an integer in [0..numBytesPerVertex/2].
// Therefore each frame index points at 2 bytes within the texture.
// The third component of the return value is 0.0 if the input index points to the first 2 bytes of the texel, or 1.0 if pointing to the second 2 bytes
const computeAnimLUTCoords = `
vec3 computeAnimLUTCoords(float vertIndex, float frameIndex) {
  // float baseIndex = (vertIndex * 2.0) + frameIndex;
  float baseIndex = (vertIndex * u_animLUTParams.z) + frameIndex;
  float halfIndex = baseIndex * 0.5;
  float index = floor(halfIndex);

  float epsilon = 0.5 / u_animLUTParams.x;
  float yId = floor(index / u_animLUTParams.x + epsilon);
  float xId = index - u_animLUTParams.x * yId;

  vec2 texCoord = g_anim_center + vec2(xId / u_animLUTParams.x, yId / u_animLUTParams.y);
  return vec3(texCoord, 2.0 * (halfIndex - index));
}
`;

// Sample 2 bytes at the specified index.
const sampleAnimVec2 = `
vec2 sampleAnimVec2(float vertIndex, float frameIndex) {
  vec3 tc = computeAnimLUTCoords(vertIndex, frameIndex);
  vec4 texel = floor(TEXTURE(u_animLUT, tc.xy) * 255.0 + 0.5);
  return texel.xy * (1.0 - tc.z) + texel.zw * tc.z;
}
`;

// Position is quantized to 6 bytes (2 bytes per component). So we always must sample two adjacent texels. We discard two bytes based on whether the index is even or odd.
const computeAnimationFrameDisplacement = `
vec3 computeAnimationFrameDisplacement(float vertIndex, float frameIndex, vec3 origin, vec3 scale) {
  vec3 tc = computeAnimLUTCoords(vertIndex, frameIndex);
  vec4 enc1 = floor(TEXTURE(u_animLUT, tc.xy) * 255.0 + 0.5);
  tc.x += g_anim_step.x;
  vec4 enc2 = floor(TEXTURE(u_animLUT, tc.xy) * 255.0 + 0.5);

  vec2 ex = enc1.xy * (1.0 - tc.z) + enc1.zw * tc.z;
  vec2 ey = enc1.zw * (1.0 - tc.z) + enc2.xy * tc.z;
  vec2 ez = enc2.xy * (1.0 - tc.z) + enc2.zw * tc.z;

  vec3 qpos = vec3(decodeUInt16(ex), decodeUInt16(ey), decodeUInt16(ez));
  return unquantizePosition(qpos, origin, scale).xyz;
}
`;

const computeAnimationDisplacement = `
vec3 computeAnimationDisplacement(float vertIndex, float frameIndex0, float frameIndex1, float fraction, vec3 origin, vec3 scale) {
  if (frameIndex0 < 0.0)
    return vec3(0.0, 0.0, 0.0);

  vec3 displacement = computeAnimationFrameDisplacement(vertIndex, frameIndex0, origin, scale);
  if (fraction > 0.0) {
    vec3 displacement1 = computeAnimationFrameDisplacement(vertIndex, frameIndex1, origin, scale);
    displacement += fraction * (displacement1 - displacement);
    }

  return displacement;
}
`;

const adjustRawPosition = `
  rawPos.xyz += computeAnimationDisplacement(g_vertexLUTIndex, u_animDispParams.x, u_animDispParams.y, u_animDispParams.z, u_qAnimDispOrigin, u_qAnimDispScale);
  return rawPos;
`;

const computeAnimationFrameNormal = `
vec3 computeAnimationFrameNormal(float frameIndex) {
  vec2 enc = sampleAnimVec2(g_vertexLUTIndex, frameIndex);
  return octDecodeNormal(enc);
}
`;

const computeAnimationNormal = `
vec3 computeAnimationNormal(float frameIndex0, float frameIndex1, float fraction) {
  vec3 normal = computeAnimationFrameNormal(frameIndex0);
  if (fraction > 0.0) {
    vec3 normal1 = computeAnimationFrameNormal(frameIndex1);
    normal += fraction * (normal1 - normal);
    }

  return normal;
}
`;

const computeAnimationFrameParam = `
float computeAnimationFrameParam(float frameIndex, float origin, float scale) {
  vec2 enc = sampleAnimVec2(g_vertexLUTIndex, frameIndex);
  return clamp((origin + scale * decodeUInt16(enc)), 0.0, 1.0);
}
`;

const computeAnimationParam = `
vec2 computeAnimationParam(float frameIndex0, float frameIndex1, float fraction, float origin, float scale) {
  float param = computeAnimationFrameParam(frameIndex0, origin, scale);
  if (fraction > 0.0) {
    float param1 = computeAnimationFrameParam(frameIndex1, origin, scale);
    param += fraction * (param1 - param);
  }

  return vec2(.5, param);
}
`;

const scratchAnimParams = [
  undefined,
  undefined,
  new Float32Array(2), // origin, scale
  new Float32Array(3), // index0, index1, fraction
];

function getAnimParams(size: 2 | 3, initialValue?: number): Float32Array {
  const array = scratchAnimParams[size]!;
  if (undefined !== initialValue)
    for (let i = 0; i < array.length; i++)
      array[i] = initialValue;

  return array;
}

function getDisplacementChannel(params: DrawParams): { channel: AuxDisplacementChannel, displacement: AnalysisStyleDisplacement } | undefined {
  const displacement = params.target.analysisStyle?.displacement;
  if (!displacement)
    return undefined;

  const channel = params.geometry.asLUT?.lut.auxChannels?.displacements?.get(displacement.channelName);
  return channel ? { channel, displacement } : undefined;
}

function getNormalChannel(params: DrawParams): AuxChannel | undefined {
  const channelName = params.target.analysisStyle?.normalChannelName;
  if (undefined === channelName)
    return undefined;

  return params.geometry.asLUT?.lut.auxChannels?.normals?.get(channelName);
}

function getScalarChannel(params: DrawParams): { channel: AuxParamChannel, scalar: AnalysisStyleThematic } | undefined {
  const scalar = params.target.analysisStyle?.thematic;
  if (!scalar)
    return undefined;

  const channel = params.geometry.asMesh?.lut.auxChannels?.params?.get(scalar.channelName);
  return channel ? { channel, scalar } : undefined;
}

function computeAnimParams(params: Float32Array, channel: AuxChannel, fraction: number): void {
  const { inputs, indices } = channel;
  const inputValue = fraction * inputs[inputs.length - 1];
  for (let i = 0; i < inputs.length - 1; i++) {
    if (inputValue >= inputs[i] && inputValue < inputs[i + 1]) {
      params[0] = indices[i];
      params[1] = indices[i + 1];
      params[2] = inputValue - inputs[i] / (inputs[i + 1] - inputs[i]);
      return;
    }
  }
  params[0] = params[1] = indices[inputs.length - 1];
  params[2] = 0.0;
}

/** @internal */
export function addAnimation(vert: VertexShaderBuilder, isSurface: boolean, isThematic: IsThematic): void {
  // Lookup table
  vert.addGlobal("g_anim_step", VariableType.Vec2);
  vert.addGlobal("g_anim_center", VariableType.Vec2);
  vert.addInitializer(initialize);

  vert.addUniform("u_animLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_animLUT", (uniform, params) => {
      const channels = (params.geometry.asLUT!).lut.auxChannels!;
      assert(undefined !== channels);
      channels.texture.bindSampler(uniform, TextureUnit.AuxChannelLUT);
    });
  });

  vert.addUniform("u_animLUTParams", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_animLUTParams", (uniform, params) => {
      const geom = params.geometry.asLUT!;
      assert(undefined !== geom && undefined !== geom.lut.auxChannels);
      const tex = geom.lut.auxChannels.texture;
      const array = getAnimParams(3);
      array[0] = tex.width;
      array[1] = tex.height;
      array[2] = geom.lut.auxChannels.numBytesPerVertex / 2;
      uniform.setUniform3fv(array);
    });
  });

  vert.addFunction(computeAnimLUTCoords);
  vert.addFunction(sampleAnimVec2);

  // Displacement
  vert.addFunction(computeAnimationFrameDisplacement);
  vert.addFunction(computeAnimationDisplacement);
  vert.set(VertexShaderComponent.AdjustRawPosition, adjustRawPosition);

  vert.addUniform("u_animDispParams", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_animDispParams", (uniform, params) => {
      const animParams = getAnimParams(3, 0.0);
      const disp = getDisplacementChannel(params);
      if (undefined !== disp)
        computeAnimParams(animParams, disp.channel, params.target.analysisFraction);

      uniform.setUniform3fv(animParams);
    });
  });
  vert.addUniform("u_qAnimDispScale", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qAnimDispScale", (uniform, params) => {
      const animParams = getAnimParams(3, 0.0);
      const disp = getDisplacementChannel(params);
      if (undefined !== disp)
        for (let i = 0; i < 3; i++)
          animParams[i] = disp.channel.qScale[i] * disp.displacement.scale;

      uniform.setUniform3fv(animParams);
    });
  });
  vert.addUniform("u_qAnimDispOrigin", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qAnimDispOrigin", (uniform, params) => {
      const animParams = getAnimParams(3, 0.0);
      const disp = getDisplacementChannel(params);
      if (undefined !== disp)
        for (let i = 0; i < 3; i++)
          animParams[i] = disp.channel.qOrigin[i] * disp.displacement.scale;

      uniform.setUniform3fv(animParams);
    });
  });

  // Normal and param
  if (isSurface) {
    vert.addFunction(octDecodeNormal);
    vert.addFunction(computeAnimationFrameNormal);
    vert.addFunction(computeAnimationNormal);

    vert.addFunction(computeAnimationFrameParam);
    vert.addFunction(computeAnimationParam);

    vert.addUniform("u_animNormalParams", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_animNormalParams", (uniform, params) => {
        const animParams = getAnimParams(3, -1.0);
        const channel = getNormalChannel(params);
        if (undefined !== channel)
          computeAnimParams(animParams, channel, params.target.analysisFraction);

        uniform.setUniform3fv(animParams);
      });
    });

    if (isThematic === IsThematic.No) {
      vert.addUniform("u_animScalarParams", VariableType.Vec3, (prog) => {
        prog.addGraphicUniform("u_animScalarParams", (uniform, params) => {
          const scalars = getScalarChannel(params);
          const animParams = getAnimParams(3, -1.0);
          if (scalars)
            computeAnimParams(animParams, scalars.channel, params.target.analysisFraction);

          uniform.setUniform3fv(animParams);
        });
      });

      vert.addUniform("u_animScalarQParams", VariableType.Vec2, (prog) => {
        prog.addGraphicUniform("u_animScalarQParams", (uniform, params) => {
          const scalars = getScalarChannel(params);
          const animParams = getAnimParams(2, 1.0);
          if (scalars) {
            const range = scalars.scalar.range;
            let rangeScale = range.high - range.low;
            if (rangeScale === 0)
              rangeScale = 1;

            animParams[0] = ThematicGradientSettings.margin + (scalars.channel.qOrigin - range.low) / rangeScale;
            animParams[1] = ThematicGradientSettings.contentRange * scalars.channel.qScale / rangeScale;
          }

          uniform.setUniform2fv(animParams);
        });
      });
    }
  }
}
