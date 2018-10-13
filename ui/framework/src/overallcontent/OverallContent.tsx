/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

import * as React from "react";
import { connect } from "react-redux";
import { User } from "oidc-client";
import { OidcProvider } from "redux-oidc";
import { AccessToken, OidcFrontendClient } from "@bentley/imodeljs-clients";
import { OverallContentPage, OverallContentActions } from "./state";
import { IModelOpen } from "../openimodel/IModelOpen";
import { ConfigurableUiContent } from "../configurableui/ConfigurableUiContent";
import { BeDragDropContext } from "@bentley/ui-components";
import { DragDropLayerRenderer } from "../configurableui/DragDropLayerManager";
import { SignIn } from "../oidc/SignIn";
import { CallbackPage } from "../oidc/Callback";
import { ApplicationHeader, ApplicationHeaderProps } from "../openimodel/ApplicationHeader";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { IModelInfo } from "../clientservices/IModelServices";
import { UiFramework } from "../UiFramework";
import { Id64String } from "@bentley/bentleyjs-core";

type IModelViewsSelectedFunc = (iModelInfo: IModelInfo, viewIdsSelected: Id64String[]) => void;

/** Props for the OverallContentComponent React component */
export interface OverallContentProps {
  appHeaderIcon: React.ReactNode;
  appHeaderMessage: string;
  appHeaderClassName?: string;
  appMessageClassName?: string;
  appBackstage?: React.ReactNode;
  currentPage: OverallContentPage | number;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  onWorkOffline?: () => void; // Note: this will be removed!
  user: User;
  accessToken: AccessToken;
  setOverallPage: (page: OverallContentPage | number) => any;
  setAccessToken: (accessToken: AccessToken) => any;
  clearAccessToken: () => any;
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
  clearAccessToken: OverallContentActions.clearAccessToken,
};

/**
 * The OverallContent component selects one of the pre-defined named components (see [OverallContentPage] enum)
 * or one of the children components depending on the currentPage property.
 */
class OverallContentComponent extends React.Component<OverallContentProps> {

  public constructor(props: OverallContentProps) {
    super(props);
  }

  // called when an imodel (and views) have been selected on the IModelOpen
  private _onOpenIModel(iModelInfo: IModelInfo, views: ViewDefinitionProps[]) {

    // view ids are passed as params
    const viewIds: Id64String[] = new Array<Id64String>();
    for (const view of views) {
      viewIds.push(view.id!);
    }

    // open the imodel and set the page
    // Note: this should be refactored, just seems like hack!
    this.props.onIModelViewsSelected(iModelInfo, viewIds);
    this.props.setOverallPage(OverallContentPage.ConfigurableUiPage);
  }

  // called when the "Offline" is clicked on the Sign In.
  private _onOffline() {
    if (this.props.onWorkOffline)
      this.props.onWorkOffline();
    this.props.setOverallPage(OverallContentPage.OfflinePage);
  }

  public componentDidMount() {
    const user = this.props.user;
    if (user && !user.expired) {
      const accessToken: AccessToken = OidcFrontendClient.createAccessToken(user);
      this.props.setAccessToken(accessToken);
    }
  }

  public componentDidUpdate(oldProps: OverallContentProps) {
    if ((!this.props.user || this.props.user.expired) && (oldProps.accessToken))
      this.props.clearAccessToken();
  }

  public render(): JSX.Element | undefined {
    let element: JSX.Element | undefined;
    if (window.location.pathname === "/signin-oidc") {
      element = <CallbackPage />;
    } else if (!this.props.accessToken && OverallContentPage.OfflinePage !== this.props.currentPage) {
      const appHeaderProps: ApplicationHeaderProps = {
        icon: this.props.appHeaderIcon,
        message: this.props.appHeaderMessage,
        headerClassName: this.props.appHeaderClassName,
        messageClassName: this.props.appMessageClassName,
      };
      element = (
        <React.Fragment>
          <ApplicationHeader {...appHeaderProps} />
          <SignIn onSignIn={() => UiFramework.userManager.signinRedirect()} onOffline={this._onOffline.bind(this)} />
        </React.Fragment>
      );
    } else if (OverallContentPage.SelectIModelPage === this.props.currentPage) {
      element = <IModelOpen accessToken={this.props.accessToken} onOpenIModel={this._onOpenIModel.bind(this)} />;
    } else if (OverallContentPage.ConfigurableUiPage === this.props.currentPage || OverallContentPage.OfflinePage === this.props.currentPage) {
      const configurableUiContentProps = {
        appBackstage: this.props.appBackstage,
      };
      element = <ConfigurableUiContent {...configurableUiContentProps} />;
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
