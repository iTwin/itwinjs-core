/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { LinkElementsInfo, PropertyRecord, PropertyValueFormat, StandardTypeNames } from "@bentley/ui-abstract";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { convertPrimitiveRecordToString, PrimitivePropertyValueRendererImpl } from "./PrimitivePropertyValueRenderer";

/**
 * URL property value renderer that renders the whole value as a URL without matching it
 * against URL regex.
 *
 * @public
 */
export class UrlPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === StandardTypeNames.URL;
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    return <PrimitivePropertyValueRendererImpl
      record={record}
      context={context}
      stringValueCalculator={convertPrimitiveRecordToString}
      linksHandler={URI_PROPERTY_LINK_HANDLER}
    />;
  }
}

/**
 * Default URI onClick event, sets location.href to the whole URI value without matching it
 * against URL regex.
 */
function urlOnClick(text: string) {
  if (text.startsWith("mailto:") || text.startsWith("pw:"))
    location.href = text;
  else
    window.open(text, "_blank")!.focus();
}

const URI_PROPERTY_LINK_HANDLER: LinkElementsInfo = {
  onClick: urlOnClick,
};
