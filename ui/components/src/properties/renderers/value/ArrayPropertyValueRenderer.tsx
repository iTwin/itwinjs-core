/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { IPropertyValueRenderer, PropertyValueRendererContext, PropertyContainerType } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat, ArrayValue } from "../../Value";
import { Orientation } from "@bentley/ui-core";
import { TableArrayValueRenderer } from "./table/ArrayValueRenderer";

/** Default Array Property Renderer */
export class ArrayPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Array;
  }

  public async render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const recordItems = (record.value as ArrayValue).items;

    if (context) {
      switch (context.containerType) {
        case PropertyContainerType.Table:
          return (
            <TableArrayValueRenderer
              propertyRecord={record}
              onDialogOpen={context.onDialogOpen}
              onPopupShow={context.onPopupShow}
              onPopupHide={context.onPopupHide}
              orientation={context.orientation ? context.orientation : Orientation.Horizontal}
            />
          );
      }
    }

    if (recordItems.length !== 0)
      return `${(record.value as ArrayValue).itemsTypeName}[${recordItems.length}]`;

    return `${(record.value as ArrayValue).itemsTypeName}[]`;
  }
}
