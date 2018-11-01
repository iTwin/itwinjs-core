/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

import { Icon, IconInfo } from "./IconLabelSupport";
import { FrontstageManager } from "./FrontstageManager";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../SyncUiEventDispatcher";
import { BaseItemState } from "./ItemDefBase";
import { ToolItemProps } from "./ItemProps";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

/** Tool Button React Component.
 */
export class ToolButton extends React.Component<ToolItemProps, BaseItemState> {
  private _componentUnmounting = false;

  /** hidden */
  public readonly state: Readonly<BaseItemState>;

  constructor(props: ToolItemProps) {
    super(props);

    this.state = {
      isVisible: undefined !== props.isVisible ? props.isVisible : true,
      isEnabled: undefined !== props.isEnabled ? props.isEnabled : true,
      isActive: undefined !== props.isActive ? props.isActive : false,
    };
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._componentUnmounting) return;

    let refreshState = false;
    let newState: BaseItemState = { ...this.state };

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ToolActivated)) {
      newState.isActive = this.props.toolId === FrontstageManager.activeToolId;
      refreshState = true;
    }

    if (!refreshState && this.props.stateSyncIds && this.props.stateSyncIds.length > 0)
      refreshState = this.props.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      if (this.props.stateFunc)
        newState = this.props.stateFunc(newState);
      if ((this.state.isActive !== newState.isActive) || (this.state.isEnabled !== newState.isEnabled) || (this.state.isVisible !== newState.isVisible)) {
        this.setState((_prevState) => ({ isActive: newState.isActive, isEnabled: newState.isEnabled, isVisible: newState.isVisible }));
      }
    }
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _execute = () => {
    if (this.props.execute) {
      this.props.execute();
    } else {
      const thisTool: typeof Tool | undefined = IModelApp.tools.find(this.props.toolId);
      if (thisTool)
        (new thisTool()).run();
    }
  }

  public get iconInfo(): IconInfo {
    return { iconClass: this.props.iconClass, iconElement: this.props.iconElement };
  }

  private renderIcon(): React.ReactNode {
    return (
      <Icon iconInfo={this.iconInfo} />
    );
  }

  public render(): React.ReactNode {
    let myClassNames = "";
    if (!this.state.isVisible)
      myClassNames += "item-hidden";
    if (!this.state.isEnabled)
      myClassNames += "nz-is-disabled";

    return (
      <ToolbarIcon
        className={myClassNames}
        isActive={this.state.isActive}
        title={this.props.label}
        key={this.props.toolId}
        onClick={this._execute}
        icon={this.renderIcon()}
      />
    );
  }
}
