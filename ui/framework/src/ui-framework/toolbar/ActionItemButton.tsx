/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";

import { CommonProps, SizeProps, Icon, BadgeUtilities } from "@bentley/ui-core";
import { Item } from "@bentley/ui-ninezone";

import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { BaseItemState } from "../shared/ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Properties that must be specified for an [[ActionItemButton]] component
 * @public
 */
export interface ActionItemButtonProps extends CommonProps {
  /** Action Button item definition containing the action information */
  actionItem: ActionButtonItemDef;
  /** Indicates whether the button is enabled or disabled */
  isEnabled?: boolean;
  /** Called when the button is initialized and the size is known */
  onSizeKnown?: (size: SizeProps) => void;
}

/** Helper method to set state from props */
const getItemStateFromProps = (props: ActionItemButtonProps): BaseItemState => {

  // Parent Component can only modify the isEnable state if the actionItem.isEnabled value is set to true.
  return {
    isEnabled: undefined !== props.isEnabled ? props.isEnabled && props.actionItem.isEnabled : props.actionItem.isEnabled, // tslint:disable-line:deprecation
    isVisible: props.actionItem.isVisible, // tslint:disable-line:deprecation
    isActive: undefined !== props.actionItem.isActive ? props.actionItem.isActive : false,
  };
};

/** A Toolbar button React Component that executes an action defined by a CommandItemDef or a ToolItemDef.
 * @public
 */
export class ActionItemButton extends React.Component<ActionItemButtonProps, BaseItemState> {
  private _componentUnmounting = false;

  /** @internal */
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

    if (!refreshState && this.props.actionItem.stateSyncIds && this.props.actionItem.stateSyncIds.length > 0) // tslint:disable-line:deprecation
      refreshState = this.props.actionItem.stateSyncIds.some((value: string): boolean => args.eventIds.has(value)); // tslint:disable-line:deprecation

    if (refreshState) {
      if (this.props.actionItem.stateFunc) // tslint:disable-line:deprecation
        newState = this.props.actionItem.stateFunc(newState); // tslint:disable-line:deprecation

      if ((this.state.isActive !== newState.isActive) || (this.state.isEnabled !== newState.isEnabled) || (this.state.isVisible !== newState.isVisible)) {
        // update actionItem as it hold the 'truth' for all state
        /* istanbul ignore else */
        if (undefined !== newState.isVisible) // tslint:disable-line:deprecation
          this.props.actionItem.isVisible = newState.isVisible; // tslint:disable-line:deprecation

        /* istanbul ignore else */
        if (undefined !== newState.isActive)
          this.props.actionItem.isActive = newState.isActive;

        this.setState({
          isActive: newState.isActive,
          isEnabled: newState.isEnabled,
          isVisible: newState.isVisible,
        });
      }
    }
  }

  /** @internal */
  public static getDerivedStateFromProps(props: ActionItemButtonProps, state: BaseItemState) {
    const updatedState = getItemStateFromProps(props);
    // istanbul ignore else
    if (!PropsHelper.isShallowEqual(updatedState, state))
      return updatedState;

    return null;
  }

  /** @internal */
  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  /** @internal */
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

  /** @internal */
  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const { actionItem, ...props } = this.props;
    const icon = <Icon iconSpec={actionItem.iconSpec} />;
    const badge = BadgeUtilities.getComponentForBadgeType(actionItem.badgeType);

    return (
      <Item
        {...props}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        title={actionItem.label}
        key={actionItem.getKey()}
        onClick={this._execute}
        onKeyDown={this._handleKeyDown}
        icon={icon}
        onSizeKnown={this.props.onSizeKnown}
        badge={badge}
      />
    );
  }
}
