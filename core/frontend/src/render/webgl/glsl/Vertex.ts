/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { DrawParams } from "../DrawCommand";
import { UniformHandle } from "../UniformHandle";
import { Matrix4 } from "../Matrix";
import { Pass, TextureUnit } from "../RenderFlags";
import { IsInstanced, PositionType } from "../TechniqueFlags";
import { VariableType, VertexShaderBuilder } from "../ShaderBuilder";
import { System } from "../System";
import { decode3Float32, decodeUint16, decodeUint24 } from "./Decode";
import { addInstanceOverrides } from "./Instancing";
import { addLookupTable } from "./LookupTable";

const initializeVertLUTCoords = `
  g_vertexLUTIndex = decodeUInt24(qpos);
  g_vertexBaseCoords = compute_vert_coords(g_vertexLUTIndex);
`;

/** @internal */
export const unquantizePosition = `
vec4 unquantizePosition(vec3 pos, vec3 origin, vec3 scale) { return vec4(origin + scale * pos, 1.0); }
`;

const computeQuantizedPosition = `
vec4 computeVertexPosition(vec3 pos) { return unquantizePosition(pos, u_qOrigin, u_qScale); }
`;

// Need to read 2 rgba values to obtain 6 16-bit integers for position
const computeVertexPositionFromLUT = `
vec4 computeVertexPosition(vec3 encodedIndex) {
  vec3 qpos = vec3(decodeUInt16(g_vertLutData0.xy), decodeUInt16(g_vertLutData0.zw), decodeUInt16(g_vertLutData1.xy));
  g_featureAndMaterialIndex = g_vertLutData2;
  return unquantizePosition(qpos, u_qOrigin, u_qScale);
}
`;

const computeUnquantizedPosition1 = `
vec4 computeVertexPosition(vec3 encodedIndex) {
  vec3 pf[4];
  pf[0] = g_vertLutData0.xyz;
  g_featureAndMaterialIndex.x = g_vertLutData0.w;
  pf[1] = g_vertLutData1.xyz;
  g_featureAndMaterialIndex.y = g_vertLutData1.w;
  pf[2] = g_vertLutData2.xyz;
  g_featureAndMaterialIndex.z = g_vertLutData2.w;
  pf[3] = g_vertLutData3.xyz;
  g_featureAndMaterialIndex.w = g_vertLutData3.w;
  return vec4(decode3Float32(pf), 1.0);
}
`;

const computeUnquantizedPosition2 = `
vec4 computeVertexPosition(vec3 encodedIndex) {
  uvec3 vux = uvec3(g_vertLutData0.xyz);
  g_featureAndMaterialIndex.x = g_vertLutData0.w;
  uvec3 vuy = uvec3(g_vertLutData1.xyz);
  g_featureAndMaterialIndex.y = g_vertLutData1.w;
  uvec3 vuz = uvec3(g_vertLutData2.xyz);
  g_featureAndMaterialIndex.z = g_vertLutData2.w;
  uvec3 vuw = uvec3(g_vertLutData3.xyz);
  g_featureAndMaterialIndex.w = g_vertLutData3.w;
  uvec3 u = (vuw << 24) | (vuz << 16) | (vuy << 8) | vux;
  return vec4(uintBitsToFloat(u), 1.0);
}
`;

const computeLineWeight = "\nfloat computeLineWeight() { return g_lineWeight; }\n";
const computeLineCode = "\nfloat computeLineCode() { return g_lineCode; }\n";

export function addSamplePosition(vert: VertexShaderBuilder): void {
  vert.addFunction(getSamplePosition(vert.positionType));
}

function getSamplePosition(type: PositionType): string {
  const prelude = `
    vec4 samplePosition(float index) {
      vec2 tc = compute_vert_coords(index);`;

  if ("quantized" === type) {
    return `
    ${prelude}
      vec4 e0 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
      tc.x += g_vert_stepX;
      vec4 e1 = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
      vec3 qpos = vec3(decodeUInt16(e0.xy), decodeUInt16(e0.zw), decodeUInt16(e1.xy));
      return unquantizePosition(qpos, u_qOrigin, u_qScale);
    }
    `;
  }

  if (System.instance.capabilities.isWebGL2) {
    return `
    ${prelude}
      uvec3 vux = uvec3(floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5));
      tc.x += g_vert_stepX;
      uvec3 vuy = uvec3(floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5));
      tc.x += g_vert_stepX;
      uvec3 vuz = uvec3(floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5));
      tc.x += g_vert_stepX;
      uvec3 vuw = uvec3(floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5));
      uvec3 u = (vuw << 24) | (vuz << 16) | (vuy << 8) | vux;
      return vec4(uintBitsToFloat(u), 1.0);
    }`;
  }

  return `
    ${prelude}
      vec3 pf[4];
      pf[0] = floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5);
      tc.x += g_vert_stepX;
      pf[1] = floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5);
      tc.x += g_vert_stepX;
      pf[2] = floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5);
      tc.x += g_vert_stepX;
      pf[3] = floor(TEXTURE(u_vertLUT, tc).xyz * 255.0 + 0.5);
      return vec4(decode3Float32(pf), 1.0);
    }`;
}

