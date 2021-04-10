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
  float refsPerGrid = 10.0;
  if (!drawGridLine(color, 1.0 / refsPerGrid, 1.0))
    drawGridLine(color, 1.0, .5);

  return color;
`;

const drawGridLine = `
  bool drawGridLine(inout vec4 color, float mult, float alphaScale) {
    vec2 scaledTexCoord = v_texCoord * mult;
    vec2 deriv = mult * fwidth(v_texCoord);
    if (deriv.x != 0.0 && deriv.y != 0.0) {
      vec2 grid = abs(fract(mult * v_texCoord - 0.5) - 0.5) / deriv;
      float line = min(grid.x, grid.y);
      if (line < 1.0) {
        color.rgb = vec3(1.0);
        color.a *= (1.0 + alphaScale * (1.0 - min(line, 1.0)));
        return true;
        }
      }
    return false;
   }
`;

/** @internal */
export default function createPlanarGridProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PlanarGrid, false));
  const vert = builder.vert;
  const frag = builder.frag;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);
  addShaderFlags(builder);
  addTranslucency(builder);

  frag.addFunction(drawGridLine);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  vert.headerComment = `//!V! PlanarGrid"}`;
  frag.headerComment = `//!F! PlanarGrid`;

  vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      uniform.setUniform4fv(planarGrid.uvParams.params);
    });
  });
  frag.addUniform("u_planeColor", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_planeColor", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      const planeColor = planarGrid.planeColor.colors;
      uniform.setUniform4fv([planeColor.r / 255, planeColor.g / 255, planeColor.b / 255, 1 - planeColor.t / 255]);
    });
  });

  return builder.buildProgram(context);
}

