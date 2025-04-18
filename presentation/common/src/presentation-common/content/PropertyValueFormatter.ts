/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { assert } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { KindOfQuantityInfo, PropertyInfo } from "../EC.js";
import { KoqPropertyValueFormatter } from "../KoqPropertyValueFormatter.js";
import { ValuesDictionary } from "../Utils.js";
import { Content } from "./Content.js";
import { Descriptor } from "./Descriptor.js";
import { ArrayPropertiesField, Field, PropertiesField, StructPropertiesField } from "./Fields.js";
import { Item } from "./Item.js";
import { DisplayValue, DisplayValuesMap, NestedContentValue, Value, ValuesArray, ValuesMap } from "./Value.js";

/** @internal */
export class ContentFormatter {
  constructor(
    private _propertyValueFormatter: { formatPropertyValue: (field: Field, value: Value, unitSystem?: UnitSystemKey) => Promise<DisplayValue> },
    private _unitSystem?: UnitSystemKey,
  ) {}

  public async formatContent(content: Content) {
    const formattedItems = await this.formatContentItems(content.contentSet, content.descriptor);
    return new Content(content.descriptor, formattedItems);
  }

  public async formatContentItems(items: Item[], descriptor: Descriptor) {
    return Promise.all(
      items.map(async (item) => {
        await this.formatValues(item.values, item.displayValues, descriptor.fields, item.mergedFieldNames);
        return item;
      }),
    );
  }

  private async formatValues(values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, fields: Field[], mergedFields: string[]) {
    for (const field of fields) {
      const value = values[field.name];

      // format display value of merged values
      if (mergedFields.includes(field.name)) {
        displayValues[field.name] = "@Presentation:label.varies@";
        continue;
      }

      // do not add undefined value to display values
      if (value === undefined) {
        continue;
      }

      // format display values of nested content field
      if (field.isNestedContentField()) {
        assert(Value.isNestedContent(value));
        await this.formatNestedContentDisplayValues(value, field.nestedFields);
        continue;
      }

      // format property items
      if (field.isPropertiesField()) {
        displayValues[field.name] = await this.formatPropertyValue(value, field);
        continue;
      }

      displayValues[field.name] = await this._propertyValueFormatter.formatPropertyValue(field, value, this._unitSystem);
    }
  }

  private async formatNestedContentDisplayValues(nestedValues: NestedContentValue[], fields: Field[]) {
    for (const nestedValue of nestedValues) {
      await this.formatValues(nestedValue.values, nestedValue.displayValues, fields, nestedValue.mergedFieldNames);
    }
  }

  private async formatPropertyValue(value: Value, field: PropertiesField): Promise<DisplayValue> {
    if (field.isArrayPropertiesField()) {
      assert(Value.isArray(value));
      return this.formatArrayItems(value, field);
    }
    if (field.isStructPropertiesField()) {
      assert(Value.isMap(value));
      return this.formatStructMembers(value, field);
    }
    return this._propertyValueFormatter.formatPropertyValue(field, value, this._unitSystem);
  }

  private async formatArrayItems(itemValues: ValuesArray, field: ArrayPropertiesField) {
    return Promise.all(itemValues.map(async (value) => this.formatPropertyValue(value, field.itemsField)));
  }

  private async formatStructMembers(memberValues: ValuesMap, field: StructPropertiesField) {
    const displayValues: DisplayValuesMap = {};
    await Promise.all(
      field.memberFields.map(async (memberField) => {
        displayValues[memberField.name] = await this.formatPropertyValue(memberValues[memberField.name], memberField);
      }),
    );
    return displayValues;
  }
}

/** @internal */
export class ContentPropertyValueFormatter {
  constructor(private _koqValueFormatter: KoqPropertyValueFormatter) {}

  public async formatPropertyValue(field: Field, value: Value, unitSystem?: UnitSystemKey): Promise<DisplayValue> {
    const doubleFormatter = isFieldWithKoq(field)
      ? async (rawValue: number) => {
          const koq = field.properties[0].property.kindOfQuantity;
          const formattedValue = await this._koqValueFormatter.format(rawValue, { koqName: koq.name, unitSystem });
          if (formattedValue !== undefined) {
            return formattedValue;
          }
          return formatDouble(rawValue);
        }
      : async (rawValue: number) => formatDouble(rawValue);

    return this.formatValue(field, value, { doubleFormatter });
  }

