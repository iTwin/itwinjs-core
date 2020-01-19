/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Backstage
 */

import * as React from "react";
import { UiEvent, CommonProps, IconSpec } from "@bentley/ui-core";
import { Backstage as NZ_Backstage } from "@bentley/ui-ninezone";
import { AccessToken } from "@bentley/imodeljs-clients";
import { CommandItemDef } from "../shared/CommandItemDef";
import { SafeAreaContext } from "../safearea/SafeAreaContext";
import { UserProfileBackstageItem } from "./UserProfile";
import { UiFramework } from "../UiFramework";

// cSpell:ignore safearea

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

  /** Shows the Backstage */
  public static show(): void {
    UiFramework.backstageManager.open();
  }

  /** Hides the Backstage */
  public static hide(): void {
    UiFramework.backstageManager.close();
  }

  /** Get CommandItemDef that will toggle display of Backstage and allow iconSpec to be overridden */
  public static getBackstageToggleCommand(overrideIconSpec?: IconSpec) {
    return new CommandItemDef({
      commandId: "UiFramework.openBackstage",
      iconSpec: overrideIconSpec ? overrideIconSpec : "icon-home",
      labelKey: "UiFramework:commands.openBackstage",
      execute: () => {
        UiFramework.backstageManager.toggle();
      },
    });
  }

  /** Command that toggles the Backstage */
  public static get backstageToggleCommand() {
    return this.getBackstageToggleCommand();
  }

  /** @internal */
  public readonly state: BackstageState;

  constructor(props: BackstageProps) {
    super(props);

    this.setIsOpen(!!this.props.isVisible);
    this.state = {
      isVisible: UiFramework.backstageManager.isOpen,
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
  }

  public componentDidUpdate(prevProps: BackstageProps) {
    if (this.props.isVisible !== prevProps.isVisible)
      this.setIsOpen(!!this.props.isVisible);
  }

  private setIsOpen(isOpen: boolean) {
    if (isOpen) {
      UiFramework.backstageManager.open();
    } else {
      UiFramework.backstageManager.close();
    }
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
      <SafeAreaContext.Consumer>
        {(safeAreaInsets) => (
          <NZ_Backstage
            className={this.props.className}
            header={header}
            isOpen={this.state.isVisible}
            onClose={this._onClose}
            safeAreaInsets={safeAreaInsets}
            showOverlay={this.props.showOverlay}
            style={this.props.style}
          >
            {this.props.children}
          </NZ_Backstage>
        )}
      </SafeAreaContext.Consumer>
    );
  }
}
