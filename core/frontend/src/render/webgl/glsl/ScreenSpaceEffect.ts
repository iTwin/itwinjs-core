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

const textureCoordFromPosition = `
  vec2 textureCoordFromPosition(vec4 pos) {
    return (pos.xy + 1.0) * 0.5;
  }
`;

const computeBaseColor = "  return effectMain();";

const computeBaseColorWithShift = `
  if (u_readingPixels)
    return TEXTURE(u_diffuse, computeSourcePixel());
  else
    return effectMain();
`;

/** @internal */
export function createScreenSpaceEffectProgramBuilder(params: ScreenSpaceEffectBuilderParams): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));

  if (params.textureCoordFromPosition)
    builder.vert.addFunction(textureCoordFromPosition);

  builder.vert.addFunction(params.source.vertex);
  builder.vert.set(VertexShaderComponent.ComputePosition, computePosition);

  if (params.source.computeSourcePixel)
    builder.frag.addFunction("vec2 computeSourcePixel()", params.source.computeSourcePixel);

  builder.frag.addFunction(params.source.fragment);
  builder.addUniform("u_diffuse", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_diffuse", (uniform, params) => {
      const texture = params.target.compositor.screenSpaceEffectFbo.getColor(0);
      texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });

  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  if (!params.source.computeSourcePixel) {
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  } else {
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColorWithShift);
    builder.frag.addUniform("u_readingPixels", VariableType.Boolean, (prog) => {
      prog.addProgramUniform("u_readingPixels", (uniform, params) => {
        uniform.setUniform1i(params.target.isReadPixelsInProgress ? 1 : 0);
      });
    });
  }

  return builder;
}
