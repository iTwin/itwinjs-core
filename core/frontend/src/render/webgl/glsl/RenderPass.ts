/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ShaderBuilder, VariableType } from "../ShaderBuilder";
import { RenderPass } from "../RenderFlags";

/**
 * Adds a uniform holding the current render pass and a set of kRenderPass_* constants
 * uniform float u_renderPass
 */
export function addRenderPass(builder: ShaderBuilder) {
  builder.addUniform("u_renderPass", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_renderPass", (uniform, params) => {
      let renderPass = params.renderPass;
      if (RenderPass.HiddenEdge === renderPass) {
        renderPass = RenderPass.OpaqueGeneral; // no distinction from shader POV...
      }

      uniform.setUniform1f(renderPass);
    });
  });

  builder.addGlobal("kRenderPass_Background", VariableType.Float, "0.0", true);
  builder.addGlobal("kRenderPass_OpaqueLinear", VariableType.Float, "1.0", true);
  builder.addGlobal("kRenderPass_OpaquePlanar", VariableType.Float, "2.0", true);
  builder.addGlobal("kRenderPass_OpaqueGeneral", VariableType.Float, "3.0", true);
  builder.addGlobal("kRenderPass_StencilVolume", VariableType.Float, "4.0", true);
  builder.addGlobal("kRenderPass_Translucent", VariableType.Float, "5.0", true);
  builder.addGlobal("kRenderPass_HiddenEdge", VariableType.Float, "6.0", true);
  builder.addGlobal("kRenderPass_Hilite", VariableType.Float, "7.0", true);
  builder.addGlobal("kRenderPass_WorldOverlay", VariableType.Float, "8.0", true);
  builder.addGlobal("kRenderPass_ViewOverlay", VariableType.Float, "9.0", true);
}
