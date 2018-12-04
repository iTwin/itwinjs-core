/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { Orientation, ElementSeparator } from "@bentley/ui-core";
import { SharedRendererProps } from "./PropertyRenderer";

import "./PropertyView.scss";

/** Properties of [[PropertyView]] React component */
export interface PropertyViewProps extends SharedRendererProps {
  /** Property label as a React element */
  labelElement: React.ReactNode;
  /** Property value as a React element */
  valueElement?: React.ReactNode;
}

/** State of [[PropertyView]] React component */
export interface PropertyViewState {
  /** Width of the whole property element */
  width?: number;
}

/**
 * A React component that renders property as label/value pair
 */
export class PropertyView extends React.Component<PropertyViewProps, PropertyViewState> {
  private _containerRef: React.RefObject<HTMLDivElement> = React.createRef();
  public readonly state: Readonly<PropertyViewState> = {
    width: undefined,
  };

  private _onClick = () => {
    if (this.props.onClick)
      this.props.onClick(this.props.propertyRecord, this.props.uniqueKey);
  }

  private getClassName(props: PropertyViewProps) {
    let propertyRecordClassName = props.orientation === Orientation.Horizontal
      ? "components-property-record--horizontal"
      : "components-property-record--vertical";
    if (props.isSelected)
      propertyRecordClassName += " components--selected";
    if (props.onClick)
      propertyRecordClassName += " components--clickable";
    if (props.isSelectable && !props.isSelected)
      propertyRecordClassName += " components--hoverable";
    return propertyRecordClassName;
  }

  private getStyle(props: PropertyViewProps, ratio: number): React.CSSProperties | undefined {
    if (props.orientation === Orientation.Horizontal) {
      if (props.onColumnRatioChanged)
        return {
          gridTemplateColumns: `${ratio * 100}% 1px ${(1 - ratio) * 100}%`,
        };
      else
        return {
          gridTemplateColumns: `${ratio * 100}% ${(1 - ratio) * 100}%`,
        };
    }
    return undefined;
  }

  private afterRender() {
    if (this.props.orientation !== Orientation.Horizontal || !this._containerRef.current)
      return;
    const width = this._containerRef.current.getBoundingClientRect().width;
    if (width !== this.state.width)
      this.setState({ width });
  }

  public componentDidMount() {
    this.afterRender();
  }

  public componentDidUpdate() {
    this.afterRender();
  }

  public render() {
    const ratio = this.props.columnRatio ? this.props.columnRatio : 0.25;

    return (
      <div
        ref={this.props.orientation === Orientation.Horizontal ? this._containerRef : undefined}
        style={this.getStyle(this.props, ratio)}
        className={this.getClassName(this.props)}
        onClick={this._onClick}
      >
        <div className="components-property-record-label">{this.props.labelElement}</div>
        {this.props.orientation === Orientation.Horizontal && this.props.onColumnRatioChanged
          ?
          <ElementSeparator
            movableArea={this.state.width}
            onRatioChanged={this.props.onColumnRatioChanged}
            ratio={ratio}
            orientation={this.props.orientation}
          />
          : undefined}
        <div className="components-property-record-value">{this.props.valueElement}</div>
      </div>
    );
  }
}
