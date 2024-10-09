/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
import { ContourDisplay } from "@itwin/core-common";
import { TextureUnit } from "../RenderFlags";
import {
  FragmentShaderComponent, ProgramBuilder, VariableType,
} from "../ShaderBuilder";
import { addFeatureIndex } from "./FeatureSymbology";
import { addInstancedRtcMatrix } from "./Vertex";

const computeContourNdx = `
  if (u_contourLUTWidth == 0u)
      return 15.0;
  uint lutIndex = uint(getFeatureIndex());
  bool odd = bool(lutIndex & 1u);
  lutIndex /= 2u;
  uint byteSel = lutIndex & 0x3u;
  lutIndex /= 4u;
  ivec2 coords = ivec2(lutIndex % u_contourLUTWidth, lutIndex / u_contourLUTWidth);
  uvec4 contourNdx4 = uvec4(texelFetch(u_contourLUT, coords, 0) * 255.0 + 0.5);
  uvec2 contourNdx2 = bool(byteSel & 2u) ? contourNdx4.ba : contourNdx4.rg;
  uint contourNdx = bool(byteSel & 1u) ? contourNdx2.g : contourNdx2.r;
  return float(odd ? contourNdx >> 4u : contourNdx & 0xFu);
`;

const unpack2BytesVec4 = `
vec4 unpack2BytesVec4(vec4 f, bool upper) {
  f = floor(f + 0.5);
  vec4 outUpper = floor(f / 256.0);
  vec4 outLower = floor(f - outUpper * 256.0);
  return upper ? outUpper : outLower;
}
`;

const unpackAndNormalize2BytesVec4 = `
vec4 unpackAndNormalize2BytesVec4(vec4 f, bool upper) {
  return unpack2BytesVec4(f, upper) / 255.0;
}
`;

const applyContours = `
  int contourNdx = int(v_contourNdx + 0.5);
  if (contourNdx > 14) // 15 => no contours
    return baseColor;

  const int maxDefs = ${ContourDisplay.maxContourGroups}; // max number of contour definitions allowed, have to change index arrays if this changes
  int contourNdxC = clamp(contourNdx, 0, maxDefs - 1);

  bool even = (contourNdxC & 1) == 0;
  vec4 rgbfp = u_contourDefs[even ? contourNdxC * 3 / 2 : (contourNdxC - 1) * 3 / 2 + 2];
  vec4 intervalsPair = u_contourDefs[(contourNdxC / 2) * 3 + 1];
  // intervals.r => minor interval distance, intervals.g => major index count
  vec2 intervals = even ? intervalsPair.rg : intervalsPair.ba;

  float coord = v_height / intervals.r;
  // determine if this is in the vicinity of a major contour line (1/2 an interval either way, which is one limit of drawing width)
  bool maj = (fract((abs(coord) + 0.5) / intervals.g) < (1.0 / intervals.g));
  vec4 rgbf = unpackAndNormalize2BytesVec4(rgbfp, maj);
  // rgbf.a => (4-bit linecode / 4-bit weight) maj/min, where the 4-bit weight is a 3-bit weight value with one fraction bit and a 1.5 offset.
  //    This gives a weight range of 1.5 to 9 in 0.5 increments.
  //    NB: the showGeometry bit flag is stuck in at bit 16 of this, so the major line code has an extra bit in it that needs to be masked out
  int lineCodeWt = int((rgbf.a * 255.0) + 0.5);
  // first * 0.5 is for fractional part of width, then have to add 1.0 for offset, then another 1.0 for actual width bias
  float lineRadius = (float(lineCodeWt & 0xf) * 0.5 + 2.0) * 0.5;

  // abs(fract(coord - 0.5) - 0.5) will produce 0.0 at the contour line, and 0.5 at the mid-point between contour lines
  // fwidth(coord) is sum of absolute diffs in coord in adjacent pixels
  float line = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  // If line is 0 (like at contour line), contourAlpha = lineRadius, so will use draw in contour color
	// If line >= lineRadius, contourAlpha = 0, so won't show contour
  float contourAlpha = lineRadius - min(line, lineRadius);

  // figure out which direction line is going, to know which screen pattern offset to use
  float dx = dFdx(contourAlpha);
  float dy = dFdy(contourAlpha);

  const float patLength = 32.0;
  uint patterns[10] = uint[](0xffffffffu, 0x80808080u, 0xf8f8f8f8u, 0xffe0ffe0u, 0xfe10fe10u, 0xe0e0e0e0u, 0xf888f888u, 0xff18ff18u, 0xccccccccu, 0x00000001u);

  float offset = trunc((abs(dx) > abs(dy)) ? gl_FragCoord.y : gl_FragCoord.x);
  offset = mod(offset, patLength);
  uint msk = 1u << uint(offset);
  contourAlpha *= (patterns[(lineCodeWt / 16) & 0xf] & msk) > 0u ? 1.0 : 0.0;
  contourAlpha = min(contourAlpha, 1.0);
  if (rgbfp.a / 65536.0 < 0.5) { // showGeometry == 0
    if (contourAlpha < 0.5)
      discard;
    return vec4(rgbf.rgb, 1.0);
  }
  // set contour opaque even if base color is transparent
  float alpha = contourAlpha >= 0.5 ? 1.0 : baseColor.a;
  return vec4(mix(baseColor.rgb, rgbf.rgb, contourAlpha), alpha);
`;

/** @internal */
export function addApplyContours(builder: ProgramBuilder) {
  const modelPos = builder.vert.usesInstancedGeometry ? "(g_instancedRtcMatrix * rawPosition)" : "rawPosition";

  const computeWorldHeight = `
float computeWorldHeight(vec4 rawPosition) {
  float height = (u_modelToWorldC * ${modelPos}).z;
  // TODO: apply ECEF correction to height
  return height;
}
`;

  addFeatureIndex(builder.vert);

  builder.addFunctionComputedVarying("v_contourNdx", VariableType.Float, "computeContourNdx", computeContourNdx);
  builder.addFunctionComputedVaryingWithArgs("v_height", VariableType.Float, "computeWorldHeight(rawPosition)", computeWorldHeight);

  if (builder.vert.usesInstancedGeometry)
    addInstancedRtcMatrix(builder.vert);

  builder.vert.addUniform("u_contourLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_contourLUT", (uniform, params) => {
      // set this uniform here so that it won't cause problems (e.g.: loopback) if it does not end up being set by bindContourLUT call
      uniform.setUniform1i(TextureUnit.Contours - TextureUnit.Zero);
      params.target.uniforms.batch.bindContourLUT(uniform);
    });
  });

  builder.vert.addUniform("u_contourLUTWidth", VariableType.Uint, (prog) => {
    prog.addGraphicUniform("u_contourLUTWidth", (uniform, params) => {
      params.target.uniforms.batch.bindContourLUTWidth(uniform);
    });
  });

  builder.vert.addUniform("u_modelToWorldC", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_modelToWorldC", (uniform, params) => {
      params.target.uniforms.branch.bindModelToWorldTransform(uniform, params.geometry, false);
    });
  });

  const contourDefsSize = 8;
  builder.frag.addUniformArray("u_contourDefs", VariableType.Vec4, contourDefsSize, (prog) => {
    prog.addGraphicUniform("u_contourDefs", (uniform, params) => {
      params.target.uniforms.contours.bindcontourDefs(uniform);
    });
  });

  builder.frag.addFunction(unpack2BytesVec4);
  builder.frag.addFunction(unpackAndNormalize2BytesVec4);
  builder.frag.set(FragmentShaderComponent.ApplyContours, applyContours);
}
