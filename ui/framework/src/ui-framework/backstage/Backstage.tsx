/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SignOutModalFrontstage } from "../oidc/SignOut";
import { FrontstageManager } from "../frontstage/FrontstageManager";

import { UiEvent, getUserColor } from "@bentley/ui-core";
import { Backstage as NZ_Backstage, UserProfile as NZ_UserProfile } from "@bentley/ui-ninezone";
import { AccessToken } from "@bentley/imodeljs-clients";
import { CommandItemDef } from "../shared/Item";

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
export interface BackstageProps {
  accessToken?: AccessToken;
  isVisible?: boolean;
  className?: string;
  showOverlay?: boolean;
  style?: React.CSSProperties;
  onClose?: () => void;
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
    if (this.props.onClose)
      this.props.onClose();
  }

  private _onSignOut = () => {
    Backstage.hide();
    FrontstageManager.openModalFrontstage(new SignOutModalFrontstage(this.props.accessToken));
  }

  private _getUserInfo(): React.ReactNode | undefined {
    if (this.props.accessToken) {
      const userInfo = this.props.accessToken.getUserInfo();
      if (userInfo) {
        return (
          <NZ_UserProfile
            color={getUserColor(userInfo.email!.id)}
            initials={this._getInitials(userInfo.profile!.firstName, userInfo.profile!.lastName)}
            onClick={this._onSignOut}
          >
            {this._getFullName(userInfo.profile!.firstName, userInfo.profile!.lastName)}
          </NZ_UserProfile>
        );
      }
    }

    return undefined;
  }

  private _getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  private _getFullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
  }

  public render(): React.ReactNode {
    Backstage.isBackstageVisible = this.state.isVisible;

    return (
      <NZ_Backstage
        className={this.props.className}
        header={this._getUserInfo()}
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
