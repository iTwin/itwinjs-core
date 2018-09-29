/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import { HorizontalAnchor } from "../Stacked";
import "./Content.scss";

/** Properties of [[WidgetContent]] component. */
export interface WidgetContentProps extends CommonProps, NoChildrenProps {
  /** Describes to which side the widget of this content is anchored. */
  anchor: HorizontalAnchor;
  /** Actual content. */
  content?: React.ReactNode;
}

/** Scrollable widget content. Used by [[Stacked]] component. */
export default class WidgetContent extends React.Component<WidgetContentProps> {
  public render() {
    const className = classnames(
      "nz-widget-rectangular-content",
      this.props.anchor === HorizontalAnchor.Left && "nz-left-anchor",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div>
          {this.props.content}
        </div>
      </div>
    );
  }
}
