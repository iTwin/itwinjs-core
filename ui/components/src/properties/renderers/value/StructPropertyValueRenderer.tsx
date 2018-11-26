/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import React from "react";
import { IPropertyValueRenderer, PropertyValueRendererContext, PropertyContainerType } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat } from "../../Value";
import { Orientation } from "@bentley/ui-core";
import { TableStructValueRenderer } from "./table/StructValueRenderer";

/** Default Struct Property Renderer */
export class StructPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Struct;
  }

  public async render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    if (context) {
      switch (context.containerType) {
        case PropertyContainerType.Table:
          return (
            <TableStructValueRenderer
              propertyRecord={record}
              onDialogOpen={context.onDialogOpen}
              onPopupShow={context.onPopupShow}
              onPopupHide={context.onPopupHide}
              orientation={context.orientation ? context.orientation : Orientation.Horizontal}
            />
          );
      }
    }
    return `{${record.property.typename}}`;
  }
}
