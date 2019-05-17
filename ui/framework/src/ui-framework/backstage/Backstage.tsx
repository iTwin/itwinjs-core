/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { UiEvent, CommonProps } from "@bentley/ui-core";
import { Backstage as NZ_Backstage } from "@bentley/ui-ninezone";
import { AccessToken } from "@bentley/imodeljs-clients";

import { CommandItemDef } from "../shared/CommandItemDef";
import { UserProfileBackstageItem } from "./UserProfile";

/** [[BackstageEvent]] arguments.
 * @public
 */
export interface BackstageEventArgs {
  isVisible: boolean;
}

/** Backstage Event class.
 * @public
 */
export class BackstageEvent extends UiEvent<BackstageEventArgs> { }

/** [[BackstageCloseEvent]] arguments.
 * @alpha @deprecated BackstageEventArgs should be used instead.
 */
export interface BackstageCloseEventArgs {
  isVisible: boolean;
}

/** Backstage Close Event class.
 * @alpha @deprecated BackstageEvent should be used instead.
 */
export class BackstageCloseEvent extends UiEvent<BackstageCloseEventArgs> { }

/** Properties for the [[Backstage]] React component.
 * @public
 */
export interface BackstageProps extends CommonProps {
  accessToken?: AccessToken;
  isVisible?: boolean;
  showOverlay?: boolean;
  onClose?: () => void;
  header?: React.ReactNode;
}

/** State for the [[Backstage]] React component.
 * @internal
 */
interface BackstageState {
  isVisible: boolean;
}

/** Backstage React component.
 * @public
 */
export class Backstage extends React.Component<BackstageProps, BackstageState> {

  public static readonly onBackstageEvent = new BackstageEvent();
  public static isBackstageVisible: boolean;

  /** @alpha @deprecated */
  public static readonly onBackstageCloseEvent = new BackstageCloseEvent();

  /** Shows the Backstage */
  public static show(): void {
    Backstage.onBackstageEvent.emit({ isVisible: true });
  }

  /** Hides the Backstage */
  public static hide(): void {
    Backstage.onBackstageEvent.emit({ isVisible: false });
  }

  /** Command that toggles the Backstage */
  public static get backstageToggleCommand() {
    return new CommandItemDef({
      iconSpec: "icon-home",
      labelKey: "UiFramework:commands.openBackstage",
      execute: () => {
        if (Backstage.isBackstageVisible)
          Backstage.hide();
        else
          Backstage.show();
      },
    });
  }

  /** @internal */
  public readonly state: BackstageState;

  constructor(props: BackstageProps) {
    super(props);

    this.state = {
      isVisible: !!this.props.isVisible,
    };
  }

  public componentDidMount() {
    Backstage.onBackstageEvent.addListener(this._handleBackstageEvent);
  }

  public componentWillUnmount() {
    Backstage.onBackstageEvent.removeListener(this._handleBackstageEvent);
  }

  private _handleBackstageEvent = (args: BackstageEventArgs) => {
    this.setState({ isVisible: args.isVisible });

    /** @deprecated */
    Backstage.onBackstageCloseEvent.emit({ isVisible: args.isVisible });
  }

  public componentDidUpdate(prevProps: BackstageProps) {
    if (this.props.isVisible !== prevProps.isVisible)
      this.setState({ isVisible: !!this.props.isVisible });
  }

  private _onClose = () => {
    Backstage.hide();

    /* istanbul ignore else */
    if (this.props.onClose)
      this.props.onClose();
  }

  public render(): React.ReactNode {
    Backstage.isBackstageVisible = this.state.isVisible;

    let header: React.ReactNode = null;

    if (this.props.header)
      header = this.props.header;
    else if (this.props.accessToken !== undefined)
      header = <UserProfileBackstageItem accessToken={this.props.accessToken} />;

    return (
      <NZ_Backstage
        className={this.props.className}
        header={header}
        isOpen={this.state.isVisible}
        onClose={this._onClose}
        showOverlay={this.props.showOverlay}
        style={this.props.style}
      >
        {this.props.children}
      </NZ_Backstage>
    );
  }
}
