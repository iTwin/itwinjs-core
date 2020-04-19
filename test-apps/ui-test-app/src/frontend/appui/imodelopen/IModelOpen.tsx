/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { UiFramework, IModelInfo, ProjectInfo, ProjectScope } from "@bentley/ui-framework";
import { IModelList } from "./IModelList";
import { ProjectDropdown } from "./ProjectDropdown";
import { NavigationList, NavigationItem } from "./Navigation";
import { BlockingPrompt } from "./BlockingPrompt";
import "./IModelOpen.scss";
import "./Common.scss";
import { AppTools } from "../../tools/ToolSpecifications";

/** Properties for the [[IModelOpen]] component */
export interface IModelOpenProps {
  onIModelSelected?: (iModelInfo: IModelInfo) => void;
  initialIModels?: IModelInfo[];
}

interface IModelOpenState {
  isLoadingProjects: boolean;
  isLoadingiModels: boolean;
  isLoadingiModel: boolean;
  recentProjects?: ProjectInfo[];
  iModels?: IModelInfo[];
  currentProject?: ProjectInfo;
  prompt: string;
  isNavigationExpanded: boolean;
}

/**
 * Open component showing projects and iModels
 */
export class IModelOpen extends React.Component<IModelOpenProps, IModelOpenState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingProjects: true,
      isLoadingiModels: false,
      isLoadingiModel: false,
      isNavigationExpanded: false,
      prompt: "Fetching project information...",
    };
  }

  public componentDidMount() {
    if (this.props.initialIModels && this.props.initialIModels.length > 0) {
      this.setState({
        isLoadingProjects: false,
        isLoadingiModels: false,
        isLoadingiModel: false,
        currentProject: this.props.initialIModels[0].projectInfo, // tslint:disable-line: tslint-react-set-state-usage
        iModels: this.props.initialIModels,  // tslint:disable-line: tslint-react-set-state-usage
      });

      return;
    }

    UiFramework.projectServices.getProjects(ProjectScope.MostRecentlyUsed, 40, 0).then((projectInfos: ProjectInfo[]) => { // tslint:disable-line:no-floating-promises
      this.setState({
        isLoadingProjects: false,
        isLoadingiModels: true,
        recentProjects: projectInfos,
      });
      if (projectInfos.length > 0)
        this._selectProject(projectInfos[0]);
    });
  }

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveIModels(project: ProjectInfo) {
    this.setState({
      prompt: "Fetching iModel information...",
      isLoadingiModels: true,
      isLoadingProjects: false,
      currentProject: project,
    });
    const iModelInfos: IModelInfo[] = await UiFramework.iModelServices.getIModels(project, 40, 0);
    // tslint:disable-next-line:no-console
    // console.log(JSON.stringify(iModelInfos));
    this.setState({
      isLoadingiModels: false,
      iModels: iModelInfos,
    });
  }

  private _onNavigationChanged = (expanded: boolean) => {
    this.setState({ isNavigationExpanded: expanded });
  }

  private _selectProject(project: ProjectInfo) {
    this.startRetrieveIModels(project); // tslint:disable-line:no-floating-promises
  }

  private _handleIModelSelected = (iModelInfo: IModelInfo): void => {
    this.setState({
      prompt: "Opening '" + iModelInfo.name + "'...",
      isLoadingiModel: true,
    }, () => {
      if (this.props.onIModelSelected)
        this.props.onIModelSelected(iModelInfo);
    });
  }

  private renderIModels() {
    if (this.state.isLoadingProjects || this.state.isLoadingiModels) {
      return (
        <BlockingPrompt prompt={this.state.prompt} />
      );
    } else {
      return (
        <>
          <IModelList iModels={this.state.iModels}
            onIModelSelected={this._handleIModelSelected} />
          {this.state.isLoadingiModel &&
            <BlockingPrompt prompt={this.state.prompt} />
          }
        </>
      );
    }
  }

  public render() {
    const contentStyle = classnames("open-content", this.state.isNavigationExpanded && "pinned");
    return (
      <div>
        <div className="open-appbar">
          <div className="backstage-icon">
            <span className="icon icon-home" onPointerUp={() => AppTools.backstageToggleCommand.execute()} />
          </div>
          <div className="project-picker-content">
            <span className="projects-label">Projects</span>
            <div className="project-picker">
              <ProjectDropdown currentProject={this.state.currentProject} recentProjects={this.state.recentProjects} onProjectClicked={this._selectProject.bind(this)} />
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
