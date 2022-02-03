/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { EasingFunction } from "@itwin/core-common";
import type { ViewStatus } from "./ViewStatus";
import type { MarginPercent } from "./MarginPercent";
import type { Point3d } from "@itwin/core-geometry";

/** An object to animate a transition of a [[Viewport]].
 * Only one animator may be associated with a viewport at a time. Registering a new
 * animator interrupts and replaces any existing animator.
 * The animator's animate() function will be invoked just prior to the rendering of each frame.
 * The animator may be removed in response to certain changes to the viewport - e.g., when
 * the viewport is closed, or viewing tools operate on it, etc.
 * @see [[Viewport.setAnimator]] to apply an animator to a viewport.
 * @public
 */
export interface Animator {
  /** Apply animation to the viewport. Return true when animation is completed, causing the animator to be removed from the viewport. */
  animate(): boolean;

  /** Invoked to abort this Animator. This method is called if [[Viewport.setAnimator]] is called before `animate` returns true */
  interrupt(): void;
}

/** Options that control how an Viewport animation behaves.
 * @public
 */
export interface ViewAnimationOptions {
  /** Amount of time for animation, in milliseconds. Default is [[ScreenViewport.animation.time.normal]] */
  animationTime?: number;
  /** if animation is aborted, don't move to end, leave at current point instead. */
  cancelOnAbort?: boolean;
  /** easing function for animation. Default is Easing.Cubic.Out */
  easingFunction?: EasingFunction;
  /** Invoked when the animator is finished.  didComplete is true only if the animation finished without being interrupted. */
  animationFinishedCallback?(didComplete: boolean): void;
}

/**  Options that control how a view is aligned with the globe.
 * @public
 */
export interface GlobalAlignmentOptions {
  /** The target point about which the alignment occurs.  This point will remain stationary in the view */
  target: Point3d;
  /** If defined and true then the alignment rotation is scaled by the [[ViewState.globalViewTransition]].  This is
   * typically used when zooming out from is zoomed out from a specific location to a more global representation.
   */
  transition?: boolean;
}

/** A method to be called if an error occurs while adjusting a ViewState's extents
 * @public
 */
export interface OnViewExtentsError {
  /** Function to be called when the extents are adjusted due to a limits error (view too larger or too small) */
  onExtentsError?: (status: ViewStatus) => ViewStatus;
}

/** Options that control the margin around the edges of a volume for lookAt and Fit view operations
 * @public
 */
export interface MarginOptions {
  /** The percentage of the view to leave blank around the edges. */
  marginPercent?: MarginPercent;
}

/** Options that control how operations that change a viewport behave.
 * @public
 */
export interface ViewChangeOptions extends OnViewExtentsError, ViewAnimationOptions {
  /** Whether to save the result of this change into the view undo stack. Default is to save in undo. */
  noSaveInUndo?: boolean;
  /** Whether the change should be animated or not. Default is to not animate frustum change. */
  animateFrustumChange?: boolean;
  /** If defined the controls how the view will be aligned with the globe */
  globalAlignment?: GlobalAlignmentOptions;
}
