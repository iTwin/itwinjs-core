/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { ProjectDialog } from "./ProjectDialog";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import { Popup, Position} from "@bentley/ui-core";
import "./ProjectDropdown.scss";

export interface ProjectDropdownProps {
  accessToken: AccessToken;
  numVisibleProjects?: number;
  recentProjects?: ProjectInfo[];
  currentProject?: ProjectInfo;
  onProjectClicked: (project: ProjectInfo) => any;
}

interface ProjectDropdownState {
  isDropdownOpen: boolean;
  showProjectsDialog: boolean;
}

/**
 * List of projects in a dropdown
 */
export class ProjectDropdown extends React.Component<ProjectDropdownProps, ProjectDropdownState> {
  private _itemHeight: number = 3.25; // each item (project) height is (n-em) in the dropdown

  public static defaultProps: Partial<ProjectDropdownProps> = {
    numVisibleProjects: 5, // default number of visible project to 5
  };

  constructor(props: ProjectDropdownProps, context?: any) {
    super(props, context);

    this.state = { isDropdownOpen: false, showProjectsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState((_prevState) => ({ showProjectsDialog: true }));
  }

  private _onCloseProjectDialog = () => {
    this.closeDialog();
  }

  private _onItemClick(project: ProjectInfo) {
    this.closeDropdown();
    this.props.onProjectClicked(project);
  }

  private _onProjectSelected = (project: ProjectInfo) => {
    this.closeDialog();
    this.props.onProjectClicked(project);
  }

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((_prevState) => ({ isDropdownOpen: !this.state.isDropdownOpen }));
  }

  private _handleOnOutsideClick = () => {
    this.closeDropdown();
  }

  private closeDropdown() {
    this.setState((_prevState) => ({ isDropdownOpen: false }));
  }

  private closeDialog() {
    this.setState((_prevState) => ({ showProjectsDialog: false }));
  }

  private getProjects(): ProjectInfo[] {
    if (this.props.recentProjects) {
      return this.props.recentProjects;
    }
    return [];
  }

  private renderProjects() {
    const projects: ProjectInfo[] = this.getProjects();
    const ulStyle: CSSProperties = {
      height: (this.props.numVisibleProjects! * this._itemHeight) + "em",
    };
    const liStyle: CSSProperties = {
      height: this._itemHeight + "em",
    };

    if (projects && projects.length === 0) {
      return (
        <div className="pp-no-mru" style={ulStyle}><p>Most recently used projects appear here.</p>Click "More" below to search for a project and add it to this list.</div>
      );
    } else {
      return (
        <ul style={ulStyle}>
          {projects && projects.map((project: ProjectInfo, i: number) => (
            <li style={liStyle} key={i} onClick={() => this._onItemClick(project)}>
              <span className="pp-icon icon icon-placeholder" />
              <div className="pp-details">
                <span>{project.projectNumber}</span>
                <span>{project.name}</span>
              </div>
            </li>
          ))}
        </ul>
      );
    }
  }

  private renderDropdown() {
    const liStyle: CSSProperties = {
      height: this._itemHeight + "em",
    };
    return (
      <Popup isShown={this.state.isDropdownOpen} position={Position.Bottom} onClose={this._handleOnOutsideClick}>
        <div className="pp-dropdown">
          {this.renderProjects()}
          <div className="pp-separator" />
          <div className="pp-more" style={liStyle} onClick={this._onMoreClicked} >
            <span className="pp-icon icon icon-search" />
            More
          </div>
        </div>
      </Popup>
    );
  }

  public render() {
    const splitterClassName = classnames("pp-splitter icon icon-chevron-down", this.state.isDropdownOpen && "opened");
    return (
      <div className="pp">
        <div className="pp-content" onClick={this._splitterClicked}>
          <div>
            <span className="number">{this.props.currentProject ? this.props.currentProject.projectNumber : ""}</span>
            <span className="name">{this.props.currentProject ? this.props.currentProject.name : ""}</span>
          </div>
          <span className={splitterClassName} />
        </div>
        <div className="pp-highlight" />
        {this.renderDropdown()}
        {this.state.showProjectsDialog &&
          <ProjectDialog accessToken={this.props.accessToken} onClose={this._onCloseProjectDialog} onProjectSelected={this._onProjectSelected} />
        }
      </div>
    );
  }
}