/** @internal */
export function addModelViewProjectionMatrix(vert: VertexShaderBuilder): void {
  if (vert.usesInstancedGeometry) {
    addModelViewMatrix(vert);
    addProjectionMatrix(vert);
    vert.addGlobal("g_mvp", VariableType.Mat4);
    vert.addInitializer("g_mvp = u_proj * g_mv;");
  } else {
    vert.addUniform("u_mvp", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_mvp", (uniform, params) => {
        params.target.uniforms.branch.bindModelViewProjectionMatrix(uniform, params.geometry, params.isViewCoords);
      });
    });
  }
}

/** @internal */
export function addProjectionMatrix(vert: VertexShaderBuilder): void {
  vert.addUniform("u_proj", VariableType.Mat4, (prog) => {
    prog.addProgramUniform("u_proj", (uniform, params) => {
      params.bindProjectionMatrix(uniform);
    });
  });
}

const computeInstancedRtcMatrix = `
  g_instancedRtcMatrix = u_instanced_rtc * g_modelMatrixRTC;
`;

/** @internal */
export function addInstancedRtcMatrix(vert: VertexShaderBuilder): void {
  if (!vert.usesInstancedGeometry) return;

  assert(undefined !== vert.find("g_modelMatrixRTC")); // set up in VertexShaderBuilder constructor...
  vert.addUniform("u_instanced_rtc", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_instanced_rtc", (uniform, params) => {
      const modelt = params.geometry.asInstanced!.getRtcOnlyTransform();
      uniform.setMatrix4(Matrix4.fromTransform(modelt));
    });
  });

  vert.addGlobal("g_instancedRtcMatrix", VariableType.Mat4);
  vert.addInitializer(computeInstancedRtcMatrix);
}

/** @internal */
export function addModelViewMatrix(vert: VertexShaderBuilder): void {
  const bind = (uniform: UniformHandle, params: DrawParams) => {
    params.target.uniforms.branch.bindModelViewMatrix(uniform, params.geometry, params.isViewCoords);
  };

  if (vert.usesInstancedGeometry) {
    vert.addUniform("u_instanced_modelView", VariableType.Mat4, (prog) => {
      prog.addGraphicUniform("u_instanced_modelView", bind);
    });

    vert.addGlobal("g_mv", VariableType.Mat4);
    vert.addInitializer("g_mv = u_instanced_modelView * g_modelMatrixRTC;");
  } else {
    vert.addUniform("u_mv", VariableType.Mat4, (prog) => {
      // ###TODO: We only need 3 rows, not 4...
      prog.addGraphicUniform("u_mv", bind);
    });
  }
}

const computeNormalMatrix = `
  g_nmx = mat3(u_modelViewN);
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

const computeNormalMatrix2 = `
  g_nmx = transpose(inverse(mat3(MAT_MV)));
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

const computeNormalMatrix1Inst = `
  g_nmx = mat3(MAT_MV);
  g_nmx[0][0] *= u_frustumScale.x;
  g_nmx[1][1] *= u_frustumScale.y;
`;

/** @internal */
export function addNormalMatrix(vert: VertexShaderBuilder, instanced: IsInstanced) {
  vert.addGlobal("g_nmx", VariableType.Mat3);
  vert.addUniform("u_frustumScale", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_frustumScale", (uniform, params) => {
      const scale = params.target.uniforms.branch.top.frustumScale;
      uniform.setUniform2fv([scale.x, scale.y]);
    });
  });

  if (System.instance.capabilities.isWebGL2) {
    vert.addInitializer(computeNormalMatrix2);
  } else if (IsInstanced.Yes === instanced) {
    vert.addInitializer(computeNormalMatrix1Inst);
  } else {
    vert.addUniform("u_modelViewN", VariableType.Mat3, (prog) => {
      prog.addGraphicUniform("u_modelViewN", (uniform, params) => {
        params.target.uniforms.branch.bindModelViewNTransform(uniform, params.geometry, false);
      });
    });
    vert.addInitializer(computeNormalMatrix);
  }
}

