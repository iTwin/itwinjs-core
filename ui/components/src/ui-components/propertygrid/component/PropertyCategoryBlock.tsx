/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import * as React from "react";
import { SpecialKey } from "@bentley/ui-abstract";
import { CommonProps, ExpandableBlock } from "@bentley/ui-core";
import { PropertyCategory } from "../PropertyDataProvider";

/**
 * Properties for the [[PropertyCategoryBlock]] React component
 * @public
 */
export interface PropertyCategoryBlockProps extends CommonProps {
  /** Category of the properties */
  category: PropertyCategory;
  /** Callback to when PropertyCategoryBlock gets expended or collapsed */
  onExpansionToggled?: (categoryName: string) => void;
}

/**
 * PropertyCategoryBlock React component
 * @public
 */
export class PropertyCategoryBlock extends React.Component<PropertyCategoryBlockProps> {
  constructor(props: PropertyCategoryBlockProps) {
    super(props);
  }

  private toggleExpansion() {
    if (this.props.onExpansionToggled)
      this.props.onExpansionToggled(this.props.category.name);
  }

  private _onClick = () => {
    this.toggleExpansion();
  };

  private _onKeyPress = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent page from scrolling when clicking [Space]:
    if (evt.key === SpecialKey.Space) {
      evt.preventDefault();
    }
    // [Space] and [Enter] toggle the block:
    if (evt.key === SpecialKey.Space || evt.key === SpecialKey.Enter) {
      this.toggleExpansion();
    }
  };

  /** @internal */
  public render() {
    return (
      <ExpandableBlock
        isExpanded={this.props.category.expand}
        onClick={this._onClick}
        onKeyPress={this._onKeyPress}
        title={this.props.category.label}
        className={this.props.className}
        style={this.props.style}
      >
        {this.props.children}
      </ExpandableBlock>
    );
  }
}
