/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ScreenSpaceEffectBuilderParams } from "../../ScreenSpaceEffectBuilder";
import { TextureUnit } from "../RenderFlags";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { System } from "../System";
import { assignFragColor } from "./Fragment";

const computePosition = `
  effectMain(rawPos);
  return rawPos;
`;

const computeBaseColor = "  return effectMain();";

/** @internal */
export function createScreenSpaceEffectProgramBuilder(params: ScreenSpaceEffectBuilderParams): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));
  builder.vert.addFunction(params.vertexShader);
  builder.vert.set(VertexShaderComponent.ComputePosition, computePosition);

  builder.frag.addFunction(params.fragmentShader);
  builder.addUniform("u_diffuse", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_diffuse", (uniform, params) => {
      const texture = params.target.compositor.screenSpaceEffectFbo.getColor(0);
      texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  return builder;
}
