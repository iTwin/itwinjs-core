/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext, PropertyContainerType } from "../../ValueRendererManager";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue } from "@bentley/imodeljs-frontend";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";
import { withLinks } from "../../LinkHandler";

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
    if (context && context.containerType === PropertyContainerType.Tree)
      return withContextStyle(context.decoratedTextElement, context);

    const value = (record.value as PrimitiveValue).value;

    if (value === undefined)
      return withContextStyle("", context);

    const stringValue = TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, value);

    return withContextStyle(withLinks(record, stringValue), context);
  }
}
