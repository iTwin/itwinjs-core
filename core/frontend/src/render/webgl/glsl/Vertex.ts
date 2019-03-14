/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { VertexShaderBuilder, VariableType } from "../ShaderBuilder";
import { Matrix3, Matrix4 } from "../Matrix";
import { TextureUnit, RenderPass } from "../RenderFlags";
import { GLSLDecode } from "./Decode";
import { addLookupTable } from "./LookupTable";
import { addInstanceOverrides } from "./Instancing";

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

// Need to read 2 rgba values to obtain 6 16-bit integers for position
const unquantizeVertexPositionFromLUTPrelude = `
vec4 unquantizeVertexPosition(vec3 encodedIndex, vec3 origin, vec3 scale) {
  vec2 tc = g_vertexBaseCoords;
  vec4 enc1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  tc.x += g_vert_stepX;
  vec4 enc2 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
`;
const computeFeatureIndexCoords = `
  tc.x += g_vert_stepX;
  g_featureIndexCoords = tc;
`;
const unquantizeVertexPositionFromLUTPostlude = `
  vec3 qpos = vec3(decodeUInt16(enc1.xy), decodeUInt16(enc1.zw), decodeUInt16(enc2.xy));
  g_vertexData2 = enc2.zw;
  return unquantizePosition(qpos, origin, scale);
}
`;

const computeLineWeight = "\nfloat computeLineWeight() { return g_lineWeight; }\n";
const computeLineCode = "\nfloat computeLineCode() { return g_lineCode; }\n";

const scratchMVPMatrix = new Matrix4();

export function addModelViewProjectionMatrix(vert: VertexShaderBuilder): void {
  if (vert.usesInstancedGeometry) {
    addModelViewMatrix(vert);
    addProjectionMatrix(vert);
    vert.addGlobal("g_mvp", VariableType.Mat4);
    vert.addInitializer("g_mvp = u_proj * g_mv;");
  } else {
    vert.addUniform("u_mvp", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_mvp", (uniform, params) => {
        const mvp = params.projectionMatrix.clone(scratchMVPMatrix);
        mvp.multiplyBy(params.modelViewMatrix);
        uniform.setMatrix4(mvp);
      });
    });
  }
}

export function addProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_proj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_proj", (uniform, params) => {
      uniform.setMatrix4(params.projectionMatrix);
    });
  });
}

export function addModelViewMatrix(vert: VertexShaderBuilder): void {
  if (vert.usesInstancedGeometry) {
    vert.addUniform("u_instanced_modelView", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_instanced_modelView", (uniform, params) => {
        uniform.setMatrix4(params.modelViewMatrix);
      });
    });

    vert.addGlobal("g_mv", VariableType.Mat4);
    vert.addInitializer("g_mv = u_instanced_modelView * g_modelMatrix;");
  } else {
    vert.addUniform("u_mv", VariableType.Mat4, (prog) => {
      // ###TODO: We only need 3 rows, not 4...
      prog.addGraphicUniform("u_mv", (uniform, params) => {
        uniform.setMatrix4(params.modelViewMatrix);
      });
    });
  }
}

export function addNormalMatrix(vert: VertexShaderBuilder) {
  if (vert.usesInstancedGeometry) {
    vert.addGlobal("g_nmx", VariableType.Mat3);
    vert.addInitializer("g_nmx = mat3(MAT_MV);");
  } else {
    vert.addUniform("u_nmx", VariableType.Mat3, (prog) => {
      prog.addGraphicUniform("u_nmx", (uniform, params) => {
        const rotMat: Matrix3 | undefined = params.modelViewMatrix.getRotation();
        if (undefined !== rotMat)
          uniform.setMatrix3(rotMat);
      });
    });
  }
}

const scratchLutParams = new Float32Array(4);
function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);
  vert.addGlobal("g_vertexData2", VariableType.Vec2);

  vert.addFunction(GLSLDecode.uint32);
  vert.addFunction(GLSLDecode.uint16);
  if (vert.usesInstancedGeometry) {
    vert.addFunction(unquantizeVertexPositionFromLUTPrelude + unquantizeVertexPositionFromLUTPostlude);
  } else {
    vert.addGlobal("g_featureIndexCoords", VariableType.Vec2);
    vert.addFunction(unquantizeVertexPositionFromLUTPrelude + computeFeatureIndexCoords + unquantizeVertexPositionFromLUTPostlude);
  }

  vert.addUniform("u_vertLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_vertLUT", (uniform, params) => {
      (params.geometry.asLUT!).lut.texture.bindSampler(uniform, TextureUnit.VertexLUT);
    });
  });

  vert.addUniform("u_vertParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_vertParams", (uniform, params) => {
      assert(undefined !== params.geometry.asLUT);
      const lut = params.geometry.asLUT!.lut;
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

export function addLineWeight(vert: VertexShaderBuilder): void {
  vert.addUniform("u_lineWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineWeight", (attr, params) => {
      attr.setUniform1f(params.geometry.getLineWeight(params.programParams));
    });
  });

  vert.addGlobal("g_lineWeight", VariableType.Float);
  if (vert.usesInstancedGeometry) {
    addInstanceOverrides(vert);
    vert.addInitializer("g_lineWeight = mix(u_lineWeight, a_instanceOverrides.g, extractInstanceBit(kOvrBit_Weight));");
  } else {
    vert.addInitializer("g_lineWeight = u_lineWeight;");
  }

  vert.addFunction(computeLineWeight);
}

export function replaceLineWeight(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineWeight, func);
}

export function addLineCode(vert: VertexShaderBuilder): void {
  vert.addUniform("u_lineCode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineCode", (attr, params) => {
      attr.setUniform1f(params.geometry.getLineCode(params.programParams));
    });
  });

  vert.addGlobal("g_lineCode", VariableType.Float);
  if (vert.usesInstancedGeometry) {
    addInstanceOverrides(vert);
    vert.addInitializer("g_lineCode = mix(u_lineCode, a_instanceOverrides.b, extractInstanceBit(kOvrBit_LineCode));");
  } else {
    vert.addInitializer("g_lineCode = u_lineCode;");
  }

  vert.addFunction(computeLineCode);
}

export function replaceLineCode(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineCode, func);
}

export namespace GLSLVertex {
  // This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
  // Also place it outside NDC range (for GL_POINTS)
  const discardVertex = `
{
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  return;
}
`;

  export const earlyDiscard = `  if (checkForEarlyDiscard(rawPosition))` + discardVertex;
  export const discard = `  if (checkForDiscard())` + discardVertex;
  export const lateDiscard = `  if (checkForLateDiscard())` + discardVertex;
}
