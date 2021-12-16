/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */
import { BeEvent, BentleyStatus, BeTimePoint, BeUiEvent, Id64Arg } from "@itwin/core-bentley";
import { GeometryStreamProps } from "@itwin/core-common";
import { HitDetail } from "./HitDetail";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { DisclosedTileTreeSet, TileTree } from "./tile/internal";
import { EventController } from "./tools/EventController";
import { BeButtonEvent, EventHandled } from "./tools/Tool";
import { ScreenViewport, ViewportDecorator } from "./Viewport";
import { System } from "./render/webgl/System";

/** Interface for drawing [[Decorations]] into, or on top of, the active [[ScreenViewport]]s managed by [[ViewManager]].
 * Decorators generate [[Decorations]].
 * @public
 */
export interface Decorator extends ViewportDecorator {
  /** If the [[decorate]] method created pickable graphics, return true if the supplied Id is from this Decorator.
   * @param id The Id of the currently selected pickable graphics.
   * @returns true if 'id' belongs to this Decorator
   */
  testDecorationHit?(id: string): boolean;

  /** If the [[decorate]] method created pickable graphics using a persistent element id instead of a transient id,
   * return true if the Decorator wants the opportunity to override the default persistent element behavior for
   * the supplied [[HitDetail]].
   * - Replace or augment the element's tooltip by implementing [[getDecorationToolTip]].
   * - Override the element's snap geometry by implementing [[getDecorationGeometry]].
   * - Handle button events as decorator events by implementing [[onDecorationButtonEvent]].
   * @param hit The HitDetail of the currently selected persistent element or pickable graphics using a persistent element id.
   * @returns true if this Decorator wants to override the default persistent element behavior.
   */
  overrideElementHit?(hit: HitDetail): boolean;

  /** If [[testDecorationHit]] or [[overrideElementHit]] returned true, implement this method to return the tooltip message for this Decorator.
   * @param hit The HitDetail about the decoration that was picked.
   * @returns A promise with the HTMLElement or string (that may contain HTML) with the tooltip message.
   */
  getDecorationToolTip?(hit: HitDetail): Promise<HTMLElement | string>;

  /** If [[testDecorationHit]] or [[overrideElementHit]] returned true, implement this method to handle a button event for this Decorator.
   * @param hit The HitDetail about the decoration that was picked.
   * @param ev The BeButtonEvent that identified this decoration.
   * @returns  A Promise that resolves to Yes if event completely handled by decoration and event should not be processed by the calling tool.
   */
  onDecorationButtonEvent?(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled>;

  /** If [[testDecorationHit]] or [[overrideElementHit]] returned true, implement this method to return the snappable geometry for this Decorator. Geometry that changes with every cursor motion isn't valid for snapping.
   * An example would be an InteractiveTool for placing a linestring. It might wish to allow snapping to accepted segments, the segment from the last accepted point to the current cursor position would not be included
   * as snappable geometry and would just be displayed in dynamics.
   * @param hit The HitDetail about the decoration that was picked.
   * @returns GeometryStreamProps containing world coordinate snappable geometry for this decoration.
   */
  getDecorationGeometry?(hit: HitDetail): GeometryStreamProps | undefined;
}

/** Argument for [[ViewManager.onSelectedViewportChanged]]
 * @public
 */
export interface SelectedViewportChangedArgs {
  current?: ScreenViewport;
  previous?: ScreenViewport;
}

/** An object which customizes the locate tooltip.
 * @internal
 */
export interface ToolTipProvider {
  /** Augment or replace tooltip for the specified HitDetail.
   * To cooperate with other tooltip providers, replacing the input tooltip instead of appending information is discouraged.
   */
  augmentToolTip(hit: HitDetail, tooltip: Promise<HTMLElement | string>): Promise<HTMLElement | string>;
}

/** The ViewManager holds the list of opened views, plus the *selected view*. It also provides notifications of view open/close and suspend/resume.
 * Applications must call [[addViewport]] when new Viewports that should be associated with user events are created.
 *
 * A single ViewManager is created when [[IModelApp.startup]] is called. It can be accessed via the static member [[IModelApp.viewManager]].
 *
 * The ViewManager controls the render loop, which causes the contents of each registered [[Viewport]] to update on the screen.
 * @public
 */
export class ViewManager implements Iterable<ScreenViewport> {
  public inDynamicsMode = false;
  public cursor = "default";
  private readonly _viewports: ScreenViewport[] = [];
  public readonly decorators: Decorator[] = [];
  private _selectedView?: ScreenViewport;
  private _invalidateScenes = false;
  private _skipSceneCreation = false;
  private _doIdleWork = false;
  private _idleWorkTimer?: any;

