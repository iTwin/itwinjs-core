/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */
import { TextureUnit } from "../RenderFlags";
import {
  FragmentShaderComponent, ProgramBuilder, VariableType,
} from "../ShaderBuilder";
import { addInstancedRtcMatrix } from "./Vertex";

const computeContourNdx = `
  if (u_contourLUTWidth == 0u)
      return 15.0;
  uint lutIndex = uint(decodeUInt24(g_featureAndMaterialIndex.xyz));
  bool odd = bool(lutIndex & 1u);
  lutIndex /= 2u;
  uint byteSel = lutIndex & 0x3u;
  lutIndex /= 4u;
  ivec2 coords = ivec2(lutIndex % u_contourLUTWidth, lutIndex / u_contourLUTWidth);
#if 1
  vec4 contourNdx4 = texelFetch(u_contourLUT, coords, 0);
  vec4 byteMask[4] = vec4[]( vec4(1, 0, 0, 0), vec4(0, 1, 0, 0), vec4(0, 0, 1, 0), vec4(0, 0, 0, 1) );
  uint contourNdx = uint(dot(contourNdx4, byteMask[byteSel]) * 255.0 + 0.5);
#else
  uvec4 contourNdx4 = uvec4(texelFetch(u_contourLUT, coords, 0) * 255.0 + 0.5);
  uvec2 contourNdx2 = bool(byteSel & 2u) ? contourNdx4.ba : contourNdx4.rg;
  uint contourNdx = bool(byteSel & 1u) ? contourNdx2.g : contourNdx2.r;
#endif
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
    // return vec4(0.0, 0.5, 1.0, 1.0); // debug for contourNdx map

  const int maxDefs = 5; // max number of contour definitions allowed, have to change index arrays if this changes
  int contourNdxC = clamp(contourNdx, 0, maxDefs - 1);

#if 0
  uint contourDefsNdx[maxDefs] = uint[](0u, 2u, 3u, 5u, 6u);
  uint intervalsPairNdx[maxDefs] = uint[](1u, 1u, 4u, 4u, 7u);
  vec4 rgbf = u_contourDefs[contourDefsNdx[contourNdxC]];
  vec4 intervalsPair = u_contourDefs[intervalsPairNdx[contourNdxC]];
  // intervals.r => minor interval distance, intervals.g => major index count
  vec2 intervals = (contourNdxC & 1) > 0 ? intervalsPair.ba : intervalsPair.rg;

#else
  bool even = (contourNdxC & 1) == 0;
  vec4 rgbf = u_contourDefs[even ? contourNdxC * 3 / 2 : (contourNdxC - 1) * 3 / 2 + 2];
  vec4 intervalsPair = u_contourDefs[(contourNdxC / 2) * 3 + 1];
  // intervals.r => minor interval distance, intervals.g => major index count
  vec2 intervals = even ? intervalsPair.rg : intervalsPair.ba;
#endif

  bool maj = (fract(abs(v_height) / intervals.g) < (0.1 / intervals.g));
  rgbf = unpackAndNormalize2BytesVec4(rgbf, maj);
  // rgba.a => (4-bit linecode / 4-bit weight) maj/min, where the 4-bit weight is a 3-bit weight value with one fraction bit and a 1.5 offset.   This gives a weight range of 1.5 to 9 in 0.5 increments.
  int lineCodeWt = int((rgbf.a * 255.0) + 0.5);
  float lineRadius = (float(lineCodeWt & 0xf) * 0.5 + 1.5) * 0.5;

  float coord = v_height / intervals.r;
  float line = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
  float contourAlpha = lineRadius - min(line, lineRadius);

  // figure out which direction line is going, to know which screen pattern offset to use
  float dx = dFdx(contourAlpha);
  float dy = dFdy(contourAlpha);

  if (contourNdx < 15) {
    const float patLength = 32.0;
    uint patterns[10] = uint[](0xffffffffu, 0x80808080u, 0xf8f8f8f8u, 0xffe0ffe0u, 0xfe10fe10u, 0xe0e0e0e0u, 0xf888f888u, 0xff18ff18u, 0xccccccccu, 0x00000001u);

    float offset = trunc((abs(dx) > abs(dy)) ? gl_FragCoord.y : gl_FragCoord.x);
    offset = mod(offset, patLength);
    uint msk = 1u << uint(offset);
    contourAlpha *= (patterns[lineCodeWt / 16] & msk) > 0u ? 1.0 : 0.0;
    return vec4(mix(baseColor.rgb, rgbf.rgb, contourAlpha), baseColor.a);
  } else {
    return (baseColor);
  }
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

  builder.addFunctionComputedVarying("v_contourNdx", VariableType.Float, "computeContourNdx", computeContourNdx);
  builder.addFunctionComputedVaryingWithArgs("v_height", VariableType.Float, "computeWorldHeight(rawPosition)", computeWorldHeight);

  if (builder.vert.usesInstancedGeometry)
    addInstancedRtcMatrix(builder.vert);

  builder.vert.addUniform("u_contourLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_contourLUT", (uniform, params) => {
      uniform.setUniform1i(TextureUnit.CivilContour - TextureUnit.Zero);  // TODO: why is this needed?
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
