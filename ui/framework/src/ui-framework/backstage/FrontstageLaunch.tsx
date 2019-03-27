/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { FrontstageManager, FrontstageActivatedEventArgs } from "../frontstage/FrontstageManager";
import { PropsHelper } from "../utils/PropsHelper";
import { Backstage } from "./Backstage";
import { BackstageItemProps, BackstageItemState, getBackstageItemStateFromProps } from "./BackstageItem";

import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";

/** Properties for a [[FrontstageLaunchBackstageItem]] component
 * @public
 */
export interface FrontstageLaunchBackstageItemProps extends BackstageItemProps {
  /** id of the frontstage */
  frontstageId: string;
}

/** Backstage item that activates a Frontstage
 * @public
 */
export class FrontstageLaunchBackstageItem extends React.PureComponent<FrontstageLaunchBackstageItemProps, BackstageItemState> {

  /** @hidden */
  public readonly state: Readonly<BackstageItemState>;
  private _componentUnmounting = false;  // used to ensure _handleSyncUiEvent callback is not processed after componentWillUnmount is called
  private _stateSyncIds: string[] = [];  // local version of syncId that are lower cased

  constructor(props: FrontstageLaunchBackstageItemProps) {
    super(props);

    if (props.stateSyncIds)
      this._stateSyncIds = props.stateSyncIds.map((value) => value.toLowerCase());

    const state = getBackstageItemStateFromProps(props);
    if (this.props.isActive === undefined) {
      state.isActive = FrontstageManager.activeFrontstageId === this.props.frontstageId;
    }
    this.state = state;
  }

  public componentDidMount() {
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    FrontstageManager.onFrontstageActivatedEvent.addListener(this._handleFrontstageActivatedEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    /* istanbul ignore else */
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    FrontstageManager.onFrontstageActivatedEvent.removeListener(this._handleFrontstageActivatedEvent);
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

  public componentDidUpdate(_prevProps: FrontstageLaunchBackstageItemProps) {
    const updatedState = getBackstageItemStateFromProps(this.props);
    updatedState.isActive = FrontstageManager.activeFrontstageId === this.props.frontstageId;
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  private _handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
    const isActive = args.activatedFrontstageDef.id === this.props.frontstageId;
    if (isActive !== this.state.isActive)
      this.setState({ isActive });
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
