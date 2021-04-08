/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@bentley/webgl-compatibility";
import { AttributeMap } from "../AttributeMap";
import { PlanarGridGeometry } from "../PlanarGrid";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TechniqueId } from "../TechniqueId";
import { unquantize2d } from "./Decode";
import { assignFragColor } from "./Fragment";
import { addModelViewProjectionMatrix } from "./Vertex";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";

const computeBaseColor = `
  float alpha = .3;
  vec2 deriv = fwidth(v_texCoord);
  if (deriv.x > 1.0 || deriv.y > 1.0)
    discard;

  vec2 grid = abs(fract(v_texCoord - 0.5) - 0.5) / deriv;
  float line = min(grid.x, grid.y);

  return vec4(vec3(1.0 - min(line, 1.0)), alpha);
`;

/** @internal */
export default function createPlanarGridProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PlanarGrid, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  builder.vert.headerComment = `//!V! PlanarGrid"}`;
  builder.frag.headerComment = `//!F! PlanarGrid`;

  builder.vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const planarGrid = params.geometry as PlanarGridGeometry;
      uniform.setUniform4fv(planarGrid.uvParams.params);
    });
  });

  return builder.buildProgram(context);
}

