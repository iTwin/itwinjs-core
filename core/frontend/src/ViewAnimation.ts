/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { EasingFunction } from "@bentley/imodeljs-common";
import { ViewStatus } from "./ViewStatus";
import { MarginPercent } from "./MarginPercent";

/** An object to animate a transition of a [[Viewport]].
 * Only one animator may be associated with a viewport at a time. Registering a new
 * animator interrupts and replaces any existing animator.
 * The animator's animate() function will be invoked just prior to the rendering of each frame.
 * The animator may be removed in response to certain changes to the viewport - e.g., when
 * the viewport is closed, or viewing tools operate on it, etc.
 * @beta
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
}

/** Options that control how operations that change a viewport behave.
 * @public
 */
export interface ViewChangeOptions extends ViewAnimationOptions {
  /** Whether to save the result of this change into the view undo stack. Default is to save in undo. */
  noSaveInUndo?: boolean;
  /** Whether the change should be animated or not. Default is to not animate frustum change. */
  animateFrustumChange?: boolean;
  /** The percentage of the view to leave blank around the edges. */
  marginPercent?: MarginPercent;
  /** Function to be called when the extents are adjusted due to a limits error (view too larger or too small) */
  onExtentsError?: (status: ViewStatus) => ViewStatus;
}
