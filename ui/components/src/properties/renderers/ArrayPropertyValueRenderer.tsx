import { IPropertyValueRenderer, IPropertyValueRendererContext, PropertyContainerType } from "../ValueRendererManager";
import { PropertyRecord } from "../Record";
import { PropertyValueFormat, ArrayValue } from "../Value";
import React from "react";
import { PropertyList } from "../../propertygrid/component/PropertyList";
import { Orientation } from "@bentley/ui-core";

/** Default Array Property Renderer */
export class ArrayPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Array;
  }

  public async render(record: PropertyRecord, context?: IPropertyValueRendererContext) {
    const recordItems = (record.value as ArrayValue).items;

    if (context) {
      switch (context.containerType) {
        case PropertyContainerType.PropertyPane:
          return (
            <PropertyList
              orientation={context.orientation ? context.orientation : Orientation.Horizontal}
              properties={recordItems}
            />
          );
      }
    }

    if (recordItems.length !== 0)
      return `${recordItems[0].property.typename}[${recordItems.length}]`;

    return "[]";
  }
}