  /** @internal */
  public readonly toolTipProviders: ToolTipProvider[] = [];

  private _beginIdleWork() {
    const idleWork = () => {
      if (undefined === this._idleWorkTimer)
        return;
      if (this._viewports.length > 0) {
        this._idleWorkTimer = undefined;
        return;
      }
      if (IModelApp.renderSystem.doIdleWork())
        this._idleWorkTimer = setTimeout(idleWork, 1);
      else
        this._idleWorkTimer = undefined;
    };

    if (undefined === this._idleWorkTimer)
      this._idleWorkTimer = setTimeout(idleWork, 1);
  }

  /** @internal */
  public onInitialized() {
    this.addDecorator(IModelApp.accuSnap);
    this.addDecorator(IModelApp.tentativePoint);
    this.addDecorator(IModelApp.accuDraw);
    this.addDecorator(IModelApp.toolAdmin);
    this.cursor = "default";

    const options = IModelApp.renderSystem.options;
    this._doIdleWork = true === options.doIdleWork;
    if (this._doIdleWork)
      this._beginIdleWork();
  }

  /** @internal */
  public onShutDown() {
    if (undefined !== this._idleWorkTimer) {
      clearTimeout(this._idleWorkTimer);
      this._idleWorkTimer = undefined;
    }
    this._viewports.length = 0;
    this.decorators.length = 0;
    this.toolTipProviders.length = 0;
    this._selectedView = undefined;
  }

  /** Called after the selected view changes.
   * @param old Previously selected viewport.
   * @param current Currently selected viewport.
   */
  public readonly onSelectedViewportChanged = new BeUiEvent<SelectedViewportChangedArgs>();

  /** Called after a view is opened. This can happen when the iModel is first opened or when a user opens a new view. */
  public readonly onViewOpen = new BeUiEvent<ScreenViewport>();

  /** Called after a view is closed. This can happen when the iModel is closed or when a user closes an open view. */
  public readonly onViewClose = new BeUiEvent<ScreenViewport>();

  /** Called after a view is suspended. This happens when the application is minimized or, on a tablet, when the application
   * is moved to the background.
   */
  public readonly onViewSuspend = new BeUiEvent<ScreenViewport>();

  /** Called after a suspended view is resumed. This can happen when a minimized application is restored
   * or, on a tablet, when the application is moved to the foreground.
   */
  public readonly onViewResume = new BeUiEvent<ScreenViewport>();

  /** Called at the beginning of each tick of the render loop, before any viewports have been updated.
   * The render loop is typically invoked by a requestAnimationFrame() callback. It will not be invoked if the ViewManager is tracking no viewports.
   * @note Due to the frequency of this event, avoid performing expensive work inside event listeners.
   * @see [[ViewManager.onFinishRender]]
   */
  public readonly onBeginRender = new BeEvent<() => void>();

  /** Called at the end of each tick of the render loop, after all viewports have been updated.
   * The render loop is typically invoked by a requestAnimationFrame() callback. It will not be invoked if the ViewManager is tracking no viewports.
   * @note Due to the frequency of this event, avoid performing expensive work inside event listeners.
   * @see [[ViewManager.onBeginRender]]
   */
  public readonly onFinishRender = new BeEvent<() => void>();

  /** @internal */
  public endDynamicsMode(): void {
    if (!this.inDynamicsMode)
      return;

    this.inDynamicsMode = false;

    const cursorVp = IModelApp.toolAdmin.cursorView;
    if (cursorVp)
      cursorVp.changeDynamics(undefined);

    for (const vp of this._viewports) {
      if (vp !== cursorVp)
        vp.changeDynamics(undefined);
    }
  }

