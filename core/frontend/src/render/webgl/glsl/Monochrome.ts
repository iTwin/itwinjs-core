/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { FragmentShaderBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";

// The alpha component of the mono color is 1.0 if lit, 0.0 if unlit.
// Unlit stuff (edges, polylines) uses the mono color directly in order for white-on-white reversal to work correctly.
const applyMonochromeColor = `
  // Compute lit monochrome color
  vec3 litRgb = baseColor.rgb;
  litRgb = vec3(dot(litRgb, vec3(.222, .707, .071)));
  litRgb *= u_monoRgb;

  // Select lit or unlit based on u_monoColor.a
  vec4 monoColor = vec4(mix(u_monoRgb, litRgb, u_mixMonoColor), baseColor.a);

  // Select monochrome or element color based on shader flag
  return chooseVec4WithBitFlag(baseColor, monoColor, u_shaderFlags, kShaderBit_Monochrome);
`;

/** @internal */
export function addMonochrome(frag: FragmentShaderBuilder): void {
  frag.set(FragmentShaderComponent.ApplyMonochrome, applyMonochromeColor);
  frag.addUniform("u_monoRgb", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_monoRgb", (uniform, params) => {
      params.target.uniforms.style.bindMonochromeRgb(uniform);
    });
  });

  frag.addUniform("u_mixMonoColor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_mixMonoColor", (uniform, params) => {
      uniform.setUniform1f(params.geometry.wantMixMonochromeColor(params.target) ? 1.0 : 0.0);
    });
  });
}
