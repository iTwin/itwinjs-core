/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { NoChildrenProps } from "../../utilities/Props";
import { HorizontalAnchor, HorizontalAnchorHelpers } from "../Stacked";
import "./Content.scss";

/** Properties of [[WidgetContent]] component.
 * @alpha
 */
export interface WidgetContentProps extends CommonProps, NoChildrenProps {
  /** Describes to which side the widget of this content is anchored. */
  anchor: HorizontalAnchor;
  /** Actual content. */
  content?: React.ReactNode;
}

/** Scrollable widget content. Used by [[Stacked]] component.
 * @alpha
 */
export class WidgetContent extends React.PureComponent<WidgetContentProps> {
  private _content = React.createRef<HTMLDivElement>();
  private _scrollTop = 0;
  private _scrollLeft = 0;

  public componentDidUpdate() {
    if (!this._content.current)
      return;
    this._content.current.scrollTop = this._scrollTop;
    this._content.current.scrollLeft = this._scrollLeft;
  }

  public render() {
    const className = classnames(
      "nz-widget-rectangular-content",
      HorizontalAnchorHelpers.getCssClassName(this.props.anchor),
      this.props.className);

    return (
      <div
        className={className}
        ref={this._content}
        onScroll={this._handleScroll}
        style={this.props.style}
      >
        <div className="nz-container">
          {this.props.content}
        </div>
      </div>
    );
  }

  private _handleScroll = () => {
    if (!this._content.current)
      return;
    this._scrollTop = this._content.current.scrollTop;
    this._scrollLeft = this._content.current.scrollLeft;
  }
}