  /** @internal */
  public beginDynamicsMode() { this.inDynamicsMode = true; }

  /** @internal */
  public get doesHostHaveFocus(): boolean { return document.hasFocus(); }

  /** Set the selected [[Viewport]] to undefined. */
  public clearSelectedView(): void {
    const previousVp = this.selectedView;
    this._selectedView = undefined;
    this.notifySelectedViewportChanged(previousVp, undefined);
  }

  /** Sets the selected [[Viewport]]. */
  public async setSelectedView(vp: ScreenViewport | undefined): Promise<BentleyStatus> {
    if (undefined === vp)
      vp = this.getFirstOpenView();

    if (vp === this.selectedView) // already the selected view
      return BentleyStatus.SUCCESS;

    if (undefined === vp) {
      this.clearSelectedView();
      return BentleyStatus.ERROR;
    }

    const previousVp = this.selectedView;
    this._selectedView = vp;

    this.notifySelectedViewportChanged(previousVp, vp);

    if (undefined === previousVp)
      await IModelApp.toolAdmin.startDefaultTool();

    return BentleyStatus.SUCCESS;
  }

  /** @internal */
  public notifySelectedViewportChanged(previous: ScreenViewport | undefined, current: ScreenViewport | undefined) {
    IModelApp.toolAdmin.onSelectedViewportChanged(previous, current);// eslint-disable-line @typescript-eslint/no-floating-promises
    this.onSelectedViewportChanged.emit({ previous, current });
  }

  /** The "selected view" is the default for certain operations.  */
  public get selectedView(): ScreenViewport | undefined { return this._selectedView; }

  /** Get the first opened view. */
  public getFirstOpenView(): ScreenViewport | undefined { return this._viewports.length > 0 ? this._viewports[0] : undefined; }

  /** Check if only a single viewport is being used.  If so, render directly on-screen using its WebGL canvas.  Otherwise, render each view offscreen. */
  private updateRenderToScreen() {
    const renderToScreen = 1 === this._viewports.length;
    for (const vp of this)
      vp.rendersToScreen = renderToScreen;
  }

  /** Add a new Viewport to the list of opened views and create an EventController for it.
   * @param newVp the Viewport to add
   * @returns SUCCESS if vp was successfully added, ERROR if it was already present.
   * @note raises onViewOpen event with newVp.
   */
  public addViewport(newVp: ScreenViewport): BentleyStatus {
    if (this._viewports.includes(newVp)) // make sure its not already added
      return BentleyStatus.ERROR;

    newVp.setEventController(new EventController(newVp)); // this will direct events to the viewport
    this._viewports.push(newVp);
    this.updateRenderToScreen();
    this.setSelectedView(newVp);// eslint-disable-line @typescript-eslint/no-floating-promises

    // Start up the render loop if necessary.
    if (1 === this._viewports.length)
      IModelApp.startEventLoop();

    this.onViewOpen.emit(newVp);

    return BentleyStatus.SUCCESS;
  }

  /** Remove a Viewport from the list of opened views, and optionally dispose of it.
   * Typically a Viewport is dropped when it is no longer of any use to the application, in which case it should also be
   * disposed of as it may hold significant GPU resources.
   * However in some cases a Viewport may be temporarily dropped to suspend rendering; and subsequently re-added to
   * resume rendering - for example, when the Viewport is temporarily hidden by other UI elements.
   * In the latter case it is up to the caller to ensure the Viewport is properly disposed of when it is no longer needed.
   * Attempting to invoke any function on a Viewport after it has been disposed is an error.
   * @param vp the Viewport to remove.
   * @param disposeOfViewport Whether or not to dispose of the Viewport. Defaults to true.
   * @return SUCCESS if vp was successfully removed, ERROR if it was not present.
   * @note raises onViewClose event with vp.
   */
  public dropViewport(vp: ScreenViewport, disposeOfViewport: boolean = true): BentleyStatus {
    const index = this._viewports.indexOf(vp);
    if (index === -1)
      return BentleyStatus.ERROR;

    this.onViewClose.emit(vp);

    // make sure tools don't think the cursor is still in this viewport
    IModelApp.toolAdmin.forgetViewport(vp);

    vp.setEventController(undefined);
    this._viewports.splice(index, 1);

    if (this.selectedView === vp) // if removed viewport was selectedView, set it to undefined.
      this.setSelectedView(undefined);// eslint-disable-line @typescript-eslint/no-floating-promises

    vp.rendersToScreen = false;
    this.updateRenderToScreen();

    if (disposeOfViewport)
      vp.dispose();

    if (this._doIdleWork && this._viewports.length === 0)
      this._beginIdleWork();

    return BentleyStatus.SUCCESS;
  }

