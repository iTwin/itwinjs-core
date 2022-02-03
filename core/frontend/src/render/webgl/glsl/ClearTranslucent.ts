/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { WebGLContext } from "@itwin/webgl-compatibility";
import { FragmentShaderComponent } from "../ShaderBuilder";
import type { ShaderProgram } from "../ShaderProgram";
import { System } from "../System";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return vec4(0.0);";
const assignFragData = `
  FragColor0 = vec4(0.0, 0.0, 0.0, 1.0);
  FragColor1 = vec4(1.0, 0.0, 0.0, 1.0);
`;

const assignFragColor = `FragColor = vec4(0.0, 0.0, 0.0, 1.0);`;

/** @internal */
export function createClearTranslucentProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  if (System.instance.capabilities.supportsMRTTransparency) {
    frag.addDrawBuffersExtension(2);
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  } else {
    // NB: This shader is never used - we just gl.clear() directly
    frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  }

  builder.vert.headerComment = "//!V! ClearTranslucent";
  builder.frag.headerComment = "//!F! ClearTranslucent";

  return builder.buildProgram(context);
}
