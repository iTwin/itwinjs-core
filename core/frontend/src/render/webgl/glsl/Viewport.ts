/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ShaderBuilder, VariableType, VertexShaderBuilder } from "../ShaderBuilder";
import { Matrix4 } from "../Matrix";
import { ViewRect } from "../../../Viewport";
import { addModelViewProjectionMatrix } from "./Vertex";
import { addRenderPass } from "./RenderPass";

export function addViewport(shader: ShaderBuilder) {
  shader.addUniform("u_viewport", VariableType.Vec4, (prog) => {
    prog.addProgramUniform("u_viewport", (uniform, params) => {
      const rect = params.target.viewRect;
      const vp: number[] = [rect.left, rect.bottom, rect.width, rect.height];
      uniform.setUniform4fv(vp);
    });
  });
}

function computeViewportTransformation(viewRect: ViewRect, nearDepthRange: number, farDepthRange: number): Matrix4 {
  const x = viewRect.left;
  const y = viewRect.top;
  const width = viewRect.width;
  const height = viewRect.height;

  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const halfDepth = (farDepthRange - nearDepthRange) * 0.5;

  const column0Row0 = halfWidth;
  const column1Row1 = halfHeight;
  const column2Row2 = halfDepth;
  const column3Row0 = x + halfWidth;
  const column3Row1 = y + halfHeight;
  const column3Row2 = nearDepthRange + halfDepth;
  const column3Row3 = 1.0;

  const mat = Matrix4.fromValues(
    column0Row0, 0.0, 0.0, column3Row0,
    0.0, column1Row1, 0.0, column3Row1,
    0.0, 0.0, column2Row2, column3Row2,
    0.0, 0.0, 0.0, column3Row3);

  return mat;
}

export function addViewportTransformation(shader: ShaderBuilder) {
  shader.addUniform("u_viewportTransformation", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_viewportTransformation", (uniform, params) => {
      uniform.setMatrix4(computeViewportTransformation(params.target.viewRect, 0.0, 1.0));
    });
  });
}

const modelToWindowCoordinates = `
vec4 modelToWindowCoordinates(vec4 position, vec4 next) {
  if (kRenderPass_ViewOverlay == u_renderPass || kRenderPass_Background == u_renderPass) {
    vec4 q = u_mvp * position;
    q.xyz /= q.w;
    q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz;
    return q;
  }

  // Negative values are in front of the camera (visible).
  float s_maxZ = -u_frustum.x;            // use -near (front) plane for segment drop test since u_frustum's near & far are pos.
  vec4  q = u_mv * position;              // eye coordinates.
  vec4  n = u_mv * next;

  if (q.z > s_maxZ) {
    if (n.z > s_maxZ)
      return vec4(0.0, 0.0,  1.0, 0.0);   // Entire segment behind eye.

    float t = (s_maxZ - q.z) / (n.z - q.z);

    q.x += t * (n.x - q.x);
    q.y += t * (n.y - q.y);
    q.z = s_maxZ;                       // q.z + (s_maxZ - q.z) * (s_maxZ - q.z) / n.z - q.z
  }
  q = u_proj * q;
  q.xyz /= q.w;                           // normalized device coords
  q.xyz = (u_viewportTransformation * vec4(q.xyz, 1.0)).xyz; // window coords
  return q;
  }
`;

export function addModelToWindowCoordinates(vert: VertexShaderBuilder) {
  addModelViewProjectionMatrix(vert);
  addViewportTransformation(vert);
  addRenderPass(vert);
  vert.addFunction(modelToWindowCoordinates);
}
