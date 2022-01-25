/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./IModelList.scss";
import classnames from "classnames";
import * as React from "react";
import { SearchBox } from "@itwin/core-react";
import { Button, ToggleSwitch } from "@itwin/itwinui-react";
import { IModelCard } from "./IModelCard";
import { BasicIModelInfo, IModelInfo } from "../ExternalIModel";
import { ITwinDialog } from "./ITwinDialog";

/** Properties for the [[IModelList]] component */
export interface IModelListProps {
  iModels?: IModelInfo[];
  onIModelSelected?: (iModelInfo: BasicIModelInfo) => void;
}

interface IModelListState {
  showDescriptions: boolean;
  showITwinDialog: boolean;
  currentIModel?: IModelInfo;
  showDetails: boolean;
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
      showITwinDialog: false,
      showDetails: false,
      filter: "",
    };
  }

  private _onShowThumbnails = () => {
    this.setState({ showDetails: false });
  };

  private _onShowDetails = () => {
    this.setState({ showDetails: true });
  };

  private _onShowITwinsSelector = () => {
    this.setState({ showITwinDialog: true });
  };

  private _onITwinsSelectorClose = () => {
    this.setState({ showITwinDialog: false });
  };

  private _handleSearchValueChanged = (value: string): void => {
    this.setState({ filter: value });
  };

  private _onIModelClick = (iModelInfo: IModelInfo) => {
    if (this.props.onIModelSelected)
      this.props.onIModelSelected(iModelInfo);
  };

  public override componentDidMount() {
    this.setState((_, props) => {
      if (props.iModels && 1 === props.iModels.length)
        return { currentIModel: props.iModels[0] };
      return {};
    });
  }

  private getFilteredIModels(): IModelInfo[] {
    let iModels: IModelInfo[] = [];
    if (this.props.iModels) {
      iModels = this.props.iModels.filter((iModel) => iModel.name.toLowerCase().includes(this.state.filter.toLowerCase()));
    }
    return iModels;
  }

  private renderIModel(iModelInfo: IModelInfo) {
    const size = `${Math.floor(Math.random() * 100).toString()} MB`;
    return (
      <tr key={iModelInfo.id}>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}><span className="icon icon-placeholder" />{iModelInfo.name}</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>{size}</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>This device</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>{iModelInfo.createdDate.toLocaleString()}</td>
        <td>
          <ToggleSwitch className="toggle-offline" />
        </td>
      </tr>
    );
  }

  private renderThumbnails(iModels: IModelInfo[]) {
    return (
      <div className="cards">
        {iModels.map((iModelInfo: IModelInfo) => (
          <IModelCard key={iModelInfo.id}
            iModel={iModelInfo}
            showDescription={this.state.showDescriptions}
            onSelectIModel={this.props.onIModelSelected}
          />
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
            There are no iModels associated to this ITwin.
            <Button styleType="cta" onClick={this._onShowITwinsSelector}>Search for active iTwins in your Organization?</Button>
          </div>
          {this.state.showITwinDialog && <ITwinDialog onClose={this._onITwinsSelectorClose} />}
        </div>
      );
    } else {
      const filteredIModels = this.getFilteredIModels();
      return (
        <div>
          {!this.state.showDetails && this.renderThumbnails(filteredIModels)}
          {this.state.showDetails && this.renderList(filteredIModels)}
          {filteredIModels.length === 0 &&
            <span className="cards-noresults fade-in-fast">No matches found for &apos;{this.state.filter}&apos;.</span>
          }
        </div>
      );
    }
  }

  public override render() {
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
      </div>
    );
  }
}
