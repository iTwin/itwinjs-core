/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tooltip */

import React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyList } from "../propertygrid/component/PropertyList";
import { PropertyData } from "../propertygrid/PropertyDataProvider";
import "./Tooltip.scss";

/** Properties for [[Tooltip]] React component
 * @alpha
 */
export interface TooltipProps {
  propertyData: PropertyData;
}

/** Tooltip React component
 * @alpha
 */
export class Tooltip extends React.Component<TooltipProps> {

  public render() {
    return (
      <div className="components-element-tooltip">
        {this.props.propertyData.label}
        <PropertyList
          orientation={Orientation.Horizontal}
          properties={this.props.propertyData.records.Favorite}
          columnRatio={1 / 3} />
      </div>
    );
  }
}
