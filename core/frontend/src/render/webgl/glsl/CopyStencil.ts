/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeColor = "return vec4(1.0, 1.0, 1.0, 1.0);";

export function createCopyStencilProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeColor);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  return builder.buildProgram(context);
}
