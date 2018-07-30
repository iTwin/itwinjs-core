/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import * as classnames from "classnames";
import { ProjectInfo } from "../clientservices/ProjectServices";
import { ProjectCard } from "./ProjectCard";
import { IModelApp } from "@bentley/imodeljs-frontend";

import "./ApplicationHeader.scss";

/** Props for the IModelPanelHeader React component */
export interface IModelPanelHeaderProps {
  thisProject?: ProjectInfo;
  icon: React.ReactNode;
  headerClassName?: string;
  openRecentList?: () => void;
}

/** IModelPanelHeader React component */
export class IModelPanelHeader extends React.Component<IModelPanelHeaderProps> {
  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public render(): JSX.Element | undefined {
    const headerClassName = classnames("fw-application-header", this.props.headerClassName);
    let projectCard: React.ReactChild | undefined;
    if (this.props.thisProject)
      projectCard = <ProjectCard thisProject={this.props.thisProject} inHeader={true} openRecentList={this.props.openRecentList} />;
    return (
      <div className={headerClassName}>
        {this.props.icon}
        <span className="App-intro">
          {IModelApp.i18n.translate("UiFramework:iModelPanelHeader.projects")}
        </span>
        {projectCard}
      </div>
    );
  }
}
