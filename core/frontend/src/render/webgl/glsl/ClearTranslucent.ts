/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ShaderProgram } from "../ShaderProgram";
import { FragmentShaderComponent } from "../ShaderBuilder";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return vec4(0.0);";
const assignFragData = `
  FragColor0 = vec4(0.0, 0.0, 0.0, 1.0);
  FragColor1 = vec4(1.0, 0.0, 0.0, 1.0);
`;

export function createClearTranslucentProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.addDrawBuffersExtension();
  frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  return builder.buildProgram(context);
}
