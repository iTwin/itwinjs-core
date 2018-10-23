/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import * as React from "react";
import { Orientation, ElementSeparator } from "@bentley/ui-core";
import UiComponents from "../../UiComponents";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue, StructValue, ArrayValue, PropertyValue } from "../../properties";
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
  /** Ratio between label and value cells */
  columnRatio?: number;
  /** Callback to ratio change event */
  onColumnRatioChanged?: (ratio: number) => void;
}

/** State of [[PropertyRenderer]] React component */
export interface PropertyRendererState {
  /** Currently loaded property value */
  displayValue: string;
  /** Current width of this component in pixels */
  width?: number;
}

/**
 * PropertyRenderer React component
 */
export class PropertyRenderer extends React.PureComponent<PropertyRendererProps, PropertyRendererState> {
  private _containerRef: React.RefObject<HTMLDivElement> = React.createRef();

  public readonly state: Readonly<PropertyRendererState> = {
    displayValue: UiComponents.i18n.translate("UiComponents:general.loading"),
    width: undefined,
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

  private afterRender() {
    if (this.props.orientation !== Orientation.Horizontal || !this._containerRef.current)
      return;
    const width = this._containerRef.current.getBoundingClientRect().width;
    if (width !== this.state.width)
      this.setState({ width });
  }

  private getClassName(props: PropertyRendererProps) {
    let propertyRecordClassName = props.orientation === Orientation.Horizontal
      ? "components-property-record--horizontal"
      : "components-property-record--vertical";

    if (props.isSelected)
      propertyRecordClassName += " components--selected";

    if (props.onClick)
      propertyRecordClassName += " components--clickable";

    return propertyRecordClassName;
  }

  public componentDidMount() {
    this.updateDisplayValue(this.props);
    this.afterRender();
  }

  public componentDidUpdate(prevProps: PropertyRendererProps) {
    if (prevProps.propertyRecord !== this.props.propertyRecord)
      this.updateDisplayValue(this.props);
    this.afterRender();
  }

  public render() {
    let divStyle: React.CSSProperties | undefined;
    let ref: React.RefObject<HTMLDivElement> | undefined;
    const ratio = this.props.columnRatio ? this.props.columnRatio : 0.25;

    if (this.props.orientation === Orientation.Horizontal) {
      if (this.props.onColumnRatioChanged)
        divStyle = {
          gridTemplateColumns: `${ratio * 100}% 1px ${(1 - ratio) * 100}%`,
        };
      else
        divStyle = {
          gridTemplateColumns: `${ratio * 100}% ${(1 - ratio) * 100}%`,
        };

      ref = this._containerRef;
    }

    return (
      <div
        ref={ref}
        style={divStyle}
        className={this.getClassName(this.props)}
        onClick={this._onClick}
      >
        <div className="components-property-record-label">{this.props.propertyRecord.property.displayLabel}</div>
        {this.props.orientation === Orientation.Horizontal && this.props.onColumnRatioChanged ?
          <ElementSeparator
            movableArea={this.state.width}
            onRatioChanged={this.props.onColumnRatioChanged}
            ratio={ratio}
            orientation={this.props.orientation}
          /> : undefined}
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
