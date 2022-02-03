/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Viewport } from "./Viewport";

/** Forms a bidirectional connection between two [[Viewport]]s such that the [[ViewState]]s of each are synchronized with one another.
 * For example, panning in one viewport will cause the other viewport to pan by the same distance, and changing the [RenderMode]($common) of one viewport
 * will change it in the other viewport.
 * By default, all aspects of the views - display style, category and model selectors, frustum, etc - are synchronized, but this can be customized by
 * subclassing and overriding the [[syncViewports]] and [[connectViewports]] methods.
 * @see [Multiple Viewport Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=multi-viewport-sample&imodel=Metrostation+Sample)
 * for an interactive demonstration.
 * @see [[TwoWayViewportFrustumSync]] to synchronize only the frusta of the viewports.
 * @public
 */
export class TwoWayViewportSync {
  protected readonly _disconnect: VoidFunction[] = [];
  private _isEcho = false;

  private syncView(source: Viewport, target: Viewport) {
    if (this._isEcho)
      return;

    this._isEcho = true; // so we don't react to the echo of this sync
    this.syncViewports(source, target);
    this._isEcho = false;
  }

  /** Invoked from [[connect]] to set up the initial synchronization between the two viewports.
   * `target` should be modified to match `source`.
   * The default implementation applies a clone of `source`'s [[ViewState]] to `target`.
   * @see [[syncViewports]] to customize subsequent synchronization.
   */
  protected connectViewports(source: Viewport, target: Viewport): void {
    const viewState = source.view.clone(target.iModel);
    target.applyViewState(viewState);
  }

  /** Invoked each time `source` changes to update `target` to match.
   * The default implementation applies a clone of `source`'s [[ViewState]] to `target`.
   * @param source The viewport that changed
   * @param target The viewport that should be updated to match `source`
   * @see [[connectViewports]] to set up the initial synchronization between the two viewports.
   */
  protected syncViewports(source: Viewport, target: Viewport): void {
    target.applyViewState(source.view.clone(target.iModel));
  }

  /** Establish the connection between two Viewports. When this method is called, `viewport2` is initialized with the state of `viewport1` via [[connectViewports]].
   * Thereafter, any change to the frustum of either viewport will be reflected in the frustum of the other viewport via [[syncViewports]].
   */
  public connect(viewport1: Viewport, viewport2: Viewport) {
    this.disconnect();

    this.connectViewports(viewport1, viewport2);

    // listen to the onViewChanged events from both views
    this._disconnect.push(viewport1.onViewChanged.addListener(() => this.syncView(viewport1, viewport2)));
    this._disconnect.push(viewport2.onViewChanged.addListener(() => this.syncView(viewport2, viewport1)));
  }

  /** Remove the connection between the two views. */
  public disconnect() {
    this._disconnect.forEach((f) => f());
    this._disconnect.length = 0;
  }
}

/** Forms a bidirectional connection between two [[Viewport]]s such that the [Frustum]($common)s of each are synchronized with one another.
 * For example, zooming out in one viewport will zoom out by the same distance in the other viewport.
 * No other aspects of the viewports are synchronized - they may have entirely different display styles, category/model selectors, etc.
 * @see [[TwoWayViewportSync]] to synchronize all aspects of the viewports.
 * @public
 */
export class TwoWayViewportFrustumSync extends TwoWayViewportSync {
  /** @internal override */
  protected override syncViewports(source: Viewport, target: Viewport): void {
    const pose = source.view.savePose();
    const view = target.view.applyPose(pose);
    target.applyViewState(view);
  }

  /** @internal override */
  protected override connectViewports(source: Viewport, target: Viewport): void {
    this.syncViewports(source, target);
  }
}
