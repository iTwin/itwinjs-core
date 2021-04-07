/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:ignore Helmert

/** An affine transformation with an additional Z Offset.
 *  The equations are:
 *  given a = scale * cos(rotation) and b = scale * sin(rotation)
 *  X = a * x - b * y + translationX
 *  Y = b * x + a * y + translationY
 *  Z = z + translationZ
 *  @alpha
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
 *  @alpha
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

  /** @internal */
  public static fromJSON(data: Helmert2DWithZOffsetProps): Helmert2DWithZOffset {
    return new Helmert2DWithZOffset(data);
  }

  /** @internal */
  public toJSON(): Helmert2DWithZOffsetProps {
    return { translationX: this.translationX, translationY: this.translationY, translationZ: this.translationZ, rotDeg: this.rotDeg, scale: this.scale };
  }

  /** @internal */
  public equals(other: Helmert2DWithZOffset): boolean {
    return (this.translationX === other.translationX &&
      this.translationY === other.translationY &&
      this.translationZ === other.translationZ &&
      this.rotDeg === other.rotDeg &&
      this.scale === other.scale);
  }
}

/** Additional Transform definition
 * @alpha
 */
export interface AdditionalTransformProps {
  /** The properties of a 2D Helmert transform with Z offset if one is defined. */
  helmert2DWithZOffset?: Helmert2DWithZOffsetProps;
}

/** Additional Transform implementation.
 *  An additional transform is a transformation that can apply to either the horizontal or vertical coordinates of a
 *  geographic CRS. The transformation is applied after the latitude/longitude have been reprojected thus the process
 *  is applied to the result Cartesian coordinates of the projection process.
 *  @alpha
*/
export class AdditionalTransform implements AdditionalTransformProps {

  /** The properties of a 2D Helmert transform with Z offset if one is defined. */
  public readonly helmert2DWithZOffset?: Helmert2DWithZOffset;

  public constructor(data?: AdditionalTransformProps) {
    if (data)
      this.helmert2DWithZOffset = data.helmert2DWithZOffset ? Helmert2DWithZOffset.fromJSON(data.helmert2DWithZOffset) : undefined;
  }

  /** @internal */
  public static fromJSON(data: AdditionalTransformProps): AdditionalTransform {
    return new AdditionalTransform(data);
  }

  /** @internal */
  public toJSON(): AdditionalTransformProps {
    return { helmert2DWithZOffset: this.helmert2DWithZOffset };
  }

  /** @internal */
  public equals(other: AdditionalTransform): boolean {
    if ((this.helmert2DWithZOffset === undefined) !== (other.helmert2DWithZOffset === undefined))
      return false;

    if (this.helmert2DWithZOffset && !this.helmert2DWithZOffset.equals(other.helmert2DWithZOffset!))
      return false;

    return true;
  }
}

