/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@bentley/webgl-compatibility";
import { Combine3TexturesGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariablePrecision, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return vec4(1.0);";

const assignFragData = `
  if (v_texCoord.y < (1.0 / 3.0))
    FragColor = TEXTURE(u_texture0, vec2(v_texCoord.x, v_texCoord.y * 3.0));
  else if (v_texCoord.y < (2.0 / 3.0))
    FragColor = TEXTURE(u_texture1, vec2(v_texCoord.x, v_texCoord.y * 3.0 - 1.0));
  else
    FragColor = TEXTURE(u_texture2, vec2(v_texCoord.x, v_texCoord.y * 3.0 - 2.0));
`;

/** @internal */
export function createCombine3TexturesProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  frag.addUniform("u_texture0", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_texture0", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as Combine3TexturesGeometry).texture0, TextureUnit.Zero);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_texture1", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_texture1", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as Combine3TexturesGeometry).texture1, TextureUnit.One);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_texture2", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_texture2", (uniform, params) => {
      Texture2DHandle.bindSampler(uniform, (params.geometry as Combine3TexturesGeometry).texture2, TextureUnit.Two);
    });
  }, VariablePrecision.High);

  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);

  builder.vert.headerComment = "//!V! Combine3Textures";
  builder.frag.headerComment = "//!F! Combine3Textures";

  return builder.buildProgram(context);
}
