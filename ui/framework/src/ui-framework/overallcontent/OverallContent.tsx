/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OverallContent */

import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { OidcClientWrapper } from "@bentley/imodeljs-frontend";
import { OverallContentPage, OverallContentActions } from "./state";
import { IModelOpen } from "../openimodel/IModelOpen";
import { ConfigurableUiContent } from "../configurableui/ConfigurableUiContent";
import { BeDragDropContext } from "@bentley/ui-components";
import { DragDropLayerRenderer } from "../dragdrop/DragDropLayerManager";
import { SignIn } from "../oidc/SignIn";
import { ApplicationHeader, ApplicationHeaderProps } from "../openimodel/ApplicationHeader";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { IModelInfo } from "../clientservices/IModelServices";
import { Id64String, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { UiFramework } from "../UiFramework";
import { ThemeManager } from "../theme/ThemeManager";

type IModelViewsSelectedFunc = (iModelInfo: IModelInfo, viewIdsSelected: Id64String[]) => void;

/** Properties for the [[OverallContent]] React component */
export interface OverallContentProps {
  appHeaderIcon: React.ReactNode;
  appHeaderMessage: string;
  appHeaderClassName?: string;
  appMessageClassName?: string;
  appBackstage?: React.ReactNode;
  currentPage: OverallContentPage | number;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  onWorkOffline?: () => void; // Note: this will be removed!
  accessToken: AccessToken;
  setOverallPage: (page: OverallContentPage | number) => any;
  setAccessToken: (accessToken: AccessToken) => any;
  clearAccessToken: () => any;
}

function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey];  // since app sets up key, don't hard-code name
  if (!frameworkState)
    return undefined;

  return {
    currentPage: frameworkState.overallContentState.currentPage,
    accessToken: frameworkState.overallContentState.accessToken,
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
  private _onOpenIModel = (iModelInfo: IModelInfo, views: ViewDefinitionProps[]) => {

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
  private _onOffline = () => {
    if (this.props.onWorkOffline)
      this.props.onWorkOffline();
    this.props.setOverallPage(OverallContentPage.OfflinePage);
  }

  public componentDidMount() {
    OidcClientWrapper.oidcClient.getAccessToken(new ActivityLoggingContext("")) // tslint:disable-line:no-floating-promises
      .then((accessToken: AccessToken | undefined) => this._setOrClearAccessToken(accessToken));
    OidcClientWrapper.oidcClient.onUserStateChanged.addListener(this._setOrClearAccessToken);
  }

  public componentWillUnmount() {
    OidcClientWrapper.oidcClient.onUserStateChanged.removeListener(this._setOrClearAccessToken);
  }

  private _setOrClearAccessToken = (accessToken: AccessToken | undefined) => {
    accessToken ? this.props.setAccessToken(accessToken) : this.props.clearAccessToken();
  }

  public render(): JSX.Element | undefined {
    let element: JSX.Element | undefined;

    const currentPage = navigator.onLine ? this.props.currentPage : OverallContentPage.OfflinePage;

    if (!this.props.accessToken && OverallContentPage.OfflinePage !== currentPage) {
      const appHeaderProps: ApplicationHeaderProps = {
        icon: this.props.appHeaderIcon,
        message: this.props.appHeaderMessage,
        headerClassName: this.props.appHeaderClassName,
        messageClassName: this.props.appMessageClassName,
      };
      element = (
        <React.Fragment>
          <ApplicationHeader {...appHeaderProps} />
          <SignIn onSignIn={() => OidcClientWrapper.oidcClient.signIn(new ActivityLoggingContext(""))} onOffline={this._onOffline} />
        </React.Fragment>
      );
    } else if (navigator.onLine && OverallContentPage.SelectIModelPage === currentPage) {
      element = <IModelOpen accessToken={this.props.accessToken} onOpenIModel={this._onOpenIModel} />;
    } else if (OverallContentPage.ConfigurableUiPage === currentPage || OverallContentPage.OfflinePage === currentPage) {
      const configurableUiContentProps = {
        appBackstage: this.props.appBackstage,
      };
      element = <ConfigurableUiContent {...configurableUiContentProps} />;
    } else if (React.Children.count(this.props.children) > currentPage) {
      element = React.Children.toArray(this.props.children)[currentPage] as React.ReactElement<any>;
    }

    return (
      <ThemeManager>
        <BeDragDropContext>
          {element}
          <DragDropLayerRenderer />
        </BeDragDropContext>
      </ThemeManager>
    );
  }
}

// we declare the variable and export that rather than using export default.
/** OverallContent React component that is Redux connected. */
export const OverallContent = connect(mapStateToProps, mapDispatch)(OverallContentComponent); // tslint:disable-line:variable-name
