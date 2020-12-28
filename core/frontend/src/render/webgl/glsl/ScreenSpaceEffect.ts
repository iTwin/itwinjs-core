/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ScreenSpaceEffectBuilderParams } from "../../ScreenSpaceEffectBuilder";
import { AttributeMap } from "../AttributeMap";
import { ProgramBuilder, VertexShaderComponent } from "../ShaderBuilder";

const computePosition = `
  effectMain(rawPos);
  return rawPos;
`;

/** @internal */
export function createScreenSpaceEffectProgramBuilder(params: ScreenSpaceEffectBuilderParams): ProgramBuilder {
  const prog = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));
  prog.frag.addFunction(params.fragmentShader);
  prog.vert.addFunction(params.vertexShader);
  prog.vert.set(VertexShaderComponent.ComputePosition, computePosition);
  return prog;
}
