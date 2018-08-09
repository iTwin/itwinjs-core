/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import * as classnames from "classnames";
import "./ExpandableBlock.scss";

/** Props for the ExpandableBlock React component */
export interface ExpandableBlockProps {
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
  /** CSS class name */
  className?: string;
  /** CSS style propertyes */
  style?: React.CSSProperties;
}

/** ExpandableBlock is a React component that shows and hides child content. */
export class ExpandableBlock extends React.Component<ExpandableBlockProps> {

  public render() {
    const cName = classnames(
      "BwcExpandableBlock",
      "Clickable",
      this.props.caption && "with-caption",
      this.props.isExpanded ? "is-expanded" : "is-collapsed",
      this.props.className,
    );
    const ariaExpanded = this.props.isExpanded ? "true" : "false";

    return (
      <div className={cName} style={this.props.style}>
        <div
          aria-expanded={ariaExpanded}
          className="header SmallerPadding"
          onClick={this.props.onClick}
          onKeyPress={this.props.onKeyPress}
          tabIndex={this.props.onKeyPress ? 0 : undefined}
        >
          <div className="icon-container SmallerIconContainer">
            <i className="icon icon-chevron-right" />
          </div>
          {this.props.caption &&
            <div className="caption" title={this.props.caption}>
              {this.props.caption}
            </div>
          }
          <div className="title SmallerTitle" title={this.props.title}>
            {this.props.title}
          </div>
        </div>
        <div className="content">
          {this.props.isExpanded ? this.props.children : null}
        </div>
      </div>
    );
  }
}
