/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { EDLCalcGeometry, EDLFilterGeometry, EDLMixGeometry, EDLSimpleGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { addRenderOrderConstants } from "./FeatureSymbology";
import { addWindowToTexCoords, assignFragColor } from "./Fragment";
import { addViewport } from "./Viewport";
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
  vec4 color = TEXTURE(u_colorTexture, v_texCoord);
  if (color.a == 0.0)
      discard;
  else {
      float depth = TEXTURE(u_depthTexture, v_texCoord).r;

      // sample from neighbors up, down, left, right
      vec2 off = u_pointCloudEDL1.y * u_invScreenSize;
      vec2 responseAndCount = vec2(0.0, 0.0);
      responseAndCount += neighborContribution(depth, vec2(0, off.y));
      responseAndCount += neighborContribution(depth, vec2(off.x, 0));
      responseAndCount += neighborContribution(depth, vec2(0, -off.y));
      responseAndCount += neighborContribution(depth, vec2(-off.x, 0));

      float response = responseAndCount.x / responseAndCount.y;
      float shade = exp(-response * 300.0 * u_pointCloudEDL1.x);
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

const computeObscurance = `
float computeObscurance(float depth) {
    vec2 neighbors[8] = vec2[8] (  //neighbor relative position
        vec2( 1.0, 0.0), vec2( 0.70710678,  0.70710678), vec2(0.0,  1.0), vec2(-0.70710678,  0.70710678),
        vec2(-1.0, 0.0), vec2(-0.70710678, -0.70710678), vec2(0.0, -1.0), vec2( 0.70710678, -0.70710678));
    #if 0 // light angle factor
        vec4 p = vec4(u_LightDir.xyz, -dot(u_LightDir.xyz, vec3(0.0, 0.0, depth)));
    #endif
    float sum = 0.0;
    vec2 posScale = u_pointCloudEDL1.y * u_scale * u_invScreenSize;
    // contribution of each neighbor
    // NOTE: this is currently using neighbor depths regardless of if that depth was written by point cloud
    for (int c = 0; c < 8; c++) {
        vec2 nRelPos = posScale * neighbors[c];
        vec2 nPos = v_texCoord + nRelPos;
        float zN = TEXTURE(u_depthTexture, nPos).r;  // neighbor depth
        #if 0 // light angle factor
            vec4 zPos = vec4(nRelPos, zNP, 1.0);
            float zNP = dot(zPos, p);
        #else
            float zNP = depth - zN;
        #endif
        sum += max(0.0, zNP) / u_scale;
    }
    return sum / 8.0; // ###TODO divide by 8 here?
}
`;

// This shader calculates a more advanced version of EDL
const calcEDL = `
  vec4 color = TEXTURE(u_colorTexture, v_texCoord);
  if (color.a == 0.0)
      // return color;
      discard;
  else {
    float depth = TEXTURE(u_depthTexture, v_texCoord).r;
    float f = computeObscurance(depth);
    f = exp(-f * 300.0 * u_pointCloudEDL1.x);
    return vec4(f*color.rgb, 1.0);
  }
`;

/** @internal */
export function createEDLCalcProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addFunction(computeObscurance);
  frag.set(FragmentShaderComponent.ComputeBaseColor, calcEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_scale", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_scale", (uniform, params) => {
      params.target.uniforms.viewRect.bindInverseDimensions(uniform);
      const geom = params.geometry as EDLCalcGeometry;
      uniform.setUniform1f(geom.scale);
    });
  });

  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_invScreenSize", (uniform, params) => {
      params.target.uniforms.viewRect.bindInverseDimensions(uniform);
    });
  });

  frag.addUniform("u_colorTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EDLCalcGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.One);
    });
  });

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLCalc";
  builder.frag.headerComment = "//!F! EDLCalc";

  return builder.buildProgram(context);
}

// This shader filters the EDL image
const filterEDL = `
  vec4 color = TEXTURE(u_colorTexture, v_texCoord);
  if (color.a == 0.0)
      discard;
  else {
      float depth = TEXTURE(u_depthTexture, v_texCoord).r;

      // sample from neighbors up, down, left, right
      vec2 off = u_pointCloudEDL1.y * u_invScreenSize;
      vec2 responseAndCount = vec2(0.0, 0.0);
      responseAndCount += neighborContribution(depth, vec2(0, off.y));
      responseAndCount += neighborContribution(depth, vec2(off.x, 0));
      responseAndCount += neighborContribution(depth, vec2(0, -off.y));
      responseAndCount += neighborContribution(depth, vec2(-off.x, 0));

      float response = responseAndCount.x / responseAndCount.y;
      float shade = exp(-response * 300.0 * u_pointCloudEDL1.x);
      color.rgb *= shade;
  }
  return color;
`;

/** @internal */
export function createEDLFilterProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addFunction(neighborContribution);
  frag.set(FragmentShaderComponent.ComputeBaseColor, filterEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_invScreenSize", (uniform, params) => {
      params.target.uniforms.viewRect.bindInverseDimensions(uniform);
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

  // Uniforms based on the PointCloudDisplaySettings.
  frag.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
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
    prog.addGraphicUniform("u_colorTexture1", (uniform, params) => {
      const geom = params.geometry as EDLMixGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture2, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_colorTexture4", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_colorTexture1", (uniform, params) => {
      const geom = params.geometry as EDLMixGeometry;
      Texture2DHandle.bindSampler(uniform, geom.colorTexture4, TextureUnit.Zero);
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
