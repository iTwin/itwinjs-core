/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { IPropertyValueRenderer, IPropertyValueRendererContext, PropertyContainerType } from "../ValueRendererManager";
import { PropertyRecord } from "../Record";
import { PropertyValueFormat, StructValue } from "../Value";
import { PropertyList } from "../../propertygrid/component/PropertyList";
import { Orientation } from "@bentley/ui-core";

/** Default Struct Property Renderer */
export class StructPropertyValueRenderer implements IPropertyValueRenderer {
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Struct;
  }

  public async render(record: PropertyRecord, context?: IPropertyValueRendererContext) {
    const recordMembers = (record.value as StructValue).members;
    const members = new Array<PropertyRecord>();

    for (const key in recordMembers) {
      if (recordMembers.hasOwnProperty(key))
        members.push(recordMembers[key]);
    }

    if (context) {
      switch (context.containerType) {
        case PropertyContainerType.PropertyPane:
          return (
            <PropertyList
              orientation={context.orientation ? context.orientation : Orientation.Horizontal}
              properties={members}
            />
          );
      }
    }
    return `{${record.property.typename}}`;
  }
}
