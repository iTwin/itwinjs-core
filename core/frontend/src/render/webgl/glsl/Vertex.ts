/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { Matrix3, Matrix4 } from "../Matrix";
import { LUTGeometry } from "../CachedGeometry";
import { TextureUnit, RenderPass } from "../RenderFlags";
import { GLSLDecode } from "./Decode";
import { addLookupTable } from "./LookupTable";

const initializeVertLUTCoords = `
  g_vertexLUTIndex = decodeUInt32(a_pos);
  g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);
`;

const unquantizePosition = `
vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) { return vec4(origin + scale * pos, 1.0); }
`;

const unquantizeVertexPosition = `
vec4 unquantizeVertexPosition(vec3 pos, vec3 origin, vec3 scale) { return unquantizePosition(pos, origin, scale); }
`;

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
}
`;

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

export function addProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_proj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_proj", (uniform, params) => {
      uniform.setMatrix4(params.projectionMatrix);
    });
  });
}

export function addModelViewMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_mv", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_mv", (uniform, params) => {
      uniform.setMatrix4(params.modelViewMatrix);
    });
  });
}

export function addNormalMatrix(vert: VertexShaderBuilder) {
  vert.addUniform("u_nmx", VariableType.Mat3, (prog) => {
    prog.addGraphicUniform("u_nmx", (uniform, params) => {
      const rotMat: Matrix3 | undefined = params.modelViewMatrix.getRotation();
      if (undefined !== rotMat)
        uniform.setMatrix3(rotMat);
    });
  });
}

const scratchLutParams = new Float32Array(4);
function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
  vert.addGlobal("g_vertexData2", VariableType.Vec2);
  vert.addGlobal("g_featureIndexCoords", VariableType.Vec2);

  vert.addFunction(GLSLDecode.uint32);
  vert.addFunction(GLSLDecode.uint16);
  vert.addFunction(unquantizeVertexPositionFromLUT);

  vert.addUniform("u_vertLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_vertLUT", (uniform, params) => {
      (params.geometry as LUTGeometry).lut.texture.bindSampler(uniform, TextureUnit.VertexLUT);
    });
  });

  vert.addUniform("u_vertParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_vertParams", (uniform, params) => {
      const lutGeom: LUTGeometry = params.geometry as LUTGeometry;
      const lut = lutGeom.lut;
      const lutParams = scratchLutParams;
      lutParams[0] = lut.texture.width;
      lutParams[1] = lut.texture.height;
      lutParams[2] = lut.numRgbaPerVertex;
      lutParams[3] = lut.numVertices;
      uniform.setUniform4fv(lutParams);
    });
  });

  addLookupTable(vert, "vert", "u_vertParams.z");
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

export function addAlpha(vert: VertexShaderBuilder): void {
  vert.addUniform("u_hasAlpha", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_hasAlpha", (uniform, params) => {
      uniform.setUniform1f(RenderPass.Translucent === params.geometry.getRenderPass(params.target) ? 1.0 : 0.0);
    });
  });
}

export namespace GLSLVertex {
  export const earlyDiscard = `
  if (checkForEarlyDiscard(rawPosition)) {
    // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
    // Also place it outside NDC range (for GL_POINTS)
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

`;

  export const discard = `
  if (checkForDiscard()) {
    // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
    // Also place it outside NDC range (for GL_POINTS)
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

`;

  export const computeLineWeight = "\nfloat ComputeLineWeight() { return u_lineWeight; }\n";
  export const computeLineCode = "\nfloat ComputeLineCode() { return u_lineCode; }\n";
}
