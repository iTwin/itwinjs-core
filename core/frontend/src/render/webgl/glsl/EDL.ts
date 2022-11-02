/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { EDLCalcEnhGeometry, EDLCalcFullGeometry, EDLFilterGeometry, EDLMixGeometry, EDLSimpleGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { assignFragColor } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

const neighborContribution = `
vec2 neighborContribution(float depth, vec2 offset) {
    vec2 depthAndFlag;
    depthAndFlag.x = TEXTURE(u_depthTexture, v_texCoord + offset).r;
    depthAndFlag.y = TEXTURE(u_colorTexture, v_texCoord + offset).a;
    return (depthAndFlag.y == 0.0) ? vec2(0.0, 0.0) : vec2(max(0.0, depth - depthAndFlag.x), 1.0);
}
`;

// This shader calculates a simpler, quicker version of EDL
const computeSimpleEDL = `
  float strength = u_pointCloudEDL1.x;
  float pixRadius = u_pointCloudEDL1.y;

  vec4 color = TEXTURE(u_colorTexture, v_texCoord);
  if (color.a == 0.0)
      discard;
  else {
      float depth = TEXTURE(u_depthTexture, v_texCoord).r;

      // sample from neighbors up, down, left, right
      vec2 off = pixRadius * u_invScreenSize;
      vec2 responseAndCount = vec2(0.0, 0.0);
      responseAndCount += neighborContribution(depth, vec2(0, off.y));
      responseAndCount += neighborContribution(depth, vec2(off.x, 0));
      responseAndCount += neighborContribution(depth, vec2(0, -off.y));
      responseAndCount += neighborContribution(depth, vec2(-off.x, 0));

      float response = responseAndCount.x / responseAndCount.y;
      float shade = exp(-response * 300.0 * strength);
      color.rgb *= shade;
  }
  return color;
`;

/** @internal */
export function createEDLSimpleProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addFunction(neighborContribution);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeSimpleEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_invScreenSize", (uniform, params) => {
      params.target.uniforms.viewRect.bindInverseDimensions(uniform);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLSimpleGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLSimpleGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLSimple";
  builder.frag.headerComment = "//!F! EDLSimple";

  return builder.buildProgram(context);
}

// This shader calculates a more advanced version of EDL, but only for original size
const calcAdv1EDL = `
    float strength = u_pointCloudEDL1.x;
    float pixRadius = u_pointCloudEDL1.y;
    vec2 invTexSize = u_texInfo.xy;

    vec4 color = TEXTURE(u_colorTexture, v_texCoord);
    if (color.a == 0.0)
        discard;
    else {
        const vec2 neighbors[8] = vec2[8] (  //neighbor relative position
            vec2( 1.0, 0.0), vec2( 0.70710678,  0.70710678), vec2(0.0,  1.0), vec2(-0.70710678,  0.70710678),
            vec2(-1.0, 0.0), vec2(-0.70710678, -0.70710678), vec2(0.0, -1.0), vec2( 0.70710678, -0.70710678));
        float depth = TEXTURE(u_depthTexture, v_texCoord).r;
        float sum = 0.0;
        vec2 posScale = pixRadius * invTexSize;
        // contribution of each neighbor
        // NOTE: this is currently using neighbor depths regardless of if they were written by point cloud
        for (int c = 0; c < 8; c++) {
            vec2 nRelPos = posScale * neighbors[c];
            vec2 nPos = v_texCoord + nRelPos;
            float zN = TEXTURE(u_depthTexture, nPos).r;  // neighbor depth
            sum += max(0.0, depth - zN);
        }
        float f = sum / 8.0;
        f = exp(-f * 300.0 * strength);
        return vec4(f * color.rgb, 1.0);
    }
`;

