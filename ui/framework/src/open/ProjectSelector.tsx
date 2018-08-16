import * as React from "react";
import * as classnames from "classnames";
import { ProjectInfo, ProjectScope } from "../clientservices/ProjectServices";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { UiFramework } from "../UiFramework";
import { Tabs, Tab } from "./Tabs";
import { SearchBox } from "@bentley/ui-core";
import "./Common.scss";
import "./ProjectSelector.scss";

interface ProjectProps {
  accessToken: AccessToken;
  filterType?: ProjectScope;
  onClose: () => void;
}

interface ProjectState {
  isLoading: boolean;
  projects?: ProjectInfo[];
  activeFilter: ProjectScope;
}

export class ProjectSelector extends React.Component<ProjectProps, ProjectState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { isLoading: true, activeFilter: this.props.filterType! };
  }

  public static defaultProps: Partial<ProjectProps> = {
    filterType: ProjectScope.MostRecentlyUsed,
  };

  // called when this component is first loaded
  public async componentDidMount() {
    this.getRecentProjects(this.props.filterType!);
  }

  private getRecentProjects(projectScope: ProjectScope) {
    this.setState ({ isLoading: true, projects: undefined, activeFilter: projectScope });
    UiFramework.projectServices.getProjects(this.props.accessToken, projectScope, 40, 0).then((projectInfos: ProjectInfo[]) => {
    this.setState ({ isLoading: false,  projects: projectInfos });
    });
  }

  private onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  }

  private onMyProjectsClicked = () => {
    this.getRecentProjects(ProjectScope.Invited);
  }

  private onFavoritesClicked = () => {
    this.getRecentProjects(ProjectScope.Favorites);
  }

  private onRecentClicked = () => {
    this.getRecentProjects(ProjectScope.MostRecentlyUsed);
  }

  private onSearchClicked = () => {
    this.setState ({ projects: undefined, activeFilter: ProjectScope.All });
    // this.getRecentProjects(ProjectScope.All);
  }

  private onProjectSelected = () => {
    this.onClose();
  }

  private handleSearchValueChanged = (value: string): void => {
    if (!value || value.trim().length === 0) {
      this.setState ({ isLoading: false, projects: undefined, activeFilter: ProjectScope.All });
    } else {
      const filter = "Name like '" + value + "'";
      this.setState ({ isLoading: true, projects: undefined, activeFilter: ProjectScope.All });
      UiFramework.projectServices.getProjects(this.props.accessToken, ProjectScope.All, 40, 0, filter).then((projectInfos: ProjectInfo[]) => {
        this.setState ({ isLoading: false,  projects: projectInfos });
      });
    }
  }

  private getNoProjectsPrompt(): string {
    switch (this.state.activeFilter) {
      case ProjectScope.Favorites:
        return "There are no favorite projects. Try a search.";
      case ProjectScope.MostRecentlyUsed:
        return "There are no recent projects. Try a search.";
      case ProjectScope.Invited:
        return "You have no projects assigned. Try a search.";
      default:
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

  private renderProject(project: ProjectInfo) {
    return (
      <tr onClick={this.onProjectSelected}>
        <td>{project.projectNumber}</td>
        <td>{project.name}</td>
        <td/>
        <td/>
      </tr>
     );
  }

  /*
  <input className={searchClassName} placeholder="Search..." type="text" />
  */

  public render() {
    const searchClassName = classnames("tabs-searchbox", this.state.activeFilter !== ProjectScope.All && "hidden");
    return (
      <div className="modal-background fade-in-fast">
        <div className="projects animate">
          <div className="header">
            <h3>Select Project</h3>
            <span onClick={this.onClose.bind(this)} className="icon icon-close" title="Close" />
          </div>
          <div className="projects-content">
            <div className="tabs-container">
              <Tabs defaultTab={this.getTabIndexFromProjectScope()}>
                <Tab label="My Projects" icon="icon-manager" onTabClicked={this.onMyProjectsClicked} />
                <Tab label="Favorites" icon="icon-star" onTabClicked={this.onFavoritesClicked}/>
                <Tab label="Recent" icon="icon-history" onTabClicked={this.onRecentClicked}/>
                <Tab label="Search" icon="icon-search" onTabClicked={this.onSearchClicked}/>
              </Tabs>
              <div className={searchClassName}>
                <SearchBox placeholder="Search..." onValueChanged={this.handleSearchValueChanged} valueChangedDelay={400} />
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
                  {this.state.isLoading && <div className="projects-loading"><div><i /><i /><i /><i /><i /><i /></div></div>}
                  {(this.state.projects && this.state.projects.length > 0) && this.state.projects.map((project: ProjectInfo) => (this.renderProject(project)))}
                  {(!this.state.isLoading && (!this.state.projects || this.state.projects.length === 0)) && <div className="projects-none">{this.getNoProjectsPrompt()}</div>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
