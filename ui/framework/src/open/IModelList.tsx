import * as React from "react";
import { IModelCard } from "./IModelCard";
import { IModelInfo } from "../clientservices/IModelServices";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import "./IModelList.scss";
import { Id64Props } from "@bentley/bentleyjs-core";
import { IModelViewsSelectedFunc } from "../openimodel/IModelPanel";
import * as classnames from "classnames";

export interface IModelListProps {
  accessToken: AccessToken;
  iModels?: IModelInfo[];
  onIModelSelected?: (iModelInfo: IModelInfo) => any;
  onIModelViewsSelected: IModelViewsSelectedFunc;

  // actions:
  setSelectedViews: (viewsSelected: Id64Props[]) => any;
}

interface IModelListState {
  showDescriptions: boolean;
  waitingForIModelConnection: boolean;
  currentIModel?: IModelInfo;
  currentViews: ViewDefinitionProps[];
  iModelConnection?: IModelConnection;
  showDetails: boolean;
}

export class IModelList extends React.Component<IModelListProps, IModelListState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showDescriptions: true, /* show descriptions by default */
      waitingForIModelConnection: true,
      currentViews: [],
      showDetails: false,
    };
  }

  private onIModelSelected(iModelInfo: IModelInfo) {
    if (this.props.onIModelSelected)
      this.props.onIModelSelected!(iModelInfo);
  }

  private onShowThumbnails = () => {
    this.setState({ showDetails: false });
  }

  private onShowDetails = () => {
    this.setState({ showDetails: true });
  }

  private renderThumbnails() {
    if (this.props.iModels && this.props.iModels.length > 1) {
      return (
        <div className="cards fade-in-fast">
          {this.props.iModels && this.props.iModels.map((iModelInfo: IModelInfo) => (
            <IModelCard key={iModelInfo.wsgId}
              accessToken={this.props.accessToken}
              iModel={iModelInfo}
              showDescription={this.state.showDescriptions}
              onIModelViewsSelected={this.props.onIModelViewsSelected}
              setSelectedViews={this.props.setSelectedViews}
              selectModel={this.onIModelSelected.bind(this, iModelInfo)} />
          ))}
        </div>
      );
    } else {
      return (
        <div className="cards-empty fade-in">
          There are no iModels associated to this project.
        </div>
      );
    }
  }

  private renderIModel(iModelInfo: IModelInfo) {
    const size = Math.floor(Math.random() * 100).toString() + " MB";
    return (
      <tr>
        <td><span className="icon icon-imodel-2" />{iModelInfo.name}</td>
        <td>{size}</td>
        <td>This device</td>
        <td>{iModelInfo.createdDate.toLocaleString()}</td>
        <td>
          <input className="tgl tgl-ios" id={iModelInfo.wsgId} type="checkbox" />
          <label className="tgl-btn" htmlFor={iModelInfo.wsgId}></label>
        </td>
      </tr>
    );
  }

  private renderDetails() {
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
            {(this.props.iModels && this.props.iModels.length > 0) && this.props.iModels.map((iModelInfo: IModelInfo) => (this.renderIModel(iModelInfo)))}
          </tbody>
        </table>
      </div>
    );
  }

  public render() {
    const classThumbnails = classnames("icon icon-app-launcher", !this.state.showDetails && "active");
    const classList = classnames("icon icon-list", this.state.showDetails && "active");
    return (
      <div className="cards-content">
        <div className="header">
          <span className="title">Recent</span>
          <input placeholder="Search imodels..." type="text" />
          <span className={classThumbnails} title="Thumbnails" onClick={this.onShowThumbnails} />
          <span className={classList} title="List" onClick={this.onShowDetails} />
        </div>
        <div className="cards-scroll-y">
          {!this.state.showDetails && this.renderThumbnails()}
          {this.state.showDetails && this.renderDetails()}
        </div>
      </div>
    );
  }
}
