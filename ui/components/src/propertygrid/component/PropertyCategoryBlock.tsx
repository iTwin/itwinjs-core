/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { ExpandableBlock } from "./ExpandableBlock";
import { PropertyCategory } from "../PropertyDataProvider";

/**
 * Props for the PropertyCategoryBlock React component
 */
export interface PropertyCategoryBlockProps {
  category: PropertyCategory;
  onBlockHeaderPressed?: () => void;
}

/**
 * PropertyCategoryBlock React component
 */
export class PropertyCategoryBlock extends React.Component<PropertyCategoryBlockProps> {

  constructor(props: any) {
    super(props);
    this.onClick = this.onClick.bind(this);
    this.onKeyPress = this.onKeyPress.bind(this);
  }

  private toggleExpansion() {
    if (this.props.onBlockHeaderPressed)
      this.props.onBlockHeaderPressed();
  }

  private onClick(_evt: React.MouseEvent<HTMLDivElement>) {
    this.toggleExpansion();
  }

  private onKeyPress(evt: React.KeyboardEvent<HTMLDivElement>) {
    /// Prevent page from scrolling when clicking [Space]:
    if (evt.key === " ") {
      evt.preventDefault();
    }
    /// [Space] and [Enter] toggle the block:
    if (evt.key === " " || evt.key === "Enter") {
      this.toggleExpansion();
    }
  }

  public render() {
    return (
      <ExpandableBlock
        isExpanded={this.props.category.expand}
        onClick={this.onClick}
        onKeyPress={this.onKeyPress}
        title={this.props.category.label}
      >
        {this.props.children}
      </ExpandableBlock>
    );
  }
}
