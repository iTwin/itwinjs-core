/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { MonochromeMode } from "@itwin/core-common";
import { FragmentShaderBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";

const applyUnlitMonochromeColor = `
  vec4 monoColor = vec4(u_monoRgb, baseColor.a);
  return u_shaderFlags[kShaderBit_Monochrome] ? monoColor : baseColor;
`;

const applySurfaceMonochromeColor = `
  vec4 monoColor = vec4(u_monoRgb, baseColor.a);
  if (1.0 == u_mixMonoColor) {
    vec3 rgb = baseColor.rgb;
    rgb = vec3(dot(rgb, vec3(.222, .707, .071)));
    rgb *= u_monoRgb;
    monoColor.rgb = rgb;
  }

  return u_shaderFlags[kShaderBit_Monochrome] ? monoColor : baseColor;
`;

function addMonoRgb(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_monoRgb", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_monoRgb", (uniform, params) => {
      params.target.uniforms.style.bindMonochromeRgb(uniform);
    });
  });
}

/** @internal */
export function addUnlitMonochrome(frag: FragmentShaderBuilder): void {
  addMonoRgb(frag);
  frag.set(FragmentShaderComponent.ApplyMonochrome, applyUnlitMonochromeColor);
}

/** @internal */
export function addSurfaceMonochrome(frag: FragmentShaderBuilder): void {
  addMonoRgb(frag);
  frag.addUniform("u_mixMonoColor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_mixMonoColor", (uniform, params) => {
      uniform.setUniform1f(MonochromeMode.Scaled === params.target.plan.monochromeMode && params.geometry.wantMixMonochromeColor(params.target) ? 1.0 : 0.0);
    });
  });

  frag.set(FragmentShaderComponent.ApplyMonochrome, applySurfaceMonochromeColor);
}
