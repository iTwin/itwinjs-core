/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./IModelCard.scss";
import * as React from "react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { BasicIModelInfo } from "../ExternalIModel";

/** Properties for the [[IModelCard]] component */
export interface IModelCardProps {
  showDescription?: boolean;
  iModel: { iTwinId: string, id: string, name: string, thumbnail?: string, description?: string };
  onSelectIModel?: (iModelInfo: BasicIModelInfo) => void;
}

interface IModelCardState {
  waitingForThumbnail: boolean;
  showOptions: boolean;
}

/**
 * Card representing a single IModel
 */
export class IModelCard extends React.Component<IModelCardProps, IModelCardState> {

  constructor(props: IModelCardProps, context?: any) {
    super(props, context);
    this.state = { waitingForThumbnail: false, showOptions: false };
  }

  public static defaultProps: Partial<IModelCardProps> = {
    showDescription: true,
  };

  private _onCardClicked = () => {
    if (this.props.onSelectIModel)
      this.props.onSelectIModel(this.props.iModel);
  };

  private renderDescription() {
    if (this.props.iModel.description && this.props.iModel.description.length > 0) {
      return (
        <span className="imodel-card-description">{this.props.iModel.description}</span>
      );
    } else {
      return (
        <span className="imodel-card-description" style={{ fontStyle: "italic" }}>No description</span>
      );
    }
  }

  public renderThumbnail() {
    if (this.state.waitingForThumbnail) {
      return (
        <div className="preview-loader">
          <ProgressRadial size="large" indeterminate />
        </div>
      );
    } else if (this.props.iModel.thumbnail) {
      return (
        <div className="preview-container">
          <img className="thumbnail" id="base64image" src={this.props.iModel.thumbnail} alt="" />
          <span className="open">Open</span>
        </div>
      );
    } else {
      return (
        <div className="preview-container">
          <span className="icon icon-placeholder" />
          <span className="open">Open</span>
        </div>
      );
    }
  }

  public override render() {
    return (
      <div className="imodel-card" >
        <div className="imodel-card-content" >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="imodel-card-preview" onClick={this._onCardClicked}>
            {this.renderThumbnail()}
          </div>
          <div className="imodel-card-name">
            <span className="text">{this.props.iModel.name}</span>
          </div>
          {this.props.showDescription && this.renderDescription()}
        </div>
      </div>
    );
  }
}
