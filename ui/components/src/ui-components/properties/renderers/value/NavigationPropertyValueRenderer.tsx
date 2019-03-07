/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue } from "@bentley/imodeljs-frontend";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";
import { withLinks } from "../../LinkHandler";

/** Default Navigation Property Renderer */
export class NavigationPropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "navigation";
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const primitive = record.value as PrimitiveValue;

    let stringValue: string | Promise<string>;

    if (primitive.displayValue) {
      stringValue = primitive.displayValue;
    } else {
      stringValue = TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, primitive.value);
    }

    return withContextStyle(withLinks(record, stringValue), context);
  }
}
