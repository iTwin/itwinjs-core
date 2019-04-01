/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { PropertyLabelRenderer } from "./PropertyLabelRenderer";
import { PrimitivePropertyLabelRendererProps } from "./PrimitivePropertyLabelRenderer";

import "./PropertyLabelRenderer.scss";

/** Properties for the [[NonPrimitivePropertyLabelRenderer]] React component
 * @public
 */
export interface NonPrimitivePropertyLabelRendererProps extends PrimitivePropertyLabelRendererProps {
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}

/**
 * A React component that renders a non-primitive property label.
 * It renders an animated arrow with text which expands when label is clicked.
 * @public
 */
export class NonPrimitivePropertyLabelRenderer extends React.PureComponent<NonPrimitivePropertyLabelRendererProps> {
  private _onClick = () => {
    if (this.props.isExpanded)
      this.props.onCollapse();
    else
      this.props.onExpand();
  }

  public render() {
    return (
      <div
        style={PropertyLabelRenderer.getStyle(this.props.offset)}
        className={"components-nonprimitive-property-label-renderer " + (this.props.className ? this.props.className : "")}
        onClick={this._onClick}
      >
        <i className={"icon icon-chevron-right" + (this.props.isExpanded ? " components-expanded" : "")} />
        <PropertyLabelRenderer renderColon={this.props.renderColon}>{this.props.children}</PropertyLabelRenderer>
      </div>
    );
  }
}
