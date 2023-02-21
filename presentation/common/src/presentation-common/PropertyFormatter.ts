/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert } from "@itwin/core-bentley";
import { Format, FormatProps, FormatterSpec, ParserSpec, UnitsProvider } from "@itwin/core-quantity";
import { Content } from "./content/Content";
import { Field, PropertiesField } from "./content/Fields";
import { DisplayValue, NestedContentValue, Value } from "./content/Value";
import { KindOfQuantityInfo, PropertyInfo } from "./EC";
import { ValuesDictionary } from "./Utils";

/** @alpha */
export interface FormatOptions {
  name: string;
  formatProps: FormatProps;
  persistenceUnitName: string;
}

/** @alpha */
export class PropertyFormatter {
  constructor(private _unitsProvider: UnitsProvider) { }

  public async format(value: number, options: FormatOptions) {
    const formatterSpec = await this.getFormatterSpec(options);
    return formatterSpec.applyFormatting(value);
  }

  public async getFormatterSpec(options: FormatOptions) {
    const { name, formatProps, persistenceUnitName } = options;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON(name, this._unitsProvider, formatProps);
    return FormatterSpec.create(name, format, this._unitsProvider, persistenceUnit);
  }

  public async getParserSpec(options: FormatOptions) {
    const { name, formatProps, persistenceUnitName } = options;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON(name, this._unitsProvider, formatProps);
    return ParserSpec.create(format, this._unitsProvider, persistenceUnit);
  }
}

/** @alpha */
export class ContentPropertyFormatter extends PropertyFormatter {
  public async formatContent(content: Content) {
    const descriptor = content.descriptor;
    for (const item of content.contentSet) {
      await this.formatValues(item.values, item.displayValues, descriptor.fields, item.mergedFieldNames);
    }
    return content;
  }

  private async formatValues(values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, fields: Field[], mergedFields: string[]) {
    for (const field of fields) {
      const value = values[field.name];
      if (field.isNestedContentField() && !mergedFields.includes(field.name)) {
        assert(Value.isNestedContent(value));
        await this.formatNestedContentDisplayValues(value, field.nestedFields);
        continue;
      }
      if (this.isFormattable(field) && typeof value === "number") {
        const koq = field.properties[0].property.kindOfQuantity;
        displayValues[field.name] = await this.format(value, { name: koq.name, persistenceUnitName: koq.persistenceUnit, formatProps: koq.activeFormat });
        continue;
      }
    }
  }

  private async formatNestedContentDisplayValues(nestedValues: NestedContentValue[], fields: Field[]) {
    for (const nestedValue of nestedValues) {
      await this.formatValues(nestedValue.values, nestedValue.displayValues, fields, nestedValue.mergedFieldNames);
    }
  }

  private isFormattable(field: Field): field is FormattableField {
    return field.isPropertiesField()
      && field.properties.length > 0
      && field.properties[0].property.kindOfQuantity !== undefined
      && field.properties[0].property.kindOfQuantity.activeFormat !== undefined;
  }
}

type FormattableField = PropertiesField & {
  properties: [{
    property: PropertyInfo & {
      kindOfQuantity: KindOfQuantityInfo & {
        activeFormat: FormatProps;
      };
    };
  }];
};
