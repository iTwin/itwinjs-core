/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
