/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { PropertyRenderer } from "./PropertyRenderer";

export interface PropertyListProps {
  orientation: Orientation;
  properties: PropertyRecord[];
  selectedPropertyKey?: string;
  onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
}

/**
 * Container component for properties within a category.
 */
export class PropertyList extends React.PureComponent<PropertyListProps> {
  public render() {
    const propertyListClassName = (this.props.orientation === Orientation.Horizontal)
      ? "components-property-list--horizontal" : "components-property-list--vertical";
    return (
      <div className={propertyListClassName}>
        {this.props.properties.map((propertyRecord: PropertyRecord) => {
          const key = propertyRecord.property.name;
          return (
            <PropertyRenderer
              key={key}
              uniqueKey={key}
              isSelected={key === this.props.selectedPropertyKey}
              propertyRecord={propertyRecord}
              orientation={this.props.orientation}
              onClick={this.props.onPropertyClicked}
            />);
        })}
      </div>
    );
  }
}
