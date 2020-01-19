/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
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
    if (context && context.decoratedTextElement)
      return withContextStyle(context.decoratedTextElement, context);

    const primitiveValue = (record.value as PrimitiveValue);
    if (primitiveValue.value === undefined)
      return withContextStyle(primitiveValue.displayValue || "", context);

    const stringValue = TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, primitiveValue.value);

    return withContextStyle(withLinks(record, stringValue, context && context.textHighlighter), context);
  }
}
