/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import UiComponents from "../../UiComponents";
import { PropertyDescription, PropertyRecord, PropertyValueFormat, PrimitiveValue, StructValue, ArrayValue, PropertyValue } from "../../properties";
import { PropertyList } from "./PropertyList";

import "./PropertyRenderer.scss";

/**
 * Properties for the [[PropertyRenderer]] React component
 */
export interface PropertyRendererProps {
  /** Unique string, that identifies this property component. Should be used if onClick is provided */
  uniqueKey?: string;
  /** PropertyRecord to render */
  propertyRecord: PropertyRecord;
  /** Orientation to use for displaying the property */
  orientation: Orientation;
  /** Controls component selection */
  isSelected?: boolean;
  /** Called when property gets clicked. If undefined, clicking is disabled */
  onClick?: (property: PropertyRecord, key?: string) => void;
}

/** State of [[PropertyRenderer]] React component */
export interface PropertyRendererState {
  /** Currently loaded property value */
  displayValue: string;
}

/**
 * PropertyRenderer React component
 */
export class PropertyRenderer extends React.PureComponent<PropertyRendererProps, PropertyRendererState> {

  public readonly state: Readonly<PropertyRendererState> = {
    displayValue: UiComponents.i18n.translate("UiComponents:general.loading"),
  };

  private _onClick = () => {
    if (this.props.onClick)
      this.props.onClick(this.props.propertyRecord, this.props.uniqueKey);
  }

  private async updateDisplayValue(props: PropertyRendererProps) {
    const displayValue = await props.propertyRecord.getDisplayValue();

    if (this.state.displayValue !== displayValue)
      this.setState({ displayValue });
  }

  public componentDidMount() {
    this.updateDisplayValue(this.props);
  }

  public componentDidUpdate(prevProps: PropertyRendererProps) {
    if (prevProps.propertyRecord !== this.props.propertyRecord)
      this.updateDisplayValue(this.props);
  }

  public render() {
    const propertyDescription: PropertyDescription = this.props.propertyRecord.property;
    let propertyRecordClassName = this.props.orientation === Orientation.Horizontal ? "components-property-record--horizontal" : "components-property-record--vertical";
    if (this.props.isSelected)
      propertyRecordClassName += " components--selected";

    if (this.props.onClick)
      propertyRecordClassName += " components--clickable";

    return (
      <div className={propertyRecordClassName} onClick={this._onClick}>
        <div className="components-property-record-label">{propertyDescription.displayLabel}</div>
        <div className="components-property-record-value"><PropertyValueRenderer orientation={this.props.orientation} value={this.props.propertyRecord.value} /></div>
      </div>
    );
  }
}

class PropertyValueRenderer extends React.PureComponent<{ orientation: Orientation, value: PropertyValue }> {
  public render() {
    switch (this.props.value.valueFormat) {
      case PropertyValueFormat.Primitive: return <PrimitivePropertyValueRenderer value={this.props.value} />;
      case PropertyValueFormat.Struct: return <StructPropertyValueRenderer orientation={this.props.orientation} value={this.props.value} />;
      case PropertyValueFormat.Array: return <ArrayPropertyValueRenderer orientation={this.props.orientation} value={this.props.value} />;
    }
    return undefined;
  }
}

class PrimitivePropertyValueRenderer extends React.PureComponent<{ value: PrimitiveValue }> {
  public render() {
    return this.props.value.displayValue;
  }
}

class StructPropertyValueRenderer extends React.PureComponent<{ orientation: Orientation, value: StructValue }> {
  public render() {
    const members = new Array<PropertyRecord>();
    for (const key in this.props.value.members) {
      if (this.props.value.members.hasOwnProperty(key))
        members.push(this.props.value.members[key]);
    }
    return <PropertyList orientation={this.props.orientation} properties={members} />;
  }
}

class ArrayPropertyValueRenderer extends React.PureComponent<{ orientation: Orientation, value: ArrayValue }> {
  public render() {
    return <PropertyList orientation={this.props.orientation} properties={this.props.value.items} />;
  }
}
