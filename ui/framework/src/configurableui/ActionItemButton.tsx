/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { Icon } from "./IconComponent";
import { FrontstageManager } from "./FrontstageManager";
import { ActionButtonItemDef } from "./Item";
import { BaseItemState } from "./ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../SyncUiEventDispatcher";

import { Item } from "@bentley/ui-ninezone";

/** Property that must be specified for a ActionItemButton component */
export interface ActionItemButtonProps {
  actionItem: ActionButtonItemDef;
}
/** A Toolbar button React Component that executes an action defined by a CommandItemDef or a ToolItemDef.
 */
export class ActionItemButton extends React.Component<ActionItemButtonProps, BaseItemState> {
  private _componentUnmounting = false;

  /** @hidden */
  public readonly state: Readonly<BaseItemState>;

  constructor(props: ActionItemButtonProps) {
    super(props);

    this.state = {
      isVisible: props.actionItem.isVisible,
      isEnabled: props.actionItem.isEnabled,
      isActive: false,
    };
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._componentUnmounting) return;

    let refreshState = false;
    let newState: BaseItemState = { ...this.state };

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ToolActivated)) {
      newState.isActive = this.props.actionItem.id === FrontstageManager.activeToolId;
      refreshState = true;
    }

    if (!refreshState && this.props.actionItem.stateSyncIds && this.props.actionItem.stateSyncIds.length > 0)
      refreshState = this.props.actionItem.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      if (this.props.actionItem.stateFunc)
        newState = this.props.actionItem.stateFunc(newState);
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
    if (this.props.actionItem.execute) {
      this.props.actionItem.execute();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const icon = <Icon iconSpec={this.props.actionItem.iconSpec} />;

    return (
      <Item
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        title={this.props.actionItem.label}
        key={this.props.actionItem.id}
        onClick={this._execute}
        icon={icon}
      />
    );
  }
}
