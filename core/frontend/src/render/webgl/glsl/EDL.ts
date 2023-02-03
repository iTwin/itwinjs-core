/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { EDLCalcBasicGeometry, EDLCalcFullGeometry, EDLFilterGeometry, EDLMixGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { assignFragColor } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

// This shader calculates a more basic version of EDL, and only for the original size, so single pass
const calcBasicEDL = `
    float strength = u_pointCloudEDL1.x;
    float scaleFactor = u_pointCloudEDL1.z;
    float pixRadius = u_pointCloudEDL1.y;
    vec2 invTexSize = u_texInfo.xy;
    float is3d = u_pointCloudEDL1.w;

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
            sum += max(0.0, (is3d > 0.5) ? depth - zN : log (depth/zN));
        }
        float f = sum / 8.0;
        f = exp(-f * 33.5 * strength * scaleFactor); // 33.5 factor to aim for a typical (unfactored) strength of 5
        return vec4(f * color.rgb, 1.0);
    }
`;

/** @internal */
export function createEDLCalcBasicProgram(context: WebGL2RenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, calcBasicEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_texInfo", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_texInfo", (uniform, params) => {
      const geom = params.geometry as EDLCalcBasicGeometry;
      uniform.setUniform3fv(geom.texInfo);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcBasicGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcBasicGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLCalcBasic";
  builder.frag.headerComment = "//!F! EDLCalcBasic";

  return builder.buildProgram(context);
}

// This shader calculates the full version of EDL, and can be run at full, 1/2 and 1/4 scale
const calcFullEDL = `
    float strength = u_pointCloudEDL1.x;
    float scaleFactor = u_pointCloudEDL1.z;
    float pixRadius = u_pointCloudEDL1.y;
    float scale = u_texInfo.z;  // 1, 2, 4
    vec2 invTexSize = u_texInfo.xy;
    float is3d = u_pointCloudEDL1.w;

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
            sum += max(0.0, (is3d > 0.5) ? depth - zN : log (depth/zN)) / scale;
        }
        float f = sum / 8.0;
        f = exp(-f * 33.5 * strength * scaleFactor); // 33.5 factor to aim for a typical (unfactored) strength of 5
        return vec4(f * color.rgb, 1.0);
    }
`;

/** @internal */
export function createEDLCalcFullProgram(context: WebGL2RenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, calcFullEDL);
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

  builder.vert.headerComment = "//!V! EDLCalcFull";
  builder.frag.headerComment = "//!F! EDLCalcFull";

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
export function createEDLFilterProgram(context: WebGL2RenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

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
export function createEDLMixProgram(context: WebGL2RenderingContext): ShaderProgram {
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
