/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { createViewportQuadBuilder } from "./ViewportQuad";
import { VariableType, FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { FloatRgba } from "../FloatRGBA";

const computeBaseColor = "return u_bgColor;";

const assignFragData = `
  FragColor0 = baseColor;
  FragColor1 = vec4(0.0);
  FragColor2 = vec4(0.0);
  FragColor3 = vec4(0.0);
`;

export function createClearPickAndColorProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  const frag = builder.frag;
  frag.addUniform("u_bgColor", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      const bgColor = FloatRgba.fromColorDef(params.target.bgColor);
      bgColor.bind(uniform);
    });
  });

  frag.addDrawBuffersExtension();
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);

  return builder.buildProgram(context);
}
