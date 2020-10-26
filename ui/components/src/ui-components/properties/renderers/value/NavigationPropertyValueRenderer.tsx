/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PrimitiveValue, PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PrimitivePropertyValueRendererImpl } from "./PrimitivePropertyValueRenderer";

/** Default Navigation Property Renderer
 * @public
 */
export class NavigationPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "navigation";
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    return <PrimitivePropertyValueRendererImpl
      record={record}
      context={context}
      stringValueCalculator={convertRecordToString}
    />;
  }
}

function convertRecordToString(record: PropertyRecord) {
  const primitive = record.value as PrimitiveValue;
  if (primitive.displayValue)
    return primitive.displayValue;
  return TypeConverterManager.getConverter(record.property.typename, record.property.converter?.name).convertPropertyToString(record.property, primitive.value);
}
