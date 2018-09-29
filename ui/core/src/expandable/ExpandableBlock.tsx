/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Expandable */

import * as React from "react";
import * as classnames from "classnames";
import "./ExpandableBlock.scss";

/** Propertiess for the [[ExpandableBlock]] React component */
export interface ExpandableBlockProps {
  /** Label */
  title: string;
  /** Indicates whether the ExpandableBlock is expanded */
  isExpanded?: boolean;
  /** Callback function for click event */
  onClick?: () => any;
  /** Callback function for key press event */
  onKeyPress?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Additional text displayed in the block below the label and in a smaller font size */
  caption?: string;
  /** CSS class name */
  className?: string;
  /** CSS style properties */
  style?: React.CSSProperties;
}

interface ExpandableBlockState {
  isExpanded: boolean;
}

/** ExpandableBlock is a React component that shows and hides child content. */
export class ExpandableBlock extends React.Component<ExpandableBlockProps, ExpandableBlockState> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { isExpanded: this.props.isExpanded! };
  }

  public static defaultProps: Partial<ExpandableBlockProps> = {
    isExpanded: false,
  };

  public componentDidUpdate(prevProps: ExpandableBlockProps) {
    if (prevProps.isExpanded !== this.props.isExpanded) {
      this.setState({ isExpanded: this.props.isExpanded! });
    }
  }

  private _handleClick = () => {
    this.setState({ isExpanded: !this.state.isExpanded }, () => {
      if (this.props.onClick) {
        this.props.onClick();
      }
    },
    );
  }

  public render() {
    const isExpanded = this.state.isExpanded;
    const cName = classnames(
      "BwcExpandableBlock",
      "Clickable",
      this.props.caption && "with-caption",
      isExpanded ? "is-expanded" : "is-collapsed",
      this.props.className,
    );
    const ariaExpanded = isExpanded ? "true" : "false";

    return (
      <div className={cName} style={this.props.style}>
        <div
          aria-expanded={ariaExpanded}
          className="header"
          onClick={this._handleClick}
          onKeyPress={this.props.onKeyPress}
          tabIndex={this.props.onKeyPress ? 0 : undefined}
        >
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
          {isExpanded ? this.props.children : null}
        </div>
      </div>
    );
  }
}

export default ExpandableBlock;
