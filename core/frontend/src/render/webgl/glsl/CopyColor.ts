/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { TextureUnit } from "../RenderFlags";
import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TexturedViewportQuadGeometry } from "../CachedGeometry";
import { TextureHandle } from "../Texture";
import { GLSLFragment } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeColor = `return TEXTURE(u_color, v_texCoord);`;

export function createCopyColorProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeColor);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  frag.addUniform("u_color", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const geom = params.geometry as TexturedViewportQuadGeometry;
      TextureHandle.bindSampler(uniform, geom.getTexture(0), TextureUnit.Zero);
    });
  });

  return builder.buildProgram(context);
}
