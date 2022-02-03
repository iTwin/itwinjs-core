/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { System } from "../System";
import type { ProgramBuilder} from "../ShaderBuilder";
import { FragmentShaderComponent, VariableType } from "../ShaderBuilder";

// Vertex shader produces barycentric coordinate for corner of triangle to be smoothly interpolated over face of triangle.
// This requires WebGL 2 because gl_VertexID.
// It also requires that we are drawing non-indexed vertices, or using an index buffer in which each set of 3 consecutive indices correspond to one triangle -
// otherwise gl_VertexID will not correlate to triangle corners.
const computeBarycentric = `
  int vertIndex = gl_VertexID % 3;
  v_barycentric = vec3(float(0 == vertIndex), float(1 == vertIndex), float(2 == vertIndex));
`;

// Fragment shader draws in the line color for fragments close to the edge of the triangle.
// Vertex shader requires WebGL 2 which includes the functionality of the GL_OES_standard_derivatives extension.
const applyWiremesh = `
  const float lineWidth = 1.0;
  const vec3 lineColor = vec3(0.0);
  vec3 delta = fwidth(v_barycentric);
  vec3 factor = smoothstep(vec3(0.0), delta * lineWidth, v_barycentric);
  vec3 color = mix(lineColor, baseColor.rgb, min(min(factor.x, factor.y), factor.z));
  return vec4(color, baseColor.a);
`;

/** Adds to a mesh shader logic to produce an overlaid wiremesh.
 * @internal
 */
export function addWiremesh(builder: ProgramBuilder): void {
  if (System.instance.isWebGL2) {
    builder.addInlineComputedVarying("v_barycentric", VariableType.Vec3, computeBarycentric);
    builder.frag.set(FragmentShaderComponent.ApplyWiremesh, applyWiremesh);
  }
}
