/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord } from "../../properties";
import { PropertyRenderer } from "./PropertyRenderer";
import { PropertyCategory } from "../PropertyDataProvider";

export interface PropertyListProps {
  orientation: Orientation;
  category?: PropertyCategory;
  properties: PropertyRecord[];
  selectedPropertyKey?: string;
  onPropertyClicked?: (property: PropertyRecord, key?: string) => void;
  columnRatio?: number;
  onColumnChanged?: (ratio: number) => void;
}

/**
 * Get unique key for property record
 * @hidden
 */
export function getPropertyKey(propertyCategory: PropertyCategory, propertyRecord: PropertyRecord) {
  return propertyCategory.name + propertyRecord.property.name;
}

/**
 * Container component for properties within a category.
 */
export class PropertyList extends React.Component<PropertyListProps> {
  public render() {
    const propertyListClassName = (this.props.orientation === Orientation.Horizontal)
      ? "components-property-list--horizontal" : "components-property-list--vertical";
    return (
      <div className={propertyListClassName}>
        {this.props.properties.map((propertyRecord: PropertyRecord) => {
          const key = this.props.category ? getPropertyKey(this.props.category, propertyRecord) : propertyRecord.property.name;
          return (
            <PropertyRenderer
              key={key}
              uniqueKey={key}
              isSelected={key === this.props.selectedPropertyKey}
              propertyRecord={propertyRecord}
              orientation={this.props.orientation}
              onClick={this.props.onPropertyClicked}
              columnRatio={this.props.columnRatio}
              onColumnRatioChanged={this.props.onColumnChanged}
            />);
        })}
      </div>
    );
  }
}
