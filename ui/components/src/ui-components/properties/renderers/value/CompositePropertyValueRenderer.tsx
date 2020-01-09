/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue, Primitives } from "@bentley/imodeljs-frontend";
import { TypeConverterManager } from "../../../converters/TypeConverterManager";
import { withContextStyle } from "./WithContextStyle";
import { withLinks } from "../../LinkHandler";

/** Default Composite Property Renderer
 * @public
 */
export class CompositePropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return record.value.valueFormat === PropertyValueFormat.Primitive
      && record.property.typename === "composite";
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(record: PropertyRecord, context?: PropertyValueRendererContext) {
    const primitive = record.value as PrimitiveValue;
    const compositeValue = primitive.value as Primitives.Composite;

    const stringValue = this.createDisplayValue(compositeValue);

    return withContextStyle(withLinks(record, stringValue, context && context.textHighlighter), context);
  }

  private async createDisplayValue(compositeValue: Primitives.Composite): Promise<string> {
    const parts: string[] = [];
    for (const part of compositeValue.parts) {
      let valueString: string;
      if (part.typeName === "composite") {
        valueString = await this.createDisplayValue(part.rawValue as Primitives.Composite);
      } else {
        valueString = await TypeConverterManager.getConverter(part.typeName).convertToString(part.rawValue);
      }

      parts.push(valueString);
    }

    return parts.join(compositeValue.separator);
  }
}
