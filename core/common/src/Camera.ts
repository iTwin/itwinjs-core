/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { JsonUtils } from "@itwin/core-bentley";
import type { AngleProps, XYAndZ, XYZProps } from "@itwin/core-geometry";
import { Angle, Point3d } from "@itwin/core-geometry";

/** JSON representation of a [[Camera]].
 * @public
 */
export interface CameraProps {
  lens: AngleProps;
  focusDist: number; // NOTE: this is abbreviated, do not change!
  eye: XYZProps;
}

/** The current position (eyepoint), lens angle, and focus distance of a camera.
 * @see [Views]($docs/learning/frontend/Views.md)
 * @public
 */
export class Camera implements CameraProps {
  public readonly lens: Angle;
  public focusDist: number;
  public readonly eye: Point3d;

  public static isValidLensAngle(val: Angle) { return val.radians > (Math.PI / 8.0) && val.radians < Math.PI; }
  public static validateLensAngle(val: Angle) { if (!this.isValidLensAngle(val)) val.setRadians(Math.PI / 2.0); }
  public invalidateFocus() { this.focusDist = 0.0; }
  public get isFocusValid() { return this.focusDist > 0.0 && this.focusDist < 1.0e14; }
  public getFocusDistance() { return this.focusDist; }
  public setFocusDistance(dist: number) { this.focusDist = dist; }
  public get isLensValid() { return Camera.isValidLensAngle(this.lens); }
  public validateLens() { Camera.validateLensAngle(this.lens); }
  public getLensAngle() { return this.lens; }
  public setLensAngle(angle: Angle) { this.lens.setFrom(angle); }
  public getEyePoint() { return this.eye; }
  public setEyePoint(pt: XYAndZ) { this.eye.setFrom(pt); }
  public get isValid() { return this.isLensValid && this.isFocusValid; }
  public equals(other: Camera) {
    return Math.abs(this.lens.radians - other.lens.radians) < .01 &&
      Math.abs(this.focusDist - other.focusDist) < .1 &&
      this.eye.isAlmostEqual(other.eye);
  }
  public clone() { return new Camera(this); }
  public setFrom(rhs: Camera) {
    this.lens.setFrom(rhs.lens);
    this.focusDist = rhs.focusDist;
    this.eye.setFrom(rhs.eye);
  }

  /** Construct a Camera
   * @param props The properties of the new camera. If undefined, create a camera with eye at {0,0,0}, 90 degree lens, 1 meter focus distance.
   */
  public constructor(props?: CameraProps) {
    if (props !== undefined) {
      this.lens = Angle.fromJSON(props.lens);
      this.focusDist = JsonUtils.asDouble(props.focusDist);
      this.eye = Point3d.fromJSON(props.eye);
      return;
    }
    this.lens = Angle.createRadians(Math.PI / 2.0);
    this.focusDist = 1;
    this.eye = new Point3d();
  }
}
