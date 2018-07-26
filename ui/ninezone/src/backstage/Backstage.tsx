/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import * as ReactDOM from "react-dom";
import "./Backstage.scss";

/** Properties of [[Backstage]] component. */
export interface BackstageProps extends CommonProps, NoChildrenProps {
  /** Describes if the Backstage should be shown or not. */
  isOpen?: boolean;
  /** Backstage items and separators. See: [[BackstageItem]], [[BackstageSeparator]] */
  items?: React.ReactNode;
  /** Function called when overlay is clicked. */
  onOverlayClicked?: React.EventHandler<React.MouseEvent<HTMLDivElement>>;
}

/** Backstage component of 9-zone UI app. */
export default class Backstage extends React.Component<BackstageProps> {
  private handleClickEvent = (ev: React.MouseEvent<HTMLDivElement>) => {
    const node = ReactDOM.findDOMNode(this);
    if (ev.target === node)
      this.props.onOverlayClicked && this.props.onOverlayClicked(ev);
  }

  public render() {
    const className = classnames(
      "nz-backstage-backstage",
      this.props.isOpen && "nz-is-open",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.handleClickEvent}
      >
        <div className="nz-items">
          {this.props.items}
        </div>
      </div>
    );
  }
}
