/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./Common.scss";
import "./ProjectDialog.scss";
import classnames from "classnames";
import * as React from "react";
import { SearchBox } from "@itwin/core-react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ProjectTab, ProjectTabs } from "./ProjectTabs";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/context-registry-client";
import { IModelApp } from "@itwin/core-frontend";

/** Properties for the [[ProjectDialog]] component */
export interface ProjectDialogProps {
  onClose: () => void;
  onProjectSelected?: (iTwin: ITwin) => void;
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

  // called when this component is first loaded
  public override async componentDidMount() {
    this.getRecentProjects(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  private async getRecentProjects() {
    this.setState({ isLoading: true, projects: undefined });
    const client = new ITwinAccessClient();
    const accessToken = await IModelApp.getAccessToken();
    const iTwins = await client.getAll(accessToken, {
      pagination: {
        top: 40,
      },
    });

    this.setState({ isLoading: false, projects: iTwins });
  }

  private _onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  };

  private _onMyProjectsClicked = () => {
    this.getRecentProjects(); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  private _onSearchClicked = () => {
    this.setState({ projects: undefined });
  };

  private _onProjectSelected = (projectInfo: ITwin) => {
    if (this.props.onProjectSelected) {
      this.props.onProjectSelected(projectInfo);
    }
  };

  private _handleSearchValueChanged = async (value: string) => {
    if (!value || value.trim().length === 0) {
      this.setState({ isLoading: false, projects: undefined, filter: value });
    } else {
      this.setState({ isLoading: true, projects: undefined });

      const accessToken = await IModelApp.getAccessToken();
      const client = new ITwinAccessClient();
      client.getAll(accessToken, { // eslint-disable-line @typescript-eslint/no-floating-promises
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
    }
  };

  private getNoProjectsPrompt(): string {
    if (this.state.filter.trim() !== "")
      return `No matches found for '${this.state.filter}'`;
    else
      return "Search all projects by name, number, or other project attribute.";
  }

  private getTabIndexFromProjectScope() {
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
              <ProjectTabs defaultTab={this.getTabIndexFromProjectScope()}>
                <ProjectTab label="My Projects" icon="icon-manager" onTabClicked={this._onMyProjectsClicked} />
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
