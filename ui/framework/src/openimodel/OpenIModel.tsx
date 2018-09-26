/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { connect } from "react-redux";
import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenIModelPage, OpenIModelActions } from "./state";
import { IModelViewsSelectedFunc } from "./IModelPanel";
import { IModelOpenPanel } from "../open/IModelOpen";
import { UiFramework } from "../UiFramework";
import { ProjectInfo, ProjectScope } from "../clientservices/ProjectServices";

/** Properties for the OpenIModel component */
export interface OpenIModelProps {
  accessToken: AccessToken;
  currentPage: OpenIModelPage;
  onIModelViewsSelected: IModelViewsSelectedFunc;
  setIModelPage: (page: OpenIModelPage) => any;
  setRecentProjects: (projects: ProjectInfo[]) => any;
}

function mapStateToProps(state: any) {
  return {
    currentPage: state.frameworkState.openIModelState.currentPage,
    accessToken: state.frameworkState.overallContentState.accessToken,
  };
}

const mapDispatch = {
  setIModelPage: OpenIModelActions.setIModelPage,
  setRecentProjects: OpenIModelActions.setRecentProjects,
};

/**
 * The OpenIModel component is the high order component for selecting an iModel. It has a number of subpages,
 * including logging in, showing iModels for the most recent Project, etc.
 */
class OpenIModelComponent extends React.Component<OpenIModelProps> {

  public constructor(props: OpenIModelProps) {
    super(props);
  }

  public componentDidMount() {
    if (this.props.accessToken) {
      UiFramework.projectServices.getProjects(this.props.accessToken, ProjectScope.MostRecentlyUsed, 40, 0).then((projectInfos: ProjectInfo[]) => {
        console.log("Done retrieving recentProjects", projectInfos); // tslint:disable-line:no-console
        this.props.setRecentProjects(projectInfos);
      });
    }
  }

  public render(): JSX.Element | undefined {
    const iModelPanelProps = {
      onIModelViewsSelected: this.props.onIModelViewsSelected,
    };

    return (
      <React.Fragment>
        <IModelOpenPanel {...iModelPanelProps} />
      </React.Fragment>
    );
  }
}

/** OpenIModel React component connected to Redux */ // tslint:disable-next-line:variable-name
export const OpenIModel = connect(mapStateToProps, mapDispatch)(OpenIModelComponent);
