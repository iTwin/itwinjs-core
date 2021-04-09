/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@bentley/webgl-compatibility";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TechniqueId } from "../TechniqueId";
import { addShaderFlags } from "./Common";
import { unquantize2d } from "./Decode";
import { addTranslucency } from "./Translucency";
import { addModelViewProjectionMatrix } from "./Vertex";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";

const computeBaseColor = `
  vec4 color = u_planeColor;
  vec2 deriv = fwidth(v_texCoord);
  if (deriv.x != 0.0 && deriv.y != 0.0) {
    vec2 grid = abs(fract(v_texCoord - 0.5) - 0.5) / deriv;
    float line = min(grid.x, grid.y);
    if (line < 1.0)
      color.a *= (1.0 + .5 * (1.0 - min(line, 1.0)));
    }

  return color;
`;

/** @internal */
export default function createPlanarGridProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PlanarGrid, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);
  addShaderFlags(builder);
  addTranslucency(builder);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  builder.vert.headerComment = `//!V! PlanarGrid"}`;
  builder.frag.headerComment = `//!F! PlanarGrid`;

  builder.vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      uniform.setUniform4fv(planarGrid.uvParams.params);
    });
  });
  builder.frag.addUniform("u_planeColor", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_planeColor", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      const planeColor = planarGrid.planeColor.colors;
      uniform.setUniform4fv([planeColor.r / 255, planeColor.g / 255, planeColor.b / 255, 1 - planeColor.t / 255]);
    });
  });

  return builder.buildProgram(context);
}

