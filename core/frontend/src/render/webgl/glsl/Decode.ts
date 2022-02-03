/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import type { ShaderBuilder } from "../ShaderBuilder";

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
