/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expectDefined } from "@itwin/core-bentley";
import { ECSchemaNamespaceUris } from "../Constants";
import { SchemaContext } from "../Context";
import { SchemaItemProps, SchemaProps } from "../Deserialization/JsonProps";
import { parseSchemaItemType, SchemaItemType } from "../ECObjects";
import { CustomAttribute } from "../Metadata/CustomAttribute";
import { ClassParser, CustomAttributeClassParser, MixinParser, RelationshipClassParser } from "./ClassParsers";
import { KindOfQuantityParser, SchemaItemParser } from "./SchemaItemParsers";

function clean(_key: string, value: any) {
  return value === null ? undefined : value;
}

type MutableSchemaProps = {
  -readonly [K in keyof SchemaProps]: SchemaProps[K]
};

/**
 * Parses SchemaProps JSON returned from an ECSql query and returns the correct SchemaProps JSON object.
 * This is necessary as a small amount information (ie. CustomAttributes, unqualified type names, etc.)
 * returned from the iModelDb is in a different format than is required for a given Schema or
 * SchemaItemProps JSON object.
 * @internal
 */
export class SchemaParser {
  /**
   * Corrects the SchemaProps JSON returned from the query to a proper SchemaProps
   * JSON object.
   * @param schema The SchemaProps JSON object to parse.
   * @param context The SchemaContext that will contain the schema and it's references.
   * @returns The corrected SchemaProps JSON.
   */
  public static async parse(schema: SchemaProps, context: SchemaContext): Promise<SchemaProps> {
    const props = schema as MutableSchemaProps;
    props.$schema = ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      props.customAttributes = props.customAttributes ? props.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
    props.label = props.label === null ? undefined : props.label;
    props.description = props.description === null ? undefined : props.description;
    if (props.items) {
      props.items = await this.parseItems(props.items as any, props.name, context);
    }

    if (!props.customAttributes || props.customAttributes.length === 0)
      delete props.customAttributes;

    const cleaned = JSON.parse(JSON.stringify(props, clean)) as SchemaProps;
    return cleaned;
  }

  /**
   * Parse the given SchemaItemProps array, as returned from an ECSql query, and returns the corrected SchemaItemProps.
   * @param schemaItems The SchemaItemProps array returned from an iModelDb.
   * @param schemaName The name of the Schema to which the SchemaItemProps belong.
   * @param context The SchemaContext containing the Schema.
   * @returns The corrected SchemaItemProps.
   */
  public static async parseSchemaItems(schemaItems: readonly SchemaItemProps[], schemaName: string, context: SchemaContext): Promise<SchemaItemProps[] | undefined> {
    const items: SchemaItemProps[] = [];
    for (const item of schemaItems) {
      const props = await this.parseItem(item, schemaName, context);
      const cleaned = JSON.parse(JSON.stringify(props, clean));
      items.push(cleaned);
    }
    return items.length > 0 ? items : undefined;
  }

  private static async parseItems(schemaItemProps: readonly SchemaItemProps[], schemaName: string, context: SchemaContext): Promise<{ [name: string]: SchemaItemProps } | undefined> {
    const items: { [name: string]: SchemaItemProps } = {};
    for (const itemProps of schemaItemProps) {
      const props = await this.parseItem(itemProps, schemaName, context);
      items[expectDefined(props.name)] = props;
      delete (props as any).name;
    }

    return Object.keys(items).length > 0 ? items : undefined;
  }

  public static async parseItem(props: SchemaItemProps, schemaName: string, context: SchemaContext): Promise<SchemaItemProps> {
    const schemaItem = "string" === typeof (props) ? JSON.parse(props) : props;
    const type = parseSchemaItemType(schemaItem.schemaItemType);
    switch (type) {
      case SchemaItemType.KindOfQuantity:
        const koqParser = new KindOfQuantityParser(schemaName, context);
        return koqParser.parse(schemaItem);
      case SchemaItemType.EntityClass:
      case SchemaItemType.StructClass:
        const classParser = new ClassParser(schemaName, context);
        return classParser.parse(schemaItem);
      case SchemaItemType.RelationshipClass:
        const relationshipParser = new RelationshipClassParser(schemaName, context);
        return relationshipParser.parse(schemaItem);
      case SchemaItemType.Mixin:
        const mixinParser = new MixinParser(schemaName, context);
        return mixinParser.parse(schemaItem);
      case SchemaItemType.CustomAttributeClass:
        const caParser = new CustomAttributeClassParser(schemaName, context);
        return caParser.parse(schemaItem);
      default:
        const itemParser = new SchemaItemParser(schemaName, context);
        return itemParser.parse(schemaItem);
    }
  }
}

/**
 * Utility method to parse CustomAttribute data retrieved from a ECSql query.
 * @param customAttribute CustomAttribute data as retrieved from an iModel query.
 * @returns The CustomAttribute instance.
 * @internal
 */
export function parseCustomAttribute(customAttribute: { ecClass: string; ecSchema: string;[propName: string]: any; }): CustomAttribute {
  return {
    ...customAttribute[customAttribute.ecClass],
    className: `${(customAttribute.ecSchema).split('.')[0]}.${customAttribute.ecClass}`,
  }
}