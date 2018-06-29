/*---------------------------------------------------------------------------------------------
 |  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";

// Positions are in NDC [-1..1]. Compute UV params in [0..1]
const computeTexCoord = "v_texCoord = (rawPosition.xy + 1.0) * 0.5;";
const computePosition = "return rawPos;";

function addTexture(prog: ProgramBuilder) {
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
