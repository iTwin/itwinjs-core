/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { addOvrFlagConstants } from "./FeatureSymbology";
import { GLSLCommon } from "./Common";

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

  vert.addFunction(GLSLCommon.extractNthBit);
  vert.addFunction(extractInstanceBit);
}

/** @internal */
export function addInstanceColor(vert: VertexShaderBuilder): void {
  addInstanceOverrides(vert);
}
