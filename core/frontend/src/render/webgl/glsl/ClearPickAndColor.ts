/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { WebGLContext } from "@itwin/webgl-compatibility";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import type { ShaderProgram } from "../ShaderProgram";
import { System } from "../System";
import { createViewportQuadBuilder } from "./ViewportQuad";

const computeBaseColor = "return u_bgColor;";

const assignFragData = `
  FragColor0 = baseColor;
  FragColor1 = vec4(0.0);
  FragColor2 = vec4(0.0);
`;

/** @internal */
export function createClearPickAndColorProgram(context: WebGLContext): ShaderProgram {
  const builder = createViewportQuadBuilder(false);
  const frag = builder.frag;
  frag.addUniform("u_bgColor", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_bgColor", (uniform, params) => {
      params.target.uniforms.style.bindBackgroundRgba(uniform);
    });
  });

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  if (!System.instance.capabilities.supportsMRTPickShaders) {
    // NB: This shader is never used - we gl.clear() directly
    frag.set(FragmentShaderComponent.AssignFragData, "FragColor = baseColor;");
  } else {
    frag.addDrawBuffersExtension(3);
    frag.set(FragmentShaderComponent.AssignFragData, assignFragData);
  }

  builder.vert.headerComment = "//!V! ClearPickAndColor";
  builder.frag.headerComment = "//!F! ClearPickAndColor";

  return builder.buildProgram(context);
}
