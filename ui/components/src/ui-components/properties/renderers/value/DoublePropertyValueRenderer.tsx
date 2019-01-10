/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat, PrimitiveValue } from "../../Value";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";

/** Default Double Property Renderer */
export class DoublePropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "double";
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const primitive = record.value as PrimitiveValue;
    if (primitive.displayValue)
      return primitive.displayValue;
    return withContextStyle(TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, primitive.value), context);
  }
}
