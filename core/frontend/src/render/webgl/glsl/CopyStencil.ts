/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { FloatRgba } from "../FloatRGBA";

const computeColor = "return vec4(u_hilite_color.rgb, 1.0);";

export function createCopyStencilProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeColor);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  frag.addUniform("u_hilite_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_hilite_color", (uniform, params) => {
      const vf = params.target.currentViewFlags;
      const useLighting = params.geometry.wantMixHiliteColorForFlash(vf, params.target);
      const transparency = useLighting ? 0 : 255;
      const hiliteColor = FloatRgba.fromColorDef(params.target.hiliteSettings.color, transparency);
      hiliteColor.bind(uniform);
    });
  });
  return builder.buildProgram(context);
}
