/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { EDLSimpleGeometry } from "../CachedGeometry";
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

  addWindowToTexCoords(frag);

  addRenderOrderConstants(frag);
  frag.addFunction(neighborContribution);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeSimpleEDL);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  frag.addUniform("u_invScreenSize", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_invScreenSize", (uniform, params) => {
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
  builder.addUniform("u_pointCloudEDL1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudEDL1", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bindEDL1(uniform);
    });
  });

  builder.vert.headerComment = "//!V! EDLSimple";
  builder.frag.headerComment = "//!F! EDLSimple";

  return builder.buildProgram(context);
}
