/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { ExpandableBlock } from "@bentley/ui-core/";
import { PropertyCategory } from "../PropertyDataProvider";

/**
 * Properties for the [[PropertyCategoryBlock]] React component
 */
export interface PropertyCategoryBlockProps {
  /** Category of the properties */
  category: PropertyCategory;
  /** Callback to when PropertyCategoryBlock gets expended or collapsed */
  onExpansionToggled?: (categoryName: string) => void;
}

/**
 * PropertyCategoryBlock React component
 */
export class PropertyCategoryBlock extends React.Component<PropertyCategoryBlockProps> {
  private toggleExpansion() {
    if (this.props.onExpansionToggled)
      this.props.onExpansionToggled(this.props.category.name);
  }

  private _onClick = () => {
    this.toggleExpansion();
  }

  private _onKeyPress = (evt: React.KeyboardEvent<HTMLDivElement>) => {
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
        onClick={this._onClick}
        onKeyPress={this._onKeyPress}
        title={this.props.category.label}
      >
        {this.props.children}
      </ExpandableBlock>
    );
  }
}
