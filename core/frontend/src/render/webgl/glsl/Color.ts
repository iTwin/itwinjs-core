/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import {
  ProgramBuilder,
  VariableType,
  FragmentShaderComponent,
} from "../ShaderBuilder";
import { LUTGeometry } from "../CachedGeometry";
import { GLSLFragment } from "./Fragment";
import { addRenderPass } from "./RenderPass";

// Vertex
const computeElementColor = `
  // Color table is appended to vertex data. Compute the index of the vertex one-past-the-end of the vertex data
  float colorTableStart = u_vertParams.z * u_vertParams.w; // num rgba per-vertex times num vertices
  float colorIndex = decodeUInt16(g_vertexData2);
  vec2 tc = computeLUTCoords(colorTableStart+colorIndex, u_vertParams.xy, g_vert_center, 1.0);
  vec4 color = mix(u_color, TEXTURE(u_vertLUT, tc), extractShaderBit(kShaderBit_NonUniformColor));
`;
const computeBaseAlpha = `
  g_baseAlpha = color.a;
`;
const adjustAndReturnColor = `
  // If in opaque pass, un-premultiply any alpha
  float inOpaquePass = float(kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  color = mix(color, adjustPreMultipliedAlpha(color, 1.0), inOpaquePass);
  return color;
`;

const computeColor = computeElementColor + adjustAndReturnColor;
const computeSurfaceColor = computeElementColor + computeBaseAlpha + adjustAndReturnColor;

// Fragment
const computeBaseColor = "return v_color;";

export function addColor(builder: ProgramBuilder, forwardBaseAlpha: boolean = false) {
  // ShaderSource::AddRenderPass
  builder.vert.addUniform("u_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const lutGeom = params.geometry as LUTGeometry;
      const color = lutGeom.getColor(params.target);
      if (color.isUniform) {
        const rgba = color.uniform;
        uniform.setUniform4fv(new Float32Array([rgba.red, rgba.green, rgba.blue, rgba.alpha]));
      }
    });
  });
  builder.vert.addFunction(GLSLFragment.adjustPreMultipliedAlpha);

  if (forwardBaseAlpha)
    builder.addGlobal("g_baseAlpha", VariableType.Float);

  addRenderPass(builder.vert);
  builder.addFunctionComputedVarying("v_color", VariableType.Vec4, "computeColor", forwardBaseAlpha ? computeSurfaceColor : computeColor);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
}
