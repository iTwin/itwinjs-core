/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { XYAndZ } from "@itwin/core-geometry";
import { Vector3d } from "@itwin/core-geometry";

const scratchUInt16 = new Uint16Array(1);

function clamp(val: number, minVal: number, maxVal: number): number {
  return val < minVal ? minVal : (val > maxVal ? maxVal : val);
}

function clampUint8(val: number): number {
  return roundUint16(0.5 + (clamp(val, -1, 1) * 0.5 + 0.5) * 255);
}

function roundUint16(val: number): number {
  scratchUInt16[0] = val;
  return scratchUInt16[0];
}

function signNotZero(val: number): number {
  return val < 0.0 ? -1.0 : 1.0;
}

/** Represents a 3d normal vector compressed into a single 16-bit integer using [oct-encoding](http://jcgt.org/published/0003/02/01/paper.pdf).
 * These are chiefly used to reduce the space required to store normal vectors for [RenderGraphic]($frontend)s.
 * @public
 */
export class OctEncodedNormal {
  /** The encoded normal. */
  public readonly value: number;

  /** Construct directly from a 16-bit encoded value.
   * @see [[encode]] to compute the encoded value.
   * @see [[fromVector]] to construct from a vector.
   */
  public constructor(val: number) {
    this.value = roundUint16(val);
  }

  /** Compute the encoded 16-bit value of the supplied normalized vector. */
  public static encode(vec: XYAndZ): number {
    return this.encodeXYZ(vec.x, vec.y, vec.z);
  }

  /** Compute the encoded 16-bit value of the supplied normalized vector components. */
  public static encodeXYZ(nx: number, ny: number, nz: number): number {
    const denom = Math.abs(nx) + Math.abs(ny) + Math.abs(nz);
    let rx = nx / denom;
    let ry = ny / denom;
    if (nz < 0) {
      const x = rx;
      const y = ry;
      rx = (1 - Math.abs(y)) * signNotZero(x);
      ry = (1 - Math.abs(x)) * signNotZero(y);
    }
    return clampUint8(ry) << 8 | clampUint8(rx);
  }

  /** Create an OctEncodedNormal from a normalized vector. */
  public static fromVector(val: XYAndZ): OctEncodedNormal {
    return new OctEncodedNormal(this.encode(val));
  }

  /** Decode this oct-encoded normal into a normalized vector. */
  public decode(): Vector3d {
    return OctEncodedNormal.decodeValue(this.value);
  }

  /** Decode a 16-bit encoded value into a normalized vector. */
  public static decodeValue(val: number, result?: Vector3d): Vector3d {
    let ex = val & 0xff;
    let ey = val >> 8;
    ex = ex / 255.0 * 2.0 - 1.0;
    ey = ey / 255.0 * 2.0 - 1.0;
    const ez = 1 - (Math.abs(ex) + Math.abs(ey));
    let n;
    if (result === undefined) {
      n = new Vector3d(ex, ey, ez);
    } else {
      n = result;
      n.x = ex;
      n.y = ey;
      n.z = ez;
    }

    if (n.z < 0) {
      const x = n.x;
      const y = n.y;
      n.x = (1 - Math.abs(y)) * signNotZero(x);
      n.y = (1 - Math.abs(x)) * signNotZero(y);
    }

    n.normalizeInPlace();
    return n;
  }
}

/** @internal */
export class OctEncodedNormalPair {
  constructor(public first: OctEncodedNormal, public second: OctEncodedNormal) { }
}
