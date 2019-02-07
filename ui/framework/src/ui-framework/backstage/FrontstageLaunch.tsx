/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { PropsHelper } from "../utils/PropsHelper";
import { Backstage, BackstageItemProps, BackstageItemState, getBackstageItemStateFromProps } from "./Backstage";

import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";

/** Properties for a [[FrontstageLaunchBackstageItem]] component
 */
export interface FrontstageLaunchBackstageItemProps extends BackstageItemProps {
  /** id of the frontstage */
  frontstageId: string;
}

/** Backstage item that activates a Frontstage */
export class FrontstageLaunchBackstageItem extends React.PureComponent<FrontstageLaunchBackstageItemProps, BackstageItemState> {

  /** @hidden */
  public readonly state: Readonly<BackstageItemState>;
  private _componentUnmounting = false;  // used to ensure _handleSyncUiEvent callback is not processed after componentWillUnmount is called
  private _stateSyncIds: string[] = [];  // local version of syncId that are lower cased

  constructor(props: FrontstageLaunchBackstageItemProps) {
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
    /* istanbul ignore else */
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    /* istanbul ignore next */
    if (this._componentUnmounting)
      return;

    /* istanbul ignore else */
    if (SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, this._stateSyncIds))
      /* istanbul ignore else */
      if (this.props.stateFunc) {
        const newState = this.props.stateFunc(this.state);
        /* istanbul ignore else */
        if (!PropsHelper.isShallowEqual(newState, this.state))
          this.setState((_prevState) => newState);
      }
  }

  public execute = (): void => {
    Backstage.hide();

    const frontstageDef = FrontstageManager.findFrontstageDef(this.props.frontstageId);
    /* istanbul ignore else */
    if (frontstageDef)
      FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises
  }

  public componentWillReceiveProps(nextProps: FrontstageLaunchBackstageItemProps) {
    const updatedState = getBackstageItemStateFromProps(nextProps);
    updatedState.isActive = FrontstageManager.activeFrontstageId === this.props.frontstageId;
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  // TODO: add tooltip, subtitle, aria-label? to NZ_BackstageItem
  public render(): React.ReactNode {
    return (
      <NZ_BackstageItem key={this.props.frontstageId}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        label={this.state.label}
        subtitle={this.state.subtitle}
        icon={PropsHelper.getIcon(this.state.iconSpec)}
        onClick={this.execute} />
    );
  }
}
