/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { ScreenSpaceEffectBuilderParams } from "../../ScreenSpaceEffectBuilder";
import { TextureUnit } from "../RenderFlags";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
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
  return u_readingPixels ? sampleSourcePixel() : effectMain();
`;

/** @internal */
export function createScreenSpaceEffectProgramBuilder(params: ScreenSpaceEffectBuilderParams): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));

  if (params.textureCoordFromPosition)
    builder.vert.addFunction(textureCoordFromPosition);

  builder.vert.addFunction(params.source.vertex);
  builder.vert.set(VertexShaderComponent.ComputePosition, computePosition);

  if (params.source.sampleSourcePixel)
    builder.frag.addFunction("vec4 sampleSourcePixel()", params.source.sampleSourcePixel);

  builder.frag.addFunction(params.source.fragment);
  builder.addUniform("u_diffuse", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_diffuse", (uniform, progParams) => {
      const texture = progParams.target.compositor.screenSpaceEffectFbo.getColor(0);
      texture.bindSampler(uniform, TextureUnit.Zero);
    });
  });

  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  if (!params.source.sampleSourcePixel) {
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  } else {
    builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColorWithShift);
    builder.frag.addUniform("u_readingPixels", VariableType.Boolean, (prog) => {
      prog.addProgramUniform("u_readingPixels", (uniform, progParams) => {
        uniform.setUniform1i(progParams.target.isReadPixelsInProgress ? 1 : 0);
      });
    });
  }

  return builder;
}
