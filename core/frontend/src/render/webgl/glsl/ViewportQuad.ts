/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { AttributeDetails} from "../AttributeMap";
import { AttributeMap } from "../AttributeMap";
import { ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";

// Positions are in NDC [-1..1]. Compute UV params in [0..1]
const computeTexCoord = "v_texCoord = (rawPosition.xy + 1.0) * 0.5;";
const computePosition = "return rawPos;";

function addTexture(prog: ProgramBuilder) {
  prog.addInlineComputedVarying("v_texCoord", VariableType.Vec2, computeTexCoord);
}

/** @internal */
export function createViewportQuadBuilder(textured: boolean, attrMapOverride?: Map<string, AttributeDetails>): ProgramBuilder {
  const attrMap = undefined !== attrMapOverride ? attrMapOverride : AttributeMap.findAttributeMap(undefined, false);
  const prog = new ProgramBuilder(attrMap);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  if (textured) {
    addTexture(prog);
  }

  return prog;
}
