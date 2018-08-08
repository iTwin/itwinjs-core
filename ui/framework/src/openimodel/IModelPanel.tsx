/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { connect } from "react-redux";

import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewQueryParams, ViewDefinitionProps } from "@bentley/imodeljs-common";

import { WaitSpinner } from "@bentley/ui-core";
import { UiFramework } from "../UiFramework";
import { IModelInfo } from "../clientservices/IModelServices";
import { ProjectInfo } from "../clientservices/ProjectServices";

import { OpenIModelActions, OpenIModelState } from "./state";
import { IModelPanelHeader } from "./IModelPanelHeader";
import { ProjectsPulldown } from "./ProjectsPulldown";
import { IModelCard } from "./IModelCard";
import { ViewSelector } from "./ViewSelector";

// @ts-ignore
import { Id64 } from "@bentley/bentleyjs-core";
// @ts-ignore
import { DeepReadonlyObject, DeepReadonlyArray, Action, ActionWithPayload } from "../utils/redux-ts";

import { Id64Props } from "@bentley/bentleyjs-core";

/** Properties for the IModelPanel component */
export interface IModelPanelProps {
  icon?: React.ReactNode;
  headerClassName?: string;
  accessToken: AccessToken;
  overlaySearchProjectsComponent: boolean;
  iModels: IModelInfo[];
  currentProject?: ProjectInfo;
  currentIModel?: IModelInfo;
  currentViews?: ViewDefinitionProps[];
  recentProjects?: ProjectInfo[];
  showRecentProjects: boolean;
  onIModelViewsSelected: IModelViewsSelectedFunc;

  // actions:
  setCurrentProject: (projectInfo: ProjectInfo) => any;
  showRecentProjectList: () => any;
  setIModels: (iModels: IModelInfo[]) => any;
  setCurrentIModel: (iModelInfo: IModelInfo) => any;
  setIModelConnection: (iModelConnection: IModelConnection, viewProps: ViewDefinitionProps[]) => any;
  setSelectedViews: (viewsSelected: Id64Props[]) => any;
}

export type IModelViewsSelectedFunc = (project: ProjectInfo, iModelConnection: IModelConnection, viewIdsSelected: Id64Props[]) => void;

interface IModelPanelState {
  waitingForIModels: boolean;
  waitingForIModelConnection: boolean;
  selectedIModelCardRect?: DOMRect;
  viewsOnOff?: boolean[];
  iModelConnection?: IModelConnection;
}

function mapStateToProps(state: any) {
  const openIModelState: OpenIModelState = state.frameworkState.openIModelState as OpenIModelState;
  return {
    accessToken: openIModelState.accessToken!,
    overlaySearchProjectsComponent: openIModelState.overlaySearchProjectList,
    iModels: openIModelState.iModels!,
    currentProject: openIModelState.currentProject,
    currentIModel: openIModelState.currentIModel,
    currentViews: openIModelState.currentViews,
    recentProjects: openIModelState.recentProjects,
    showRecentProjects: openIModelState.showRecentProjects,
  };
}

// these are the actions that apply to this page.
const mapDispatch = {
  setCurrentProject: OpenIModelActions.setCurrentProject,
  showRecentProjectList: OpenIModelActions.showRecentProjectList,
  setIModels: OpenIModelActions.setIModels,
  setCurrentIModel: OpenIModelActions.setCurrentIModel,
  setIModelConnection: OpenIModelActions.setIModelConnection,
  setSelectedViews: OpenIModelActions.setSelectedViews,
};

/** This Component displays the iModels for the currently selected CONNECT Project as rectangular cards. */
class IModelPanelComponent extends React.Component<IModelPanelProps, IModelPanelState> {

  public readonly state: Readonly<IModelPanelState> = {
    waitingForIModels: false,
    waitingForIModelConnection: false,
    iModelConnection: undefined,
  };

  // invoked when a project in the Recent Project List pulldown is clicked.
  private selectProject(selectedProject: ProjectInfo) {
    this.props.setCurrentProject(selectedProject);
  }

  // invoked when the down-arrow icon in the ProjectCard in the IModelPanelHeader is pressed.
  private openRecentList(_event: any) {
    this.props.showRecentProjectList();
  }

  private selectIModel(selectedIModel: IModelInfo, event: any) {
    const selectedIModelCardRect: DOMRect = event.currentTarget.getBoundingClientRect();
    this.setState({ selectedIModelCardRect });
    this.props.setCurrentIModel(selectedIModel);
  }

  // renders the recent projects pulldown list, if needed.
  private getRecentProjectsPulldown(): React.ReactNode | undefined {
    if ((!this.props.showRecentProjects) || (undefined === this.props.recentProjects) || (0 === this.props.recentProjects.length))
      return undefined;

    return <ProjectsPulldown projectList={this.props.recentProjects} selectProject={this.selectProject.bind(this)} />;
  }

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveIModels(thisProject: ProjectInfo) {
    this.setState({ waitingForIModels: true });
    const iModels: IModelInfo[] = await UiFramework.iModelServices.getIModels(this.props.accessToken, thisProject, 40, 0);
    this.props.setIModels(iModels);
    this.setState({ waitingForIModels: false });
  }

