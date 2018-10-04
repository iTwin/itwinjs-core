/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { IModelList } from "./IModelList";
import { ProjectDropdown } from "./ProjectDropdown";
import { UiFramework } from "../UiFramework";
import { IModelInfo } from "../clientservices/IModelServices";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/imodeljs-clients";
import { NavigationList, NavigationItem } from "./Navigation";
import { BlockingPrompt } from "./BlockingPrompt";
import { ProjectInfo, ProjectScope } from "../clientservices/ProjectServices";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import "./IModelOpen.scss";
import "./Common.scss";

export interface IModelOpenProps {
  accessToken: AccessToken;
  onOpenIModel?: (iModelInfo: IModelInfo, iModelConnection: IModelConnection, views: ViewDefinitionProps[]) => void;
}

interface IModelOpenState {
  isLoadingProjects: boolean;
  isLoadingiModels: boolean;
  recentProjects?: ProjectInfo[];
  iModels?: IModelInfo[];
  currentProject?: ProjectInfo;
  prompt: string;
  isNavigationExpanded: boolean;
}

/**
 * Open component showing projects and imodels
 */
export class IModelOpen extends React.Component<IModelOpenProps, IModelOpenState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingProjects: true,
      isLoadingiModels: false,
      isNavigationExpanded: false,
      prompt: "Fetching project information...",
    };
  }

  public componentDidMount() {
    UiFramework.projectServices.getProjects(this.props.accessToken, ProjectScope.MostRecentlyUsed, 40, 0).then((projectInfos: ProjectInfo[]) => {
      this.setState(Object.assign({}, this.state, {
        isLoadingProjects: false,
        isLoadingiModels: true,
        recentProjects: projectInfos,
      }));
      if (projectInfos.length > 0)
        this._selectProject(projectInfos[0]);
    });
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
    this.setState(Object.assign({}, this.state, {
      isLoadingiModels: false,
      iModels: iModelInfos,
    }));
  }

  private _onNavigationChanged = (expanded: boolean) => {
    this.setState(Object.assign({}, this.state, { isNavigationExpanded: expanded }));
  }

  private _selectProject(project: ProjectInfo) {
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
          accessToken={this.props.accessToken}
          onIModelSelected={this.props.onOpenIModel} />
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
              <ProjectDropdown accessToken={this.props.accessToken} currentProject={this.state.currentProject} recentProjects={this.state.recentProjects} onProjectClicked={this._selectProject.bind(this)} />
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
