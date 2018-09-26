/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

import * as React from "react";
import { connect } from "react-redux";
import { User } from "oidc-client";
import { OidcProvider } from "redux-oidc";
import { AccessToken, UserProfile } from "@bentley/imodeljs-clients";
import { OverallContentPage, OverallContentActions } from "./state";
import { OpenIModel } from "../openimodel/OpenIModel";
import { ConfigurableUIContent } from "../configurableui/ConfigurableUIContent";
import { IModelViewsSelectedFunc } from "../openimodel/IModelPanel";
import { BeDragDropContext } from "@bentley/ui-components";
import { DragDropLayerRenderer } from "../configurableui/DragDropLayerManager";
import { SignInPage } from "../oidc/SignIn";
import { CallbackPage } from "../oidc/Callback";
import { ApplicationHeader, ApplicationHeaderProps } from "../openimodel/ApplicationHeader";
import { UiFramework } from "../UiFramework";

/** Props for the OverallContentComponent React component */
export interface OverallContentProps {
  appHeaderIcon: React.ReactNode;
  appHeaderMessage: string;
  appHeaderClassName?: string;
  appMessageClassName?: string;
  appBackstage?: React.ReactNode;
  currentPage: OverallContentPage | number;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  user: User;
  accessToken: AccessToken;
  setOverallPage: (page: OverallContentPage | number) => any;
  setAccessToken: (accessToken: AccessToken) => any;
}

function mapStateToProps(state: any) {
  return {
    currentPage: state.frameworkState.overallContentState.currentPage,
    user: state.frameworkState.oidcState.user,
    accessToken: state.frameworkState.overallContentState.accessToken,
  };
}

const mapDispatch = {
  setOverallPage: OverallContentActions.setOverallPage,
  setAccessToken: OverallContentActions.setAccessToken,
};

/**
 * The OverallContent component selects one of the pre-defined named components (see [OverallContentPage] enum)
 * or one of the children components depending on the currentPage property.
 */
class OverallContentComponent extends React.Component<OverallContentProps> {

  public constructor(props: OverallContentProps) {
    super(props);
  }

  public componentDidMount() {
    const user = this.props.user;
    if (!user || user.expired)
      return;

    const startsAt: Date = new Date(user.expires_at - user.expires_in!);
    const expiresAt: Date = new Date(user.expires_at);
    const userProfile = new UserProfile(user.profile.given_name, user.profile.family_name, user.profile.email!, user.profile.sub, user.profile.org_name!, user.profile.org!, user.profile.ultimate_site!, user.profile.usage_country_iso!);

    const accessToken: AccessToken = AccessToken.fromJsonWebTokenString(user.access_token, userProfile, startsAt, expiresAt);
    this.props.setAccessToken(accessToken);
  }

  public render(): JSX.Element | undefined {
    let element: JSX.Element | undefined;
    if (window.location.pathname === "/signin-oidc") {
      element = <CallbackPage />;
    } else if (!this.props.accessToken) {
      const appHeaderProps: ApplicationHeaderProps = {
        icon: this.props.appHeaderIcon,
        message: this.props.appHeaderMessage,
        headerClassName: this.props.appHeaderClassName,
        messageClassName: this.props.appMessageClassName,
      };
      element = (
        <React.Fragment>
          <ApplicationHeader {...appHeaderProps} />
          <SignInPage />
        </React.Fragment>
      );
    } else if (OverallContentPage.SelectIModelPage === this.props.currentPage) {
      const openIModelProps = {
        onIModelViewsSelected: this.props.onIModelViewsSelected,
      };
      element = <OpenIModel {...openIModelProps} />;
    } else if (OverallContentPage.ConfigurableUIPage === this.props.currentPage) {
      const configurableUiContentProps = {
        appBackstage: this.props.appBackstage,
      };
      element = <ConfigurableUIContent {...configurableUiContentProps} />;
    } else if (React.Children.count(this.props.children) > this.props.currentPage) {
      element = React.Children.toArray(this.props.children)[this.props.currentPage] as React.ReactElement<any>;
    }

    return (
      <OidcProvider userManager={UiFramework.userManager} store={UiFramework.store}>
        <BeDragDropContext>
          {element}
          <DragDropLayerRenderer />
        </BeDragDropContext>
      </OidcProvider>
    );
  }
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */
export const OverallContent = connect(mapStateToProps, mapDispatch)(OverallContentComponent); // tslint:disable-line:variable-name
