/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Id64String } from "@itwin/core-bentley";
import type { IModelConnection, ViewState } from "@itwin/core-frontend";
import { DrawingViewState, IModelApp, ScreenViewport, SpatialViewState } from "@itwin/core-frontend";

export class RobotWorldApp {

  private static _iModel: IModelConnection;

  // __PUBLISH_EXTRACT_START__ IModelConnection.Views.getSpatialViewList
  /** Get a list of Spatial views from an iModel. */
  public static async getSpatialViews(): Promise<IModelConnection.ViewSpec[]> {
    return this._iModel.views.getViewList({ from: SpatialViewState.classFullName });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ IModelConnection.Views.getDrawingViewList
  /** Get a list of all Drawing views from an iModel. */
  public static async getDrawingViews(): Promise<IModelConnection.ViewSpec[]> {
    return this._iModel.views.getViewList({ from: DrawingViewState.classFullName });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ IModelConnection.Views.load
  /** Stub for a real UI that would present the user with the list and choose one entry */
  public static async pickView(views: IModelConnection.ViewSpec[]): Promise<string> {
    // ...real ui code here showing view[].name list, returning chosenView...
    const chosenView = 0;

    // return the id of the chosen view
    return views[chosenView].id;
  }

  /** Load the list of spatial views from our iModel, let the user pick one, and return a Promise for the ViewState of the selected view. */
  public static async loadOneView(): Promise<ViewState> {
    // first get the list of spatial views
    const views: IModelConnection.ViewSpec[] = await this.getSpatialViews();

    // ask the user to pick one from the list, returning its Id
    const viewId: string = await this.pickView(views);

    // return a promise for the ViewState of the selected view. Note that caller will have to await this method
    return this._iModel.views.load(viewId);
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ScreenViewport.changeView
  /** Show a list of spatial views, allow the user to select one, load its ViewState, and then change the selected ScreenViewport to show it. */
  public static async showOneView(): Promise<void> {
    const viewstate = await this.loadOneView();
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.changeView(viewstate);
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ScreenViewport.changeViewedModel2d
  /** Change the displayed 2d Model of the selected view, if it is currently showing a 2d Model
   * @note the categories and displayStyle are unchanged. View is fitted to new model extents.
   */
  public static async change2dModel(newModelId: Id64String): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      return vp.changeViewedModel2d(newModelId, { doFit: true });
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ViewManager.addViewport
  /** Open a Viewport on the supplied div element. */
  public static async openView(viewDiv: HTMLDivElement) {
    const viewState = await this.loadOneView();
    const viewPort = ScreenViewport.create(viewDiv, viewState);
    IModelApp.viewManager.addViewport(viewPort);
  }
  // __PUBLISH_EXTRACT_END__

}
