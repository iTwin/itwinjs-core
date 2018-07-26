/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import { Anchor } from "../Stacked";

import "./Content.scss";

export interface WidgetContentProps extends CommonProps {
  anchor?: Anchor;
  onClick?: () => void;
}

export default class WidgetContent extends React.Component<WidgetContentProps> {
  public render() {
    const className = classnames(
      "nz-widget-rectangular-content",
      this.props.anchor === Anchor.Left && "nz-left-anchor",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.handleOnClick}
      >
        <div>
          {this.props.children}
        </div>
      </div>
    );
  }

  private handleOnClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
