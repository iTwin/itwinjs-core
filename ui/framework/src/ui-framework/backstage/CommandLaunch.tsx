/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";
import { Backstage, BackstageItemProps, BackstageItemState, getBackstageItemStateFromProps } from "./Backstage";
import { CommandHandler } from "../shared/ItemProps";

import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";

/** Properties for a Command Launch Backstage item.
 */
export interface CommandLaunchBackstageItemProps extends BackstageItemProps, CommandHandler {
  /** Unique Id for this backstage item. */
  commandId: string;
}

export class CommandLaunchBackstageItem extends React.PureComponent<CommandLaunchBackstageItemProps, BackstageItemState> {

  /** @hidden */
  public readonly state: Readonly<BackstageItemState>;
  private _componentUnmounting = false;  // used to ensure _handleSyncUiEvent callback is not processed after componentWillUnmount is called
  private _stateSyncIds: string[] = [];  // local version of syncId that are lower cased

  constructor(props: CommandLaunchBackstageItemProps) {
    super(props);

    if (props.stateSyncIds)
      this._stateSyncIds = props.stateSyncIds.map((value) => value.toLowerCase());

    this.state = getBackstageItemStateFromProps(props);
  }

  public componentDidMount() {
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    if (this._componentUnmounting)
      return;

    if (SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, this._stateSyncIds))
      if (this.props.stateFunc) {
        const newState = this.props.stateFunc(this.state);
        if (!PropsHelper.isShallowEqual(newState, this.state))
          this.setState((_prevState) => newState);
      }
  }

  public execute = (): void => {
    Backstage.hide();

    if (this.props.execute) {
      if (this.props.getCommandArgs)
        this.props.execute(this.props.getCommandArgs());
      else
        this.props.execute(this.props.parameters);
    }
  }

  public componentWillReceiveProps(nextProps: CommandLaunchBackstageItemProps) {
    const updatedState = getBackstageItemStateFromProps(nextProps);
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  // TODO: add tooltip, subtitle, aria-label? to NZ_BackstageItem
  public render(): React.ReactNode {
    return (
      <NZ_BackstageItem key={this.props.commandId}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        label={this.state.label}
        icon={PropsHelper.getIcon(this.state.iconSpec)}
        onClick={this.execute} />
    );
  }
}
