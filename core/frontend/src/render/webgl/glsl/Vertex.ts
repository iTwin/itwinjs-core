/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { Matrix4 } from "../Matrix";
import { GLSLDecode } from "./Decode";

const initializeVertLUTCoords = `
g_vertexLUTIndex = decodeUInt32(a_pos);
g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);`;

const unquantizePosition = `
vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) {
  return vec4(origin + scale * pos, 1.0);
}`;

const unquantizeVertexPosition = `
vec4 unquantizeVertexPosition(vec3 pos, vec3 origin, vec3 scale) {
  return unquantizePosition(pos, origin, scale);
}`;

const unquantizeVertexPositionFromLUT = `
vec4 unquantizeVertexPosition(vec3 encodedIndex, vec3 origin, vec3 scale) {
  // Need to read 2 rgba values to obtain 6 16-bit integers for position
  vec2 tc = g_vertexBaseCoords;
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  g_featureIndexCoords = tc;

  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));

  // Might as well decode the color index since we already read it...may not end up being used.
  // (NOTE = If this is a textured mesh, the normal is stored where the color index would otherwise be...)
  g_vertexData2 = enc2.zw;

  return unquantizePosition(qpos, origin, scale);
}`;

const scratchMVPMatrix = new Matrix4();

export function addModelViewProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_mvp", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_mvp", (uniform, params) => {
      const mvp = params.projectionMatrix.clone(scratchMVPMatrix);
      mvp.multiplyBy(params.modelViewMatrix);
      uniform.setMatrix4(mvp);
    });
  });
}

function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
  vert.addGlobal("g_vertexData2", VariableType.Vec2);
  vert.addGlobal("g_featureIndexCoords", VariableType.Vec2);

  vert.addFunction(GLSLDecode.uint32);
  vert.addFunction(GLSLDecode.uint32);
  vert.addFunction(unquantizeVertexPositionFromLUT);

  // ###TODO: u_vertLUT, u_vertParams, LookupTable.AddToBuilder()

  vert.addInitializer(initializeVertLUTCoords);
}

export function addPosition(vert: VertexShaderBuilder, fromLUT: boolean) {
  vert.addFunction(unquantizePosition);

  vert.addAttribute("a_pos", VariableType.Vec3, (prog) => {
    prog.addAttribute("a_pos", (attr, params) => { params.geometry.bindVertexArray(attr); });
  });
  vert.addUniform("u_qScale", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qScale", (uniform, params) => {
      uniform.setUniform3fv(params.geometry.qScale);
    });
  });
  vert.addUniform("u_qOrigin", VariableType.Vec3, (prog) => {
    prog.addGraphicUniform("u_qOrigin", (uniform, params) => {
      uniform.setUniform3fv(params.geometry.qOrigin);
    });
  });

  if (!fromLUT) {
    vert.addFunction(unquantizeVertexPosition);
  } else {
    addPositionFromLUT(vert);
  }
}

export namespace GLSLVertex {
  export const earlyDiscard =
    `if (checkForEarlyDiscard(rawPosition)) {
      // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
      // Also place it outside NDC range (for GL_POINTS)
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }`;

  export const discard =
    `if (checkForDiscard()) {
      // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
      // Also place it outside NDC range (for GL_POINTS)
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }`;
}
