/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { FloatRgba } from "../FloatRGBA";

// The alpha component of the mono color is 1.0 if lit, 0.0 if unlit.
// Unlit stuff (edges, polylines) uses the mono color directly in order for white-on-white reversal to work correctly.
const applyMonochromeColor = `
  // Compute lit monochrome color
  vec3 litRgb = baseColor.rgb;
  litRgb /= max(0.0001, baseColor.a); // un-premultiply alpha
  litRgb = vec3(dot(litRgb, vec3(.222, .707, .071)));
  litRgb *= u_monoRgb.rgb;

  // Select lit or unlit based on u_monoColor.a
  vec4 monoColor = vec4(mix(u_monoRgb.rgb, litRgb, u_monoRgb.a), baseColor.a);
  monoColor.rgb *= monoColor.a;

  // Select monochrome or element color based on shader flag
  return mix(baseColor, monoColor, extractShaderBit(kShaderBit_Monochrome));
`;

export function addMonochrome(frag: FragmentShaderBuilder): void {
  frag.set(FragmentShaderComponent.ApplyMonochrome, applyMonochromeColor);
  frag.addUniform("u_monoRgb", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_monoRgb", (uniform, params) => {
      // alpha = 1.0 indicates lit surface, 0.0 = unlit
      const transparency = params.geometry.isLitSurface ? 0 : 255;
      const color = FloatRgba.fromColorDef(params.target.monoColor, transparency);
      color.bind(uniform);
    });
  });
}
