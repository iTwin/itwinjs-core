/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { ViewportComponent } from "@bentley/ui-components";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";
import { FillCentered } from "@bentley/ui-core";
import { ScreenViewport, ViewState, IModelConnection } from "@bentley/imodeljs-frontend";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ViewportContentControl } from "./ViewportContentControl";
import { DefaultViewOverlay } from "./DefaultViewOverlay";
import { UiFramework } from "../UiFramework";
import { connectIModelConnectionAndViewState } from "../redux/connectIModel";

// create a HOC viewport component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionViewport = viewWithUnifiedSelection(ViewportComponent);

/** ViewSelector that is connected to the IModelConnection property in the Redux store. The application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedViewport = connectIModelConnectionAndViewState(null, null)(UnifiedSelectionViewport); // tslint:disable-line:variable-name

/** [[IModelViewportControl]] options. These options are set in the applicationData property of the [[ContentProps]].
 * @beta
 */
export interface IModelViewportControlOptions {
  /** ViewState or a function to return a ViewState */
  viewState?: ViewState | (() => ViewState);
  /** IModelConnection of data in Viewport */
  iModelConnection?: IModelConnection | (() => IModelConnection);
  /** Optional property to  disable the use of the DefaultViewOverlay */
  disableDefaultViewOverlay?: boolean;
  /** Optional background color which may be used if viewState and iModelConnection are undefined */
  bgColor?: string;
}

/** iModel Viewport Control
 * @beta
 */
// istanbul ignore next
export class IModelViewportControl extends ViewportContentControl {
  public static get id() {
    return "UiFramework.IModelViewportControl";
  }
  protected _disableDefaultViewOverlay = false;
  protected _viewState: ViewState | undefined;
  protected _iModelConnection: IModelConnection | undefined;

  constructor(info: ConfigurableCreateInfo, options: IModelViewportControlOptions) {
    super(info, options);

    if (options.viewState) {
      if (typeof options.viewState === "function")
        this._viewState = options.viewState();
      else
        this._viewState = options.viewState;
    }

    if (!!options.disableDefaultViewOverlay)
      this._disableDefaultViewOverlay = true;

    const iModelConnection = (typeof options.iModelConnection === "function") ? options.iModelConnection() : options.iModelConnection;

    if (this._viewState && iModelConnection) {
      this.reactElement = this.getImodelViewportReactElement(iModelConnection, this._viewState);
    } else {
      if (UiFramework.getIModelConnection() && UiFramework.getDefaultViewState()) {
        this.reactElement = this.getImodelConnectedViewportReactElement();
      } else {
        this.reactElement = this.getNoContentReactElement(options);
        this.setIsReady();
      }
    }
  }

  /** Get the React component that will contain the Viewport */
  protected getImodelConnectedViewportReactElement(): React.ReactNode {
    return <IModelConnectedViewport
      viewportRef={(v: ScreenViewport) => {
        this.viewport = v;
        // for convenience, if window defined bind viewport to window
        if (undefined !== window)
          (window as any).viewport = v;
      }}
      getViewOverlay={this._getViewOverlay}
    />;
  }

  /** Get the React component that will contain the Viewport */
  protected getImodelViewportReactElement(iModelConnection: IModelConnection, viewState: ViewState): React.ReactNode {
    return <UnifiedSelectionViewport
      viewState={viewState}
      imodel={iModelConnection}
      viewportRef={(v: ScreenViewport) => {
        this.viewport = v;
        // for convenience, if window defined bind viewport to window
        if (undefined !== window)
          (window as any).viewport = v;
      }}
      getViewOverlay={this._getViewOverlay}
    />;
  }

  /** Get the React component that will be shown when no iModel data is available */
  protected getNoContentReactElement(_options: IModelViewportControlOptions): React.ReactNode {
    const noContent = UiFramework.translate("general.no-content");
    return <FillCentered> {noContent} </FillCentered>;
  }

  /** Get the React.Element for a ViewSelector change. */
  public getReactElementForViewSelectorChange(iModelConnection: IModelConnection, _unusedViewDefinitionId: Id64String, viewState: ViewState, _name: string): React.ReactNode {
    return this.getImodelViewportReactElement(iModelConnection, viewState);
  }

  /** Get the default ViewOverlay unless parameter is set to not use it. May be override in an application specific sub-class  */
  protected _getViewOverlay = (viewport: ScreenViewport): React.ReactNode => {
    if (this._disableDefaultViewOverlay)
      return null;

    return <DefaultViewOverlay viewport={viewport} />;
  }

  /** Get the NavigationAidControl associated with this ContentControl */
  public get navigationAidControl(): string {
    if (this._viewState)
      return super.navigationAidControl;
    else
      return "StandardRotationNavigationAid";
  }
}

ConfigurableUiManager.registerControl(IModelViewportControl.id, IModelViewportControl);
