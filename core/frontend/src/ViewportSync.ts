/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport } from "./Viewport";

/** A function used by [[connectViewports]] that can synchronize the state of a target [[Viewport]] with
 * changes in the state of a source Viewport.
 * The source viewport is the viewport in the connection whose state has changed.
 * The function will be invoked once for each target viewport in the connection.
 * @public
 * @extensions
 */
export type SynchronizeViewports = (source: Viewport, target: Viewport) => void;

/** Forms a connection between two or more [[Viewport]]s such that a change in any one of the viewports is reflected in all of the others.
 * When the connection is first formed, all of the viewports are synchronized to the current state of the **first** viewport in `viewports`.
 * Thereafter, an event listener registered with each viewport's [[Viewport.onViewChanged]] event is invoked when anything about that viewport's state changes.
 * Each time such an event occurs, the initating ("source") viewport is passed to `sync` to obtain a function that can be invoked to synchronize each of the other
 * ("target") viewports with the source viewport's new state. The function returned by `sync` can choose to synchronize any or all aspects of the viewports' states, such as
 * the viewed volume, display style, viewed categories or models, or anything else.
 *
 * To sever the connection, invoke the function returned by this function. For example:
 * ```ts
 *  // set up the connection.
 *  const disconnect = connectViewports([viewport0, viewport1, viewport2], (changedViewport) => synchronizeViewportFrusta(changedViewport));
 *  // some time later, sever the connection.
 *  disconnect();
 * ```
 *
 * @note [[Viewport.onViewChanged]] can be invoked **very** frequently - sometimes multiple times per frame. Try to avoid performing excessive computations within your synchronization functions.
 *
 * @param viewports The viewports to be connected. It should contain at least two viewports and no duplicate viewports. The initial state of each viewport will be synchronized with
 * the state of the first viewport in this iterable.
 * @param sync A function to be invoked whenever the state of any viewport in `viewports` changes, returning a function that can be used to synchronize the
 * state of each viewport.
 * @returns a function that can be invoked to sever the connection between the viewports.
 * @see [[connectViewportFrusta]] to synchronize the [Frustum]($common) of each viewport.
 * @see [[connectViewportViews]] to synchronize every aspect of the viewports.
 * @see [[TwoWayViewportSync]] to synchronize the state of exactly two viewports.
 * @see [Multiple Viewport Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=multi-viewport-sample&imodel=Metrostation+Sample)
 * @public
 * @extensions
 */
export function connectViewports(viewports: Iterable<Viewport>, sync: (changedViewport: Viewport) => SynchronizeViewports): () => void {
  const disconnect: VoidFunction[] = [];

  let echo = false;
  const synchronize = (source: Viewport) => {
    if (echo)
      return;

    // Ignore onViewChanged events resulting from synchronization.
    echo = true;
    try {
      const doSync = sync(source);
      for (const vp of viewports)
        if (vp !== source)
          doSync(source, vp);
    } finally {
      echo = false;
    }
  };

  let firstViewport: Viewport | undefined;
  for (const vp of viewports) {
    if (!firstViewport)
      firstViewport = vp;

    disconnect.push(vp.onViewChanged.addListener(() => synchronize(vp)));
  }

  if (firstViewport)
    synchronize(firstViewport);

  return () => {
    for (const f of disconnect)
      f();

    disconnect.length = 0;
  };
}

/** A function that returns a [[SynchronizeViewports]] function that synchronizes every aspect of the viewports' states, including
 * display style, model and category selectors, [Frustum]($common), etc.
 * @see [[connectViewportViews]] to establish a connection between viewports using this synchronization strategy.
 * @public
 * @extensions
 */
export function synchronizeViewportViews(source: Viewport): SynchronizeViewports {
  return (_source, target) => target.applyViewState(source.view.clone(target.iModel));
}

/** A function that returns a [[SynchronizeViewports]] function that synchronizes the viewed volumes of each viewport.
 * @see [[connectViewportFrusta]] to establish a connection between viewports using this synchronization strategy.
 * @public
 * @extensions
 */
export function synchronizeViewportFrusta(source: Viewport): SynchronizeViewports {
  const pose = source.view.savePose();
  return (_source, target) => {
    const view = target.view.applyPose(pose);
    target.applyViewState(view);
  };
}

/** Form a connection between two or more [[Viewport]]s such that they all view the same volume. For example, zooming out in one viewport
 * will zoom out by the same distance in all of the other viewports.
 * @see [[connectViewports]] to customize how the viewports are synchronized.
 * @public
 * @extensions
 */
export function connectViewportFrusta(viewports: Iterable<Viewport>): () => void {
  return connectViewports(viewports, (source) => synchronizeViewportFrusta(source));
}

/** Form a connection between two or more [[Viewport]]s such that every aspect of the viewports are kept in sync. For example, if the set of models
 * or categories visible in one viewport is changed, the same set of models and categories will be visible in the other viewports.
 * @see [[connectViewportFrusta]] to synchronize only the [Frustum]($common) of each viewport.
 * @see [[connectViewports]] to customize how the viewports are synchronized.
 * @public
 * @extensions
 */
export function connectViewportViews(viewports: Iterable<Viewport>): () => void {
  return connectViewports(viewports, (source) => synchronizeViewportViews(source));
}

/** Forms a bidirectional connection between two [[Viewport]]s such that the [[ViewState]]s of each are synchronized with one another.
 * For example, panning in one viewport will cause the other viewport to pan by the same distance, and changing the [RenderMode]($common) of one viewport
 * will change it in the other viewport.
 * By default, all aspects of the views - display style, category and model selectors, frustum, etc - are synchronized, but this can be customized by
 * subclassing and overriding the [[syncViewports]] and [[connectViewports]] methods.
 * @see [Multiple Viewport Sample](https://www.itwinjs.org/sample-showcase/?group=Viewer+Features&sample=multi-viewport-sample&imodel=Metrostation+Sample)
 * for an interactive demonstration.
 * @see [[TwoWayViewportFrustumSync]] to synchronize only the frusta of the viewports.
 * @see [[connectViewportViews]] to synchronize the state of more than two viewports.
 * @public
 * @extensions
 */
export class TwoWayViewportSync {
  protected readonly _disconnect: VoidFunction[] = [];

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

    this._disconnect.push(connectViewports([viewport1, viewport2], () => (source, target) => this.syncViewports(source, target)));
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
 * @see [[connectViewportFrusta]] to synchronize the frusta of more than two viewports.
 * @public
 * @extensions
 */
export class TwoWayViewportFrustumSync extends TwoWayViewportSync {
  /** Synchronizes the two viewports by applying `source`'s frustum to `target`. */
  protected override syncViewports(source: Viewport, target: Viewport): void {
    const pose = source.view.savePose();
    const view = target.view.applyPose(pose);
    target.applyViewState(view);
  }

  /** Sets up the initial connection between two viewports by applying `source`'s frustum to `target`. */
  protected override connectViewports(source: Viewport, target: Viewport): void {
    this.syncViewports(source, target);
  }
}
