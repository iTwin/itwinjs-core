/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import * as React from "react";
import _ from "lodash";
import { Orientation } from "@bentley/ui-core";
import { PropertyRecord, PropertyValueFormat, ArrayValue } from "../";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../ValueRendererManager";
import { PrimitiveRendererProps, PrimitivePropertyRenderer } from "./PrimitivePropertyRenderer";
import { NonPrimitivePropertyRenderer } from "./NonPrimitivePropertyRenderer";
import { EditorContainer, PropertyUpdatedArgs } from "../../editors/EditorContainer";
import UiComponents from "../../UiComponents";

/** Properties shared by all renderers and PropertyView */
export interface SharedRendererProps {
  /** PropertyRecord to render */
  propertyRecord: PropertyRecord;
  /** Unique string, that identifies this property component. Should be used if onClick is provided */
  uniqueKey?: string;
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
  /** Indicated that property can be selected */
  isSelectable?: boolean;
}

/** Properties of [[PropertyRenderer]] React component */
export interface PropertyRendererProps extends SharedRendererProps {
  /** Custom value renderer */
  propertyValueRendererManager?: PropertyValueRendererManager;
  /** Multiplier of how much the property is indented to the right */
  indentation?: number;
  /** Indicates property is being edited */
  isEditing?: boolean;
  /** Called when property edit is committed. */
  onEditCommit?: (args: PropertyUpdatedArgs) => void;
  /** Called when property edit is cancelled. */
  onEditCancel?: () => void;
}

/** State of [[PropertyRenderer]] React component */
export interface PropertyRendererState {
  /** Currently loaded property value */
  displayValue?: React.ReactNode;
}

/**  A React component that renders properties */
export class PropertyRenderer extends React.Component<PropertyRendererProps, PropertyRendererState> {
  public readonly state: Readonly<PropertyRendererState> = {
    displayValue: UiComponents.i18n.translate("UiComponents:general.loading"),
  };

  public static getLabelOffset(indentation?: number) {
    if (!indentation)
      return 0;

    return indentation * 20;
  }

  private async updateDisplayValue(props: PropertyRendererProps) {
    if (props.isEditing) {
      this.updateDisplayValueAsEditor(props);
      return;
    }

    const rendererContext: PropertyValueRendererContext = {
      orientation: this.props.orientation,
      containerType: PropertyContainerType.PropertyPane,
    };
    let displayValue: React.ReactNode | undefined;

    if (this.props.propertyValueRendererManager)
      displayValue = await this.props.propertyValueRendererManager.render(props.propertyRecord, rendererContext);
    else {
      displayValue = await PropertyValueRendererManager.defaultManager.render(props.propertyRecord, rendererContext);
      // Adding left padding so it would align with text in EditText components
      // Since default renderers return simple text, there should be no problem
      if (typeof displayValue === typeof "")
        displayValue = <span style={{ paddingLeft: 9 }}>{displayValue}</span>;
    }

    // Align value with label if orientation is vertical
    if (this.props.orientation === Orientation.Vertical)
      displayValue = <span style={{ paddingLeft: PropertyRenderer.getLabelOffset(this.props.indentation) }}>{displayValue}</span>;

    this.setState({ displayValue });
  }

  private _onEditCommit = (args: PropertyUpdatedArgs) => {
    if (this.props.onEditCommit)
      this.props.onEditCommit(args);
  }

  private _onEditCancel = () => {
    if (this.props.onEditCancel)
      this.props.onEditCancel();
  }

  /** Display property record value in an editor */
  public updateDisplayValueAsEditor(props: PropertyRendererProps) {
    this.setState({
      displayValue:
        <EditorContainer
          propertyRecord={props.propertyRecord}
          onCommit={this._onEditCommit}
          onCancel={this._onEditCancel}
        />,
    });
  }

  public componentDidMount() {
    this.updateDisplayValue(this.props); // tslint:disable-line:no-floating-promises
  }

  public componentDidUpdate(prevProps: PropertyRendererProps) {
    if (prevProps.propertyRecord !== this.props.propertyRecord
      || prevProps.isEditing !== this.props.isEditing)
      this.updateDisplayValue(this.props); // tslint:disable-line:no-floating-promises
  }

  public render() {
    const sharedProps: PrimitiveRendererProps = {
      ...(_.omit(this.props, ["children", "propertyValueRendererManager", "isEditing", "onEditCommit", "onEditCancel"]) as PrimitiveRendererProps),
      valueElement: this.state.displayValue,
      indentation: this.props.indentation,
    };

    switch (this.props.propertyRecord.value.valueFormat) {
      case PropertyValueFormat.Primitive:
        return (
          <PrimitivePropertyRenderer {...sharedProps} />
        );
      case PropertyValueFormat.Array:
        // If array is empty, render it as a primitive property
        if (this.props.propertyRecord.value.valueFormat === PropertyValueFormat.Array
          && (this.props.propertyRecord.value as ArrayValue).items.length === 0)
          return (
            <PrimitivePropertyRenderer {...sharedProps} />
          );
      // tslint:disable-next-line:no-switch-case-fall-through
      case PropertyValueFormat.Struct:
        return (
          <NonPrimitivePropertyRenderer
            isCollapsable={true}
            {...sharedProps}
          />
        );
    }
  }
}
