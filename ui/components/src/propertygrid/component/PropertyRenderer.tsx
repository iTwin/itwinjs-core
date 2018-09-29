/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import UiComponents from "../../UiComponents";
import { PropertyDescription, PropertyRecord } from "../../properties";

/**
 * Props for the PropertyRenderer React component
 */
export interface PropertyRendererProps {
  /** PropertyRecord to render */
  propertyRecord: PropertyRecord;
  /** Orientation to use for displaying the property */
  orientation: Orientation;
}

export interface PropertyRendererState {
  displayValue: string;
}

/**
 * PropertyRenderer React component
 */
export class PropertyRenderer extends React.Component<PropertyRendererProps, PropertyRendererState> {

  public readonly state: Readonly<PropertyRendererState> = {
    displayValue: UiComponents.i18n.translate("UiComponents:general.loading"),
  };

  public componentWillReceiveProps(props: PropertyRendererProps) {
    this.updateDisplayValue(props);
  }

  public componentWillMount() {
    this.updateDisplayValue(this.props);
  }

  private async updateDisplayValue(props: PropertyRendererProps) {
    const displayValue = await props.propertyRecord.getDisplayValue();
    this.setState({ displayValue });
  }

  public render() {
    const propertyDescription: PropertyDescription = this.props.propertyRecord.property;
    if (this.props.orientation === Orientation.Horizontal) {
      return (
        <tr className="HorizontalPropertyRecord">
          <td className="PropertyName">{propertyDescription.displayLabel}</td>
          <td className="PropertyValue">{this.state.displayValue}</td>
        </tr>
      );
    } else {
      return (
        <div className="VerticalPropertyRecord">
          <div className="PropertyName">{propertyDescription.displayLabel}</div>
          <div className="PropertyValue">{this.state.displayValue}</div>
        </div>
      );
    }
  }
}
