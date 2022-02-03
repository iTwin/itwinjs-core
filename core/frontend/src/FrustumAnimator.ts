/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Point3d, Vector3d } from "@itwin/core-geometry";
import { Angle, Geometry, Matrix3d, Range3d, Transform } from "@itwin/core-geometry";
import { Tweens } from "@itwin/core-common";
import type { Animator, ViewAnimationOptions } from "./ViewAnimation";
import { ScreenViewport } from "./Viewport";
import type { ViewPose, ViewPose3d } from "./ViewPose";
import type { ViewState3d } from "./ViewState";
/**
 * Compute an intermediate eye point as it swings around a moving target with rotating axes and varying distance to target.
 * (eye, target, distance) is redundant -- implementation problem is to figure out which to use for compatibility with subsequent view setup.
 */
function interpolateSwingingEye(
  axes0: Matrix3d,
  eye0: Point3d,
  distance0: number,
  axes1: Matrix3d,
  eye1: Point3d,
  distance1: number,
  fraction: number,
  axesAtFraction: Matrix3d
): { target: Point3d, eye: Point3d, distance: number } {
  const z0 = axes0.rowZ();
  const z1 = axes1.rowZ();
  const zA = axesAtFraction.rowZ();
  // back up from the eye points to the targets.
  const target0 = eye0.plusScaled(z0, -distance0);
  const target1 = eye1.plusScaled(z1, -distance1);
  // RULE: Target point moves by simple interpolation
  const targetA = target0.interpolate(fraction, target1);
  // RULE: Distance from target to eye is simple interpolation
  const distanceA = Geometry.interpolate(distance0, fraction, distance1);
  // The interpolated target, interpolated distance, and specified axes give the intermediate eyepoint.
  const eyeA = targetA.plusScaled(zA, distanceA);
  return {
    target: targetA,
    eye: eyeA,
    distance: distanceA,
  };
}
/** Animates the transition of a [[Viewport]] from one [Frustum]($common) to another. The viewport will render as many frames as necessary during the supplied duration.
 * @public
 */
export class FrustumAnimator implements Animator {
  private _tweens = new Tweens();
  private _duration = 0;

