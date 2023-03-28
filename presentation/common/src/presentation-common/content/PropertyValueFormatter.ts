/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { assert } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { KindOfQuantityInfo, PropertyInfo } from "../EC";
import { KoqPropertyValueFormatter } from "../KoqPropertyValueFormatter";
import { ValuesDictionary } from "../Utils";
import { Content } from "./Content";
import { Field, PropertiesField } from "./Fields";
import { ArrayTypeDescription, PrimitiveTypeDescription, PropertyValueFormat, StructTypeDescription, TypeDescription } from "./TypeDescription";
import { DisplayValue, DisplayValuesMap, NestedContentValue, Value } from "./Value";

/** @alpha */
export function createContentFormatter(schemaContext: SchemaContext, unitSystem?: UnitSystemKey) {
  const koqPropertyFormatter = new KoqPropertyValueFormatter(schemaContext);
  const contentValueFormatter = new ContentPropertyValueFormatter(koqPropertyFormatter);
  return new ContentFormatter(contentValueFormatter, unitSystem);
}

/** @alpha */
export class ContentFormatter {
  constructor(private _propertyValueFormatter: ContentPropertyValueFormatter, private _unitSystem?: UnitSystemKey) { }

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

      // format display value of merged values
      if (mergedFields.includes(field.name)) {
        displayValues[field.name] = "@Presentation:label.varies@";
        continue;
      }

      // format display values of nested content field
      if (field.isNestedContentField()) {
        assert(Value.isNestedContent(value));
        await this.formatNestedContentDisplayValues(value, field.nestedFields);
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

}

/** @alpha */
export class ContentPropertyValueFormatter {
  constructor(private _koqValueFormatter: KoqPropertyValueFormatter) { }

  public async formatPropertyValue(field: Field, value: Value, unitSystem?: UnitSystemKey): Promise<DisplayValue> {
    if (isFieldWithKoq(field) && typeof value === "number") {
      const koq = field.properties[0].property.kindOfQuantity;
      const formattedValue = await this._koqValueFormatter.format(value, { koqName: koq.name, unitSystem });
      if (formattedValue !== undefined)
        return formattedValue;
    }

    return this.formatValue(field.type, value);
  }

  public formatValue(type: TypeDescription, value: Value): DisplayValue {
    switch (type.valueFormat) {
      case PropertyValueFormat.Primitive:
        return this.formatPrimitiveValue(type, value);
      case PropertyValueFormat.Array:
        return this.formatArrayValue(type, value);
      case PropertyValueFormat.Struct:
        return this.formatStructValue(type, value);
    }
  }

  public formatPrimitiveValue(type: PrimitiveTypeDescription, value: Value) {
    if (value === undefined)
      return "";

    if (type.typeName === "point2d" && isPoint2d(value)) {
      return `X: ${formatDouble(value.x)} Y: ${formatDouble(value.y)}`;
    }
    if (type.typeName === "point3d" && isPoint3d(value)) {
      return `X: ${formatDouble(value.x)} Y: ${formatDouble(value.y)} Z: ${formatDouble(value.z)}`;
    }
    if (type.typeName === "dateTime") {
      assert(typeof value === "string");
      return value;
    }
    if (type.typeName === "bool" || type.typeName === "boolean") {
      assert(typeof value === "boolean");
      return value ? "True" : "False";
    }
    if (type.typeName === "int" || type.typeName === "long") {
      assert(isNumber(value));
      return value.toFixed(0);
    }
    if (type.typeName === "double") {
      assert(isNumber(value));
      return formatDouble(value);
    }
    if (type.typeName === "navigation") {
      assert(Value.isNavigationValue(value));
      return value.label.displayValue;
    }

    return value.toString();
  }

  public formatStructValue(type: StructTypeDescription, value: Value) {
    if (!Value.isMap(value))
      return {};

    const formattedMember: DisplayValuesMap = {};
    for (const member of type.members) {
      formattedMember[member.name] = this.formatValue(member.type, value[member.name]);
    }
    return formattedMember;
  }

  public formatArrayValue(type: ArrayTypeDescription, value: Value) {
    if (!Value.isArray(value))
      return [];

    return value.map((arrayVal) => this.formatValue(type.memberType, arrayVal));
  }
}

function formatDouble(value: number) {
  return value.toFixed(2);
}

type FieldWithKoq = PropertiesField & {
  properties: [{
    property: PropertyInfo & {
      kindOfQuantity: KindOfQuantityInfo;
    };
  }];
};

function isFieldWithKoq(field: Field): field is FieldWithKoq {
  return field.isPropertiesField()
    && field.properties.length > 0
    && field.properties[0].property.kindOfQuantity !== undefined;
}

function isPoint2d(obj: Value): obj is { x: number, y: number } {
  return obj !== undefined && isNumber((obj as any).x) && isNumber((obj as any).y);
}

function isPoint3d(obj: Value): obj is { x: number, y: number, z: number } {
  return isPoint2d(obj) && isNumber((obj as any).z);
}

function isNumber(obj: Value): obj is number {
  return !isNaN(Number(obj));
}
