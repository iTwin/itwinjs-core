/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { connect } from "react-redux";
import { OpenIModelPage, OpenIModelActions } from "./state";
import { ApplicationHeader, ApplicationHeaderProps } from "./ApplicationHeader";
import { IModelViewsSelectedFunc } from "./IModelPanel";
import { IModelOpenPanel } from "../open/IModelOpen";
import { SignInPage } from "../open/SignIn";

/** Properties for the OpenIModel component */
export interface OpenIModelProps {
  appHeaderIcon: React.ReactNode;
  appHeaderMessage: string;
  appHeaderClassName?: string;
  appMessageClassName?: string;
  currentPage: OpenIModelPage;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  setIModelPage: (page: OpenIModelPage) => any;
}

function mapStateToProps(state: any) {
  return {
    currentPage: state.frameworkState.openIModelState.currentPage,
  };
}

const mapDispatch = {
  setIModelPage: OpenIModelActions.setIModelPage,
};

/**
 * The OpenIModel component is the high order component for selecting an iModel. It has a number of subpages,
 * including logging in, showing iModels for the most recent Project, etc.
 */
class OpenIModelComponent extends React.Component<OpenIModelProps> {

  public constructor(props: OpenIModelProps) {
    super(props);
  }

  public render(): JSX.Element | undefined {
    const appHeaderProps: ApplicationHeaderProps = {
      icon: this.props.appHeaderIcon,
      message: this.props.appHeaderMessage,
      headerClassName: this.props.appHeaderClassName,
      messageClassName: this.props.appMessageClassName,
    };
    const iModelPanelProps = {
      onIModelViewsSelected: this.props.onIModelViewsSelected,
    };
    if (OpenIModelPage.LoginPage === this.props.currentPage) {
      return (
        <React.Fragment>
          <ApplicationHeader {...appHeaderProps} />
          <SignInPage />;
        </React.Fragment>
      );
    } else
      return (
        <React.Fragment>
          <IModelOpenPanel {...iModelPanelProps} />
        </React.Fragment>
      );
  }
}

/** OpenIModel React component connected to Redux */ // tslint:disable-next-line:variable-name
export const OpenIModel = connect(mapStateToProps, mapDispatch)(OpenIModelComponent);
