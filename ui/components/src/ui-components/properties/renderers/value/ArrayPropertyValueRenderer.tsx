/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { IPropertyValueRenderer, PropertyValueRendererContext, PropertyContainerType } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat, ArrayValue } from "../../Value";
import { Orientation } from "@bentley/ui-core";
import { TableArrayValueRenderer } from "./table/ArrayValueRenderer";
import { withContextStyle } from "./WithContextStyle";

/** Default Array Property Renderer */
export class ArrayPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Array;
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const recordItems = (record.value as ArrayValue).items;

    if (context && context.containerType === PropertyContainerType.Table) {
      return withContextStyle(
        <TableArrayValueRenderer
          propertyRecord={record}
          onDialogOpen={context.onDialogOpen}
          orientation={context.orientation ? context.orientation : Orientation.Horizontal}
        />,
        context,
      );
    }

    if (context && context.containerType === PropertyContainerType.PropertyPane) {
      return "";
    }

    return withContextStyle(
      (recordItems.length !== 0)
        ? `${(record.value as ArrayValue).itemsTypeName}[${recordItems.length}]`
        : `${(record.value as ArrayValue).itemsTypeName}[]`,
      context,
    );
  }
}
