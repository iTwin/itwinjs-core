/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import _ from "lodash";
import { PropertyValueFormat, StructValue, ArrayValue } from "../Value";
import { PropertyRecord } from "../Record";
import { NonPrimitivePropertyLabelRenderer } from "./label/NonPrimitivePropertyLabelRenderer";
import { PropertyView } from "./PropertyView";
import { PrimitiveRendererProps } from "./PrimitivePropertyRenderer";
import { PropertyRenderer } from "./PropertyRenderer";
import UiComponents from "../../UiComponents";
import { Orientation } from "@bentley/ui-core";

import "./NonPrimitivePropertyRenderer.scss";

/** Properties of [[NonPrimitivePropertyRenderer]] React component */
export interface NonPrimitivePropertyRendererProps extends PrimitiveRendererProps {
  /** Can struct/array property be collapsed */
  isCollapsible?: boolean;
}

/** State of [[NonPrimitivePropertyRenderer]] React component */
export interface NonPrimitivePropertyRendererState {
  /** Is struct/array property expanded */
  isExpanded?: boolean;
}

/** React Component that renders struct and array properties */
export class NonPrimitivePropertyRenderer extends React.Component<NonPrimitivePropertyRendererProps, NonPrimitivePropertyRendererState> {
  public readonly state: NonPrimitivePropertyRendererState = {
    /** If it's not collapsible, that means it's expanded by default and can't be collapsed */
    isExpanded: !this.props.isCollapsible,
  };

  private _onExpanded = () => {
    this.setState({ isExpanded: true });
  }

  private _onCollapsed = () => {
    this.setState({ isExpanded: false });
  }

  private getLabel(props: NonPrimitivePropertyRendererProps, state: NonPrimitivePropertyRendererState): React.ReactNode {
    const offset = PropertyRenderer.getLabelOffset(this.props.indentation);

    return (
      <NonPrimitivePropertyLabelRenderer
        isExpanded={!!state.isExpanded}
        onExpand={this._onExpanded}
        onCollapse={this._onCollapsed}
        offset={offset}
        renderColon={this.props.orientation === Orientation.Horizontal}
      >
        {props.propertyRecord.property.displayLabel}
      </NonPrimitivePropertyLabelRenderer>
    );
  }

  private getStructProperties(items: { [name: string]: PropertyRecord }) {
    const members = new Array<PropertyRecord>();
    for (const key in items) {
      if (items.hasOwnProperty(key))
        members.push(items[key]);
    }
    return members;
  }

  private getArrayProperties(items: PropertyRecord[]) {
    const additionalProperties: PropertyRecord[] = [
      new PropertyRecord(
        {
          valueFormat: PropertyValueFormat.Primitive,
          value: items.length,
          displayValue: items.length.toString(),
        },
        {
          displayLabel: UiComponents.i18n.translate("UiComponents:general.length"),
          name: "array_length",
          typename: "int",
        }),
    ];

    const modifiedProperties: PropertyRecord[] = items.map((item, index): PropertyRecord => {
      const newProperty = { ...item.property };
      newProperty.displayLabel = `[${index}]`;
      newProperty.name = `${newProperty.name}_${index}`;
      return new PropertyRecord(item.value, newProperty);
    });

    return additionalProperties.concat(modifiedProperties);
  }

  private _renderPropertyForItem = (item: PropertyRecord) => {
    const prefix = this.props.uniqueKey ? this.props.uniqueKey : this.props.propertyRecord.property.name;
    const uniqueKey = `${prefix}_${item.property.name}`;
    return (
      <PropertyRenderer
        key={uniqueKey}
        uniqueKey={uniqueKey}
        propertyRecord={item}
        indentation={this.props.indentation ? this.props.indentation + 1 : 1}
        orientation={this.props.orientation}
        columnRatio={this.props.columnRatio}
      />
    );
  }

  public render() {
    let items: PropertyRecord[];

    if (this.props.propertyRecord.value.valueFormat === PropertyValueFormat.Struct)
      items = this.getStructProperties((this.props.propertyRecord.value as StructValue).members);
    else
      items = this.getArrayProperties((this.props.propertyRecord.value as ArrayValue).items);

    const props = _.omit(this.props, ["children", "indentation"]);

    return (
      <>
        {this.props.isCollapsible
          ?
          <PropertyView
            labelElement={this.getLabel(this.props, this.state)}
            {...props}
          />
          : undefined}

        {this.state.isExpanded ? items.map(this._renderPropertyForItem) : undefined}
      </>
    );
  }
}
