/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import _ from "lodash";
import { PrimitivePropertyLabelRenderer } from "./label/PrimitivePropertyLabelRenderer";
import { PropertyView } from "./PropertyView";
import { SharedRendererProps, PropertyRendererState, PropertyRenderer } from "./PropertyRenderer";
import { Orientation } from "@bentley/ui-core";

/** Properties of [[PrimitivePropertyRenderer]] React component */
export interface PrimitiveRendererProps extends SharedRendererProps {
  /** Property value as a React element */
  valueElement?: React.ReactNode;
  /** Multiplier of how much the property is indented to the right */
  indentation?: number;
}

/** React Component that renders primitive properties */
export class PrimitivePropertyRenderer extends React.Component<PrimitiveRendererProps, PropertyRendererState> {
  public render() {
    const { children, indentation, ...props } = this.props;
    const offset = PropertyRenderer.getLabelOffset(this.props.indentation);
    return (
      <PropertyView
        {...props}
        labelElement={
          <PrimitivePropertyLabelRenderer offset={offset} renderColon={this.props.orientation === Orientation.Horizontal}>
            {this.props.propertyRecord.property.displayLabel}
          </PrimitivePropertyLabelRenderer>}
      />
    );
  }
}
