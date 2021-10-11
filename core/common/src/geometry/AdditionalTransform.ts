/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */
// cspell:ignore Helmert

import { Geometry } from "@itwin/core-geometry";

/** An affine transformation with an additional Z Offset.
 *  The equations are:
 *  given a = scale * cos(rotation) and b = scale * sin(rotation)
 *  X = a * x - b * y + translationX
 *  Y = b * x + a * y + translationY
 *  Z = z + translationZ
 *  @public
 */
export interface Helmert2DWithZOffsetProps {
  /** The X post translation */
  translationX: number;
  /** The Y post-translation */
  translationY: number;
  /** The Z post-translation or Z offset*/
  translationZ: number;
  /** The rotation in the trigonometric (CCW) direction in degrees. */
  rotDeg: number;
  /** The scale. This scale applies to both X and Y axises. Does not apply to Z. */
  scale: number;
}

/** An affine transformation with an additional Z Offset.
 *  The equations are:
 *  given a = scale * cos(rotation) and b = scale * sin(rotation)
 *  X = a * x - b * y + translationX
 *  Y = b * x + a * y + translationY
 *  Z = z + translationZ
 *
 *  Note that the class only implements the definition and not the operation.
 *  @public
 */
export class Helmert2DWithZOffset implements Helmert2DWithZOffsetProps {
  /** The X post translation */
  public translationX!: number;
  /** The Y post-translation */
  public translationY!: number;
  /** The Z post-translation or Z offset*/
  public translationZ!: number;
  /** The rotation in the trigonometric (CCW) direction in degrees. */
  public rotDeg!: number;
  /** The scale. This scale applies to both X and Y axises. Does not apply to Z. */
  public scale!: number;

  constructor(data?: Helmert2DWithZOffsetProps) {
    if (data) {
      this.translationX = data.translationX;
      this.translationY = data.translationY;
      this.translationZ = data.translationZ;
      this.rotDeg = data.rotDeg;
      this.scale = data.scale;
    }
  }

  /** Creates an Helmert Transform from JSON representation.
   * @public */
  public static fromJSON(data: Helmert2DWithZOffsetProps): Helmert2DWithZOffset {
    return new Helmert2DWithZOffset(data);
  }

  /** Creates a JSON from the Helmert Transform definition
   * @public */
  public toJSON(): Helmert2DWithZOffsetProps {
    return { translationX: this.translationX, translationY: this.translationY, translationZ: this.translationZ, rotDeg: this.rotDeg, scale: this.scale };
  }

  /** Compares two Helmert2DWithZOffset objects applying a minuscule tolerance.
   *  @public */
  public equals(other: Helmert2DWithZOffset): boolean {
    return (Math.abs(this.translationX - other.translationX) < Geometry.smallMetricDistance &&
      Math.abs(this.translationY - other.translationY) < Geometry.smallMetricDistance &&
      Math.abs(this.translationZ - other.translationZ) < Geometry.smallMetricDistance &&
      Math.abs(this.rotDeg - other.rotDeg) < Geometry.smallAngleDegrees &&
      Math.abs(this.scale - other.scale) < Geometry.smallFraction);
  }
}

/** Additional Transform definition
 * @public
 */
export interface AdditionalTransformProps {
  /** The properties of a 2D Helmert transform with Z offset if one is defined. */
  helmert2DWithZOffset?: Helmert2DWithZOffsetProps;
}

/** Additional Transform implementation.
 *  An additional transform is a transformation that can apply to either the horizontal or vertical coordinates of a
 *  geographic CRS. The transformation is applied after the latitude/longitude have been reprojected thus the process
 *  is applied to the result Cartesian coordinates of the projection process.
 *  @public
*/
export class AdditionalTransform implements AdditionalTransformProps {

  /** The properties of a 2D Helmert transform with Z offset if one is defined. */
  public readonly helmert2DWithZOffset?: Helmert2DWithZOffset;

  public constructor(data?: AdditionalTransformProps) {
    if (data)
      this.helmert2DWithZOffset = data.helmert2DWithZOffset ? Helmert2DWithZOffset.fromJSON(data.helmert2DWithZOffset) : undefined;
  }

  /** Creates an Additional Transform from JSON representation.
   * @public */
  public static fromJSON(data: AdditionalTransformProps): AdditionalTransform {
    return new AdditionalTransform(data);
  }

  /** Creates a JSON from the Additional Transform definition
   * @public */
  public toJSON(): AdditionalTransformProps {
    return { helmert2DWithZOffset: this.helmert2DWithZOffset };
  }

  /** Compares two additional transforms applying a minuscule tolerance to comparing numbers.
   *  @public */
  public equals(other: AdditionalTransform): boolean {
    if ((this.helmert2DWithZOffset === undefined) !== (other.helmert2DWithZOffset === undefined))
      return false;

    if (this.helmert2DWithZOffset && !this.helmert2DWithZOffset.equals(other.helmert2DWithZOffset!))
      return false;

    return true;
  }
}

