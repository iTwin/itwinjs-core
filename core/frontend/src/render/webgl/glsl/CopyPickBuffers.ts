/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { TextureUnit } from "../RenderFlags";
import { VariableType, VariablePrecision, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { CopyPickBufferGeometry } from "../CachedGeometry";
import { TextureHandle } from "../Texture";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return vec4(1.0);";

const assignFragData = `
  FragColor0 = TEXTURE(u_pickElementId0, v_texCoord);
  FragColor1 = TEXTURE(u_pickElementId1, v_texCoord);
  FragColor2 = TEXTURE(u_pickDepthAndOrder, v_texCoord);
`;

export function createCopyPickBuffersProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.addUniform("u_pickElementId0", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickElementId0", (uniform, params) => {
      TextureHandle.bindSampler(uniform, (params.geometry as CopyPickBufferGeometry).elemIdLow, TextureUnit.Zero);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_pickElementId1", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickElementId1", (uniform, params) => {
      TextureHandle.bindSampler(uniform, (params.geometry as CopyPickBufferGeometry).elemIdHigh, TextureUnit.One);
    });
  }, VariablePrecision.High);

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_pickDepthAndOrder", (uniform, params) => {
      TextureHandle.bindSampler(uniform, (params.geometry as CopyPickBufferGeometry).depthAndOrder, TextureUnit.Two);
    });
  }, VariablePrecision.High);

  frag.addDrawBuffersExtension();
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);

  return builder.buildProgram(context);
}