  /** Construct an animator that animates from `begin` to `end`. */
  public constructor(public options: ViewAnimationOptions, viewport: ScreenViewport, begin: ViewPose, end: ViewPose) {
    const settings = ScreenViewport.animation;
    const zoomSettings = settings.zoomOut;

    let duration = undefined !== options.animationTime ? options.animationTime : settings.time.normal.milliseconds;
    if (duration <= 0 || begin.cameraOn !== end.cameraOn) // no duration means skip animation. We can't animate if the camera toggles.
      return;

    this._duration = duration;
    let extentBias: Vector3d | undefined;
    let eyeBias: Vector3d | undefined;
    const zVec = begin.zVec;
    const view = viewport.view;
    const view3 = view as ViewState3d;
    const begin3 = begin as ViewPose3d;
    const end3 = end as ViewPose3d;
    const beginTarget = begin.target;
    const endTarget = end.target;
    const axis = end.rotation.multiplyMatrixMatrixInverse(begin.rotation)!.getAxisAndAngleOfRotation(); // axis to rotate begin to get to end
    const timing = { fraction: 0.0, height: 0, position: 0 }; // updated by tween.

    // don't do "zoom out" if the two views aren't pointing in the same direction, or if they request cancelOnAbort (since that implies that the view
    // is a linear interpolation from begin to end), or if it's disabled.
    if (zoomSettings.enable && !options.cancelOnAbort && zVec.isAlmostEqual(end.zVec)) {
      view.applyPose(end); // start with the pose at the end
      const viewTransform = Transform.createOriginAndMatrix(undefined, view.getRotation());
      const endRange = Range3d.createTransformedArray(viewTransform, view.calculateFocusCorners()); // get the view-aligned range of the focus plane at the end
      const beginRange = Range3d.createTransformedArray(viewTransform, view.applyPose(begin).calculateFocusCorners()); // get the view-aligned range of the focus plane at the beginning

      // do the starting and ending views (plus the margin) overlap? If not we need to zoom out to show how to get from one to the other
      const expand = (range: Range3d) => { const r = range.clone(); r.scaleAboutCenterInPlace(zoomSettings.margin); return r; };
      if (!expand(beginRange).intersectsRangeXY(expand(endRange))) {
        view3.lookAtViewAlignedVolume(beginRange.union(endRange), viewport.viewRect.aspect); // set up a view that would show both extents
        duration *= zoomSettings.durationFactor; // increase duration so the zooming isn't too fast
        extentBias = view.getExtents().minus(begin.extents); // if the camera is off, the "bias" is the amount the union-ed view is larger than the starting view
        if (begin.cameraOn)
          eyeBias = zVec.scaleToLength(zVec.dotProduct(begin3.camera.eye.vectorTo(view3.camera.eye))); // if the camera is on, the bias is the difference in height of the two eye positions
      }
    }

    this._tweens.create(timing, {
      to: { fraction: 1.0, height: zoomSettings.heights, position: zoomSettings.positions },
      duration,
      start: true,
      easing: options.easingFunction ? options.easingFunction : settings.easing,
      interpolation: zoomSettings.interpolation,
      onComplete: () =>
        viewport.setupFromView(end), // when we're done, set up from final state
      onUpdate: () => {
        const fraction = extentBias ? timing.position : timing.fraction; // if we're zooming, fraction comes from position interpolation
        const rot = Matrix3d.createRotationAroundVector(axis.axis, Angle.createDegrees(fraction * axis.angle.degrees))!.multiplyMatrixMatrix(begin.rotation);
        if (begin.cameraOn) {
          const newExtents = begin.extents.interpolate(fraction, end.extents);
          if (undefined !== eyeBias) {
            const eyePoint = begin3.camera.eye.interpolate(fraction, end3.camera.eye);
            eyePoint.plusScaled(eyeBias, timing.height, eyePoint);
            const targetPoint = eyePoint.plusScaled(rot.getRow(2), -1.0 * (Geometry.interpolate(begin3.camera.focusDist, fraction, end3.camera.focusDist)));
            view3.lookAt({ eyePoint, targetPoint, upVector: rot.getRow(1), newExtents });
          } else {
            const data = interpolateSwingingEye(
              begin3.rotation, begin3.camera.eye, begin3.camera.focusDist,
              end3.rotation, end3.camera.eye, end3.camera.focusDist, fraction, rot);
            view3.lookAt({ eyePoint: data.eye, targetPoint: data.target, upVector: rot.getRow(1), newExtents });
          }
        } else {
          const extents = begin.extents.interpolate(timing.fraction, end.extents);
          if (undefined !== extentBias)
            extents.plusScaled(extentBias, timing.height, extents); // no camera, zooming out expands extents
          view.setExtents(extents);
          view.setRotation(rot);
          view.setCenter(beginTarget.interpolate(fraction, endTarget)); // must be done last - depends on extents and rotation
        }
        viewport.setupFromView();
      },
    });
  }

  /** @internal */
  public animate() {
    const didFinish = !this._tweens.update();
    if (didFinish && this.options.animationFinishedCallback)
      this.options.animationFinishedCallback(true);
    return didFinish;
  }

  /** @internal */
  public interrupt() {
    // We were interrupted. Either go to: the final frame (normally) or, add a small fraction of the total duration (30ms for a .5 second duration) to
    // the current time for cancelOnAbort. That makes aborted animations show some progress, as happens when the mouse wheel rolls quickly.
    this._tweens.update(this.options.cancelOnAbort ? Date.now() + (this._duration * .06) : Infinity);
    if (this.options.animationFinishedCallback)
      this.options.animationFinishedCallback(false);
  }
}
