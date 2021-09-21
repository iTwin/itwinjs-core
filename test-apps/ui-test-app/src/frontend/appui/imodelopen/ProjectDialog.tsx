/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Common.scss";
import "./ProjectDialog.scss";
import classnames from "classnames";
import * as React from "react";
import { SearchBox } from "@bentley/ui-core";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ProjectTab, ProjectTabs } from "./ProjectTabs";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/context-registry-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

/** The possible values for Project scope in the iTwin services environment.
 * @internal
 */
export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

/** Properties for the [[ProjectDialog]] component */
export interface ProjectDialogProps {
  filterType?: ProjectScope;
  onClose: () => void;
  onProjectSelected?: (iTwin: ITwin) => void;

}

interface ProjectDialogState {
  isLoading: boolean;
  projects?: ITwin[];
  activeFilter: ProjectScope;
  filter: string;
}

/**
 * Project picker dialog
 */
export class ProjectDialog extends React.Component<ProjectDialogProps, ProjectDialogState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { isLoading: true, activeFilter: this.props.filterType!, filter: "" };
  }

  public static defaultProps: Partial<ProjectDialogProps> = {
    filterType: ProjectScope.MostRecentlyUsed,
  };

  // called when this component is first loaded
  public override async componentDidMount() {
    this.getRecentProjects(this.props.filterType!); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private async getRecentProjects(projectScope: ProjectScope) {
    this.setState({ isLoading: true, projects: undefined, activeFilter: projectScope });
    const client = new ITwinAccessClient();
    const ctx = await AuthorizedFrontendRequestContext.create();
    client.getAll(ctx, { // eslint-disable-line @typescript-eslint/no-floating-promises
      pagination: {
        top: 40,
      },
    }).then((projectInfos: ITwin[]) => { // eslint-disable-line @typescript-eslint/no-floating-promises
      this.setState({ isLoading: false, projects: projectInfos });
    });
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  };

  private _onMyProjectsClicked = () => {
    this.getRecentProjects(ProjectScope.Invited); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _onFavoritesClicked = () => {
    this.getRecentProjects(ProjectScope.Favorites); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _onRecentClicked = () => {
    this.getRecentProjects(ProjectScope.MostRecentlyUsed); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _onSearchClicked = () => {
    this.setState({ projects: undefined, activeFilter: ProjectScope.All });
  };

  private _onProjectSelected = (projectInfo: ITwin) => {
    if (this.props.onProjectSelected) {
      this.props.onProjectSelected(projectInfo);
    }
  };

  private _handleSearchValueChanged = (value: string): void => {
    if (!value || value.trim().length === 0) {
      this.setState({ isLoading: false, projects: undefined, activeFilter: ProjectScope.All, filter: value });
    } else {
      this.setState({ isLoading: true, projects: undefined, activeFilter: ProjectScope.All });

      AuthorizedFrontendRequestContext.create().then((ctx: AuthorizedFrontendRequestContext) => { // eslint-disable-line @typescript-eslint/no-floating-promises
        const client = new ITwinAccessClient();
        client.getAll(ctx, { // eslint-disable-line @typescript-eslint/no-floating-promises
          pagination: {
            top: 40,
          },
          search: {
            searchString: value,
            exactMatch: false,
            propertyName: ITwinSearchableProperty.Name,
          },
        }).then((iTwins: ITwin[]) => {
          this.setState({ isLoading: false, projects: iTwins, filter: value });
        });
      });
    }
  };

  private getNoProjectsPrompt(): string {
    switch (this.state.activeFilter) {
      case ProjectScope.Favorites:
        return "There are no favorite projects. Try a search.";
      case ProjectScope.MostRecentlyUsed:
        return "There are no recent projects. Try a search.";
      case ProjectScope.Invited:
        return "You have no projects assigned. Try a search.";
      default:
        if (this.state.filter.trim() !== "")
          return `No matches found for '${this.state.filter}'`;
        else
          return "Search all projects by name, number, or other project attribute.";
    }
  }

  private getTabIndexFromProjectScope() {
    if (this.props.filterType === ProjectScope.Invited)
      return 0;
    if (this.props.filterType === ProjectScope.Favorites)
      return 1;
    if (this.props.filterType === ProjectScope.MostRecentlyUsed)
      return 2;
    else
      return 3;
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
    const searchClassName = classnames("tabs-searchbox", this.state.activeFilter !== ProjectScope.All && "hidden");
    return (
      <div className="modal-background fade-in-fast">
        <div className="projects animate">
          <div className="header">
            <h3>Select Project</h3>
            <span onClick={this._onClose.bind(this)} className="icon icon-close" title="Close" />
          </div>
          <div className="projects-content">
            <div className="tabs-container">
              <ProjectTabs defaultTab={this.getTabIndexFromProjectScope()}>
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
