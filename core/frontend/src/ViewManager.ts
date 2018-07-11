/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */
import { Viewport } from "./Viewport";
import { BeCursor } from "./tools/Tool";
import { BeEvent } from "@bentley/bentleyjs-core";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { EventController } from "./tools/EventController";
import { Point3d } from "@bentley/geometry-core";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { UpdatePlan } from "./render/UpdatePlan";
import { DecorateContext } from "./ViewContext";
import { SpatialModelState, DrawingModelState, SectionDrawingModelState, SheetModelState } from "./ModelState";
import { WebMercatorModelState } from "./tile/WebMercatorTileTree";
import { ScaleableMeshModelState } from "./tile/ScalableMeshTileTree";

/**
 * The ViewManager holds the list of opened views, plus the *selected view*. It also provides notifications of view open/close and suspend/resume.
 * Applications must call [[addViewport]] when new Viewports that should be associated with user events are created.
 *
 * A single ViewManager is created when [[IModelApp.startup]] is called. It can be accessed via the static member [[IModelApp.viewManager]].
 */
export class ViewManager {
  public inDynamicsMode = false;
  public cursor?: BeCursor;
  private readonly _viewports: Viewport[] = [];
  private _selectedView?: Viewport;
  private _invalidateScenes = false;
  private _skipSceneCreation = false;

  public onInitialized(): void {
    const models = IModelConnection.Models;
    models.registerClass(SpatialModelState.getClassFullName(), SpatialModelState);
    models.registerClass(DrawingModelState.getClassFullName(), DrawingModelState);
    models.registerClass(SectionDrawingModelState.getClassFullName(), SectionDrawingModelState);
    models.registerClass(SheetModelState.getClassFullName(), SheetModelState);
    models.registerClass(WebMercatorModelState.getClassFullName(), WebMercatorModelState);
    models.registerClass(ScaleableMeshModelState.getClassFullName(), ScaleableMeshModelState);
  }

  /** Called after the selected view changes.
   * @param old Previously selected viewport.
   * @param current Currently selected viewport.
   */
  public readonly onSelectedViewportChanged = new BeEvent<(previous: Viewport | undefined, current: Viewport | undefined) => void>();

  /** Called after a view is opened. This can happen when the iModel is first opened or when a user opens a closed view. */
  public readonly onViewOpen = new BeEvent<(vp: Viewport) => void>();

  /** Called after a view is closed. This can happen when the iModel is closed or when a user closes an open view. */
  public readonly onViewClose = new BeEvent<(vp: Viewport) => void>();

  /** Called after a view is suspended. This can happen when the application is minimized. */
  public readonly onViewSuspend = new BeEvent<(vp: Viewport) => void>();

  /**
   * Called after a suspended view is resumed. This can happen when a minimized application is restored
   * or, on a tablet, when the application is moved to the foreground.
   */
  public readonly onViewResume = new BeEvent<(vp: Viewport) => void>();

  public endDynamicsMode(): void {
    if (!this.inDynamicsMode)
      return;

    this.inDynamicsMode = false;

    const cursorVp = IModelApp.toolAdmin.getCursorView();
    if (cursorVp)
      cursorVp.changeDynamics(undefined);

    for (const vp of this._viewports) {
      if (vp !== cursorVp)
        vp.changeDynamics(undefined);
    }
  }
  public beginDynamicsMode() { this.inDynamicsMode = true; }
  public doesHostHaveFocus(): boolean { return true; } // NEEDS_WORK
  public isInfoWindowUp(): boolean { return false; } // NEEDS_WORK
  public clearInfoWindow(): void { }

  public showInfoWindow(_viewPt: Point3d, _vp: Viewport, _msg: string) {
    //   if (this.doesHostHaveFocus())
    //     this.getInfoWindow().show(viewPt, vp, msg);
  }

  public clearSelectedView(): void {
    const previousVp = this.selectedView;
    this._selectedView = undefined;
    this.notifySelectedViewportChanged(previousVp, undefined);
  }

  public setSelectedView(vp: Viewport | undefined): BentleyStatus {
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

    IModelApp.toolAdmin.startDefaultTool(); // ###TODO not in native, where should defaultTool be called?

    return BentleyStatus.SUCCESS;
  }

  public notifySelectedViewportChanged(previous: Viewport | undefined, current: Viewport | undefined): void {
    IModelApp.toolAdmin.onSelectedViewportChanged(previous, current);
    this.onSelectedViewportChanged.raiseEvent(previous, current);
  }

