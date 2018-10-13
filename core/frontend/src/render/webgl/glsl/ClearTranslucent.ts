/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ShaderProgram } from "../ShaderProgram";
import { FragmentShaderComponent } from "../ShaderBuilder";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { System } from "../System";

const computeBaseColor = "return vec4(0.0);";
const assignFragData = `
  FragColor0 = vec4(0.0, 0.0, 0.0, 1.0);
  FragColor1 = vec4(1.0, 0.0, 0.0, 1.0);
`;

const assignFragColor = `FragColor = vec4(0.0, 0.0, 0.0, 1.0);`;

export function createClearTranslucentProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  if (System.instance.capabilities.supportsMRTTransparency) {
    frag.addDrawBuffersExtension();
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  } else {
    // NB: This shader is never used - we just gl.clear() directly
    frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  }

  return builder.buildProgram(context);
}
