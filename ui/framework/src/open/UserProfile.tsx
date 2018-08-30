/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { AccessToken } from "@bentley/imodeljs-clients";
import { UserProfile } from "@bentley/imodeljs-clients";
import { Popup, Position } from "./Popup";
import "./UserProfile.scss";

export interface UserProfileProps {
  accessToken: AccessToken;
}

interface UserProfileState {
  isDropdownOpen: boolean;
  userProfile?: UserProfile;
}

export class UserProfileButton extends React.Component<UserProfileProps, UserProfileState> {

  constructor(props: UserProfileProps, context?: any) {
    super(props, context);

    this.state = {
      isDropdownOpen: false,
    };
  }

  // called when a state change occurs.
  public async componentWillReceiveProps(newProps: UserProfileProps) {
    if (newProps.accessToken) {
      this.setState ({userProfile: newProps.accessToken.getUserProfile()});
    }
  }

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    _event.preventDefault();
    this.setState((_prevState) => ({ isDropdownOpen: !this.state.isDropdownOpen }));
  }

  private _handleOnOutsideClick = () => {
    this.setState((_prevState) => ({ isDropdownOpen: false }));
  }

  private getFullName(): string {
    let name: string = "";

    if (this.props.accessToken) {
      if (this.state.userProfile) {
        name = this.state.userProfile.firstName + " " + this.state.userProfile.lastName;
      }
    }

    return name;
  }

  private getInitials(): string {
    let initials: string = "";

    if (this.props.accessToken) {
      if (this.state.userProfile) {
        if (this.state.userProfile.firstName.length > 1)
          initials += this.state.userProfile.firstName[0];
        if (this.state.userProfile.lastName.length > 1)
          initials += this.state.userProfile.lastName[0];
      }
    }
    return initials;
  }

  private renderDropdown() {
    let email: string = "";
    let organization: string = "";
    if (this.state.userProfile) {
      email = this.state.userProfile.email;
      organization = this.state.userProfile.organization;
    }
    return (
      <Popup isShown={this.state.isDropdownOpen} position={Position.BottomRight} onClose={this._handleOnOutsideClick}>
        <div className="dropdown-menu">
          <ul>
            <li>
              <div className="circle no-select" style={{ fontSize: "2em" }}>{this.getInitials()}</div>
              <div className="profile-details">
                <div className="profile-name">{this.getFullName()}</div>
                <div className="profile-email">{email}</div>
                <div className="profile-organization">{organization}</div>
              </div>
            </li>
            <li className="divider" role="separator"></li>
            <li className="profile-menuitem" onClick={this._splitterClicked.bind(this)}>Sign Out</li>
          </ul>
        </div>
      </Popup>
    );
  }

  private renderContent() {
    if (this.state.isDropdownOpen) {
      return (
        <span className="icon icon-close fade-in-medium" title="Close" style={{ fontSize: ".75em"}}/>
      );
    } else {
      return (
        <span>{this.getInitials()}</span>
      );
    }
  }

  public render() {
    return (
      <div>
        <div className="circle circle-button no-select" onClick={this._splitterClicked.bind(this)}>
          {this.renderContent()}
        </div>
        {this.renderDropdown()}
      </div>
    );
  }
}
