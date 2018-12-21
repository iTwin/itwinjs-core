/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { Subtract } from "@bentley/presentation-common";

/** Properties of [[withVisibility]] HOC. */
export interface WithVisibilityProps {
  /** SyncUi Ids that trigger the calling of boolFunc */
  eventIds: string[];
  /** function called to determine visibility */
  boolFunc: () => boolean;
  /** default visibility */
  defaultVisible: boolean;
}

export interface WithVisibilityState {
  showComponent: boolean;
}

/**
 * A HOC component that adds ability to show/hide supplied component.
 */
// tslint:disable-next-line: variable-name naming-convention
export function withVisibility<P>(Component: React.ComponentType<P>): React.ComponentType<Subtract<P, WithVisibilityProps> & WithVisibilityProps> {

  type CombinedProps = Subtract<P, WithVisibilityProps> & WithVisibilityProps;

  return class WithUnifiedSelection extends React.Component<CombinedProps, WithVisibilityState> {
    private _componentUnmounting = false;

    /** @hidden */
    public readonly state: WithVisibilityState;

    constructor(props: CombinedProps) {
      super(props);

      this.state = {
        showComponent: undefined !== props.defaultVisible ? props.defaultVisible : true,
      };
    }

    private _handleVisibilitySyncUiEvent = (args: SyncUiEventArgs): void => {
      if (this._componentUnmounting) return;
      let showComponent = this.state.showComponent;
      if (this.props.eventIds.some((value: string): boolean => args.eventIds.has(value))) {
        showComponent = this.props.boolFunc();
        if (this.state.showComponent !== showComponent) {
          this.setState((_prevState) => ({ showComponent }));
        }
      }
    }

    public componentDidMount() {
      if (this.props.boolFunc && this.props.eventIds.length > 0)
        SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleVisibilitySyncUiEvent);
    }

    public componentWillUnmount() {
      if (this.props.boolFunc && this.props.eventIds.length > 0) {
        this._componentUnmounting = true;
        SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleVisibilitySyncUiEvent);
      }
    }

    public render() {
      if (!this.state.showComponent)
        return null;

      const {
        eventIds, boolFunc, defaultVisible, // do not bleed our props
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props as any;
      return (
        <Component
          {...props}
        />
      );
    }
  };
}
