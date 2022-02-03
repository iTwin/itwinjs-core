/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import type { ProgramBuilder} from "../ShaderBuilder";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { System } from "../System";
import { addEyeSpace } from "./Common";

// Based on http://tulrich.com/geekstuff/log_depth_buffer.txt
// Previously attempted to adjust z in vertex shader along the lines of https://outerra.blogspot.com/2013/07/logarithmic-depth-buffer-optimizations.html
// - but interpolation along triangles intersecting the near plane was far too wonky.
const finalizeDepth = "return 0.0 == u_logZ.x ? -v_eyeSpace.z / u_logZ.y : log(-v_eyeSpace.z * u_logZ.x) / u_logZ.y;";

/** @internal */
export function addLogDepth(builder: ProgramBuilder): void {
  assert(System.instance.supportsLogZBuffer);

  addEyeSpace(builder);

  const frag = builder.frag;
  frag.addUniform("u_logZ", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_logZ", (uniform, params) => {
      uniform.setUniform2fv(params.target.uniforms.frustum.logZ);
    });
  });

  if (!System.instance.capabilities.isWebGL2)
    frag.addExtension("GL_EXT_frag_depth");
  frag.set(FragmentShaderComponent.FinalizeDepth, finalizeDepth);
}
