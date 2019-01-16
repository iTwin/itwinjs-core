/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { PropertyLabelRendererProps, PropertyLabelRenderer } from "./PropertyLabelRenderer";

import "./PropertyLabelRenderer.scss";

/** Properties of a [[PrimitivePropertyLabelRenderer]] React component */
export interface PrimitivePropertyLabelRendererProps extends PropertyLabelRendererProps {
  /** Additional class name for the label wrapper */
  className?: string;
  /** Offset from the left side in pixels. */
  offset?: number;
}

/** A React component that renders a primitive property label */
export class PrimitivePropertyLabelRenderer extends React.PureComponent<PrimitivePropertyLabelRendererProps> {
  public render() {
    return (
      <span
        className={"components-primitive-property-label-renderer " + (this.props.className ? this.props.className : "")}
        style={PropertyLabelRenderer.getStyle(this.props.offset)}
      >
        <PropertyLabelRenderer renderColon={this.props.renderColon}>{this.props.children}</PropertyLabelRenderer>
      </span>
    );
  }
}
