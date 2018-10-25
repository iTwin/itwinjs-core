/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import * as classnames from "classnames";
import { IModelCard } from "./IModelCard";
import { IModelInfo } from "../clientservices/IModelServices";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { ProjectDialog } from "./ProjectDialog";
import { IModelViewPicker } from "./IModelViewPicker";
import { SearchBox, Toggle } from "@bentley/ui-core";
import "./IModelList.scss";

/** Properties for the [[IModelList]] component */
export interface IModelListProps {
  accessToken: AccessToken;
  iModels?: IModelInfo[];
  onIModelSelected?: (iModel: IModelInfo, views: ViewDefinitionProps[]) => void;
}

interface IModelListState {
  showDescriptions: boolean;
  showProjectDialog: boolean;
  currentIModel?: IModelInfo;
  showDetails: boolean;
  showViews: boolean;
  filter: string;
}

/**
 * A list of IModelCards (IModels)
 */
export class IModelList extends React.Component<IModelListProps, IModelListState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showDescriptions: true, /* show descriptions by default */
      showProjectDialog: false,
      showDetails: false,
      showViews: false,
      filter: "",
    };
  }

  private _onShowThumbnails = () => {
    this.setState({ showDetails: false });
  }

  private _onShowDetails = () => {
    this.setState({ showDetails: true });
  }

  private _onShowProjectsSelector = () => {
    this.setState({ showProjectDialog: true });
  }

  private _onProjectsSelectorClose = () => {
    this.setState({ showProjectDialog: false });
  }

  private _handleSearchValueChanged = (value: string): void => {
    this.setState({ filter: value });
  }

  private _onViewsClose = () => {
    this.setState({ showViews: false });
  }

  private _onViewsSelected = (views: ViewDefinitionProps[]) => {
    if (this.props.onIModelSelected && this.state.currentIModel)
      this.props.onIModelSelected(this.state.currentIModel, views);
  }

  private _onIModelClick = (iModelInfo: IModelInfo) => {
    this.setState({ currentIModel: iModelInfo, showViews: true });
  }

  private getFilteredIModels(): IModelInfo[] {
    let iModels: IModelInfo[] = [];
    if (this.props.iModels) {
      iModels = this.props.iModels!.filter((iModel) => iModel.name.toLowerCase().includes(this.state.filter.toLowerCase()));
    }
    return iModels;
  }

  private renderIModel(iModelInfo: IModelInfo) {
    const size = Math.floor(Math.random() * 100).toString() + " MB";
    // const checked = Math.random() > .5;
    return (
      <tr key={iModelInfo.wsgId}>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}><span className="icon icon-placeholder" />{iModelInfo.name}</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>{size}</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>This device</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>{iModelInfo.createdDate.toLocaleString()}</td>
        <td>
          <Toggle className="toggle-offline" showCheckmark={true} />
        </td>
      </tr>
    );
  }

  private renderThumbnails(iModels: IModelInfo[]) {
    return (
      <div className="cards">
        {iModels.map((iModelInfo: IModelInfo) => (
          <IModelCard key={iModelInfo.wsgId}
            accessToken={this.props.accessToken}
            iModel={iModelInfo}
            showDescription={this.state.showDescriptions}
            onSelectIModel={this.props.onIModelSelected} />
        ))}
      </div>
    );
  }

  private renderList(iModels: IModelInfo[]) {
    return (
      <div className="table-container fade-in-fast">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Location</th>
              <th>Opened</th>
              <th>Offline</th>
            </tr>
          </thead>
          <tbody>
            {iModels.map((iModelInfo: IModelInfo) => (this.renderIModel(iModelInfo)))}
          </tbody>
        </table>
      </div>
    );
  }

  private renderContent() {
    if (!this.props.iModels || this.props.iModels.length === 0) {
      return (
        <div className="cards-empty">
          <div className="fade-in-fast">
            There are no iModels associated to this project.
            <button onClick={this._onShowProjectsSelector}>Search for active projects in your Organization?</button>
          </div>
          {this.state.showProjectDialog && <ProjectDialog accessToken={this.props.accessToken} onClose={this._onProjectsSelectorClose} />}
        </div>
      );
    } else {
      const filteredIModels = this.getFilteredIModels();
      return (
        <div>
          {!this.state.showDetails && this.renderThumbnails(filteredIModels)}
          {this.state.showDetails && this.renderList(filteredIModels)}
          {filteredIModels.length === 0 &&
            <span className="cards-noresults fade-in-fast">No matches found for '{this.state.filter}'.</span>
          }
        </div>
      );
    }
  }

  public render() {
    const classThumbnails = classnames("viewtype icon icon-placeholder", !this.state.showDetails && "active");
    const classList = classnames("viewtype icon icon-list", this.state.showDetails && "active");
    return (
      <div className="cards-content">
        <div className="header">
          <span className="title">Recent</span>
          <SearchBox placeholder="Search ..." onValueChanged={this._handleSearchValueChanged} valueChangedDelay={300} />
          <span className={classThumbnails} title="Thumbnails" onClick={this._onShowThumbnails} />
          <span className={classList} title="List" onClick={this._onShowDetails} />
        </div>
        <div className="cards-scroll-y">
          {this.renderContent()}
        </div>
        {this.state.showViews &&
          <IModelViewPicker accessToken={this.props.accessToken} iModel={this.state.currentIModel!} onClose={this._onViewsClose.bind(this)} OnViewsSelected={this._onViewsSelected.bind(this)} />}
      </div>
    );
  }
}
