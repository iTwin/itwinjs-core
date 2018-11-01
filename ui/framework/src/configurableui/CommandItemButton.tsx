/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { Icon } from "./IconLabelSupport";
import { FrontstageManager } from "./FrontstageManager";
import { CommandItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../SyncUiEventDispatcher";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

/** Property that must be specified for a CommandItemButton component */
export interface CommandItemButtonProps {
  commandItem: CommandItemDef;
}
/** A Toolbar button React Component that executes a command defined by a CommandItemDef.
 */
export class CommandItemButton extends React.Component<CommandItemButtonProps, BaseItemState> {
  private _componentUnmounting = false;

  /** hidden */
  public readonly state: Readonly<BaseItemState>;

  constructor(props: CommandItemButtonProps) {
    super(props);

    this.state = {
      isVisible: undefined !== props.commandItem.isVisible ? props.commandItem.isVisible : true,
      isEnabled: undefined !== props.commandItem.isEnabled ? props.commandItem.isEnabled : true,
      isActive: false,
    };
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._componentUnmounting) return;

    let refreshState = false;
    let newState: BaseItemState = { ...this.state };

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ToolActivated)) {
      newState.isActive = this.props.commandItem.isToolId && this.props.commandItem.id === FrontstageManager.activeToolId;
      refreshState = true;
    }

    if (!refreshState && this.props.commandItem.stateSyncIds && this.props.commandItem.stateSyncIds.length > 0)
      refreshState = this.props.commandItem.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      if (this.props.commandItem.stateFunc)
        newState = this.props.commandItem.stateFunc(newState);
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
    if (this.props.commandItem.execute) {
      this.props.commandItem.execute();
    }
  }

  private renderIcon(): React.ReactNode {
    return (
      <Icon iconInfo={this.props.commandItem.iconInfo} />
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
        title={this.props.commandItem.label}
        key={this.props.commandItem.id}
        onClick={this._execute}
        icon={this.renderIcon()}
      />
    );
  }
}
