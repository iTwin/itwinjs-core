/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderBuilder, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { FloatRgba } from "../FloatRGBA";

const applyMonochromeColor = `
  if (!isShaderBitSet(kShaderBit_Monochrome))
    return baseColor;

  // The alpha component of the mono color = 1.0 if lit, 0.0 if unlit
  // We need to use the mono color directly for unlit stuff (i.e. edges, polylines) in order for white-on-white reversal to work correctly.
  // But it looks terrible for lit surfaces.
  if (u_monoRgb.a  > 0.5) {
    // Preserve translucency...
    if (baseColor.a > 0.0)
      baseColor.rgb /= baseColor.a;

    baseColor.rgb = vec3(dot(baseColor.rgb, vec3(.222, .707, .071)));
    baseColor.rgb *= u_monoRgb.rgb;
  } else {
    baseColor.rgb = u_monoRgb.rgb;
  }

  baseColor.rgb *= baseColor.a;
  return baseColor;
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
