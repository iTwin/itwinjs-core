/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

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
    }`;
}
