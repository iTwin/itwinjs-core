/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import {
  FragmentShaderComponent,
  ProgramBuilder,
  VariableType,
  VertexShaderBuilder,
} from "../ShaderBuilder";
import { GLSLFragment } from "./Fragment";
import { addRenderPass } from "./RenderPass";
import { addInstanceColor } from "./Instancing";

// Vertex
// Color table is appended to vertex data. Compute the index of the vertex one-past-the-end of the vertex data
const computeElementColor = `
  float colorTableStart = u_vertParams.z * u_vertParams.w; // num rgba per-vertex times num vertices
  float colorIndex = decodeUInt16(g_vertexData2);
  vec2 tc = computeLUTCoords(colorTableStart+colorIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 color = mix(u_color, TEXTURE(u_vertLUT, tc), extractShaderBit(kShaderBit_NonUniformColor));
`;
const computeBaseAlpha = `
  g_baseAlpha = color.a;
`;
// If in opaque pass, un-premultiply any alpha
const adjustAndReturnColor = `
  float inOpaquePass = float(kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  color = mix(color, adjustPreMultipliedAlpha(color, 1.0), inOpaquePass);
  return color;
`;
const applyInstanceColor = `
  color.rgb /= max(0.0001, color.a); // revert pre-multiplied alpha
  color.rgb = mix(color.rgb, a_instanceRgba.rgb / 255.0, extractInstanceBit(kOvrBit_Rgb));
  color.a = mix(color.a, a_instanceRgba.a / 255.0, extractInstanceBit(kOvrBit_Alpha));
  color.rgb *= color.a; // pre-multiply alpha
`;

const computeInstancedElementColor = computeElementColor + applyInstanceColor;
const computeColor = computeElementColor + adjustAndReturnColor;
const computeInstancedColor = computeInstancedElementColor + adjustAndReturnColor;
const computeSurfaceColor = computeElementColor + computeBaseAlpha + adjustAndReturnColor;
const computeInstancedSurfaceColor = computeInstancedElementColor + computeBaseAlpha + adjustAndReturnColor;

function getComputeColor(vert: VertexShaderBuilder, forwardBaseAlpha: boolean): string {
  if (vert.usesInstancedGeometry) {
    addInstanceColor(vert);
    return forwardBaseAlpha ? computeInstancedSurfaceColor : computeInstancedColor;
  } else {
    return forwardBaseAlpha ? computeSurfaceColor : computeColor;
  }
}

// Fragment
const computeBaseColor = "return v_color;";

/** @internal */
export function addColor(builder: ProgramBuilder, forwardBaseAlpha: boolean = false) {
  // ShaderSource::AddRenderPass
  builder.vert.addUniform("u_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const lutGeom = params.geometry.asLUT!;
      const color = lutGeom.getColor(params.target);
      if (color.isUniform) {
        color.uniform.bind(uniform);
      }
    });
  });
  builder.vert.addFunction(GLSLFragment.adjustPreMultipliedAlpha);

  if (forwardBaseAlpha)
    builder.addGlobal("g_baseAlpha", VariableType.Float);

  addRenderPass(builder.vert);
  builder.addFunctionComputedVarying("v_color", VariableType.Vec4, "computeColor", getComputeColor(builder.vert, forwardBaseAlpha));

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
}