  /** The "selected view" is the default for certain operations.  */
  public get selectedView(): Viewport | undefined { return this._selectedView; }

  /** Get the first opened view. */
  public getFirstOpenView(): Viewport | undefined { return this._viewports.length > 0 ? this._viewports[0] : undefined; }

  /**
   * Add a new Viewport to the list of opened views and create an EventController for it.
   * @param newVp the Viewport to add
   * @note raises onViewOpen event with newVp.
   * @note Does nothing if newVp is already present in the list.
   */
  public addViewport(newVp: Viewport): void {
    for (const vp of this._viewports) { if (vp === newVp) return; } // make sure its not already in view array
    newVp.setEventController(new EventController(newVp)); // this will direct events to the viewport
    this._viewports.push(newVp);

    // See DgnClientFxViewport::Initialize()
    this.setSelectedView(newVp);

    // Start up the render loop if necessary.
    if (1 === this._viewports.length)
      IModelApp.toolAdmin.startEventLoop();

    this.onViewOpen.raiseEvent(newVp);
  }

  /**
   * Remove a Viewport from the list of opened views.
   * @param vp the Viewport to remove.
   * @return SUCCESS if vp was successfully removed, ERROR if it was not present.
   * @note raises onViewClose event with vp.
   */
  public dropViewport(vp: Viewport): BentleyStatus {
    this.onViewClose.raiseEvent(vp);
    IModelApp.toolAdmin.onViewportClosed(vp); // notify tools that this view is no longer valid

    let didDrop = false;
    const vpList = this._viewports;
    for (let i = 0; i < vpList.length; ++i) {
      if (vpList[i] === vp) {
        vp.setEventController(undefined);
        vpList.splice(i, 1);
        didDrop = true;
        break;
      }
    }

    if (!didDrop)
      return BentleyStatus.ERROR;

    if (this.selectedView === vp) // if removed viewport was selectedView, set it to undefined.
      this.setSelectedView(undefined);

    return BentleyStatus.SUCCESS;
  }

  public forEachViewport(func: (vp: Viewport) => void) { this._viewports.forEach((vp) => func(vp)); }

  public invalidateDecorationsAllViews(): void { this._viewports.forEach((vp) => vp.invalidateDecorations()); }
  public onSelectionSetChanged(_iModel: IModelConnection) {
    this._viewports.forEach((vp) => vp.view.setSelectionSetDirty());
    // for (auto & vp : m_viewports)
    // if (& vp -> GetViewController().GetDgnDb() == & db)
    //   vp -> GetViewControllerR().SetSelectionSetDirty();
  }

  public invalidateViewportScenes(): void { this._viewports.forEach((vp: Viewport) => vp.sync.invalidateScene()); }

  public validateViewportScenes(): void { this._viewports.forEach((vp: Viewport) => vp.sync.setValidScene()); }

  public invalidateScenes(): void { this._invalidateScenes = true; }
  public onNewTilesReady(): void { this.invalidateScenes(); }

  // Invoked by ToolAdmin event loop.
  public renderLoop(): void {
    if (0 === this._viewports.length) return;

    if (this._skipSceneCreation)
      this.validateViewportScenes();
    else if (this._invalidateScenes)
      this.invalidateViewportScenes();

    this._invalidateScenes = false;

    const cursorVp = IModelApp.toolAdmin.getCursorView();
    const plan = new UpdatePlan();

    if (undefined === cursorVp || cursorVp.renderFrame(plan))
      for (const vp of this._viewports)
        if (vp !== cursorVp && !vp.renderFrame(plan))
          break;

    // const tileGenerationSeconds = 5.0;
    // requests.requestMissing(BeDuration.fromSeconds(tileGenerationSeconds));

    this.processIdle();
  }

  private processIdle(): void {
    // ###TODO: precompile shaders?
  }

  /** Called when rendering a frame to allow decorations to be added */
  public readonly onDecorate = new BeEvent<(context: DecorateContext) => void>();

  public callDecorators(context: DecorateContext) {
    IModelApp.accuSnap.decorate(context);
    IModelApp.tentativePoint.decorate(context);
    IModelApp.accuDraw.decorate(context);
    IModelApp.toolAdmin.decorate(context);
    context.viewport.decorate(context);
    this.onDecorate.raiseEvent(context);
  }

  public setViewCursor(cursor: BeCursor | undefined): void {
    if (cursor === this.cursor)
      return;

    this.cursor = cursor;
    if (undefined !== this.selectedView) {
      this.selectedView.setCursor(cursor);
    }

  }
}