  /** Iterate over the viewports registered with the view manager. */
  public [Symbol.iterator](): Iterator<ScreenViewport> {
    return this._viewports[Symbol.iterator]();
  }

  /** Force each registered [[Viewport]] to regenerate all of its cached [[Decorations]] on the next frame. If the decorator parameter is specified, only
   * the specified decorator will have its cached decorations invalidated for all viewports.
   * @see [[Viewport.invalidateCachedDecorations]] to manually remove a decorator's cached decorations from a viewport, forcing them to be regenerated.
   * @beta
   */
  public invalidateCachedDecorationsAllViews(decorator: ViewportDecorator): void {
    if (decorator.useCachedDecorations)
      for (const vp of this)
        vp.invalidateCachedDecorations(decorator);
  }

  /** Force each registered [[Viewport]] to regenerate its [[Decorations]] on the next frame. */
  public invalidateDecorationsAllViews(): void {
    for (const vp of this)
      vp.invalidateDecorations();
  }

  /** Force each registered [[Viewport]] to regenerate its [[FeatureSymbology.Overrides]] on the next frame.
   * @alpha
   */
  public invalidateSymbologyOverridesAllViews(): void {
    for (const vp of this)
      vp.setFeatureOverrideProviderChanged();
  }

  /** @internal */
  public onSelectionSetChanged(_iModel: IModelConnection) {
    for (const vp of this)
      vp.markSelectionSetDirty();
  }

  /** @internal */
  public invalidateViewportScenes(): void {
    for (const vp of this)
      vp.invalidateScene();
  }

  /** @internal */
  public validateViewportScenes(): void {
    for (const vp of this)
      vp.setValidScene();
  }

  /** @internal */
  public invalidateScenes(): void {
    this._invalidateScenes = true;
    IModelApp.requestNextAnimation();
  }
  /** @internal */
  public get sceneInvalidated(): boolean { return this._invalidateScenes; }

  /** Invoked by ToolAdmin event loop.
   * @internal
   */
  public renderLoop(): void {
    if (0 === this._viewports.length)
      return;
    if (this._skipSceneCreation)
      this.validateViewportScenes();
    else if (this._invalidateScenes)
      this.invalidateViewportScenes();

    this._invalidateScenes = false;

    this.onBeginRender.raiseEvent();

    for (const vp of this._viewports)
      vp.renderFrame();

    this.onFinishRender.raiseEvent();
  }

  /** Purge TileTrees that haven't been drawn since the specified time point and are not currently in use by any ScreenViewport.
   * Intended strictly for debugging purposes - TileAdmin takes care of properly purging.
   * @internal
   */
  public purgeTileTrees(olderThan: BeTimePoint): void {
    // A single viewport can display tiles from more than one IModelConnection.
    // NOTE: A viewport may be displaying no trees - but we need to record its IModel so we can purge those which are NOT being displayed
    //  NOTE: That won't catch external tile trees previously used by that viewport.
    const trees = new DisclosedTileTreeSet();
    const treesByIModel = new Map<IModelConnection, Set<TileTree>>();
    for (const vp of this._viewports) {
      vp.discloseTileTrees(trees);
      if (undefined === treesByIModel.get(vp.iModel))
        treesByIModel.set(vp.iModel, new Set<TileTree>());
    }

    for (const tree of trees) {
      let set = treesByIModel.get(tree.iModel);
      if (undefined === set) {
        set = new Set<TileTree>();
        treesByIModel.set(tree.iModel, set);
      }

      set.add(tree);
    }

    for (const entry of treesByIModel) {
      const iModel = entry[0];
      iModel.tiles.purge(olderThan, entry[1]);
    }
  }

