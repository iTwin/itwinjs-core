/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { ShaderBuilder, VertexShaderBuilder } from "../ShaderBuilder";
import { VariableType } from "../ShaderBuilder";
import { addRenderPass } from "./RenderPass";
import { addModelViewMatrix, addProjectionMatrix } from "./Vertex";

/** @internal */
export function addViewport(shader: ShaderBuilder) {
  shader.addUniform("u_viewport", VariableType.Vec2, (prog) => {
    prog.addProgramUniform("u_viewport", (uniform, params) => {
      params.target.uniforms.viewRect.bindDimensions(uniform);
    });
  });
}

/** @internal */
export function addViewportTransformation(shader: ShaderBuilder) {
  shader.addUniform("u_viewportTransformation", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_viewportTransformation", (uniform, params) => {
      params.target.uniforms.viewRect.bindViewportMatrix(uniform);
    });
  });
}

const modelToWindowCoordinates = `
vec4 modelToWindowCoordinates(vec4 position, vec4 next, out vec4 clippedMvpPos, out vec3 clippedMvPos) {
  if (kRenderPass_ViewOverlay == u_renderPass || kRenderPass_Background == u_renderPass) {
    vec4 q = MAT_MV * position;
    clippedMvPos = q.xyz;
    q = u_proj * q;
    clippedMvpPos = q;
    q.xyz /= q.w;
    q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz;
    return q;
  }

  // Negative values are in front of the camera (visible).
  float s_maxZ = -u_frustum.x;            // use -near (front) plane for segment drop test since u_frustum's near & far are pos.
  vec4  q = MAT_MV * position;            // eye coordinates.
  vec4  n = MAT_MV * next;

  if (q.z > s_maxZ) {
    if (n.z > s_maxZ) {
      clippedMvPos = vec3(0.0, 0.0, 1.0);
      clippedMvpPos = vec4(0.0, 0.0, 1.0, 0.0);
      return vec4(0.0, 0.0, 1.0, 0.0);    // Entire segment behind front clip plane.
    }

    float t = (s_maxZ - q.z) / (n.z - q.z);

    q.x += t * (n.x - q.x);
    q.y += t * (n.y - q.y);
    q.z = s_maxZ;                         // q.z + (s_maxZ - q.z) / (n.z - q.z) * (n.z - q.z) = s_maxZ
  }

  clippedMvPos = q.xyz;
  q = u_proj * q;
  clippedMvpPos = q;
  q.xyz /= q.w;                           // normalized device coords
  q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz; // window coords
  return q;
}
`;

/** @internal */
export function addModelToWindowCoordinates(vert: VertexShaderBuilder) {
  addModelViewMatrix(vert);
  addProjectionMatrix(vert);
  addViewportTransformation(vert);
  addRenderPass(vert);
  vert.addFunction(modelToWindowCoordinates);
}
