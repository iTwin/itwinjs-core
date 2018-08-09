/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { WebFontIcon } from "@bentley/ui-core";
import "./ProjectCard.scss";

/** The ProjectCard component is used to display the information regarding a CONNECTED project. */
export interface ProjectCardProps {
  thisProject?: ProjectInfo;
  inHeader: boolean;
  openRecentList?: () => void;
  selectProject?: (selectedProject: ProjectInfo) => void;
}

/** Renders the current project in the header (inHeader true) and the projects in the Recent Projects list. */
export class ProjectCard extends React.Component<ProjectCardProps> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  // called on event.
  private selectProject(_event: any) {
    if (this.props.selectProject)
      this.props.selectProject(this.props.thisProject!);
  }

  public render(): any {
    let divStyleName = "fw-projectcard-div";
    let tableStyleName = "fw-projectcard-table";
    let numberStyleName = "fw-projectcard-number";
    let chevronIcon: React.ReactChild | undefined;
    if (this.props.inHeader) {
      divStyleName = divStyleName.concat(" fw-projectcard-div-inheader");
      tableStyleName = tableStyleName.concat(" fw-projectcard-table-inheader");
      numberStyleName = numberStyleName.concat(" fw-projectcard-number-inheader");
      chevronIcon = React.createElement(WebFontIcon, { iconName: "icon-chevron-down", onClick: this.props.openRecentList, className: "fw-projectcard-icon" });
    }

    return (
      <div className={divStyleName} >
        <table className={tableStyleName} onClick={this.selectProject.bind(this)} >
          <tbody>
            <tr>
              <th rowSpan={2}><WebFontIcon iconName="icon-apps-connect" className="fw-projectcard-icon" /></th>
              <td className={numberStyleName}>{this.props.thisProject!.projectNumber}</td>
            </tr>
            <tr>
              <td>{this.props.thisProject!.name}</td>
            </tr>
          </tbody>
        </table>
        {chevronIcon}
      </div>
    );
  }
}
