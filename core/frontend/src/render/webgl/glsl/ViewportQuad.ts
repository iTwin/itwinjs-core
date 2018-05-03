/*---------------------------------------------------------------------------------------------
 |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { GLSLVertex } from "./Vertex";
import { GL } from "../GL";
import { TexturedViewportQuadGeometry } from "../CachedGeometry";

const computePosition = `return rawPos;`;
const computeTexCoord = `v_texCoord = unquantize2d(a_texCoord, u_qTexCoordParams);`;

function addTexture(prog: ProgramBuilder) {
  const vert = prog.vert;

  vert.addFunction(GLSLVertex.unquantize2d);
  vert.addAttribute("a_texCoord", VariableType.Vec2, (program) => {
    program.addAttribute("a_texCoord", (attr, params) => {
        const geom = params.geometry as TexturedViewportQuadGeometry;
        attr.enableArray(geom.uvParams, 2, GL.DataType.UnsignedShort, false, 0, 0);
      });
  });

  vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (program) => {
    program.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      uniform.setUniform4fv((params.geometry as TexturedViewportQuadGeometry).uvParams.params);
    });
  });

  prog.addInlineComputedVarying("v_texCoord", VariableType.Vec2, computeTexCoord);
}

export function createViewportQuadBuilder(textured: boolean): ProgramBuilder {
  const prog = new ProgramBuilder(false);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  if (textured) {
    addTexture(prog);
  }

  return prog;
}
