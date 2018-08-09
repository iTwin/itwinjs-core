/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

/** GLSLDecode */
export namespace GLSLDecode {
  export const uint16 = `
float decodeUInt16(vec2 v) {
  v = v * vec2(1.0, 256.0); // v.y <<= 8
  return dot(v, vec2(1.0)); // v.x+v.y => v.x | v.y
}
`;

  export const uint32 = `
float decodeUInt32(vec3 v) {
  v = v * vec3(1.0, 256.0, 256.0*256.0); // v.y <<= 8; v.z <<= 16
  return dot(v, vec3(1.0)); // v.x+v.y+v.z => v.x | v.y | v.z
}
`;

  export const unquantize3d = `
vec3 unquantize3d(vec3 qpos, vec3 origin, vec3 scale) { return origin + scale * qpos; }
`;

  export const unquantize2d = `
// params.xy = origin. params.zw = scale.
vec2 unquantize2d(vec2 qpos, vec4 params) { return params.xy + params.zw * qpos; }
`;

  export const depthRgb = `
float decodeDepthRgb(vec3 rgb) { return dot(rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0)); }
`;

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
}
