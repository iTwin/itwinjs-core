/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ShaderBuilder, ProgramBuilder, VariableType, ShaderType } from "../ShaderBuilder";
import { UniformHandle } from "../Handle";
import { DrawParams } from "../DrawCommand";
import { LUTGeometry } from "../CachedGeometry";
import { ShaderFlags } from "../ShaderProgram";
import { System, RenderType } from "../System";
import { assert } from "@bentley/bentleyjs-core";
import { SurfaceGeometry } from "../Surface";

const isShaderBitSet = `
bool isShaderBitSet(float flag) { return 0.0 != extractNthBit(floor(u_shaderFlags + 0.5), flag); }
`;

function addShaderFlagsLookup(shader: ShaderBuilder) {
  shader.addConstant("kShaderBit_Monochrome", VariableType.Float, "0.0");
  shader.addConstant("kShaderBit_NonUniformColor", VariableType.Float, "1.0");
  shader.addConstant("kShaderBit_OITFlatAlphaWeight", VariableType.Float, "2.0");
  shader.addConstant("kShaderBit_OITScaleOutput", VariableType.Float, "3.0");

  shader.addFunction(GLSLCommon.extractNthBit);
  shader.addFunction(isShaderBitSet);
}

export function addViewMatrix(vert: ShaderBuilder): void {
  vert.addUniform("u_viewMatrix", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_viewMatrix", (uniform, params) => {
      uniform.setMatrix4(params.viewMatrix);
    });
  });
}

function setShaderFlags(uniform: UniformHandle, params: DrawParams) {
  assert(params.geometry instanceof LUTGeometry);
  const geom = params.geometry as LUTGeometry;
  let flags = params.target.currentShaderFlags;

  const color = geom.getColor(params.target);
  if (color.isNonUniform)
    flags |= ShaderFlags.NonUniformColor;

  // Certain textures render in the translucent pass but we actually want to maintain true opacity for opaque pixels.
  // For these, use a constant Z to calculate alpha weight.  Otherwise, the opaque things in the texture are weighted by their Z due
  // to the nature of the OIT algorithm.  In this case, we set OITFlatAlphaWeight.

  // Since RGBA8 rendering is very low precision, if we are using that kind of output, we also want to flatten alpha weight.
  // Otherwise, the very tiny Z range makes things fade to black as the precision limit is encountered.  This workaround disregards Z
  // in calculating the color, so it means that transparency is less accurate based on Z-ordering, but it is the best we can do with
  // this algorithm on low-end hardware.
  const maxRenderType = System.instance.capabilities.maxRenderType;
  const surface = params.geometry instanceof SurfaceGeometry ? params.geometry as SurfaceGeometry : undefined;
  if ((undefined !== surface && (surface.isGlyph || surface.isTileSection)) || RenderType.TextureUnsignedByte === maxRenderType)
    flags |= ShaderFlags.OITFlatAlphaWeight;

  // If Cesium-style transparency is being used with non-float texture targets, we must scale the output in the shaders to 0-1 range.
  // Otherwise, it will get implicitly clamped to that range and we'll lose any semblance our desired precision (even though it is low).
  if (maxRenderType < RenderType.TextureHalfFloat)
    flags |= ShaderFlags.OITScaleOutput;

  uniform.setUniform1f(flags);
}

export function addShaderFlags(builder: ProgramBuilder) {
  addShaderFlagsLookup(builder.vert);
  addShaderFlagsLookup(builder.frag);

  builder.addUniform("u_shaderFlags", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_shaderFlags", (uniform, params) => { setShaderFlags(uniform, params); });
  });
}

export function addFrustum(builder: ProgramBuilder) {
  builder.addUniform("u_frustum", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_frustum", (uniform, params) => {
      uniform.setUniform3fv(params.target.frustumUniforms.frustum);
    });
  });

  builder.addGlobal("kFrustumType_Ortho2d", VariableType.Float, ShaderType.Both, "0.0", true);
  builder.addGlobal("kFrustumType_Ortho3d", VariableType.Float, ShaderType.Both, "1.0", true);
  builder.addGlobal("kFrustumType_Perspective", VariableType.Float, ShaderType.Both, "2.0", true);
}

const computeEyeSpace = "v_eyeSpace = (u_mv * rawPosition);";

export function addEyeSpace(builder: ProgramBuilder) {
  builder.addInlineComputedVarying("v_eyeSpace", VariableType.Vec4, computeEyeSpace);
}

export namespace GLSLCommon {
  // Expects flags in range [0...256] with no fraction; and bit is [0..31] with no fraction.
  // Returns 1.0 if the nth bit is set, 0.0 otherwise.
  // dividing flags by 2^(n+1) yields #.5##... if the nth bit is set, #.0##... otherwise
  // Taking the fractional part yields 0.5##...
  // Multiplying by 2.0 and taking the floor yields 1.0 or 0.0
  export const extractNthBit = `
float extractNthBit(float flags, float n) {
  float denom = pow(2.0, n+1.0);
  return floor(fract(flags/denom)*2.0);
}
`;

  // TFS#794899 and related...float values of 0.0 or 1.0 used to indicate false/true apparently do not
  // get precisely preserved when interpolated to fragment shader despite all triangles producing
  // same values. Use this to work around it and make it clear what the code is actually doing.
  export const floatToBool = "\nbool floatToBool(float f) { return floor(f + 0.5) > 0.0; }\n";
}
