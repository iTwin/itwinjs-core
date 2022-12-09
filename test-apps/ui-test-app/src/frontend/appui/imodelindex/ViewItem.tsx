/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ViewItem.scss";
import classnames from "classnames";
import * as React from "react";
import { ViewDefinitionProps } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { CommonProps, LoadingSpinner } from "@itwin/core-react";

/** Properties for [[ViewItem]] component
 * @internal
 */
export interface ViewItemProps extends CommonProps {
  /** View definition */
  viewProps: ViewDefinitionProps;
  /** IModelConnection to retrieve the thumbnail */
  iModelConnection: IModelConnection | undefined;
  /** Show thumbnails on the view items */
  showThumbnail?: boolean;
  /** Create view item in either details or thumbnail view */
  detailsView?: boolean;
  /** Determine if view is selected or not */
  isSelected?: boolean;
  /** Show hover indicator */
  showHoverIndicator?: boolean;
  /** Called when the view is clicked */
  onClick: (viewProps: ViewDefinitionProps) => void;
}

/** @internal */
interface ViewItemState {
  thumbnail: any;
  waitingForThumbnail: boolean;
}

/** Button containing thumbnail and view name
 * @internal
 */
export default class ViewItem extends React.Component<ViewItemProps, ViewItemState> {

  constructor(props: ViewItemProps) {
    super(props);

    this.state = { thumbnail: undefined, waitingForThumbnail: true };
  }

  /** Load thumbnail from the iModelConnection if necessary */
  public override async componentDidMount() {
    this.setState({ waitingForThumbnail: false });
  }

  public get viewDefinition(): ViewDefinitionProps {
    return this.props.viewProps;
  }

  public static createItem(props: ViewItemProps, _key: any) {
    return <ViewItem {...props} key={_key} />;
  }

  private _onClick = () => {
    this.props.onClick(this.props.viewProps);
  };

  public renderThumbnail() {
    if (this.state.waitingForThumbnail) {
      return (
        <LoadingSpinner />
      );
    } else if (this.state.thumbnail === undefined) {
      return (
        <svg className="no-thumbnail" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" enableBackground="new 0 0 16 16"><g><path d="M10.3 5.9 7.7 9.3 6 7.6 3 11 13 11z" /><circle cx="4.4" cy="5.9" r="1.3" /><path d="M0,2v12h16V2H0z M14,12H2V4h12V12z" /></g></svg>
      );
    } else {
      return (
        <>
          <img src={this.state.thumbnail} alt="" />
          {this.props.showHoverIndicator && <span className="open">Open</span>}
        </>
      );
    }
  }

  public override render() {
    const label = this.props.viewProps.userLabel ? this.props.viewProps.userLabel : this.props.viewProps.code.value;
    return (
      <>
        {this.props.detailsView &&
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className={classnames("view-list-item", this.props.isSelected && "selected", this.props.className)} style={this.props.style} onClick={this._onClick}>
            <div className="view-item-thumbnail-container thumbnail-container-small">
              {this.renderThumbnail()}
            </div>
            <span title={label}>{label}</span>
          </div>
        }
        {!this.props.detailsView &&
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className={classnames("view-list-item-thumbnail", this.props.isSelected && "selected", this.props.className)} style={this.props.style} onClick={this._onClick}>
            <div className="view-item-thumbnail-container">
              {this.renderThumbnail()}
            </div>
            <div className="view-item-label-thumbnail" title={label}>
              <span>{label}</span>
            </div>
          </div>
        }
      </>
    );
  }
}
