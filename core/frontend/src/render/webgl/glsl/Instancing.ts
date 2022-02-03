/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import type { VertexShaderBuilder } from "../ShaderBuilder";
import { VariableType } from "../ShaderBuilder";
import { System } from "../System";
import type { UniformHandle } from "../UniformHandle";
import type { Matrix4 } from "../Matrix";
import { addExtractNthBit } from "./Common";
import { addOvrFlagConstants } from "./FeatureSymbology";

const extractInstanceBit = `
float extractInstanceBit(float flag) { return extractNthBit(a_instanceOverrides.r, flag); }
`;
const extractInstanceBit2 = `
float extractInstanceBit(uint flag) { return extractNthBit(a_instanceOverrides.r, flag); }
`;

const computeInstancedModelMatrixRTC = `
  if (g_isAreaPattern) {
    vec2 spacing = u_patternParams.yz;
    float scale = u_patternParams.w;

    float x = u_patternOrigin.x + a_patternX * spacing.x;
    float y = u_patternOrigin.y + a_patternY * spacing.y;
    vec4 translation = vec4(x / scale, y / scale, 0.0, 1.0);
    mat4 symbolTrans = u_patOrg;
    symbolTrans[3] = symbolTrans * translation;

    g_modelMatrixRTC = u_patLocalToModel * symbolTrans * u_patSymbolToLocal;
  } else {
    g_modelMatrixRTC = mat4(
      a_instanceMatrixRow0.x, a_instanceMatrixRow1.x, a_instanceMatrixRow2.x, 0.0,
      a_instanceMatrixRow0.y, a_instanceMatrixRow1.y, a_instanceMatrixRow2.y, 0.0,
      a_instanceMatrixRow0.z, a_instanceMatrixRow1.z, a_instanceMatrixRow2.z, 0.0,
      a_instanceMatrixRow0.w, a_instanceMatrixRow1.w, a_instanceMatrixRow2.w, 1.0);
  }
`;
function setMatrix(uniform: UniformHandle, matrix: Matrix4 | undefined): void {
  if (matrix)
    uniform.setMatrix4(matrix);
}

function addPatternTransforms(vert: VertexShaderBuilder): void {
  vert.addUniform("u_patOrg", VariableType.Mat4, (prog) =>
    prog.addGraphicUniform("u_patOrg", (uniform, params) =>
      setMatrix(uniform, params.geometry.asInstanced?.patternTransforms?.orgTransform)));

  vert.addUniform("u_patLocalToModel", VariableType.Mat4, (prog) =>
    prog.addGraphicUniform("u_patLocalToModel", (uniform, params) =>
      setMatrix(uniform, params.geometry.asInstanced?.patternTransforms?.localToModel)));

  vert.addUniform("u_patSymbolToLocal", VariableType.Mat4, (prog) =>
    prog.addGraphicUniform("u_patSymbolToLocal", (uniform, params) =>
      setMatrix(uniform, params.geometry.asInstanced?.patternTransforms?.symbolToLocal)));

  vert.addUniform("u_patternOrigin", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_patternOrigin", (uniform, params) => {
      const origin = params.geometry.asInstanced?.patternTransforms?.origin;
      if (origin)
        uniform.setUniform2fv(origin);
    });
  });
}

/** @internal */
export function addInstancedModelMatrixRTC(vert: VertexShaderBuilder) {
  assert(vert.usesInstancedGeometry);

  vert.addUniform("u_patternParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_patternParams", (uniform, params) => {
      const inst = params.geometry.asInstanced;
      assert(undefined !== inst);
      if (inst)
        uniform.setUniform4fv(inst.patternParams);
    });
  });

  addPatternTransforms(vert);

  vert.addGlobal("g_isAreaPattern", VariableType.Boolean);
  vert.addInitializer("g_isAreaPattern = 0.0 != u_patternParams.x;");

  vert.addGlobal("g_modelMatrixRTC", VariableType.Mat4);
  vert.addInitializer(computeInstancedModelMatrixRTC);
}

/** @internal */
export function addInstanceOverrides(vert: VertexShaderBuilder): void {
  if (undefined !== vert.find("a_instanceOverrides"))
    return;

  addOvrFlagConstants(vert);

  addExtractNthBit(vert);
  vert.addFunction(System.instance.capabilities.isWebGL2 ? extractInstanceBit2 : extractInstanceBit);
}

/** @internal */
export function addInstanceColor(vert: VertexShaderBuilder): void {
  addInstanceOverrides(vert);

  vert.addUniform("u_applyInstanceColor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_applyInstanceColor", (uniform, params) => {
      let val = 1.0;
      if (params.geometry.isEdge && undefined !== params.target.currentEdgeSettings.getColor(params.target.currentViewFlags))
        val = 0.0;

      uniform.setUniform1f(val);
    });
  });
}
