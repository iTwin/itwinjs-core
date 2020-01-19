/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { addOvrFlagConstants } from "./FeatureSymbology";
import { extractNthBit } from "./Common";

const extractInstanceBit = `
  float extractInstanceBit(float flag) { return extractNthBit(a_instanceOverrides.r, flag); }
`;

const computeInstancedModelMatrixRTC = `
  g_modelMatrixRTC = mat4(
    a_instanceMatrixRow0.x, a_instanceMatrixRow1.x, a_instanceMatrixRow2.x, 0.0,
    a_instanceMatrixRow0.y, a_instanceMatrixRow1.y, a_instanceMatrixRow2.y, 0.0,
    a_instanceMatrixRow0.z, a_instanceMatrixRow1.z, a_instanceMatrixRow2.z, 0.0,
    a_instanceMatrixRow0.w, a_instanceMatrixRow1.w, a_instanceMatrixRow2.w, 1.0);
`;

/** @internal */
export function addInstancedModelMatrixRTC(vert: VertexShaderBuilder) {
  assert(vert.usesInstancedGeometry);
  vert.addGlobal("g_modelMatrixRTC", VariableType.Mat4);
  vert.addInitializer(computeInstancedModelMatrixRTC);
}

/** @internal */
export function addInstanceOverrides(vert: VertexShaderBuilder): void {
  if (undefined !== vert.find("a_instanceOverrides"))
    return;

  addOvrFlagConstants(vert);

  vert.addFunction(extractNthBit);
  vert.addFunction(extractInstanceBit);
}

/** @internal */
export function addInstanceColor(vert: VertexShaderBuilder): void {
  addInstanceOverrides(vert);

  vert.addUniform("u_applyInstanceColor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_applyInstanceColor", (uniform, params) => {
      let val = 1.0;
      if (params.geometry.isEdge) {
        const ovrs = params.target.getEdgeOverrides(params.renderPass);
        if (undefined !== ovrs && ovrs.overridesColor)
          val = 0.0;
      }

      uniform.setUniform1f(val);
    });
  });
}
