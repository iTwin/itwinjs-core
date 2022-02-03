/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { RenderPass } from "../RenderFlags";
import type { ShaderBuilder} from "../ShaderBuilder";
import { VariableType } from "../ShaderBuilder";

// render passes actually used in shader code.
const renderPasses = [
  [RenderPass.Background, "Background"],
  [RenderPass.OpaqueLayers, "Layers"], // Shaders treat all layer passes the same
  [RenderPass.OpaqueLinear, "OpaqueLinear"],
  [RenderPass.OpaquePlanar, "OpaquePlanar"],
  [RenderPass.OpaqueGeneral, "OpaqueGeneral"],
  [RenderPass.Classification, "Classification"],
  [RenderPass.Translucent, "Translucent"],
  [RenderPass.HiddenEdge, "HiddenEdge"],
  [RenderPass.Hilite, "Hilite"],
  [RenderPass.WorldOverlay, "WorldOverlay"],
  [RenderPass.ViewOverlay, "ViewOverlay"],
  [RenderPass.PlanarClassification, "PlanarClassification"],
];

/**
 * Adds a uniform holding the current render pass and a set of kRenderPass_* constants
 * uniform float u_renderPass
 * @internal
 */
export function addRenderPass(builder: ShaderBuilder) {
  builder.addUniform("u_renderPass", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_renderPass", (uniform, params) => {
      let renderPass = params.renderPass;
      switch (renderPass) {
        case RenderPass.HiddenEdge:
          renderPass = RenderPass.OpaqueGeneral; // no distinction from shader POV...
          break;
        case RenderPass.OverlayLayers:
        case RenderPass.TranslucentLayers:
          renderPass = RenderPass.OpaqueLayers; // no distinction from shader POV...
          break;
      }

      uniform.setUniform1f(renderPass);
    });
  });

  for (const renderPass of renderPasses)
    builder.addGlobal(`kRenderPass_${renderPass[1]}`, VariableType.Float, `${renderPass[0].toString()}.0`, true);
}
