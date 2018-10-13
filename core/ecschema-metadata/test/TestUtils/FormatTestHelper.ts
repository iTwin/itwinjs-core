/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import SchemaContext, { ISchemaLocater } from "../../src/Context";
import { SchemaMatchType } from "./../../src/ECObjects";
import SchemaKey from "../../src/SchemaKey";
import Schema from "../../src/Metadata/Schema";

const formatsKey = new SchemaKey("Formats", 1, 0, 0);

export class TestSchemaLocater implements ISchemaLocater {
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined> {
    if (!schemaKey.matches(formatsKey, matchType))
      return undefined;

    return (await Schema.fromJson(testFormatSchema, context)) as T;
  }

  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): T | undefined {
    if (!schemaKey.matches(formatsKey, matchType))
      return undefined;

    return Schema.fromJsonSync(testFormatSchema, context) as T;
  }
}

const testFormatSchema = {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
  name: "Formats",
  version: "1.0.0",
  items: {
    Length: {
      schemaItemType: "Phenomenon",
      definition: "LENGTH(1)",
    },
    USCustom: {
      schemaItemType: "UnitSystem",
    },
    MILE: {
      schemaItemType: "Unit",
      label: "mile",
      phenomenon: "Formats.Length",
      unitSystem: "Formats.USCustom",
      definition: "YRD",
      numerator: 1760.0,
    },
    YRD: {
      schemaItemType: "Unit",
      label: "yard",
      phenomenon: "Formats.Length",
      unitSystem: "Formats.USCustom",
      definition: "FT",
      numerator: 3.0,
    },
    FT: {
      schemaItemType: "Unit",
      label: "foot",
      phenomenon: "Formats.Length",
      unitSystem: "Formats.USCustom",
      definition: "IN",
      numerator: 12.0,
    },
    IN: {
      schemaItemType: "Unit",
      label: "inch",
      phenomenon: "Formats.Length",
      unitSystem: "Formats.USCustom",
      definition: "MM",
      numerator: 25.4,
    },
    MILLIINCH: {
      schemaItemType: "Unit",
      label: "mil",
      phenomenon: "Formats.Length",
      unitSystem: "Formats.USCustom",
      definition: "[MILLI]*IN",
    },
    DefaultReal: {
      schemaItemType: "Format",
      type: "decimal",
      precision: 6,
    },
    SingleUnitFormat: {
      schemaItemType: "Format",
      type: "decimal",
      precision: 6,
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
        ],
      },
    },
    DoubleUnitFormat: {
      schemaItemType: "Format",
      type: "decimal",
      precision: 6,
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
          {
            name: "Formats.FT",
            label: "feet",
          },
        ],
      },
    },
    TripleUnitFormat: {
      schemaItemType: "Format",
      type: "decimal",
      precision: 6,
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
          {
            name: "Formats.FT",
            label: "feet",
          },
          {
            name: "Formats.IN",
            label: "inch(es)",
          },
        ],
      },
    },
    QuadUnitFormat: {
      schemaItemType: "Format",
      type: "decimal",
      precision: 6,
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.MILE",
            label: "mile(s)",
          },
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
          {
            name: "Formats.FT",
            label: "feet",
          },
          {
            name: "Formats.IN",
            label: "inch(es)",
          },
        ],
      },
    },
  },
};
