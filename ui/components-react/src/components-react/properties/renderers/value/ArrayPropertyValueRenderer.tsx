/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import type { ArrayValue, PropertyRecord} from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import type { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyContainerType } from "../../ValueRendererManager";
import { TableArrayValueRenderer } from "./table/ArrayValueRenderer";
import { withContextStyle } from "./WithContextStyle";

/** Default Array Property Renderer
 * @public
 */
export class ArrayPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Array;
  }

  /** Method that returns a JSX representation of PropertyRecord */
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
      return withContextStyle("", context);
    }

    return withContextStyle(
      (recordItems.length !== 0)
        ? `${(record.value as ArrayValue).itemsTypeName}[${recordItems.length}]`
        : `${(record.value as ArrayValue).itemsTypeName}[]`,
      context,
    );
  }
}
