/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { LinkElementsInfo, PrimitiveValue, PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PrimitivePropertyValueRendererImpl } from "./PrimitivePropertyValueRenderer";
import { PropertyGridCommons } from "../../../propertygrid/component/PropertyGridCommons";

/** Default URI Property Renderer
 * @public
 */
export class URIPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "URI";
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    if (!record.links)
      record.links = URI_PROPERTY_LINK_HANDLER;

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

/**
 * A helper method to set all string to link.
 * @internal
 */
export const getFullLink = (value: string): Array<{ start: number, end: number }> => {
  return [{ start: 0, end: value.length }];
};

const URI_PROPERTY_LINK_HANDLER: LinkElementsInfo = {
  matcher: getFullLink,
  onClick: PropertyGridCommons.handleLinkClick,
};
