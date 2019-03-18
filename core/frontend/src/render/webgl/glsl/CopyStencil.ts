/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment } from "./Fragment";
import { createViewportQuadBuilder } from "./ViewportQuad";
import { MutableFloatRgba } from "../FloatRGBA";
import { ColorDef } from "@bentley/imodeljs-common";

const computeColor = "return vec4(u_hilite_color.rgb, 1.0);";

const scratchHiliteColor: MutableFloatRgba = MutableFloatRgba.fromColorDef(ColorDef.white);

/** @internal */
export function createCopyStencilProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = createViewportQuadBuilder(true);
  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeColor);
  frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
  frag.addUniform("u_hilite_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_hilite_color", (uniform, params) => {
      const vf = params.target.currentViewFlags;
      const useLighting = params.geometry.wantMixHiliteColorForFlash(vf, params.target);
      const hiliteColor = params.target.hiliteColor;
      scratchHiliteColor.setRgbaValues(hiliteColor.red, hiliteColor.green, hiliteColor.blue, useLighting ? 1.0 : 0.0);
      scratchHiliteColor.bind(uniform);
    });
  });
  return builder.buildProgram(context);
}
