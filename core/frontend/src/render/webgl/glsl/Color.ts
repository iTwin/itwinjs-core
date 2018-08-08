/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
  vec4 color = u_color;
  if (isShaderBitSet(kShaderBit_NonUniformColor)) {
    // Color table is appended to vertex data. Compute the index of the vertex one-past-the-end of the vertex data
    float colorTableStart = u_vertParams.z * u_vertParams.w; // num rgba per-vertex times num vertices
    float colorIndex = decodeUInt16(g_vertexData2);
    vec2 tc = computeLUTCoords(colorTableStart+colorIndex, u_vertParams.xy, g_vert_center, 1.0);
    color = TEXTURE(u_vertLUT, tc);
  }
`;
const computeBaseAlpha = `
  v_baseAlpha = color.a;
`;
const adjustAndReturnColor = `
  if (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass)
    color = adjustPreMultipliedAlpha(color, 1.0);

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
    builder.addVarying("v_baseAlpha", VariableType.Float);

  addRenderPass(builder.vert);
  builder.addFunctionComputedVarying("v_color", VariableType.Vec4, "computeColor", forwardBaseAlpha ? computeSurfaceColor : computeColor);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
}
