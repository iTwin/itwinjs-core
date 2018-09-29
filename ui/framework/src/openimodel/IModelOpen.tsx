/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { connect } from "react-redux";
import { IModelList } from "./IModelList";
import { ProjectDropdown } from "./ProjectDropdown";
import { UiFramework } from "../UiFramework";
import { IModelInfo } from "../clientservices/IModelServices";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { AccessToken } from "@bentley/imodeljs-clients";
import { NavigationList, NavigationItem } from "./Navigation";
import { BlockingPrompt } from "./BlockingPrompt";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { OpenIModelActions, OpenIModelState } from "../openimodel/state";
import { Id64String } from "@bentley/bentleyjs-core";
import "./IModelOpen.scss";
import "./Common.scss";

export type IModelViewsSelectedFunc = (project: ProjectInfo, iModelConnection: IModelConnection, viewIdsSelected: Id64String[]) => void;

export interface IModelOpenProps {
  accessToken: AccessToken;
  icon?: React.ReactNode;
  headerClassName?: string;
  overlaySearchProjectsComponent: boolean;
  iModels: IModelInfo[];
  currentProject?: ProjectInfo;
  currentIModel?: IModelInfo;
  currentViews?: ViewDefinitionProps[];
  recentProjects?: ProjectInfo[];
  showRecentProjects: boolean;
  onIModelViewsSelected: IModelViewsSelectedFunc;

  // actions:
  setCurrentProject: (projectInfo: ProjectInfo) => any;
  showRecentProjectList: () => any;
  setIModels: (iModels: IModelInfo[]) => any;
  setCurrentIModel: (iModelInfo: IModelInfo) => any;
  setIModelConnection: (iModelConnection: IModelConnection, viewProps: ViewDefinitionProps[]) => any;
  setSelectedViews: (viewsSelected: Id64String[]) => any;
}

interface IModelOpenState {
  isLoadingProjects: boolean;
  isLoadingiModels: boolean;
  iModels?: IModelInfo[];
  currentProject?: ProjectInfo;
  prompt: string;
  isNavigationExpanded: boolean;
}

function mapStateToProps(state: any) {
  const openIModelState: OpenIModelState = state.frameworkState.openIModelState as OpenIModelState;
  return {
    accessToken: state.frameworkState.overallContentState.accessToken,
    overlaySearchProjectsComponent: openIModelState.overlaySearchProjectList,
    iModels: openIModelState.iModels!,
    currentProject: openIModelState.currentProject,
    currentIModel: openIModelState.currentIModel,
    currentViews: openIModelState.currentViews,
    recentProjects: openIModelState.recentProjects,
    showRecentProjects: openIModelState.showRecentProjects,
  };
}

// these are the actions that apply to this page.
const mapDispatch = {
  setCurrentProject: OpenIModelActions.setCurrentProject,
  showRecentProjectList: OpenIModelActions.showRecentProjectList,
  setIModels: OpenIModelActions.setIModels,
  setCurrentIModel: OpenIModelActions.setCurrentIModel,
  setIModelConnection: OpenIModelActions.setIModelConnection,
  setSelectedViews: OpenIModelActions.setSelectedViews,
};

class IModelOpenComponent extends React.Component<IModelOpenProps, IModelOpenState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingProjects: true,
      isLoadingiModels: false,
      isNavigationExpanded: false,
      prompt: "Fetching project information...",
    };
  }

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveIModels(project: ProjectInfo) {
    this.setState(Object.assign({}, this.state, {
      prompt: "Fetching iModel information...",
      isLoadingiModels: true,
      isLoadingProjects: false,
      currentProject: project,
    }));
    const iModelInfos: IModelInfo[] = await UiFramework.iModelServices.getIModels(this.props.accessToken, project, 40, 0);
    this.props.setIModels(iModelInfos);
    this.setState(Object.assign({}, this.state, {
      isLoadingiModels: false,
      iModels: iModelInfos,
    }));
  }

  // called when a state change occurs.
  public async componentWillReceiveProps(newProps: IModelOpenProps) {
    if ((newProps.currentProject) && (newProps.currentProject! !== this.props.currentProject)) {
      this.startRetrieveIModels(newProps.currentProject);
    }
  }

  private _onNavigationChanged = (expanded: boolean) => {
    this.setState(Object.assign({}, this.state, { isNavigationExpanded: expanded }));
  }

  private _onIModelSelected = (iModelInfo: IModelInfo) => {
    this.props.setCurrentIModel(iModelInfo);
  }

  private selectProject(project: ProjectInfo) {
    this.startRetrieveIModels(project);
  }

  private renderIModels() {
    if (this.state.isLoadingProjects || this.state.isLoadingiModels) {
      return (
        <BlockingPrompt prompt={this.state.prompt} />
      );
    } else {
      return (
        <IModelList iModels={this.state.iModels}
          onIModelSelected={this._onIModelSelected}
          accessToken={this.props.accessToken}
          setSelectedViews={this.props.setSelectedViews}
          onIModelViewsSelected={this.props.onIModelViewsSelected} />
      );
    }
  }

  public render() {
    const contentStyle = classnames("open-content", this.state.isNavigationExpanded && "pinned");
    return (
      <div>
        <div className="open-appbar">
          <div className="backstage-icon">
            <span className="icon icon-app-launcher" />
          </div>
          <div className="project-picker-content">
            <span className="projects-label">Projects</span>
            <div className="project-picker">
              <ProjectDropdown accessToken={this.props.accessToken} currentProject={this.state.currentProject} recentProjects={this.props.recentProjects} onProjectClicked={this.selectProject.bind(this)} />
            </div>
          </div>
        </div>
        <NavigationList defaultTab={0} onExpandChanged={this._onNavigationChanged}>
          <NavigationItem label="Recent" icon="icon-placeholder" />
          <NavigationItem label="Offline" icon="icon-placeholder" />
          <NavigationItem label="Browse History" icon="icon-placeholder" />
          <NavigationItem label="iModels" icon="icon-placeholder" />
          <NavigationItem label="Share" icon="icon-placeholder" />
          <NavigationItem label="Share Point" icon="icon-placeholder" />
          <NavigationItem label="Reality Data" icon="icon-placeholder" />
          <NavigationItem label="New Project..." icon="icon-placeholder" />
        </NavigationList>
        <div className={contentStyle}>
          {this.renderIModels()}
        </div>
      </div>
    );
  }
}

// tslint:disable-next-line:variable-name
export const IModelOpenPanel = connect(mapStateToProps, mapDispatch)(IModelOpenComponent as any);