  /** Get the tooltip for a persistent element.
   * Calls the backend method [Element.getToolTipMessage]($backend), and replaces all instances of `${localizeTag}` with localized string from IModelApp.i18n.
   * @beta
   */
  public async getElementToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const msg: string[] = await hit.iModel.getToolTipMessage(hit.sourceId); // wait for the locate message(s) from the backend
    return IModelApp.formatElementToolTip(msg);
  }

  /** Add a new [[ToolTipProvider]] to customize the locate tooltip.
   * @internal
   * @param provider The new tooltip provider to add.
   * @throws Error if provider is already active.
   * @returns a function that may be called to remove this provider (in lieu of calling [[dropToolTipProvider]].)
   * @see [[dropToolTipProvider]]
   */
  public addToolTipProvider(provider: ToolTipProvider): () => void {
    if (this.toolTipProviders.includes(provider))
      throw new Error("tooltip provider already registered");
    this.toolTipProviders.push(provider);
    return () => { this.dropToolTipProvider(provider); };
  }

  /** Drop (remove) a [[ToolTipProvider]] so it is no longer active.
   * @internal
   * @param provider The tooltip to drop.
   * @note Does nothing if provider is not currently active.
   */
  public dropToolTipProvider(provider: ToolTipProvider) {
    const index = this.toolTipProviders.indexOf(provider);
    if (index >= 0)
      this.toolTipProviders.splice(index, 1);
  }

  /** Add a new [[Decorator]] to display decorations into the active views.
   * @param decorator The new decorator to add.
   * @throws Error if decorator is already active.
   * @returns a function that may be called to remove this decorator (in lieu of calling [[dropDecorator]].)
   * @see [[dropDecorator]]
   */
  public addDecorator(decorator: Decorator): () => void {
    if (this.decorators.includes(decorator))
      throw new Error("decorator already registered");

    this.decorators.push(decorator);
    this.invalidateDecorationsAllViews();
    return () => { this.dropDecorator(decorator); };
  }

  /** Drop (remove) a [[Decorator]] so it is no longer active.
   * @param decorator The Decorator to drop.
   * @returns true if the decorator was found and removed; false if the decorator was not found.
   */
  public dropDecorator(decorator: Decorator): boolean {
    const index = this.decorators.indexOf(decorator);
    if (index < 0)
      return false;

    this.invalidateCachedDecorationsAllViews(decorator);
    this.decorators.splice(index, 1);
    this.invalidateDecorationsAllViews();
    return true;
  }

