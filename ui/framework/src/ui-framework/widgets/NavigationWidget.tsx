/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponentEvents, ViewClassFullNameChangedEventArgs } from "@bentley/ui-components";

import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { ToolbarWidgetDefBase } from "./ToolbarWidgetBase";
import { NavigationWidgetProps, WidgetType } from "./WidgetDef";

import { NavigationAidControl, NavigationAidActivatedEventArgs } from "../navigationaids/NavigationAidControl";
import { FrontstageManager, ToolActivatedEventArgs } from "../frontstage/FrontstageManager";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";

import { Tools as NZ_ToolsWidget } from "@bentley/ui-ninezone";
import { ContentViewManager } from "../content/ContentViewManager";
import { ContentControlActivatedEventArgs } from "../content/ContentControl";
import { CommonProps } from "@bentley/ui-core";
import { UiShowHideManager } from "../utils/UiShowHideManager";

/** A Navigation Widget normally displayed in the top right zone in the 9-Zone Layout system.
 * @public
 */
export class NavigationWidgetDef extends ToolbarWidgetDefBase {
  private _navigationAidId: string;
  private _imodel: IModelConnection | undefined;
  private _navigationAidControl: NavigationAidControl | undefined;
  private _reactElement: React.ReactNode;

  constructor(props: NavigationWidgetProps) {
    super(props);

    this.widgetType = WidgetType.Navigation;

    this._navigationAidId = (props.navigationAidId !== undefined) ? props.navigationAidId : "";
  }

  public get reactElement(): React.ReactNode {
    if (!this._reactElement)
      this._reactElement = <NavigationWidgetWithDef navigationWidgetDef={this} />;

    return this._reactElement;
  }

  public renderCornerItem(): React.ReactNode {
    // istanbul ignore if
    if (FrontstageManager.isLoading)
      return null;

    if (!this._navigationAidControl && this._navigationAidId) {
      this._navigationAidControl = ConfigurableUiManager.createControl(this._navigationAidId, this._navigationAidId, { imodel: this._imodel }) as NavigationAidControl;
      if (this._navigationAidControl.getType() !== ConfigurableUiControlType.NavigationAid) {
        throw Error("NavigationWidgetDef.renderCornerItem error: navigationAidId '" + this._navigationAidId + "' is registered to a control that is NOT a NavigationAid");
      }
      this._navigationAidControl.initialize();
    }

    if (this._navigationAidControl) {
      const size = this._navigationAidControl.getSize() || "64px";
      const divStyle: React.CSSProperties = {
        width: size,
        height: size,
      };

      return (
        <div style={divStyle}>
          {this._navigationAidControl.reactElement}
        </div>
      );
    }

    return null;
  }

  public updateNavigationAid(navigationAidId: string, imodel?: IModelConnection): void {
    this._navigationAidId = navigationAidId;
    this._imodel = imodel;
    this._navigationAidControl = undefined;
  }
}

/** Properties for the [[NavigationWidget]] React component.
 * @public
 */
export interface NavigationWidgetPropsEx extends NavigationWidgetProps, CommonProps {
  iModelConnection?: IModelConnection;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** State for the Navigation Widget React component.
 * @internal
 */
interface NavigationWidgetState {
  navigationWidgetDef: NavigationWidgetDef;
}

/** Navigation Widget React component.
 * @public
 */
export class NavigationWidget extends React.Component<NavigationWidgetPropsEx, NavigationWidgetState> {

  /** @internal */
  public readonly state: Readonly<NavigationWidgetState>;

  constructor(props: NavigationWidgetPropsEx) {
    super(props);

    this.state = { navigationWidgetDef: new NavigationWidgetDef(props) };
  }

  /** Adds listeners */
  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivated);
    ViewportComponentEvents.onViewClassFullNameChangedEvent.addListener(this._handleViewClassFullNameChange);
  }

  /** Removes listeners */
  public componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivated);
    ViewportComponentEvents.onViewClassFullNameChangedEvent.removeListener(this._handleViewClassFullNameChange);
  }

  private _handleContentControlActivated = (args: ContentControlActivatedEventArgs): void => {
    const navigationAidId = args.activeContentControl.navigationAidControl;
    setTimeout(() => {
      FrontstageManager.setActiveNavigationAid(navigationAidId, this.props.iModelConnection!);
    });
  }

  private _handleViewClassFullNameChange = (args: ViewClassFullNameChangedEventArgs): void => {
    setTimeout(() => {
      const activeContentControl = ContentViewManager.getActiveContentControl();

      if (activeContentControl && args.viewport === activeContentControl.viewport) {
        const navigationAidId = activeContentControl.navigationAidControl;
        FrontstageManager.setActiveNavigationAid(navigationAidId, this.props.iModelConnection!);
      }
    });
  }

  public componentDidUpdate(prevProps: NavigationWidgetPropsEx, _prevState: NavigationWidgetState) {
    if (this.props !== prevProps) {
      this.setState({ navigationWidgetDef: new NavigationWidgetDef(this.props) });
    }
  }

  public render(): React.ReactNode {
    return (
      <NavigationWidgetWithDef
        className={this.props.className}
        style={this.props.style}
        navigationWidgetDef={this.state.navigationWidgetDef}
        horizontalToolbar={this.props.horizontalToolbar}
        verticalToolbar={this.props.verticalToolbar}
      />
    );
  }
}

/** Properties for the [[NavigationWidgetWithDef]] component.
 */
interface Props extends CommonProps {
  navigationWidgetDef: NavigationWidgetDef;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** Navigation Widget React component that's passed a NavigationWidgetDef.
 */
class NavigationWidgetWithDef extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs): void => {
    this.setState((_prevState) => ({ toolId: args.toolId }));
  }

  private _handleNavigationAidActivatedEvent = (args: NavigationAidActivatedEventArgs): void => {
    this.props.navigationWidgetDef.updateNavigationAid(args.navigationAidId, args.iModelConnection);

    this.setState((_prevState) => ({ navigationAidId: args.navigationAidId, imodel: args.iModelConnection }));
  }

  public componentDidMount() {
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
    FrontstageManager.onNavigationAidActivatedEvent.addListener(this._handleNavigationAidActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
    FrontstageManager.onNavigationAidActivatedEvent.removeListener(this._handleNavigationAidActivatedEvent);
  }

  public render(): React.ReactNode {
    const navigationAid = this.props.navigationWidgetDef.renderCornerItem();
    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.navigationWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.navigationWidgetDef.renderVerticalToolbar();

    return (
      <NZ_ToolsWidget isNavigation
        className={this.props.className}
        style={this.props.style}
        button={navigationAid}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
        preserveSpace={true}
        onMouseEnter={UiShowHideManager.handleWidgetMouseEnter}
      />
    );
  }
}
