/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import { Matrix3d } from "@bentley/geometry-core";

/**
 * Describes a set of commonly-used view rotations.
 */
export const enum StandardViewId {
  /**
   * Any rotation which does not match one of the standard rotations.
   * Invalid as an argument to StandardView.getStandardRotation() - used as a return value only.
   */
  NotStandard = -1,
  /** Looking directly down the z axis from above. */
  Top = 0,
  /* ###TODO finish documenting me... */
  Bottom = 1,
  Left = 2,
  Right = 3,
  Front = 4,
  Back = 5,
  Iso = 6,
  RightIso = 7,
}

let standardViewMatrices: Matrix3d[] | undefined;

function getMatrices(): Matrix3d[] {
  if (undefined !== standardViewMatrices)
    return standardViewMatrices;

  standardViewMatrices = [];

  standardViewMatrices[StandardViewId.Top] = Matrix3d.identity;
  standardViewMatrices[StandardViewId.Bottom] = Matrix3d.createRowValues(1, 0, 0, 0, -1, 0, 0, 0, -1);
  standardViewMatrices[StandardViewId.Left] = Matrix3d.createRowValues(0, -1, 0, 0, 0, 1, -1, 0, 0);
  standardViewMatrices[StandardViewId.Right] = Matrix3d.createRowValues(0, 1, 0, 0, 0, 1, 1, 0, 0);
  standardViewMatrices[StandardViewId.Front] = Matrix3d.createRowValues(1, 0, 0, 0, 0, 1, 0, -1, 0);
  standardViewMatrices[StandardViewId.Back] = Matrix3d.createRowValues(-1, 0, 0, 0, 0, 1, 0, 1, 0);
  standardViewMatrices[StandardViewId.Iso] = Matrix3d.createRowValues(
    0.707106781186548, -0.70710678118654757, 0.00000000000000000,
    0.408248290463863, 0.40824829046386302, 0.81649658092772603,
    -0.577350269189626, -0.57735026918962573, 0.57735026918962573);
  standardViewMatrices[StandardViewId.RightIso] = Matrix3d.createRowValues(
    0.707106781186548, 0.70710678118654757, 0.00000000000000000,
    -0.408248290463863, 0.40824829046386302, 0.81649658092772603,
    0.577350269189626, -0.57735026918962573, 0.57735026918962573);

  standardViewMatrices.forEach((mat) => Object.freeze(mat));
  return standardViewMatrices;
}

/**
 * Supplies access to a set of commonly-used view rotations.
 */
export class StandardView {
  public static get top(): Matrix3d { return this.getStandardRotation(StandardViewId.Top); }
  public static get bottom(): Matrix3d { return this.getStandardRotation(StandardViewId.Bottom); }
  public static get left(): Matrix3d { return this.getStandardRotation(StandardViewId.Left); }
  public static get right(): Matrix3d { return this.getStandardRotation(StandardViewId.Right); }
  public static get front(): Matrix3d { return this.getStandardRotation(StandardViewId.Front); }
  public static get back(): Matrix3d { return this.getStandardRotation(StandardViewId.Back); }
  public static get iso(): Matrix3d { return this.getStandardRotation(StandardViewId.Iso); }
  public static get rightIso(): Matrix3d { return this.getStandardRotation(StandardViewId.RightIso); }

  /**
   * Obtain a [[Matrix3d]] corresponding to the specified [[StandardViewId]].
   * @param id The ID of the desired rotation.
   * @return A rotation matrix corresponding to the requested standard view ID, or a "top" view rotation if the input does not correspond to a standard rotation.
   */
  public static getStandardRotation(id: StandardViewId): Matrix3d {
    if (id < StandardViewId.Top || id > StandardViewId.RightIso)
      id = StandardViewId.Top;

    return getMatrices()[id];
  }

  /**
   * Attempts to adjust the supplied rotation matrix to match the standard view rotation it most closely matches.
   * If a matching standard rotation exists, the input matrix will be modified in-place to precisely match it.
   * Otherwise, the input matrix will be unmodified.
   * @param matrix The rotation matrix to adjust.
   * ###TODO Didn't the native version of this return the ID of the standard rotation?
   */
  public static adjustToStandardRotation(matrix: Matrix3d): void {
    getMatrices().some((test) => {
      if (test.maxDiff(matrix) > 1.0e-7)
        return false;

      matrix.setFrom(test);
      return true;
    });
  }
}
