/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ECSchemaNamespaceUris } from "../Constants";
import { SchemaItemProps, SchemaProps } from "../Deserialization/JsonProps";
import { parseSchemaItemType, SchemaItemType } from "../ECObjects";
import { SchemaInfo } from "../Interfaces";
import { CustomAttribute } from "../Metadata/CustomAttribute";
import { ClassParser, CustomAttributeClassParser, MixinParser, RelationshipClassParser } from "./ClassParsers";
import { KindOfQuantityParser, SchemaItemParser } from "./SchemaItemParsers";

function clean(_key: string, value: any) {
  return value === null ? undefined : value;
}

type MutableSchemaProps = {
  -readonly [K in keyof SchemaProps]: SchemaProps[K]
};

interface NamedSchemaItemProps extends SchemaItemProps {
  name: string;
  schemaItemType: SchemaItemType;
}

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
  public static async parse(schema: SchemaProps, schemaInfos: Iterable<SchemaInfo>): Promise<SchemaProps> {
    const props = schema as MutableSchemaProps;
    props.$schema = ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
    props.customAttributes = props.customAttributes ? props.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
    props.label = props.label === null ? undefined : props.label;
    props.description = props.description === null ? undefined : props.description;
    if (props.items) {
      props.items = await this.parseItems(props.items as any, props.name, schemaInfos);
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
  public static async parseSchemaItems(schemaItems: readonly SchemaItemProps[], schemaName: string, schemaInfos: Iterable<SchemaInfo>): Promise<NamedSchemaItemProps[] | undefined> {
    const items: NamedSchemaItemProps[] = [];
    for (const item of schemaItems) {
      const props = await this.parseItem(item, schemaName, schemaInfos);
      const cleaned = JSON.parse(JSON.stringify(props, clean));
      items.push(cleaned);
    }
    return items.length > 0 ? items : undefined;
  }

  private static async parseItems(schemaItemProps: readonly SchemaItemProps[], schemaName: string, schemaInfos: Iterable<SchemaInfo>): Promise<{ [name: string]: SchemaItemProps } | undefined> {
    const items: { [name: string]: SchemaItemProps } = {};
    for (const itemProps of schemaItemProps) {
      const props = await this.parseItem(itemProps, schemaName, schemaInfos);
      items[props.name] = props;
      delete (props as any).name;
    }

    return Object.keys(items).length > 0 ? items : undefined;
  }

  public static async parseItem(props: SchemaItemProps, schemaName: string, schemaInfos: Iterable<SchemaInfo>): Promise<NamedSchemaItemProps> {
    const schemaItem = "string" === typeof (props) ? JSON.parse(props) : props;
    const type = parseSchemaItemType(schemaItem.schemaItemType);
    switch (type) {
      case SchemaItemType.KindOfQuantity:
        const koqParser = new KindOfQuantityParser(schemaName, schemaInfos);
        return await koqParser.parse(schemaItem) as NamedSchemaItemProps;
      case SchemaItemType.EntityClass:
      case SchemaItemType.StructClass:
        const classParser = new ClassParser(schemaName, schemaInfos);
        return await classParser.parse(schemaItem) as NamedSchemaItemProps;
      case SchemaItemType.RelationshipClass:
        const relationshipParser = new RelationshipClassParser(schemaName, schemaInfos);
        return await relationshipParser.parse(schemaItem) as NamedSchemaItemProps;
      case SchemaItemType.Mixin:
        const mixinParser = new MixinParser(schemaName, schemaInfos);
        return await mixinParser.parse(schemaItem) as NamedSchemaItemProps;
      case SchemaItemType.CustomAttributeClass:
        const caParser = new CustomAttributeClassParser(schemaName, schemaInfos);
        return await caParser.parse(schemaItem) as NamedSchemaItemProps;
      default:
        const itemParser = new SchemaItemParser(schemaName, schemaInfos);
        return await itemParser.parse(schemaItem) as NamedSchemaItemProps;
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