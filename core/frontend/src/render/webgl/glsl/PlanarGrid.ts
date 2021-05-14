/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@bentley/webgl-compatibility";
import { PlanarGridTransparency } from "../../RenderSystem";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { System } from "../System";
import { TechniqueId } from "../TechniqueId";
import { addShaderFlags } from "./Common";
import { unquantize2d } from "./Decode";
import { addLogDepth } from "./LogarithmicDepthBuffer";
import { addTranslucency } from "./Translucency";
import { addModelViewProjectionMatrix } from "./Vertex";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";

const computeBaseColor = `
  // u_gridProps - x = gridsPerRef, y - planeAlpha, z = line alpha, w = ref alpha.
  vec4 color = vec4(u_gridColor, u_gridProps.y);
  float refsPerGrid = u_gridProps.x;
  if (0.0 == refsPerGrid || !drawGridLine(color, 1.0 / refsPerGrid, u_gridProps.w - color.a))
    drawGridLine(color, 1.0, u_gridProps.z - color.a);

  return color;
`;

const drawGridLine = `
  bool drawGridLine(inout vec4 color, float mult, float alphaScale) {
    vec2 scaledTexCoord = v_texCoord * mult;
    vec2 deriv = mult * screenSpaceDeriv(v_texCoord);
    if (deriv.x != 0.0 && deriv.y != 0.0) {
      vec2 grid = abs(fract(mult * v_texCoord - 0.5) - 0.5) / deriv;
      float line = min(grid.x, grid.y);
      if (line < 1.0) {
        color.a += alphaScale * (1.0 - min(line, 1.0)) / max(1.0, length(deriv));
        return true;
        }
      }
    return false;
   }
`;

const fwidth2dWhenAvailable =  `\nvec2 screenSpaceDeriv(vec2 screenXY) { return fwidth(screenXY); }\n`;
const fwidth2dWhenNotAvailable =  `\nvec2 screenSpaceDeriv(vec2 screenXY) { return vec2(0.25, 0.25); }\n`;

const defaultTransparency = new PlanarGridTransparency();
/** @internal */
export default function createPlanarGridProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PlanarGrid, false));
  const vert = builder.vert;
  const frag = builder.frag;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);
  addShaderFlags(builder);

  addTranslucency(builder);
  if (System.instance.capabilities.isWebGL2) {
    frag.addFunction(fwidth2dWhenAvailable);
  } else if (System.instance.capabilities.supportsStandardDerivatives) {
    frag.addExtension("GL_OES_standard_derivatives");
    frag.addFunction(fwidth2dWhenAvailable);
  } else {
    frag.addFunction(fwidth2dWhenNotAvailable);
  }

  if (System.instance.supportsLogZBuffer)
    addLogDepth(builder);

  frag.addFunction(drawGridLine);

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  vert.headerComment = `//!V! PlanarGrid`;
  frag.headerComment = `//!F! PlanarGrid`;

  vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      uniform.setUniform4fv(planarGrid.uvParams.params);
    });
  });
  frag.addUniform("u_gridColor", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_gridColor", (uniform, params) => {
      const planarGrid = params.geometry.asPlanarGrid!;
      const color = planarGrid.props.color.colors;
      uniform.setUniform3fv([color.r / 255, color.g / 255, color.b / 255]);
    });
  });
  frag.addUniform("u_gridProps", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_gridProps", (uniform, params) => {
      const planarGridProps = params.geometry.asPlanarGrid!.props;
      const transparency = planarGridProps.transparency ? planarGridProps.transparency : defaultTransparency;
      uniform.setUniform4fv([planarGridProps.gridsPerRef,  1.0 - transparency.planeTransparency, 1.0 - transparency.lineTransparency, 1.0 - transparency.refTransparency]);
    });
  });

  return builder.buildProgram(context);
}

