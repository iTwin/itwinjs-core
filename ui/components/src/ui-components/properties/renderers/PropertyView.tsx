/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import { Orientation, ElementSeparator } from "@bentley/ui-core";
import { SharedRendererProps } from "./PropertyRenderer";
import { PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { ActionButtonList } from "./ActionButtonList";
import "./PropertyView.scss";

/** Properties of [[PropertyView]] React component
 * @public
 */
export interface PropertyViewProps extends SharedRendererProps {
  /** Property label as a React element */
  labelElement: React.ReactNode;
  /** Property value as a React element */
  valueElement?: React.ReactNode;
}

/** @internal */
interface PropertyViewState {
  isHovered: boolean;
}

/**
 * A React component that renders property as label/value pair
 * @public
 */
export class PropertyView extends React.Component<PropertyViewProps, PropertyViewState> {

  constructor(props: PropertyViewProps) {
    super(props);
    this.state = {
      isHovered: false,
    };
  }

  private _onClick = () => {
    if (this.props.onClick)
      this.props.onClick(this.props.propertyRecord, this.props.uniqueKey);
  }

  private _onMouseEnter = () => {
    if (this.props.isHoverable)
      this.setState({ isHovered: true });
  }

  private _onMouseLeave = () => {
    if (this.props.isHoverable)
      this.setState({ isHovered: false });
  }

  private _onContextMenu = (e: React.MouseEvent) => {
    if (this.props.onContextMenu)
      this.props.onContextMenu(this.props.propertyRecord, e);
    if (this.props.onRightClick)
      this.props.onRightClick(this.props.propertyRecord, this.props.uniqueKey);
    e.preventDefault();
    return false;
  }

  private getClassName(props: PropertyViewProps) {
    let propertyRecordClassName = props.orientation === Orientation.Horizontal
      ? "components-property-record--horizontal"
      : "components-property-record--vertical";
    if (props.isSelected)
      propertyRecordClassName += " components--selected";
    if (props.onClick)
      propertyRecordClassName += " components--clickable";
    if (props.isHoverable)
      propertyRecordClassName += " components--hoverable";
    return propertyRecordClassName;
  }

  private getStyle(props: PropertyViewProps, ratio: number): React.CSSProperties {
    let gridTemplateColumns;
    if (props.orientation === Orientation.Horizontal)
      gridTemplateColumns = `${ratio * 100}%` + (props.onColumnRatioChanged ? " 1px" : "") + " auto";
    else // Orientation.Vertical
      gridTemplateColumns = "auto";

    if (props.actionButtonRenderers)
      gridTemplateColumns += " auto"; // add another column for action buttons

    return { gridTemplateColumns };
  }

  /** @internal */
  public render() {
    const ratio = this.props.columnRatio ? this.props.columnRatio : 0.25;

    return (
      <div
        style={this.getStyle(this.props, ratio)}
        className={this.getClassName(this.props)}
        onClick={this._onClick}
        onContextMenu={this._onContextMenu}
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}
      >
        <div className="components-property-record-label">{this.props.labelElement}</div>
        {this.props.orientation === Orientation.Horizontal && this.props.onColumnRatioChanged
          ?
          <ElementSeparator
            movableArea={this.props.width}
            onRatioChanged={this.props.onColumnRatioChanged}
            ratio={ratio}
            orientation={this.props.orientation}
          />
          : undefined}
        {this.props.propertyRecord.value.valueFormat === PropertyValueFormat.Primitive
          ? <div className="components-property-record-value"><span>{this.props.valueElement}</span></div>
          : undefined
        }
        {this.props.actionButtonRenderers
          ?
          <ActionButtonList
            orientation={this.props.orientation}
            property={this.props.propertyRecord}
            isPropertyHovered={this.state.isHovered}
            actionButtonRenderers={this.props.actionButtonRenderers}
          />
          :
          undefined
        }
      </div>
    );
  }
}
