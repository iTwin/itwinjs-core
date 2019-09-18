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
  VertexShaderComponent,
} from "../ShaderBuilder";
import { addInstanceColor } from "./Instancing";

// Vertex
// Color table is appended to vertex data. Compute the index of the vertex one-past-the-end of the vertex data
// NB: Color in color table has pre-multiplied alpha - revert it.
const computeElementColor = `
  float colorTableStart = u_vertParams.z * u_vertParams.w; // num rgba per-vertex times num vertices
  float colorIndex = decodeUInt16(g_vertexData2);
  vec2 tc = computeLUTCoords(colorTableStart+colorIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 lutColor = TEXTURE(u_vertLUT, tc);
  lutColor.rgb /= max(0.0001, lutColor.a);
  vec4 color = mix(u_color, lutColor, extractShaderBit(kShaderBit_NonUniformColor));
`;
const computeBaseAlpha = `
  g_baseAlpha = color.a;
`;
const returnColor = `
  return color;
`;
const applyInstanceColor = `
  color.rgb = mix(color.rgb, a_instanceRgba.rgb / 255.0, u_applyInstanceColor * extractInstanceBit(kOvrBit_Rgb));
  color.a = mix(color.a, a_instanceRgba.a / 255.0, u_applyInstanceColor * extractInstanceBit(kOvrBit_Alpha));
`;

const computeInstancedElementColor = computeElementColor + applyInstanceColor;
const computeColor = computeElementColor + returnColor;
const computeInstancedColor = computeInstancedElementColor + returnColor;
const computeSurfaceColor = computeElementColor + computeBaseAlpha + returnColor;
const computeInstancedSurfaceColor = computeInstancedElementColor + computeBaseAlpha + returnColor;

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
  builder.vert.addUniform("u_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const lutGeom = params.geometry.asLUT!;
      const color = lutGeom.getColor(params.target);
      if (color.isUniform) {
        color.uniform.bind(uniform);
      }
    });
  });

  if (forwardBaseAlpha)
    builder.addGlobal("g_baseAlpha", VariableType.Float);

  builder.addVarying("v_color", VariableType.Vec4);
  builder.vert.set(VertexShaderComponent.ComputeBaseColor, getComputeColor(builder.vert, forwardBaseAlpha));

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
}
