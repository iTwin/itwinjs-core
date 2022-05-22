/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@itwin/webgl-compatibility";
import { SingleTexturedViewportQuadGeometry } from "../CachedGeometry";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { Texture2DHandle } from "../Texture";
import { assignFragColor } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeColor = "return TEXTURE(u_color, v_texCoord);";

// Transparent background color will not have premultiplied alpha - multiply it when copying.
// Set all other pixels opaque.
const computeColorNoAlpha = `
  vec4 color = TEXTURE(u_color, v_texCoord);
  if (color == u_bgColor)
    return vec4(color.rgb * color.a, color.a);
  else
    return vec4(color.rgb, 1.0);
`;

/** @internal */
export function createCopyColorProgram(context: WebGLContext, copyAlpha: boolean = true): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;

  frag.set(FragmentShaderComponent.ComputeBaseColor, copyAlpha ? computeColor : computeColorNoAlpha);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  frag.addUniform("u_color", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_color", (uniform, params) => {
      const geom = params.geometry as SingleTexturedViewportQuadGeometry;
      Texture2DHandle.bindSampler(uniform, geom.texture, TextureUnit.Zero);
    });
  });

  if (!copyAlpha) {
    frag.addUniform("u_bgColor", VariableType.Vec4, (prog) => {
      prog.addProgramUniform("u_bgColor", (uniform, params) => {
        params.target.uniforms.style.bindBackgroundRgba(uniform);
      });
    });
  }

  const flagString = (copyAlpha ? "-CopyAlpha" : "-NoAlpha");
  builder.vert.headerComment = `//!V! CopyColor${flagString}`;
  builder.frag.headerComment = `//!F! CopyColor${flagString}`;

  return builder.buildProgram(context);
}
