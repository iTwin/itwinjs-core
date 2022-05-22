/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { AttributeMap } from "../AttributeMap";
import { EVSMGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, VariablePrecision, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { assignFragColor } from "./Fragment";
import { addEvsmExponent, warpDepth } from "./SolarShadowMapping";

// This shader reads the depth texture, converts it to EVSM values, then averages those down 4 to 1

// Positions are in NDC [-1..1]. Compute UV params in [0..1]
const computeTexCoord = "v_texCoord = (rawPosition.xy + 1.0) * 0.5;";
const computePosition = "return rawPos;";

const computeEVSM = `
  const float sampleWeight = 0.25;
  vec4 average = vec4(0.0);
  vec2 tc = v_texCoord - u_stepSize * 0.5; // v_texCoord starts in between the 4 texels

  float depth = TEXTURE(u_depthTexture, tc).r;
  vec2 vsmDepth = warpDepth(depth, u_evsmExponent);
  average += sampleWeight * vec4(vsmDepth.xy, vsmDepth.xy * vsmDepth.xy);

  tc.x += u_stepSize.x;
  depth = TEXTURE(u_depthTexture, tc).r;
  vsmDepth = warpDepth(depth, u_evsmExponent);
  average += sampleWeight * vec4(vsmDepth.xy, vsmDepth.xy * vsmDepth.xy);

  tc.y += u_stepSize.y;
  depth = TEXTURE(u_depthTexture, tc).r;
  vsmDepth = warpDepth(depth, u_evsmExponent);
  average += sampleWeight * vec4(vsmDepth.xy, vsmDepth.xy * vsmDepth.xy);

  tc.x -= u_stepSize.x;
  depth = TEXTURE(u_depthTexture, tc).r;
  vsmDepth = warpDepth(depth, u_evsmExponent);
  average += sampleWeight * vec4(vsmDepth.xy, vsmDepth.xy * vsmDepth.xy);

  return average;
`;

/** @internal */
export function createEVSMProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));
  const vert = builder.vert;
  const frag = builder.frag;

  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  builder.addInlineComputedVarying("v_texCoord", VariableType.Vec2, computeTexCoord);

  frag.addUniform("u_depthTexture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_depthTexture", (uniform, params) => {
      const geom = params.geometry as EVSMGeometry;
      Texture2DHandle.bindSampler(uniform, geom.depthTexture, TextureUnit.Zero);
    });
  });

  frag.addUniform("u_stepSize", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_stepSize", (uniform, params) => {
      const geom = params.geometry as EVSMGeometry;
      uniform.setUniform2fv(geom.stepSize);
    });
  }, VariablePrecision.High);

  addEvsmExponent(frag);

  frag.addFunction(warpDepth);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeEVSM);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  builder.vert.headerComment = "//!V! EVSMFromDepth";
  builder.frag.headerComment = "//!F! EVSMFromDepth";

  return builder.buildProgram(context);
}