  // called when this component is first loaded
  public async componentDidMount() {
    if (this.props.currentProject)
      this.startRetrieveIModels(this.props.currentProject);
  }

  // called when a state change occurs.
  public async componentWillReceiveProps(newProps: IModelPanelProps) {
    if ((newProps.currentProject) && (newProps.currentProject! !== this.props.currentProject)) {
      this.startRetrieveIModels(newProps.currentProject);
    }

    if (this.props.currentProject && newProps.currentIModel && (newProps.currentIModel !== this.props.currentIModel)) {
      this.setState({ waitingForIModelConnection: true });
      const iModelConnection: IModelConnection = await UiFramework.iModelServices.openIModel(this.props.accessToken, this.props.currentProject, newProps.currentIModel.wsgId);
      const viewQueryParams: ViewQueryParams = { wantPrivate: false };
      let viewProps: ViewDefinitionProps[] = [];
      try {
        viewProps = await iModelConnection.views.queryProps(viewQueryParams);
        for (const viewProp of viewProps) {
          // tslint:disable-next-line:no-console
          console.log(viewProp);
        }
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.log("error getting views", e);
      }
      const viewsOnOff = new Array<boolean>(viewProps.length).fill(false);
      this.setState({ waitingForIModelConnection: false, viewsOnOff, iModelConnection });
      this.props.setIModelConnection(iModelConnection, viewProps);
    }
  }

  // This method is Dispatched from ViewSelector
  private viewsPicked(viewsSelected: boolean[]) {
    // tslint:disable-next-line:no-console
    console.log("Views Picked", viewsSelected);
    // pick out the ViewDefinitionProps we want.
    const viewIdsSelected: Id64Props[] = new Array<Id64Props>();
    for (let iView: number = 0; iView < viewsSelected.length; iView++) {
      if (viewsSelected[iView]) {
        viewIdsSelected.push(this.props.currentViews![iView].id!);
      }
    }

    this.props.onIModelViewsSelected(this.props.currentProject!, this.state.iModelConnection!, viewIdsSelected);
    this.props.setSelectedViews(viewIdsSelected);
  }

  // renders the view selector, if needed. It is displayed right after a new Project is selected.
  private getViewSelector(): React.ReactNode | undefined {
    if (!this.props.currentViews || 0 === this.props.currentViews.length) {
      return undefined;
    }
    return <ViewSelector iModelCardRect={this.state.selectedIModelCardRect!} viewList={this.props.currentViews} viewsPicked={this.viewsPicked.bind(this)} />;
  }

  // called to show a card for each iModel within the selected project
  private renderIModelCards(): React.ReactNode {
    if (!this.props.iModels)
      return undefined;

    if (this.props.iModels.length > 0) {
      const elements = this.props.iModels.map((thisIModel) => {
        return (
          <IModelCard iModel={thisIModel} selectModel={this.selectIModel.bind(this, thisIModel)} key={thisIModel.wsgId} accessToken={this.props.accessToken} />
        );
      });
      const cardContainerStyle: React.CSSProperties = {
        display: "flex",
        flexWrap: "wrap",
      };
      return (
        < div style={cardContainerStyle}>
          {elements}
        </div >
      );
    } else {
      const divStyle: React.CSSProperties = {
        width: "80%",
        textAlign: "center",
      };
      return (
        <div style={divStyle}>
          <p>{UiFramework.i18n.translate("UiFramework:IModelPanel.noIModels", { projectName: this.props.currentProject!.name })}</p>
        </div>
      );
    }
  }

  // This renders the main background = which consists of the iModels for the current project in card form.
  private getMainArea(): React.ReactNode {
    if (this.state.waitingForIModels) {
      return (<WaitSpinner />);
    }

    if (this.state.waitingForIModelConnection) {
      return (
        <div>
          {this.renderIModelCards()}
          <div className="fw-imodelpanel-smokedglass" />
          <WaitSpinner />
        </div>
      );
    }

    return this.renderIModelCards();
  }

  public render(): any {
    // @e always show the iModel list (MainArea) for the current project.
    // We also shows the recent project pulldown if state's "showRectProjectList" is set.
    // We also show  the view selector for a newly selected project.
    return (
      <div className="fw-imodel-list-container">
        <IModelPanelHeader thisProject={this.props.currentProject} icon={this.props.icon} openRecentList={this.openRecentList.bind(this)} />
        {this.getMainArea()}
        {this.getRecentProjectsPulldown()}
        {this.getViewSelector()}
      </div>
    );
  }
}

/** This Component displays the iModels for the currently selected CONNECT Project as rectangular cards. */ // tslint:disable-next-line:variable-name
export const IModelPanel = connect(mapStateToProps, mapDispatch)(IModelPanelComponent as any);
