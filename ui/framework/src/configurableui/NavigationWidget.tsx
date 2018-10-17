/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { CSSProperties } from "react";

import ConfigurableUiManager from "./ConfigurableUiManager";
import { ToolbarWidgetDefBase } from "./ToolbarWidgetBase";
import { NavigationWidgetProps, WidgetType } from "./WidgetDef";

import { NavigationAidControl } from "./NavigationAidControl";
import { FrontstageManager, ToolActivatedEventArgs, NavigationAidActivatedEventArgs, ContentControlActivatedEventArgs } from "./FrontstageManager";
import { ConfigurableUiControlType } from "./ConfigurableUiControl";

import ToolsWidget from "@bentley/ui-ninezone/lib/widget/Tools";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/** A Navigation Widget normally displayed in the top right zone in the 9-Zone Layout system.
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

  public renderCornerItem(): React.ReactNode | undefined {
    if (!this._navigationAidControl && this._navigationAidId) {
      this._navigationAidControl = ConfigurableUiManager.createControl(this._navigationAidId, this._navigationAidId, { imodel: this._imodel }) as NavigationAidControl;
      if (this._navigationAidControl.getType() !== ConfigurableUiControlType.NavigationAid) {
        throw Error("NavigationWidgetDef.renderCornerItem error: navigationAidId '" + this._navigationAidId + "' is registered to a control that is NOT a NavigationAid");
      }
    }

    if (this._navigationAidControl) {
      const size = this._navigationAidControl.getSize() || "64px";
      const divStyle: CSSProperties = {
        width: size,
        height: size,
      };

      return (
        <div style={divStyle}>
          {this._navigationAidControl.reactElement}
        </div>
      );
    }

    return undefined;
  }

  public updateNavigationAid(navigationAidId: string, imodel?: IModelConnection): void {
    this._navigationAidId = navigationAidId;
    this._imodel = imodel;
    this._navigationAidControl = undefined;
  }
}

/** Properties for the [[NavigationWidget]] React component.
 */
export interface NavigationWidgetPropsEx extends NavigationWidgetProps {
  iModelConnection?: IModelConnection;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** State for the Navigation Widget React component.
 */
export interface NavigationWidgetState {
  navigationWidgetProps: NavigationWidgetPropsEx;
  navigationWidgetDef: NavigationWidgetDef;
}

/** Navigation Widget React component.
 */
export class NavigationWidget extends React.Component<NavigationWidgetPropsEx, NavigationWidgetState> {

  /** hidden */
  public readonly state: Readonly<NavigationWidgetState>;

  constructor(props: NavigationWidgetPropsEx, context?: any) {
    super(props, context);

    this.state = { navigationWidgetProps: props, navigationWidgetDef: new NavigationWidgetDef(props) };
  }

  /** Adds listeners */
  public componentDidMount() {
    FrontstageManager.onContentControlActivatedEvent.addListener(this._handleContentControlActivated);
  }

  /** Removes listeners */
  public componentWillUnmount() {
    FrontstageManager.onContentControlActivatedEvent.removeListener(this._handleContentControlActivated);
  }

  private _handleContentControlActivated = (args: ContentControlActivatedEventArgs): void => {
    const navigationAidId = args.activeContentControl.navigationAidControl;
    setImmediate(() => {
      FrontstageManager.setActiveNavigationAid(navigationAidId, this.props.iModelConnection!);
    });
  }

  public static getDerivedStateFromProps(newProps: NavigationWidgetPropsEx, state: NavigationWidgetState): NavigationWidgetState | null {
    if (newProps !== state.navigationWidgetProps) {
      return { navigationWidgetProps: newProps, navigationWidgetDef: new NavigationWidgetDef(newProps) };
    }

    return null;
  }

  public render(): React.ReactNode {
    this.state.navigationWidgetDef.resolveItems();

    return (
      <NavigationWidgetWithDef
        navigationWidgetDef={this.state.navigationWidgetDef}
        horizontalToolbar={this.props.horizontalToolbar}
        verticalToolbar={this.props.verticalToolbar}
      />
    );
  }
}

/** Properties for the [[NavigationWidgetWithDef]] component.
 */
interface Props {
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
    this.props.navigationWidgetDef.resolveItems();

    const navigationAid = this.props.navigationWidgetDef.renderCornerItem();
    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.navigationWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.navigationWidgetDef.renderVerticalToolbar();

    return (
      <ToolsWidget isNavigation
        button={navigationAid}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}
