/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { CSSProperties } from "react";
import * as classnames from "classnames";

import { AccessToken } from "@bentley/imodeljs-clients";
import { WebFontIcon } from "@bentley/ui-core";

import { UiFramework } from "../UiFramework";
import { IModelInfo } from "../clientservices/IModelServices";
import "./IModelCard.scss";

/** Props for the IModelCard React component */
export interface IModelCardProps {
  iModel: IModelInfo;
  cardClassName?: string;
  thumbnailClassName?: string;
  fallbackIconClassName?: string;
  nameClassName?: string;
  accessToken: AccessToken;
  selectModel: () => void;
}

export interface IModelCardState {
  waitingForThumbnail: boolean;
}

/**
 * Renders an iModel thumbnail and name in the window.
 */
export class IModelCard extends React.Component<IModelCardProps, IModelCardState> {

  public readonly state: Readonly<IModelCardState> = { waitingForThumbnail: false };

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveThumbnail(thisIModel: IModelInfo) {
    this.setState({ waitingForThumbnail: true });
    thisIModel.thumbnail = await UiFramework.iModelServices.getThumbnail(this.props.accessToken, thisIModel.projectInfo.wsgId, thisIModel.wsgId);

    this.setState({ waitingForThumbnail: false });
  }

  // called when this component is first loaded
  public async componentDidMount() {
    // we don't get the thumbnail until it's needed.

    if (!this.props.iModel.thumbnail)
      this.startRetrieveThumbnail(this.props.iModel);
  }

  public render(): any {
    const iModelCardClassName = classnames("fw-imodelcard", this.props.cardClassName);
    const thumbnailClassName = classnames("fw-imodelcard-thumbnail", this.props.thumbnailClassName);
    const fallbackIconClassName = classnames("fw-imodelcard-fallbackicon", this.props.fallbackIconClassName);
    const nameClassName = classnames("fw-imodelcard-name", this.props.nameClassName);
    let thumbnailElement: React.ReactChild | undefined;
    if (this.props.iModel.thumbnail) {
      thumbnailElement = <img className={thumbnailClassName} id="base64image" src={this.props.iModel.thumbnail} />;
    } else {
      const thumbnailStyle: CSSProperties = {
        cursor: this.state.waitingForThumbnail ? "wait" : "default",
      };
      thumbnailElement = <WebFontIcon iconName="icon-imodel-hollow" className={fallbackIconClassName} style={thumbnailStyle} />;
    }
    return (
      <div className={iModelCardClassName} onClick={this.props.selectModel} >
        {thumbnailElement}
        <span className={nameClassName}>{this.props.iModel.name}</span>
      </div>
    );
  }
}
