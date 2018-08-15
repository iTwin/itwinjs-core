import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { Div, withOnOutsideClick } from "@bentley/ui-core";
import { ProjectSelector } from "./ProjectSelector";
import "./ProjectPicker.scss";
import { AccessToken } from "@bentley/imodeljs-clients/lib";

// tslint:disable-next-line:variable-name
const DivWithOnOutsideClick = withOnOutsideClick(Div);

export interface IProjectPickerProps {
  accessToken: AccessToken;
  numVisibleProjects?: number;
  recentProjects?: ProjectInfo[];
  currentProject?: ProjectInfo;
  onProjectClicked: (project: ProjectInfo) => any;
}

interface IProjectPickerState {
  isDropdownOpen: boolean;
  showProjectsSelector: boolean;
}

export class ProjectPicker extends React.Component<IProjectPickerProps, IProjectPickerState> {
  private _itemHeight: number = 3.25; // each item (project) height is (n-em) in the dropdown

  public static defaultProps: Partial<IProjectPickerProps> = {
    numVisibleProjects: 5, // default number of visible project to 5
  };

  constructor(props: IProjectPickerProps, context?: any) {
    super(props, context);

    this.state = { isDropdownOpen: false, showProjectsSelector: false };
  }

  /*
  private onCloseDropdown = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState((_prevState) => ({ showProjectsSelector: true }));
  }
*/

  private onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState((_prevState) => ({ showProjectsSelector: true }));
  }

  private onCloseProjectSelector = () => {
    this.closeDropdown();
    this.setState((_prevState) => ({ showProjectsSelector: false }));
  }

  private onItemClick (project: ProjectInfo) {
    this.closeDropdown();
    this.props.onProjectClicked(project);
  }

  private splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((_prevState) => ({
      isDropdownOpen: !this.state.isDropdownOpen}));
  }

  private handleOnOutsideClick = () => {
    this.closeDropdown();
  }

  private closeDropdown() {
    this.setState((_prevState) => ({ isDropdownOpen: false }));
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
            <li style={liStyle} key={i} onClick={() => this.onItemClick(project)}>
              <span className="pp-icon icon icon-apps-connect" />
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
      <div className="pp-dropdown fade-in-fast">
        {this.renderProjects()}
        <div className="pp-separator" />
        <div className="pp-more" style={liStyle} onClick={this.onMoreClicked} >
          <span className="pp-icon icon icon-search" />
          More
        </div>
      </div>
    );
  }

  public render() {
    const splitterClassName = classnames("pp-splitter icon icon-chevron-down", this.state.isDropdownOpen && "opened");
    return (
      <DivWithOnOutsideClick onOutsideClick={this.handleOnOutsideClick} className="pp">
        <div className="pp-content" onClick={this.splitterClicked}>
          <div>
            <span className="number">{this.props.currentProject ? this.props.currentProject.projectNumber : ""}</span>
            <span className="name">{this.props.currentProject ? this.props.currentProject.name : ""}</span>
          </div>
          <span className={splitterClassName}/>
        </div>
        <div className="pp-highlight"/>
        {this.state.isDropdownOpen && this.renderDropdown()}
        {this.state.showProjectsSelector && <ProjectSelector accessToken={this.props.accessToken} onClose={this.onCloseProjectSelector}/>}
      </DivWithOnOutsideClick>
    );
  }
}
