/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeTimePoint } from "@itwin/core-bentley";
import { Angle, Matrix3d, Point2d, Point3d, Vector3d } from "@itwin/core-geometry";
import { Camera } from "@itwin/core-common";
import { ViewState, ViewState2d, ViewState3d } from "./ViewState";

/** The "pose" for a [View]($docs/learning/frontend/views#viewstate-parameters) describing the viewed area or volume, depending upon whether
 * the view is 2d or 3d.
 * @see [[ViewState.savePose]] to extract a pose from a view and [[ViewState.applyPose]] to apply a pose to a view.
 * @note a ViewPose is immutable.
 * @public
 * @extensions
 */
export abstract class ViewPose {
  /** The time at which this pose was created, if it was saved into a [[Viewport]]'s undo stack. */
  public undoTime?: BeTimePoint;
  /** Returns true if this pose is equivalent to the pose represented by the specified [[ViewState]].
   * This implies that `this.equal(view.savePose())`.
   */
  public abstract equalState(view: ViewState): boolean;
  /** Returns true if this pose is equivalent to the specified other pose. */
  public abstract equal(other: ViewPose): boolean;
  /** The origin of the view in [[CoordSystem.World]] coordinates.
   * @see [[ViewState.getOrigin]].
   */
  public abstract origin: Point3d;
  /** The extents of the view in [[CoordSystem.World]] coordinates.
   * @see [[ViewState.getExtents]].
   */
  public abstract extents: Vector3d;
  /** The 3x3 ortho-normal rotation matrix of the view.
   * @see [[ViewState.getRotation]].
   */
  public abstract rotation: Matrix3d;
  /** True if the camera is enabled.
   * @see [[ViewPose3d.camera]] to access the camera.
   */
  public cameraOn: boolean;

  /** Computes the center of the viewed volume. */
  public get center(): Point3d {
    const delta = this.rotation.multiplyTransposeVector(this.extents);
    return this.origin.plusScaled(delta, 0.5);
  }

  /** Returns the target point of the view. This is the same as [[center]] unless [[cameraOn]] is `true`. */
  public get target() { return this.center; }

  /** Computes the Z vector of the [[rotation]] matrix. */
  public get zVec() { return this.rotation.getRow(2); }

  public constructor(cameraOn: boolean) {
    this.cameraOn = cameraOn;
  }
}

/** The "pose" for a [[ViewState3d]], including information about the view's [Camera]($common) if it is enabled.
 * @public
 * @extensions
 */
export class ViewPose3d extends ViewPose {
  /** See [[ViewPose.origin]]. */
  public readonly origin: Point3d;
  /** See [[ViewPose.extents]]. */
  public readonly extents: Vector3d;
  /** See [[ViewPose.rotation]]. */
  public readonly rotation: Matrix3d;
  /** The camera parameters of the view.
   * @note This object is meaningful only if [[ViewPose.cameraOn]] is `true`.
   */
  public readonly camera: Camera;

  /** Construct a pose from the specified 3d view. */
  public constructor(view: ViewState3d) {
    super(view.isCameraOn);

    this.origin = view.origin.clone();
    this.extents = view.extents.clone();
    this.rotation = view.rotation.clone();
    this.camera = view.camera.clone();
  }

  /** See [[ViewPose.target]]. */
  public override get target() {
    return this.cameraOn ? this.camera.eye.plusScaled(this.rotation.getRow(2), -1.0 * this.camera.focusDist) : this.center;
  }

  /** See [[ViewPose.equal]]. */
  public override equal(other: ViewPose): boolean {
    if (!(other instanceof ViewPose3d))
      return false;

    return this.cameraOn === other.cameraOn &&
      this.origin.isAlmostEqual(other.origin) &&
      this.extents.isAlmostEqual(other.extents) &&
      this.rotation.isAlmostEqual(other.rotation) &&
      (!this.cameraOn || this.camera.equals(other.camera));
  }

  /** See [[ViewPose.equalState]]. */
  public override equalState(view: ViewState): boolean {
    if (!(view instanceof ViewState3d))
      return false;

    return this.cameraOn === view.isCameraOn &&
      this.origin.isAlmostEqual(view.origin) &&
      this.extents.isAlmostEqual(view.extents) &&
      this.rotation.isAlmostEqual(view.rotation) &&
      (!this.cameraOn || this.camera.equals(view.camera));
  }
}

/** The "pose" for a [[ViewState2d]].
 * @public
 * @extensions
 */
export class ViewPose2d extends ViewPose {
  /** The 2d origin of the view.
   * @see [[ViewState2d.origin]].
   */
  public readonly origin2d: Point2d;
  /** The 2d extents of the view.
   * @see [[ViewState2d.delta]].
   */
  public readonly delta: Point2d;
  /** The rotation of the view.
   * @see [[ViewState2d.angle]].
   */
  public readonly angle: Angle;

  /** Construct a pose from the specified 2d view. */
  public constructor(view: ViewState2d) {
    super(false);
    this.origin2d = view.origin.clone();
    this.delta = view.delta.clone();
    this.angle = view.angle.clone();
  }

  /** See [[ViewPose.equal]]. */
  public equal(other: ViewPose): boolean {
    if (!(other instanceof ViewPose2d))
      return false;

    return this.origin2d.isAlmostEqual(other.origin) &&
      this.delta.isAlmostEqual(other.delta) &&
      this.angle.isAlmostEqualNoPeriodShift(other.angle);
  }

  /** See [[ViewPose.equalState]]. */
  public equalState(view: ViewState): boolean {
    if (!(view instanceof ViewState2d))
      return false;

    return this.origin2d.isAlmostEqual(view.origin) &&
      this.delta.isAlmostEqual(view.delta) &&
      this.angle.isAlmostEqualNoPeriodShift(view.angle);
  }

  /** See [[ViewPose.origin]]. */
  public get origin() {
    return new Point3d(this.origin2d.x, this.origin2d.y);
  }
  /** See [[ViewPose.extents]]. */
  public get extents() {
    return new Vector3d(this.delta.x, this.delta.y);
  }
  /** See [[ViewPose.rotation]]. */
  public get rotation() {
    return Matrix3d.createRotationAroundVector(Vector3d.unitZ(), this.angle)!;
  }
}
