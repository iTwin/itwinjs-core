/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Expandable */

import * as React from "react";
import { ExpandableBlock as BwcExpandableBlock } from "@bentley/bwc/lib/";
import "./ExpandableBlock.scss";

/** Propertiess for the [[ExpandableBlock]] React component */
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
  /** CSS style properties */
  style?: React.CSSProperties;
}

/** ExpandableBlock is a React component that shows and hides child content. */
export class ExpandableBlock extends React.Component<ExpandableBlockProps> {
  public render() {
    return (
      <BwcExpandableBlock
        className={"core-property-block" + (this.props.className ? " " + this.props.className : "")}
        isExpanded={this.props.isExpanded}
        onClick={this.props.onClick}
        onKeyPress={this.props.onKeyPress}
        title={this.props.title}
        caption={this.props.caption}
      >
        {this.props.children}
      </BwcExpandableBlock>
    );
  }
}

export default ExpandableBlock;
