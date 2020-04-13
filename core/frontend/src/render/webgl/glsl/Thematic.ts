/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  FragmentShaderComponent,
  ProgramBuilder,
  VariableType,
} from "../ShaderBuilder";
import {
  addInstancedRtcMatrix,
  addProjectionMatrix,
} from "./Vertex";
import { addRenderPass } from "./RenderPass";

// Access the gradient texture for the calculated index.
const applyThematicHeight = `
float ndx = clamp(v_thematicIndex, 0.0, 1.0);
return vec4(TEXTURE(s_texture, vec2(0.0, ndx)).rgb, baseColor.a);
`;

// Compute the value for the varying to be interpolated to the fragment shader in order to access the color in the thematic gradient texture
// We will project a vector onto another vector using this equation: proju = (v . u) / (v . v) * v
export function getComputeThematicIndex(instanced: boolean): string {
  const modelPos = instanced ? "(g_instancedRtcMatrix * rawPosition).xyz" : "rawPosition.xyz";
  return `
  vec3 u = u_modelToWorld + ` + modelPos + `;
  vec3 v = u_thematicAxis;
  vec3 proju = (dot(v, u) / dot(v, v)) * v;

  vec3 a = v * u_thematicRange.s;
  vec3 b = v * u_thematicRange.t;
  vec3 c = proju;
  v_thematicIndex = findFractionalPositionOnLine(a, b, c);
  `;
}

// Determine the fractional position of c on line segment ab.  Assumes the three points are aligned on the same axis.
const findFractionalPositionOnLine = `
float abDist = distance(a, b);
return dot(b - a, c - a) / (abDist * abDist);
`;

/** @internal */
export function addThematicDisplay(builder: ProgramBuilder) {
  const frag = builder.frag;
  const vert = builder.vert;

  addRenderPass(builder.frag);

  addProjectionMatrix(vert);
  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);

  vert.addFunction("float findFractionalPositionOnLine(vec3 a, vec3 b, vec3 c)", findFractionalPositionOnLine);

  vert.addUniform("u_modelToWorld", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_modelToWorld", (uniform, params) => { // ###TODO: instanced?
      params.target.uniforms.branch.bindModelToWorldTransform(uniform, params.geometry, false);
    });
  });

  vert.addUniform("u_thematicRange", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_thematicRange", (uniform, params) => {
      params.target.uniforms.thematic.bindRange(uniform);
    });
  });

  vert.addUniform("u_thematicAxis", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_thematicAxis", (uniform, params) => {
      params.target.uniforms.thematic.bindAxis(uniform);
    });
  });

  frag.set(FragmentShaderComponent.ApplyThematicDisplay, applyThematicHeight);
}
