/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Common.scss";
import "./ProjectDialog.scss";
import classnames from "classnames";
import * as React from "react";
import { SearchBox } from "@bentley/ui-core";
import { UiFramework } from "@bentley/ui-framework";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ProjectTab, ProjectTabs } from "./ProjectTabs";
import { ITwin } from "@bentley/context-registry-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

/** Properties for the [[ProjectDialog]] component */
export interface ProjectDialogProps {
  onClose: () => void;
  onProjectSelected?: (project: ITwin) => void;
}

interface ProjectDialogState {
  isLoading: boolean;
  projects?: ITwin[];
  filter: string;
}

/**
 * Project picker dialog
 */
export class ProjectDialog extends React.Component<ProjectDialogProps, ProjectDialogState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { isLoading: true, filter: "" };
  }

  public static defaultProps: Partial<ProjectDialogProps> = {
  };

  // called when this component is first loaded
  public override async componentDidMount() {
    await this.getProjects();
  }

  private async getProjects() {
    this.setState({ isLoading: true, projects: undefined });

    const requestContext = await AuthorizedFrontendRequestContext.create();
    const projectInfos: ITwin[] = await UiFramework.iTwinAccessService.getAll(requestContext, {top:40, skip:0});
    this.setState({ isLoading: false, projects: projectInfos });
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  };

  private _onMyProjectsClicked = () => {
    void this.getProjects();
  };

  private _onFavoritesClicked = () => {
    void this.getProjects();
  };

  private _onRecentClicked = () => {
    void this.getProjects();
  };

  private _onSearchClicked = () => {
    this.setState({ projects: undefined });
    // this.getProjects();
  };

  private _onProjectSelected = (projectInfo: ITwin) => {
    if (this.props.onProjectSelected) {
      this.props.onProjectSelected(projectInfo);
    }
  };

  private _handleSearchValueChanged = (value: string): void => {
    if (!value || value.trim().length === 0) {
      this.setState({ isLoading: false, projects: undefined, filter: value });
    } else {
      const filter = `Name like '${value}'`;
      this.setState({ isLoading: true, projects: undefined });

      void AuthorizedFrontendRequestContext.create().then((requestContext: AuthorizedFrontendRequestContext) => {
        void UiFramework.iTwinAccessService.getAll(requestContext).then((projectInfos: ITwin[]) => {
          projectInfos.filter((iTwin: ITwin) =>
            iTwin.name?.includes(filter))
            .slice(0,40);

          this.setState({ isLoading: false, projects: projectInfos, filter: value });
        });
      });
    }
  };

  private getNoProjectsPrompt(): string {
    return "Search all projects by name, number, or other project attribute.";
  }

  private renderProject(project: ITwin) {
    return (
      <tr key={project.id} onClick={this._onProjectSelected.bind(this, project)}>
        <td>{project.code}</td>
        <td>{project.name}</td>
        <td />
        <td />
      </tr>
    );
  }

  public override render() {
    const searchClassName = classnames("tabs-searchbox", "hidden");
    return (
      <div className="modal-background fade-in-fast">
        <div className="projects animate">
          <div className="header">
            <h3>Select Project</h3>
            <span onClick={this._onClose.bind(this)} className="icon icon-close" title="Close" />
          </div>
          <div className="projects-content">
            <div className="tabs-container">
              <ProjectTabs defaultTab={0}>
                <ProjectTab label="My Projects" icon="icon-manager" onTabClicked={this._onMyProjectsClicked} />
                <ProjectTab label="Favorites" icon="icon-star" onTabClicked={this._onFavoritesClicked} />
                <ProjectTab label="Recent" icon="icon-history" onTabClicked={this._onRecentClicked} />
                <ProjectTab label="Search" icon="icon-search" onTabClicked={this._onSearchClicked} />
              </ProjectTabs>
              <div className={searchClassName}>
                <SearchBox placeholder="Search..." onValueChanged={this._handleSearchValueChanged} valueChangedDelay={400} />
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Project Number</th>
                    <th>Project Name</th>
                    <th>Asset Type</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {(this.state.projects && this.state.projects.length > 0) && this.state.projects.map((project: ITwin) => (this.renderProject(project)))}
                </tbody>
              </table>
              {this.state.isLoading &&
                <div className="projects-loading">
                  <ProgressRadial size="large" indeterminate />
                </div>
              }
              {(!this.state.isLoading && (!this.state.projects || this.state.projects.length === 0)) && <div className="projects-none">{this.getNoProjectsPrompt()}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