/** @internal */
export function createEDLCalcAdv1Program(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, calcAdv1EDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_texInfo", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_texInfo", (uniform, params) => {
      const geom = params.geometry as EDLCalcEnhGeometry;
      uniform.setUniform3fv(geom.texInfo);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcEnhGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcEnhGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLCalcAdv1";
  builder.frag.headerComment = "//!F! EDLCalcAdv1";

  return builder.buildProgram(context);
}

// This shader calculates a more advanced version of EDL, and can be run at full, 1/2 and 1/4 scale
const calcAdv2EDL = `
    float strength = u_pointCloudEDL1.x;
    float pixRadius = u_pointCloudEDL1.y;
    float scale = u_texInfo.z;  // 1, 2, 4
    vec2 invTexSize = u_texInfo.xy;

    vec4 color = TEXTURE(u_colorTexture, v_texCoord);
    if (color.a == 0.0)
        return color;
    else {
        const vec2 neighbors[8] = vec2[8] (  //neighbor relative position
            vec2( 1.0, 0.0), vec2( 0.70710678,  0.70710678), vec2(0.0,  1.0), vec2(-0.70710678,  0.70710678),
            vec2(-1.0, 0.0), vec2(-0.70710678, -0.70710678), vec2(0.0, -1.0), vec2( 0.70710678, -0.70710678));
        float depth = TEXTURE(u_depthTexture, v_texCoord).r;
        float sum = 0.0;
        vec2 posScale = pixRadius * invTexSize;
        // contribution of each neighbor
        // NOTE: this is currently using neighbor depths regardless of if they were written by point cloud
        for (int c = 0; c < 8; c++) {
            vec2 nRelPos = posScale * neighbors[c];
            vec2 nPos = v_texCoord + nRelPos;
            float zN = TEXTURE(u_depthTexture, nPos).r;  // neighbor depth
            sum += max(0.0, depth - zN) / scale;
        }
        float f = sum / 8.0;
        f = exp(-f * 300.0 * strength);
        return vec4(f * color.rgb, 1.0);
    }
`;

/** @internal */
export function createEDLCalcAdv2Program(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, calcAdv2EDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_texInfo", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_texInfo", (uniform, params) => {
      const geom = params.geometry as EDLCalcFullGeometry;
      uniform.setUniform3fv(geom.texInfo);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcFullGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcFullGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLCalcAdv2";
  builder.frag.headerComment = "//!F! EDLCalcAdv2";

  return builder.buildProgram(context);
}

// This shader filters the EDL image, and can be run at 1/2 and 1/4 scale
const filterEDL = `
    // NB: this bilateral filter hardcodes spatialSigma to 2.0 and depthSigma to 0.4, with halfSize = 2
    float distCoefs[] = float[] (
        1.0, 0.9692332344763441, 0.8824969025845955, 0.9692332344763441, 0.9394130628134758,
        0.8553453273074225, 0.8824969025845955, 0.8553453273074225, 0.8553453273074225, 0.7788007830714049);
    const float depthSigma = 0.4;
    vec2 invTexSize = u_texInfo.xy;

    float depth = TEXTURE(u_depthTexture, v_texCoord).r;
    float wsum = 0.0;  // sum of all weights
    vec3  csum = vec3(0.0);  // sum of all contributions
    vec2  coordi = vec2(0.0, 0.0);  // ith neighbor position x,y

    for (int c = -2; c <= 2; c++) {
        coordi.x = float(c) * invTexSize.x;
        int cabs = (c < 0) ? -c : c;

        for (int d = -2; d <= 2; d++) {
            coordi.y = float(d) * invTexSize.y;
            vec4 ci = TEXTURE(u_colorTexture, v_texCoord + coordi); // neighbor color

            //pixel distance based damping
            int dabs = (d < 0) ? -d : d;
            float fi = distCoefs[cabs * 3 + dabs];

            //pixel depth difference based damping
            float zi = TEXTURE(u_depthTexture, v_texCoord + coordi).r; // neighbor depth
            float dz = (depth - zi) / depthSigma;
            fi *= exp(-dz * dz / 2.0);

            csum += ci.rgb * fi;
            wsum += fi;
        }
    }
    return vec4(csum / wsum, 1.0);
`;

/** @internal */
export function createEDLFilterProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addFunction(neighborContribution);
  frag.set(FragmentShaderComponent.ComputeBaseColor, filterEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_texInfo", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_texInfo", (uniform, params) => {
      const geom = params.geometry as EDLFilterGeometry;
      uniform.setUniform3fv(geom.texInfo);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLFilterGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLFilterGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  builder.vert.headerComment = "//!V! EDLFilter";
  builder.frag.headerComment = "//!F! EDLFilter";

  return builder.buildProgram(context);
}

// This shader mixes the 3 EDL images into the final image
const mixEDL = `
  vec4 col1 = TEXTURE(u_colorTexture1, v_texCoord);
  if (col1.a == 0.0)
      discard;
  else {
      vec3 col2 = TEXTURE(u_colorTexture2, v_texCoord).rgb;
      vec3 col4 = TEXTURE(u_colorTexture4, v_texCoord).rgb;
      return vec4 ((u_weights.x * col1.rgb + u_weights.y * col2 + u_weights.z * col4) / (u_weights.x + u_weights.y + u_weights.z), 1.0);
  }
`;

/** @internal */
export function createEDLMixProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, mixEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_colorTexture1", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture1", (uniform, params) => {
      const geom = params.geometry as EDLMixGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture1, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_colorTexture2", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture2", (uniform, params) => {
      const geom = params.geometry as EDLMixGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture2, TextureUnit.One);
    });
  });

  frag.addUniform("u_colorTexture4", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture4", (uniform, params) => {
      const geom = params.geometry as EDLMixGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture4, TextureUnit.Two);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_weights", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_weights", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL2(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLMix";
  builder.frag.headerComment = "//!F! EDLMix";

  return builder.buildProgram(context);
}
