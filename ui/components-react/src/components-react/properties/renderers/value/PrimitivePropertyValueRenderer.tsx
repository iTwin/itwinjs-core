/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { LinkElementsInfo, PrimitiveValue, PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { useAsyncValue } from "../../../common/UseAsyncValue";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { PropertyGridCommons } from "../../../propertygrid/component/PropertyGridCommons";
import { LinksRenderer } from "../../LinkHandler";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";

/** Default Primitive Property Renderer
 * @public
 */
export class PrimitivePropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    return <PrimitivePropertyValueRendererImpl
      record={record}
      context={context}
      stringValueCalculator={convertPrimitiveRecordToString}
    />;
  }
}

/**
 * Function that converts primitive [[PropertyRecord]] to string
 * @internal
 */
export function convertPrimitiveRecordToString(record: PropertyRecord) {
  const primitive = record.value as PrimitiveValue;
  return TypeConverterManager.getConverter(record.property.typename, record.property.converter?.name).convertPropertyToString(record.property, primitive.value);
}

/** @internal */
interface PrimitivePropertyValueRendererImplProps {
  record: PropertyRecord;
  stringValueCalculator: (record: PropertyRecord) => string | Promise<string>;
  context?: PropertyValueRendererContext;
  linksHandler?: LinkElementsInfo;
}

/** @internal */
export function PrimitivePropertyValueRendererImpl(props: PrimitivePropertyValueRendererImplProps) {
  const { stringValue, element } = useRenderedStringValue(props.record, props.stringValueCalculator, props.context, props.linksHandler);
  return <span style={props.context?.style} title={stringValue}>{element}</span>;
}

/**
 * Default link handler used for handling records,
 * which did not have any specified LinkElementsInfo.
 *
 * Default matcher matches all URLs using regex.
 * Default onClick opens window or sets location.href with found URL.
 * @public
 */
export const DEFAULT_LINKS_HANDLER: LinkElementsInfo = {
  matcher: PropertyGridCommons.getLinks,
  onClick: PropertyGridCommons.handleLinkClick,
};

/** @internal */
export function useRenderedStringValue(
  record: PropertyRecord,
  stringValueCalculator: (record: PropertyRecord) => string | Promise<string>,
  context?: PropertyValueRendererContext,
  linksHandler?: LinkElementsInfo,
): { stringValue?: string, element: React.ReactNode } {
  const stringValue = useAsyncValue(stringValueCalculator(record));
  const el = (stringValue === undefined)
    ? context?.defaultValue
    : <LinksRenderer
      value={stringValue}
      links={record.links ?? linksHandler ?? DEFAULT_LINKS_HANDLER}
      highlighter={context?.textHighlighter}
    />;
  return { stringValue, element: el };
}
