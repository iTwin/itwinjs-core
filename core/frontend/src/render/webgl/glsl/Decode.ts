/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { ShaderBuilder } from "../ShaderBuilder";

/** @internal */
export const decodeUint16 = `
float decodeUInt16(vec2 v) {
  return dot(v, vec2(1.0, 256.0)); // v.x | (v.y << 8)
}
`;

/** @internal */
export const decodeUint24 = `
float decodeUInt24(vec3 v) {
  return dot(v, vec3(1.0, 256.0, 256.0*256.0)); // v.x | (v.y << 8) | (v.z << 16)
}
`;

/** @internal */
export const unquantize3d = `
vec3 unquantize3d(vec3 qpos, vec3 origin, vec3 scale) { return origin + scale * qpos; }
`;

/** @internal */
export const unquantize2d = `
// params.xy = origin. params.zw = scale.
vec2 unquantize2d(vec2 qpos, vec4 params) { return params.xy + params.zw * qpos; }
`;

/** @internal */
export const decodeDepthRgb = `
float decodeDepthRgb(vec3 rgb) { return dot(rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0)); }
`;

/** @internal */
export const encodeDepthRgb = `
vec3 encodeDepthRgb(float depth) {
  // 1.0 must be reduced slightly; otherwise decoding will produce zero. It's the far plane, so we don't care (and decoding produces 1.0 anyway).
  depth = min(depth, 16777215.0/16777216.0);

  vec3 enc = vec3(1.0, 255.0, 65025.0) * depth;
  enc = fract(enc);
  enc.xy -= enc.yz / 255.0;
  return enc;
}
`;

/** Pack 2 floats in the integer range [0..255] into a single float equal to v.x | (v.y << 8)
 * @internal
 */
export const pack2Bytes = `
float pack2Bytes(vec2 v) {
  return v.x + (v.y * 256.0);
}
`;

/** Unpack a float in the integer range [0..0xffff] into a vec2 containing 2 integers in the range [0..255]
 * @internal
 */
export const unpack2Bytes = `
vec2 unpack2Bytes(float f) {
  f = floor(f + 0.5);
  vec2 v;
  v.y = floor(f / 256.0);
  v.x = floor(f - v.y * 256.0);
  return v;
}
`;

/** @internal */
export const unpackAndNormalize2Bytes = `
vec2 unpackAndNormalize2Bytes(float f) {
  return unpack2Bytes(f) / 255.0;
}
`;

/** @internal */
export function addUnpackAndNormalize2Bytes(builder: ShaderBuilder): void {
  builder.addFunction(unpack2Bytes);
  builder.addFunction(unpackAndNormalize2Bytes);
}

/** Given an IEEE 32-bit float stuffed into a RGBA unsigned byte texture, extract the float.
 * The input vec4 components are in the integer range [0..255].
 * From https://github.com/CesiumGS/cesium/blob/main/Source/Shaders/Builtin/Functions/unpackFloat.glsl
 * @internal
 */
export const decodeFloat32 = `
float decodeFloat32(vec4 packedFloat) {
  float sign = 1.0 - step(128.0, packedFloat[3]) * 2.0;
  float exponent = 2.0 * mod(packedFloat[3], 128.0) + step(128.0, packedFloat[2]) - 127.0;
  if (exponent == -127.0)
    return 0.0;

  float mantissa = mod(packedFloat[2], 128.0) * 65536.0 + packedFloat[1] * 256.0 + packedFloat[0] + float(0x800000);
  float result = sign * exp2(exponent - 23.0) * mantissa;
  return result;
}
`;

export const decode3Float32 = `
// This expects an array of 4 vec3s, where each vec4 contains a slice of all 3 of the packed floats in .xyz
// pf0 is in [0].x, pf1 is in [0].y, and pf2 in [0].z
// e.g.: packedFloat[0] = vec3(pf0.x, pf1.x, pf2.x)
// likewise .y info is in [1], .z in [2], and .w in [3]
vec3 decode3Float32(vec3 packedFloat[4]) {
  vec3 sign = 1.0 - step(128.0, packedFloat[3].xyz) * 2.0;
  vec3 exponent = 2.0 * mod(packedFloat[3].xyz, 128.0) + step(128.0, packedFloat[2].xyz) - 127.0;
  vec3 zeroFlag = vec3(notEqual(vec3(-127.0), exponent));
  vec3 mantissa = mod(packedFloat[2].xyz, 128.0) * 65536.0 + packedFloat[1].xyz * 256.0 + packedFloat[0].xyz + float(0x800000);
  vec3 result = sign * exp2(exponent - 23.0) * mantissa * zeroFlag;
  return result;
}
`;
