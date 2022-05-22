/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { CombineTexturesGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariablePrecision, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return vec4(1.0);";

const assignFragData = `
  if (v_texCoord.y < .5)
    FragColor = TEXTURE(u_texture0, vec2(v_texCoord.x, v_texCoord.y * 2.0));
  else
    FragColor = TEXTURE(u_texture1, vec2(v_texCoord.x, v_texCoord.y * 2.0 - 1.0));
`;

/** @internal */
export function createCombineTexturesProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  frag.addUniform("u_texture0", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_texture0", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as CombineTexturesGeometry).texture0, TextureUnit.Zero);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_texture1", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_texture1", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as CombineTexturesGeometry).texture1, TextureUnit.One);
    });
  }, VariablePrecision.High);

  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);

  builder.vert.headerComment = "//!V! CombineTextures";
  builder.frag.headerComment = "//!F! CombineTextures";

  return builder.buildProgram(context);
}
