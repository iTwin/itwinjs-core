/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext, PropertyContainerType } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat, PrimitiveValue } from "../../Value";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";

/** Default Primitive Property Renderer */
export class PrimitivePropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    if (context && context.containerType === PropertyContainerType.Tree)
      return withContextStyle(context.decoratedTextElement, context);

    const value = (record.value as PrimitiveValue).value;
    if (value !== undefined)
      return withContextStyle(TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value), context);

    return "";
  }
}
