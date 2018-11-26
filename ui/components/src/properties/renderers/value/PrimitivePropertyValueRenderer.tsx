/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat, PrimitiveValue } from "../../Value";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";

/** Default Primitive Property Renderer */
export class PrimitivePropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  public async render(record: PropertyRecord) {
    const value = (record.value as PrimitiveValue).value;

    if (value !== undefined)
      return TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);

    return "";
  }
}
