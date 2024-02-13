/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderBuilder, VertexShaderComponent } from "../ShaderBuilder";
import { addInstanceColor } from "./Instancing";

// Vertex
// Color table is appended to vertex data. Compute the index of the vertex one-past-the-end of the vertex data
// NB: Color in color table has pre-multiplied alpha - revert it.
function getComputeElementColor(quantized: boolean): string {
  const vertData = quantized ? "g_vertLutData1.zw" : "g_vertLutData4.xy";
  return `
  float colorTableStart = u_vertParams.z * u_vertParams.w; // num rgba per-vertex times num vertices
  float colorIndex = decodeUInt16(${vertData});
  vec2 tc = computeLUTCoords(colorTableStart+colorIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 lutColor = TEXTURE(u_vertLUT, tc);
  lutColor.rgb /= max(0.0001, lutColor.a);
  vec4 color = (u_shaderFlags[kShaderBit_NonUniformColor] ? lutColor : u_color);
`;
}

const returnColor = `
  return color;
`;

const applyInstanceColor = `
  color.rgb = mix(color.rgb, a_instanceRgba.rgb / 255.0, u_applyInstanceColor * extractInstanceBit(kOvrBit_Rgb));
  color.a = mix(color.a, a_instanceRgba.a / 255.0, u_applyInstanceColor * extractInstanceBit(kOvrBit_Alpha));

  tc = vec2(0.0, 0.125);
  lutColor = TEXTURE(u_vertLUT, tc);
  lutColor.rgb /= max(0.0001, lutColor.a);
  color = (u_shaderFlags[kShaderBit_NonUniformColor] ? lutColor : u_color);
`;

function getComputeColor(vert: VertexShaderBuilder): string {
  const quantized = "quantized" === vert.positionType;
  if (vert.usesInstancedGeometry) {
    addInstanceColor(vert);
    return `${getComputeElementColor(quantized)}${applyInstanceColor}${returnColor}`;
  } else {
    return `${getComputeElementColor(quantized)}${returnColor}`;
  }
}

// Fragment
const computeBaseColor = "return v_color;";

/** @internal */
export function addColor(builder: ProgramBuilder) {
  builder.vert.addUniform("u_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const lutGeom = params.geometry.asLUT!;
      const color = lutGeom.getColor(params.target);
      if (color.isUniform) {
        color.uniform.bind(uniform);
      }
    });
  });
  addVaryingColor(builder, getComputeColor(builder.vert));
}

/** @internal */
export function addVaryingColor(builder: ProgramBuilder, computeVertexBase: string) {
  builder.addVarying("v_color", VariableType.Vec4);
  builder.vert.set(VertexShaderComponent.ComputeBaseColor, computeVertexBase);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
}
