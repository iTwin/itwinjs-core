/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue } from "@bentley/imodeljs-frontend";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";
import { LinksRenderer } from "../../LinkHandler";

/** Default Double Property Renderer
 * @public
 */
export class DoublePropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "double";
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const primitive = record.value as PrimitiveValue;

    let stringValue: string | Promise<string>;

    if (primitive.displayValue) {
      stringValue = primitive.displayValue;
    } else {
      stringValue = TypeConverterManager.getConverter(record.property.typename).convertPropertyToString(record.property, primitive.value);
    }

    return withContextStyle(
      <LinksRenderer
        value={stringValue}
        record={record}
        highlighter={context?.textHighlighter}
        defaultValue={context?.defaultValue} />,
      context,
    );
  }
}
