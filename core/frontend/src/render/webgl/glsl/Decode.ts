/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export namespace GLSLDecode {
  export const uint16 =
    `float decodeUInt16(vec2 v) {
      v = v * vec2(1.0, 256.0); // v.y <<= 8
      return dot(v, vec2(1.0)); // v.x+v.y => v.x | v.y
    }`;

  export const uint32 =
    `float decodeUInt32(vec3 v) {
      v = v * vec3(1.0, 256.0, 256.0*256.0); // v.y <<= 8; v.z <<= 16
      return dot(v, vec3(1.0)); // v.x+v.y+v.z => v.x | v.y | v.z
    }`;
}
