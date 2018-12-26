/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { SignOutModalFrontstage } from "../../oidc/SignOut";
import { LabelProps, TooltipProps, StringGetter } from "../ItemProps";
import { FrontstageManager } from "../FrontstageManager";
import { IconProps, IconSpec } from "../IconComponent";
import { PropsHelper } from "../../utils/PropsHelper";

import { UiEvent } from "@bentley/ui-core";
import { Backstage as NZ_Backstage, BackstageSeparator as NZ_BackstageSeparator, UserProfile as NZ_UserProfile } from "@bentley/ui-ninezone";
import { AccessToken } from "@bentley/imodeljs-clients";

/** Base properties for a [[Backstage]] item.
 */
export interface BackstageItemProps extends LabelProps, TooltipProps, IconProps {
  /** optional subtitle */
  subtitle?: string | StringGetter;
  /** if set, it is used to define a key that is used to look up a localized string. This value is used only if label is not explicitly set. */
  subtitleKey?: string;
  /** if set, component will be enabled - defaults to true */
  isEnabled?: boolean;
  /** if set, component will be shown with as the active item - defaults to false */
  isActive?: boolean;
  /** optional function to set state of backstage item */
  stateFunc?: (state: Readonly<BackstageItemState>) => BackstageItemState;
  /** optional SyncUi event ids that will trigger the state function to run. */
  stateSyncIds?: string[];
}

/** Properties that define the state of a Backstage items.
 */
export interface BackstageItemState {
  isEnabled: boolean;
  label: string;
  subtitle: string;
  tooltip: string;
  iconSpec: IconSpec;
  isActive?: boolean;
}

/** Helper method to set backstage item state from props */
export const getBackstageItemStateFromProps = (props: BackstageItemProps): BackstageItemState => {
  const labelSpec = PropsHelper.getStringSpec(props.label, props.labelKey);
  const subtitleSpec = PropsHelper.getStringSpec(props.subtitle, props.subtitleKey);
  const tooltipSpec = PropsHelper.getStringSpec(props.tooltip, props.tooltipKey);

  return {
    isEnabled: undefined !== props.isEnabled ? props.isEnabled : true,
    label: PropsHelper.getStringFromSpec(labelSpec),
    subtitle: PropsHelper.getStringFromSpec(subtitleSpec),
    tooltip: PropsHelper.getStringFromSpec(tooltipSpec),
    iconSpec: props.iconSpec,
    isActive: undefined !== props.isActive ? props.isActive : false,
  };
};

/** Separator Backstage item.
 */
export class SeparatorBackstageItem extends React.PureComponent<BackstageItemProps> {
  private static _sSeparatorBackstageItemKey: number;
  private _key: number;

  constructor(separatorBackstageItemDef: BackstageItemProps) {
    super(separatorBackstageItemDef);

    SeparatorBackstageItem._sSeparatorBackstageItemKey++;
    this._key = SeparatorBackstageItem._sSeparatorBackstageItemKey;
  }

  public render(): React.ReactNode {
    return (
      <NZ_BackstageSeparator key={this._key} />
    );
  }
}

/** [[BackstageCloseEventEvent]] arguments.
 */
export interface BackstageCloseEventArgs {
  isVisible: boolean;
}

/** Backstage Close Event class.
 */
export class BackstageCloseEventEvent extends UiEvent<BackstageCloseEventArgs> { }

function closeBackStage() {
  Backstage.onBackstageCloseEventEvent.emit({ isVisible: false });
}

/** Properties for the [[Backstage]] React component.
 */
export interface BackstageProps {
  accessToken?: AccessToken;
  isVisible: boolean;
  className?: string;
  showOverlay?: boolean;
  style?: React.CSSProperties;
  onClose?: () => void;
}

/** Backstage React component.
 */
export class Backstage extends React.Component<BackstageProps> {
  private static _backstageCloseEventEvent: BackstageCloseEventEvent = new BackstageCloseEventEvent();
  public static get onBackstageCloseEventEvent(): BackstageCloseEventEvent { return Backstage._backstageCloseEventEvent; }

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public static hide(): void {
    closeBackStage();
  }

  private _onSignOut = () => {
    closeBackStage();
    FrontstageManager.openModalFrontstage(new SignOutModalFrontstage(this.props.accessToken));
  }

  private _getUserInfo(): React.ReactNode | undefined {
    if (this.props.accessToken) {
      const userInfo = this.props.accessToken.getUserInfo();
      if (userInfo) {
        return (
          <NZ_UserProfile firstName={userInfo.profile!.firstName} lastName={userInfo.profile!.lastName} email={userInfo.email!.id}
            onClick={this._onSignOut.bind(this)} />
        );
      }
    }

    return undefined;
  }

  public render(): React.ReactNode {
    return (
      <>
        <NZ_Backstage
          isOpen={this.props.isVisible}
          showOverlay={this.props.showOverlay}
          onClose={closeBackStage}
          header={this._getUserInfo()}
          items={this.props.children}
        />
      </>
    );
  }
}
