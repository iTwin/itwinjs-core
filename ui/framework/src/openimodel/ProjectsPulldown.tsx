/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { ProjectCard } from "./ProjectCard";
import "./ProjectsPulldown.scss";

/** Props for the ProjectsPulldown React component */
export interface ProjectsPulldownProps {
  projectList: ProjectInfo[];
  selectProject: (selectedProject: ProjectInfo) => any;
}

/** Lists the available projects in a pulldown */
export class ProjectsPulldown extends React.Component<ProjectsPulldownProps> {

  public render(): any {
    const cardContainerStyle: React.CSSProperties = {
      position: "relative",
    };

    const elements = this.props.projectList.map((thisProject) => {
      return (
        <div style={cardContainerStyle} key={thisProject.wsgId}>
          <ProjectCard thisProject={thisProject} inHeader={false} selectProject={this.props.selectProject} />
        </div>
      );
    });
    return (
      <div className="fw-projectspulldown-container" >
        {elements}
      </div>
    );
  }
}
