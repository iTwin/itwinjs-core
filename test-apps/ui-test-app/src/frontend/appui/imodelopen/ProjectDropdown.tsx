/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ProjectDropdown.scss";
import classnames from "classnames";
import * as React from "react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popup } from "@itwin/core-react";
import { ITwin } from "@bentley/itwin-registry-client";

// SWB Should we rename all references to project in this file and file names?

/** Properties for the [[ProjectDropdown]] component */
export interface ProjectDropdownProps {
  numVisibleProjects?: number;
  recentProjects?: ITwin[];
  currentProject?: ITwin;
  onProjectClicked: (project: ITwin) => any;
}

interface ITwinDropdownState {
  isDropdownOpen: boolean;
  showITwinsDialog: boolean;
}

/**
 * List of iTwin Projects in a dropdown
 */
export class ITwinDropdown extends React.Component<ITwinDropdownProps, ITwinDropdownState> {
  private _itemHeight: number = 3.25; // each item (iTwin) height is (n-em) in the dropdown
  private _target: HTMLElement | null = null;

  public static defaultProps: Partial<ITwinDropdownProps> = {
    numVisibleITwins: 5, // default number of visible iTwin to 5
  };

  constructor(props: ITwinDropdownProps, context?: any) {
    super(props, context);
    this.state = { isDropdownOpen: false, showITwinsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState({ showITwinsDialog: true });
  };

  private _onItemClick(iTwin: ITwin) {
    this.closeDropdown();
    this.props.onProjectClicked(iTwin);
  }

  private _onProjectSelected = (iTwin: ITwin) => {
    this.closeDialog();
    this.props.onProjectClicked(iTwin);
  };

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
    this.setState({ showProjectsDialog: false });
  }

  private getProjects(): ITwin[] {
    if (this.props.recentProjects) {
      return this.props.recentProjects;
    }
    return [];
  }

  private renderProjects() {
    const projects: ITwin[] = this.getProjects();
    const ulStyle: React.CSSProperties = {
      height: `${this.props.numVisibleITwins! * this._itemHeight}em`,
    };
    const liStyle: React.CSSProperties = {
      height: `${this._itemHeight}em`,
    };

    if (itwins && itwins.length === 0) {
      return (
        <div className="pp-no-mru" style={ulStyle}><p>Most recently used iTwins appear here.</p>Click &quot;More&quot; below to search for an iTwin and add it to this list.</div>
      );
    } else {
      return (
        <ul style={ulStyle}>
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
          {this.renderITwins()}
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