  private async formatValue(field: Field, value: Value, ctx?: { doubleFormatter: (raw: number) => Promise<string> }): Promise<DisplayValue> {
    if (field.isPropertiesField()) {
      if (field.isArrayPropertiesField()) {
        return this.formatArrayValue(field, value);
      }

      if (field.isStructPropertiesField()) {
        return this.formatStructValue(field, value);
      }
    }

    return this.formatPrimitiveValue(field, value, ctx);
  }

  private async formatPrimitiveValue(field: Field, value: Value, ctx?: { doubleFormatter: (raw: number) => Promise<string> }) {
    if (value === undefined) {
      return "";
    }

    const formatDoubleValue = async (raw: number) => (ctx ? ctx.doubleFormatter(raw) : formatDouble(raw));

    if (field.type.typeName === "point2d" && isPoint2d(value)) {
      return `X: ${await formatDoubleValue(value.x)}; Y: ${await formatDoubleValue(value.y)}`;
    }
    if (field.type.typeName === "point3d" && isPoint3d(value)) {
      return `X: ${await formatDoubleValue(value.x)}; Y: ${await formatDoubleValue(value.y)}; Z: ${await formatDoubleValue(value.z)}`;
    }
    if (field.type.typeName === "dateTime") {
      assert(typeof value === "string");
      return value;
    }
    if (field.type.typeName === "bool" || field.type.typeName === "boolean") {
      assert(typeof value === "boolean");
      return value ? "@Presentation:value.true@" : "@Presentation:value.false@";
    }
    if (field.type.typeName === "int" || field.type.typeName === "long") {
      assert(isNumber(value));
      return value.toFixed(0);
    }
    if (field.type.typeName === "double") {
      assert(isNumber(value));
      return formatDoubleValue(value);
    }
    if (field.type.typeName === "navigation") {
      assert(Value.isNavigationValue(value));
      return value.label.displayValue;
    }

    if (field.type.typeName === "enum" && field.isPropertiesField()) {
      const defaultValue = !field.properties[0].property.enumerationInfo?.isStrict
        ? value.toString() // eslint-disable-line @typescript-eslint/no-base-to-string
        : undefined;

      return field.properties[0].property.enumerationInfo?.choices.find(({ value: enumValue }) => enumValue === value)?.label ?? defaultValue;
    }
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return value.toString();
  }

  private async formatStructValue(field: StructPropertiesField, value: Value) {
    if (!Value.isMap(value)) {
      return {};
    }

    const formattedMember: DisplayValuesMap = {};
    for (const member of field.memberFields) {
      formattedMember[member.name] = await this.formatValue(member, value[member.name]);
    }
    return formattedMember;
  }

  private async formatArrayValue(field: ArrayPropertiesField, value: Value) {
    if (!Value.isArray(value)) {
      return [];
    }

    return Promise.all(
      value.map(async (arrayVal) => {
        return this.formatValue(field.itemsField, arrayVal);
      }),
    );
  }
}

function formatDouble(value: number) {
  return value.toFixed(2);
}

type FieldWithKoq = PropertiesField & {
  properties: [
    {
      property: PropertyInfo & {
        kindOfQuantity: KindOfQuantityInfo;
      };
    },
  ];
};

function isFieldWithKoq(field: Field): field is FieldWithKoq {
  return field.isPropertiesField() && field.properties.length > 0 && field.properties[0].property.kindOfQuantity !== undefined;
}

function isPoint2d(obj: Value): obj is { x: number; y: number } {
  return obj !== undefined && isNumber((obj as any).x) && isNumber((obj as any).y);
}

function isPoint3d(obj: Value): obj is { x: number; y: number; z: number } {
  return isPoint2d(obj) && isNumber((obj as any).z);
}

function isNumber(obj: Value): obj is number {
  return !isNaN(Number(obj));
}
