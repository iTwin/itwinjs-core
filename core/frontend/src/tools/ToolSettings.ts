/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { BeDuration } from "@itwin/core-bentley";
import { Angle, Constant } from "@itwin/core-geometry";

/** Settings that control the behavior of built-in tools. Applications may modify these values.
 * @public
 */
export class ToolSettings {
  /** Two tap must be within this period to be a double tap. */
  public static doubleTapTimeout = BeDuration.fromMilliseconds(250);
  /** Two clicks must be within this period to be a double click. */
  public static doubleClickTimeout = BeDuration.fromMilliseconds(500);
  /** Number of screen inches of movement allowed between clicks to still qualify as a double-click.  */
  public static doubleClickToleranceInches = 0.05;
  /** @beta Use virtual cursor to help with locating elements using touch input. By default it's only enabled for snapping. */
  public static enableVirtualCursorForLocate = false;
  /** If true, view rotation tool keeps the up vector (worldZ) aligned with screenY. */
  public static preserveWorldUp = true;
  /** Delay with a touch on the surface before a move operation begins. */
  public static touchMoveDelay = BeDuration.fromMilliseconds(50);
  /** Delay with the mouse down before a drag operation begins. */
  public static startDragDelay = BeDuration.fromMilliseconds(110);
  /** Distance in screen inches a touch point must move before being considered motion. */
  public static touchMoveDistanceInches = 0.1;
  /** Distance in screen inches the cursor must move before a drag operation begins. */
  public static startDragDistanceInches = 0.15;
  /** Distance in screen inches touch points must move apart to be considered a change in zoom scale. */
  public static touchZoomChangeThresholdInches = 0.20;
  /** Radius in screen inches to search for elements that anchor viewing operations. */
  public static viewToolPickRadiusInches = 0.20;
  /** Camera angle enforced for walk tool. */
  public static walkCameraAngle = Angle.createDegrees(75.6);
  /** Whether the walk tool enforces worldZ be aligned with screenY */
  public static walkEnforceZUp = false;
  /** Speed, in meters per second, for the walk tool. */
  public static walkVelocity = 3.5;
  /** @beta Integer increment used to compute a walkVelocity multiplier for the look and move tool, capped at 10x */
  public static walkVelocityChange = 0;
  /** Whether the walk tool requests pointer lock to hide the cursor for mouse look */
  public static walkRequestPointerLock = true;
  /** @beta Whether the look and move tool detects collisions while moving forward */
  public static walkCollisions = false;
  /** @beta Whether the look and move tool adjusts the camera height for stairs/ramps when collisions are enabled */
  public static walkDetectFloor = false;
  /** @beta Maximum step height in meters above floor/ground to use when floor detection is enabled */
  public static walkStepHeight = 0.3;
  /** @beta Camera height in meters above floor/ground to use for set up walk tool */
  public static walkEyeHeight = 1.6;
  /** Scale factor applied for wheel events with "per-line" modifier. */
  public static wheelLineFactor = 40;
  /** Scale factor applied for wheel events with "per-page" modifier. */
  public static wheelPageFactor = 120;
  /** When the zoom-with-wheel tool (with camera enabled) gets closer than this distance to an obstacle, it "bumps" through. */
  public static wheelZoomBumpDistance = Constant.oneCentimeter;
  /** the speed to scroll for the "scroll view" tool (distance per second). */
  public static scrollSpeed = .75;
  /** the speed to zoom for the "zoom view" tool. */
  public static zoomSpeed = 10;
  /** Scale factor for zooming with mouse wheel. */
  public static wheelZoomRatio = 1.5;
  /** Parameters for viewing operations with *inertia* (i.e. they continue briefly if used with a throwing action) */
  public static viewingInertia = {
    /** Flag to enable inertia. */
    enabled: true,
    /** How quickly the inertia decays. The smaller the damping value the faster the inertia decays. Must be less than 1.0 */
    damping: .96,
    /** Maximum duration of the inertia operation. Important when frame rates are low. */
    duration: BeDuration.fromMilliseconds(500),
  };
}
