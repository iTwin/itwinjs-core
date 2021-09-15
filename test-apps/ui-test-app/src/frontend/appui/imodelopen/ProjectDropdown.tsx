/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// SWB
import "./ProjectDropdown.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@bentley/ui-abstract";
import { Popup } from "@bentley/ui-core";
import { ITwin } from "@bentley/itwin-registry-client";

// SWB
/** Properties for the [[ProjectDropdown]] component */
// SWB
export interface ProjectDropdownProps {
  // SWB
  numVisibleProjects?: number;
  // SWB
  recentProjects?: ITwin[];
  // SWB
  currentProject?: ITwin;
  // SWB
  onProjectClicked: (project: ITwin) => any;
}

// SWB
interface ProjectDropdownState {
  isDropdownOpen: boolean;
  // SWB
  showProjectsDialog: boolean;
}

/**
 * List of projects in a dropdown
 */
// SWB
export class ProjectDropdown extends React.Component<ProjectDropdownProps, ProjectDropdownState> {
  // SWB
  private _itemHeight: number = 3.25; // each item (project) height is (n-em) in the dropdown
  private _target: HTMLElement | null = null;

  // SWB
  public static defaultProps: Partial<ProjectDropdownProps> = {
    // SWB
    numVisibleProjects: 5, // default number of visible project to 5
  };

  // SWB
  constructor(props: ProjectDropdownProps, context?: any) {
    super(props, context);

    // SWB
    this.state = { isDropdownOpen: false, showProjectsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    // SWB
    this.setState({ showProjectsDialog: true });
  };

  // SWB
  private _onItemClick(project: ITwin) {
    this.closeDropdown();
    // SWB
    this.props.onProjectClicked(project);
  }

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((prevState) => ({ isDropdownOpen: !prevState.isDropdownOpen }));
  };

  private _handleOnOutsideClick = () => {
    this.closeDropdown();
  };

  private closeDropdown() {
    this.setState({ isDropdownOpen: false });
  }

  private closeDialog() {
    // SWB
    this.setState({ showProjectsDialog: false });
  }

  // SWB
  private getProjects(): ITwin[] {
    // SWB
    if (this.props.recentProjects) {
      // SWB
      return this.props.recentProjects;
    }
    return [];
  }

  // SWB
  private renderProjects() {
    // SWB
    const projects: ITwin[] = this.getProjects();
    const ulStyle: React.CSSProperties = {
      // SWB
      height: `${this.props.numVisibleProjects! * this._itemHeight}em`,
    };
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };

    if (projects && projects.length === 0) {
      return (
        // SWB
        <div className="pp-no-mru" style={ulStyle}><p>Most recently used projects appear here.</p>Click &quot;More&quot; below to search for a project and add it to this list.</div>
      );
    } else {
      return (
        <ul style={ulStyle}>
          {/* // SWB */}
          {projects && projects.map((project: ITwin, i: number) => (
            <li style={liStyle} key={i} onClick={() => this._onItemClick(project)}>
              <span className="pp-icon icon icon-placeholder" />
              <div className="pp-details">
                <span>{project.code}</span>
                <span>{project.name}</span>
              </div>
            </li>
          ))}
        </ul>
      );
    }
  }

  private renderDropdown() {
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };
    return (
      <Popup isOpen={this.state.isDropdownOpen} position={RelativePosition.Bottom} onClose={this._handleOnOutsideClick} target={this._target}>
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

  public override render() {
    const splitterClassName = classnames("pp-splitter icon icon-chevron-down", this.state.isDropdownOpen && "opened");
    return (
      <div className="pp">
        <div className="pp-content" onClick={this._splitterClicked} ref={(element) => { this._target = element; }}>
          <div>
            {/* // SWB */}
            <span className="number">{this.props.currentProject ? this.props.currentProject.code : ""}</span>
            <span className="name">{this.props.currentProject ? this.props.currentProject.name : ""}</span>
          </div>
          <span className={splitterClassName} />
        </div>
        <div className="pp-highlight" />
        {this.renderDropdown()}
      </div>
    );
  }
}
