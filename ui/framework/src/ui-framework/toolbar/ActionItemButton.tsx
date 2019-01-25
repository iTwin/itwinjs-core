/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { Icon } from "../shared/IconComponent";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ActionButtonItemDef } from "../shared/Item";
import { BaseItemState } from "../shared/ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";

import { Item } from "@bentley/ui-ninezone";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Property that must be specified for a ActionItemButton component */
export interface ActionItemButtonProps {
  actionItem: ActionButtonItemDef;
  isEnabled?: boolean;
}

/** Helper method to set state from props */
const getItemStateFromProps = (props: ActionItemButtonProps): BaseItemState => {

  // Parent Component can only modify the isEnable state if the actionItem.isEnabled value is set to true.
  return {
    isEnabled: undefined !== props.isEnabled ? props.isEnabled && props.actionItem.isEnabled : props.actionItem.isEnabled,
    isVisible: props.actionItem.isVisible,
    isActive: undefined !== props.actionItem.isActive ? props.actionItem.isActive : false,
  };
};

/** A Toolbar button React Component that executes an action defined by a CommandItemDef or a ToolItemDef.
 */
export class ActionItemButton extends React.Component<ActionItemButtonProps, BaseItemState> {
  private _componentUnmounting = false;

  /** @hidden */
  public readonly state: Readonly<BaseItemState>;

  constructor(props: ActionItemButtonProps) {
    super(props);

    this.state = getItemStateFromProps(props);
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    // istanbul ignore if
    if (this._componentUnmounting)
      return;

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
        // update actionItem as it hold the 'truth' for all state
        if (undefined !== newState.isVisible)
          this.props.actionItem.isVisible = newState.isVisible;
        if (undefined !== newState.isActive)
          this.props.actionItem.isActive = newState.isActive;

        this.setState((_prevState) => ({ isActive: newState.isActive, isEnabled: newState.isEnabled, isVisible: newState.isVisible }));
      }
    }
  }

  public componentWillReceiveProps(nextProps: ActionItemButtonProps) {
    const updatedState = getItemStateFromProps(nextProps);
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _execute = () => {
    // istanbul ignore else
    if (this.props.actionItem.execute) {
      this.props.actionItem.execute();
    }
  }

  private _handleKeyDown = (e: React.KeyboardEvent): void => {
    // istanbul ignore else
    if (e.key === "Escape") {
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const { actionItem, ...props } = this.props;
    const icon = <Icon iconSpec={actionItem.iconSpec} />;

    return (
      <Item
        {...props}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        title={actionItem.label}
        key={actionItem.id}
        onClick={this._execute}
        onKeyDown={this._handleKeyDown}
        icon={icon}
      />
    );
  }
}
