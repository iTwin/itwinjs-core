/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { TableNonPrimitiveValueRenderer as TableValueRenderer, TableSpecificValueRendererProps } from "./NonPrimitiveValueRenderer";
import { NonPrimitivePropertyRenderer } from "../../NonPrimitivePropertyRenderer";
import { ArrayValue } from "../../../Value";

/** A react component which renders array property value as a button with text */
export class TableArrayValueRenderer extends React.PureComponent<TableSpecificValueRendererProps> {
  private getButtonLabel(props: TableSpecificValueRendererProps) {
    const value = (props.propertyRecord.value as ArrayValue);
    return value.items.length !== 0 ? `${value.itemsTypeName}[${value.items.length}]` : "[]";
  }

  private getDialogContents() {
    return (
      <NonPrimitivePropertyRenderer
        uniqueKey={`table_array_${this.props.propertyRecord.property.name}`}
        orientation={this.props.orientation}
        propertyRecord={this.props.propertyRecord}
      />
    );
  }

  public render() {
    const typeName = (this.props.propertyRecord.value as ArrayValue).itemsTypeName;
    return (
      <TableValueRenderer
        buttonLabel={this.getButtonLabel(this.props)}
        dialogContents={this.getDialogContents()}
        dialogTitle={`Array of type "${typeName}"`}
        onDialogOpen={this.props.onDialogOpen}
      />
    );
  }
}
