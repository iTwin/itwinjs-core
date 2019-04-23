/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Expandable */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import "./ExpandableBlock.scss";

/** Properties for the [[ExpandableBlock]] React component
 * @public
 */
export interface ExpandableBlockProps extends CommonProps {
  /** Label */
  title: string;
  /** Indicates whether the ExpandableBlock is expanded */
  isExpanded: boolean;
  /** Callback function for click event */
  onClick: React.MouseEventHandler<HTMLDivElement>;
  /** Callback function for key press event */
  onKeyPress?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Additional text displayed in the block below the label and in a smaller font size */
  caption?: string;
}

/** ExpandableBlock is a React component that shows and hides child content.
 * @public
 */
export class ExpandableBlock extends React.PureComponent<ExpandableBlockProps> {

  public render() {
    const cName = classnames(
      "uicore-expandable-blocks-block",
      this.props.caption && "with-caption",
      this.props.isExpanded ? "is-expanded" : "is-collapsed",
      this.props.className,
    );
    const ariaExpanded = this.props.isExpanded ? "true" : "false";

    return (
      <div className={cName} style={this.props.style}>
        <div aria-expanded={ariaExpanded} className="header" onClick={this.props.onClick}
          onKeyPress={this.props.onKeyPress} tabIndex={this.props.onKeyPress ? 0 : undefined}>
          <div className="icon-container">
            <i className="icon icon-chevron-right" />
          </div>
          {this.props.caption &&
            <div className="caption" title={this.props.caption}>
              {this.props.caption}
            </div>
          }
          <div className="title" title={this.props.title}>
            {this.props.title}
          </div>
        </div>
        <div className="content">
          {this.props.isExpanded && this.props.children}
        </div>
      </div>
    );
  }
}
