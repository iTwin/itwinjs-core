/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { RenderType } from "@itwin/webgl-compatibility";
import { DrawParams } from "../DrawCommand";
import { UniformHandle } from "../UniformHandle";
import { ProgramBuilder, ShaderBuilder, ShaderType, VariableType } from "../ShaderBuilder";
import { System } from "../System";
import { addModelViewMatrix } from "./Vertex";

// These are not used anywhere currently, but will leave them here commented out in case we want them later.
// const chooseFloatWithBitFlag2 = `
// float chooseFloatWithBitFlag(float f1, float f2, uint flags, uint n) { return 0u != (flags & n) ? f2 : f1; }
// `;

const chooseVec2With2BitFlags = `
vec2 chooseVec2With2BitFlags(vec2 v1, vec2 v2, uint flags, uint n1, uint n2) { return 0u != (flags & (n1 | n2)) ? v2 : v1; }
`;

const chooseVec3WithBitFlag = `
vec3 chooseVec3WithBitFlag(vec3 v1, vec3 v2, uint flags, uint n) { return 0u != (flags & n) ? v2 : v1; }
`;

/** @internal */
export function addChooseVec2WithBitFlagsFunction(shader: ShaderBuilder) {
  shader.addFunction(extractNthBit);
  shader.addFunction(chooseVec2With2BitFlags);
}

/** @internal */
export function addChooseVec3WithBitFlagFunction(shader: ShaderBuilder) {
  shader.addFunction(extractNthBit);
  shader.addFunction(chooseVec3WithBitFlag);
}

function addShaderFlagsConstants(shader: ShaderBuilder) {
  shader.addConstant("kShaderBit_Monochrome", VariableType.Int, "0");
  shader.addConstant("kShaderBit_NonUniformColor", VariableType.Int, "1");
  shader.addConstant("kShaderBit_OITFlatAlphaWeight", VariableType.Int, "2");
  shader.addConstant("kShaderBit_OITScaleOutput", VariableType.Int, "3");
  shader.addConstant("kShaderBit_IgnoreNonLocatable", VariableType.Int, "4");
}

const shaderFlagArray = new Int32Array(5);
const kShaderBitMonochrome = 0;
const kShaderBitNonUniformColor = 1;
const kShaderBitOITFlatAlphaWeight = 2;
const kShaderBitOITScaleOutput = 3;
const kShaderBitIgnoreNonLocatable = 4;

function setShaderFlags(uniform: UniformHandle, params: DrawParams) {
  const monochrome = params.target.currentViewFlags.monochrome && params.geometry.wantMonochrome(params.target);
  shaderFlagArray[kShaderBitMonochrome] = monochrome ? 1 : 0;

  shaderFlagArray[kShaderBitNonUniformColor] = 0;
  shaderFlagArray[kShaderBitOITFlatAlphaWeight] = 0;
  shaderFlagArray[kShaderBitOITScaleOutput] = 0;
  shaderFlagArray[kShaderBitIgnoreNonLocatable] = 0;

  const geom = params.geometry.asLUT;
  if (undefined !== geom) {
    // Could also be RealityMeshGeometry, so only detect non-uniform color if explicitly LUTGeometry.
    const color = geom.getColor(params.target);
    if (color.isNonUniform)
      shaderFlagArray[kShaderBitNonUniformColor] = 1;
  }

  // Certain textures render in the translucent pass but we actually want to maintain true opacity for opaque pixels.
  // For these, use a constant Z to calculate alpha weight.  Otherwise, the opaque things in the texture are weighted by their Z due
  // to the nature of the OIT algorithm.  In this case, we set OITFlatAlphaWeight.

  // Since RGBA8 rendering is very low precision, if we are using that kind of output, we also want to flatten alpha weight.
  // Otherwise, the very tiny Z range makes things fade to black as the precision limit is encountered.  This workaround disregards Z
  // in calculating the color, so it means that transparency is less accurate based on Z-ordering, but it is the best we can do with
  // this algorithm on low-end hardware.

  // Finally, the application can put the viewport into "fadeout mode", which explicitly enables flat alpha weight in order to de-emphasize transparent geometry.
  const maxRenderType = System.instance.maxRenderType;
  let flatAlphaWeight = RenderType.TextureUnsignedByte === maxRenderType || params.target.isFadeOutActive;
  if (!flatAlphaWeight) {
    const surface = params.geometry.asSurface;
    flatAlphaWeight = undefined !== surface && (surface.isGlyph || surface.isTileSection);
  }

  if (flatAlphaWeight)
    shaderFlagArray[kShaderBitOITFlatAlphaWeight] = 1;

  // If Cesium-style transparency is being used with non-float texture targets, we must scale the output in the shaders to 0-1 range.
  // Otherwise, it will get implicitly clamped to that range and we'll lose any semblance our desired precision (even though it is low).
  if (maxRenderType < RenderType.TextureHalfFloat)
    shaderFlagArray[kShaderBitOITScaleOutput] = 1;

  if (!params.target.drawNonLocatable)
    shaderFlagArray[kShaderBitIgnoreNonLocatable] = 1;

  uniform.setUniform1iv(shaderFlagArray);
}

/** @internal */
export function addShaderFlags(builder: ProgramBuilder) {
  addShaderFlagsConstants(builder.vert);
  addShaderFlagsConstants(builder.frag);

  builder.addUniformArray("u_shaderFlags", VariableType.Boolean, 5, (prog) => {
    prog.addGraphicUniform("u_shaderFlags", (uniform, params) => setShaderFlags(uniform, params));
  });
}

/** @internal */
export function addFrustum(builder: ProgramBuilder) {
  builder.addUniform("u_frustum", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_frustum", (uniform, params) => {
      uniform.setUniform3fv(params.target.uniforms.frustum.frustum);
    });
  });

  builder.addGlobal("kFrustumType_Ortho2d", VariableType.Float, ShaderType.Both, "0.0", true);
  builder.addGlobal("kFrustumType_Ortho3d", VariableType.Float, ShaderType.Both, "1.0", true);
  builder.addGlobal("kFrustumType_Perspective", VariableType.Float, ShaderType.Both, "2.0", true);
}

const computeEyeSpace = "v_eyeSpace = (MAT_MV * rawPosition).rgb;";

/** @internal */
export function addEyeSpace(builder: ProgramBuilder) {
  addModelViewMatrix(builder.vert);
  builder.addInlineComputedVarying("v_eyeSpace", VariableType.Vec3, computeEyeSpace);
}

/** @internal */
export const addUInt32s = `
vec4 addUInt32s(vec4 a, vec4 b) {
  vec4 c = a + b;
  if (c.x > 255.0) { c.x -= 256.0; c.y += 1.0; }
  if (c.y > 255.0) { c.y -= 256.0; c.z += 1.0; }
  if (c.z > 255.0) { c.z -= 256.0; c.w += 1.0; }
  return c;
}
`;

/** Expects flags in range [0...256] with no fraction; and bit is [0..31] with no fraction.
 * Return true if bit `n` is set in `flags`.
 */
const nthBitSet = `
bool nthBitSet(float flags, uint n) { return 0u != (uint(flags) & n); }
`;

/** @internal */
const extractNthBit = `
float extractNthBit(float flags, uint n) { return 0u != (uint(flags) & n) ? 1.0 : 0.0; }
`;

/** @internal */
export function addExtractNthBit(shader: ShaderBuilder): void {
  shader.addFunction(nthBitSet);
  shader.addFunction(extractNthBit);
}