  /** Get the tooltip for a pickable decoration.
   * @internal
   */
  public async getDecorationToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    for (const decorator of this.decorators) {
      if (undefined !== decorator.testDecorationHit && undefined !== decorator.getDecorationToolTip && decorator.testDecorationHit(hit.sourceId))
        return decorator.getDecorationToolTip(hit);
    }
    return hit.viewport ? hit.viewport.getToolTip(hit) : "";
  }

  /** Allow a pickable decoration to handle a button event that identified it for the SelectTool.
   * @internal
   */
  public async onDecorationButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    for (const decorator of IModelApp.viewManager.decorators) {
      if (undefined !== decorator.testDecorationHit && undefined !== decorator.onDecorationButtonEvent && decorator.testDecorationHit(hit.sourceId))
        return decorator.onDecorationButtonEvent(hit, ev);
    }
    return EventHandled.No;
  }

  /** Allow a pickable decoration to be snapped to by AccuSnap or TentativePoint.
   * @internal
   */
  public getDecorationGeometry(hit: HitDetail): GeometryStreamProps | undefined {
    for (const decorator of IModelApp.viewManager.decorators) {
      if (undefined !== decorator.testDecorationHit && undefined !== decorator.getDecorationGeometry && decorator.testDecorationHit(hit.sourceId))
        return decorator.getDecorationGeometry(hit);
    }
    return undefined;
  }

  /** Allow a pickable decoration created using a persistent element id to augment or replace the the persistent element's tooltip.
   * @internal
   */
  public async overrideElementToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    for (const decorator of this.decorators) {
      if (undefined !== decorator.overrideElementHit && undefined !== decorator.getDecorationToolTip && decorator.overrideElementHit(hit))
        return decorator.getDecorationToolTip(hit);
    }
    return this.getElementToolTip(hit);
  }

  /** Allow a pickable decoration created using a persistent element id to handle a button event that identified it for the SelectTool.
   * @internal
   */
  public async overrideElementButtonEvent(hit: HitDetail, ev: BeButtonEvent): Promise<EventHandled> {
    for (const decorator of IModelApp.viewManager.decorators) {
      if (undefined !== decorator.overrideElementHit && undefined !== decorator.onDecorationButtonEvent && decorator.overrideElementHit(hit))
        return decorator.onDecorationButtonEvent(hit, ev);
    }
    return EventHandled.No;
  }

  /** Allow a pickable decoration created using a persistent element id to control whether snapping uses the persistent element's geometry.
   * @internal
   */
  public overrideElementGeometry(hit: HitDetail): GeometryStreamProps | undefined {
    for (const decorator of IModelApp.viewManager.decorators) {
      if (undefined !== decorator.overrideElementHit && undefined !== decorator.getDecorationGeometry && decorator.overrideElementHit(hit))
        return decorator.getDecorationGeometry(hit);
    }
    return undefined;
  }

  public get crossHairCursor(): string { return `url(${IModelApp.publicPath}cursors/crosshair.cur), crosshair`; }
  public get dynamicsCursor(): string { return `url(${IModelApp.publicPath}cursors/dynamics.cur), move`; }
  public get grabCursor(): string { return `url(${IModelApp.publicPath}cursors/openHand.cur), auto`; }
  public get grabbingCursor(): string { return `url(${IModelApp.publicPath}cursors/closedHand.cur), auto`; }
  public get walkCursor(): string { return `url(${IModelApp.publicPath}cursors/walk.cur), auto`; }
  public get rotateCursor(): string { return `url(${IModelApp.publicPath}cursors/rotate.cur), auto`; }
  public get lookCursor(): string { return `url(${IModelApp.publicPath}cursors/look.cur), auto`; }
  public get zoomCursor(): string { return `url(${IModelApp.publicPath}cursors/zoom.cur), auto`; }

  /** Change the cursor shown in all Viewports.
   * @param cursor The new cursor to display. If undefined, the default cursor is used.
   */
  public setViewCursor(cursor: string = "default") {
    if (cursor === this.cursor)
      return;
    this.cursor = cursor;
    for (const vp of this._viewports)
      vp.setCursor(cursor);
  }

  /** Intended strictly as a temporary solution for interactive editing applications, until official support for such apps is implemented.
   * Call this after editing one or more models, passing in the Ids of those models, to cause new tiles to be generated reflecting the changes.
   * Pass undefined if you are unsure which models changed (this is less efficient as it discards all tiles for all viewed models in all viewports).
   * @internal
   */
  public refreshForModifiedModels(modelIds: Id64Arg | undefined): void {
    for (const vp of this._viewports)
      vp.refreshForModifiedModels(modelIds);
  }

  /** The number of [antialiasing](https://en.wikipedia.org/wiki/Multisample_anti-aliasing) samples to be used when rendering the contents of all viewports
   * registered with the ViewManager.
   * Must be an integer greater than zero. A value of 1 means antialiasing is disabled. A higher number of samples correlates generally to a higher quality image but
   * is also more demanding on the graphics hardware.
   * This setting will also be applied to subsequently-registered viewports.
   */
  public setAntialiasingAllViews(numSamples: number): void {
    for (const vp of this)
      vp.antialiasSamples = numSamples;

    System.instance.antialiasSamples = numSamples;
  }
}