function readVertexData(index: number): string {
  return `g_vertLutData${index} = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);`;
}

const nextVertexData = "tc.x += g_vert_stepX;";

function readNextVertexData(index: number): string {
  return `
  ${nextVertexData}
  ${readVertexData(index)}`;
}

const prereadVertexDataPrelude = `
  vec2 tc = g_vertexBaseCoords;
  ${readVertexData(0)}
  ${readNextVertexData(1)}
  ${readNextVertexData(2)}
`;

const prereadQuantizedVertexData = `${prereadVertexDataPrelude}
  if (3.0 < u_vertParams.z) {
    ${readNextVertexData(3)}
  }
`;

const prereadUnquantizedVertexData = `${prereadVertexDataPrelude}
  ${readNextVertexData(3)}
  ${readNextVertexData(4)}
  if (5.0 < u_vertParams.z) {
    ${readNextVertexData(5)}
  }
`;

const scratchLutParams = new Float32Array(4);
function addPositionFromLUT(vert: VertexShaderBuilder) {
  vert.addGlobal("g_vertexLUTIndex", VariableType.Float);
  vert.addGlobal("g_vertexBaseCoords", VariableType.Vec2);

  const unquantized = "unquantized" === vert.positionType;
  const maxRgbaPerVert = unquantized ? 6 : 4;
  for (let i = 0; i < maxRgbaPerVert; i++) vert.addGlobal(`g_vertLutData${i}`, VariableType.Vec4);

  vert.addFunction(decodeUint24);
  vert.addFunction(decodeUint16);

  if (unquantized) {
    if (System.instance.capabilities.isWebGL2) {
      vert.addFunction(computeUnquantizedPosition2);
    } else {
      vert.addFunction(decode3Float32);
      vert.addFunction(computeUnquantizedPosition1);
    }
  } else {
    vert.addFunction(computeVertexPositionFromLUT);
  }

  vert.addUniform("u_vertLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_vertLUT", (uniform, params) => {
      params.geometry.asLUT!.lut.texture.bindSampler(uniform, TextureUnit.VertexLUT);
    });
  });

  vert.addUniform("u_vertParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_vertParams", (uniform, params) => {
      assert(undefined !== params.geometry.asLUT);
      const lut = params.geometry.asLUT.lut;
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

  vert.addGlobal("g_featureAndMaterialIndex", VariableType.Vec4);

  // Read the vertex data from the vertex table up front.  Yields a consistent (if unexplainable) small performance boost.
  vert.addInitializer(unquantized ? prereadUnquantizedVertexData : prereadQuantizedVertexData);
}

/** @internal */
export function addPosition(vert: VertexShaderBuilder, fromLUT: boolean) {
  if (!fromLUT || "quantized" === vert.positionType) {
    vert.addFunction(unquantizePosition);
    vert.addUniform("u_qScale", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_qScale", (uniform, params) => {
        assert(params.geometry.usesQuantizedPositions);
        uniform.setUniform3fv(params.geometry.qScale);
      });
    });
    vert.addUniform("u_qOrigin", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_qOrigin", (uniform, params) => {
        assert(params.geometry.usesQuantizedPositions);
        uniform.setUniform3fv(params.geometry.qOrigin);
      });
    });
  }

  if (!fromLUT) {
    vert.addFunction(computeQuantizedPosition);
  } else {
    addPositionFromLUT(vert);
  }
}

/** @internal */
export function addAlpha(vert: VertexShaderBuilder): void {
  vert.addUniform("u_hasAlpha", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_hasAlpha", (uniform, params) => {
      uniform.setUniform1f(Pass.rendersTranslucent(params.geometry.getPass(params.target)) ? 1 : 0);
    });
  });
}

/** @internal */
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

/** @internal */
export function replaceLineWeight(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineWeight, func);
}

/** @internal */
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

/** @internal */
export function replaceLineCode(vert: VertexShaderBuilder, func: string): void {
  vert.replaceFunction(computeLineCode, func);
}

// This vertex belongs to a triangle which should not be rendered. Produce a degenerate triangle.
// Also place it outside NDC range (for GL_POINTS)
const discardVertex = ` {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
`;

/** @internal */
export const earlyVertexDiscard = `  if (checkForEarlyDiscard(rawPosition))${discardVertex}`;
/** @internal */
export const vertexDiscard = `  if (checkForDiscard())${discardVertex}`;
/** @internal */
export const lateVertexDiscard = `  if (checkForLateDiscard())${discardVertex}`;
