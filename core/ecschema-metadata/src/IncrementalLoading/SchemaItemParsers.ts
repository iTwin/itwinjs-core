/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { SchemaContext } from "../Context";
import { AnySchemaItemProps, KindOfQuantityProps, SchemaItemProps } from "../Deserialization/JsonProps";
import { parseSchemaItemType } from "../ECObjects";
import { OverrideFormat, OverrideFormatProps } from "../Metadata/OverrideFormat";
import { SchemaItem } from "../Metadata/SchemaItem";
import { parseCustomAttribute } from "./SchemaParser";

type MutableSchemaItemProps = {
  -readonly [K in keyof SchemaItemProps]: SchemaItemProps[K]
};

/**
 * Parses SchemaItemProps JSON returned from an ECSql query and returns the correct SchemaItemProps JSON.
 * This is necessary as a small amount information (ie. CustomAttribute data) returned from the iModelDb
 * is in a different format than is required for a SchemaItemProps JSON object.
 * @internal
 */
export class SchemaItemParser {
  protected _schema: string;
  protected _context: SchemaContext;

  /**
   * Initializes a new SchemaItemParser.
   * @param schemaName The name the Schema containing the SchemaItems.
   * @param context The SchemaContext containing the Schema.
   */
  public constructor(schemaName: string, context: SchemaContext) {
    this._schema = schemaName;
    this._context = context;
  }

  /**
   * Parses the given SchemaItemProps JSON returned from an ECSql query.
   * @param data The SchemaItemProps JSON as returned from an iModelDb.
   * @returns The corrected SchemaItemProps Json.
   */
  public async parse(data: AnySchemaItemProps): Promise<SchemaItemProps> {
    const props = data as MutableSchemaItemProps;
    props.schemaItemType = parseSchemaItemType((data as any).schemaItemType);
    props.customAttributes = props.customAttributes ? props.customAttributes.map((attr: any) => { return parseCustomAttribute(attr); }) : undefined;
    if (!props.customAttributes || props.customAttributes.length === 0)
      delete props.customAttributes;

    return props;
  }

  /**
   * Helper method to resolve the SchemaItem's full name from the given rawTypeName.
   * If the SchemaItem is defined in the same Schema from which it is referenced,
   * the rawTypeName will be SchemaItem name ('PhysicalElement'). Otherwise,
   * the rawTypeName will have the schema alias ('bis:PhysicalElement').
   * @param rawTypeName The name or aliased name of the SchemaItem.
   * @returns The full name of the SchemaItem, ie. 'BisCore.PhysicalElement'
   */
  public async getQualifiedTypeName(rawTypeName: string): Promise<string> {
    const nameParts = rawTypeName.split(":");
    if (nameParts.length !== 2) {
      const [schemaName, itemName] = SchemaItem.parseFullName(rawTypeName);
      if (!schemaName || schemaName === '')
        return `${this._schema}.${itemName}`;
      return rawTypeName;
    }

    const resolvedName = await this.resolveNameFromAlias(nameParts[0].toLocaleLowerCase());
    if (!resolvedName)
      throw new Error(`No valid schema found for alias '${nameParts[0]}'`);

    return `${resolvedName}.${nameParts[1]}`;
  }

  private async resolveNameFromAlias(alias: string): Promise<string | undefined> {
    for (const schema of this._context.getKnownSchemas()) {
      if (schema.alias === alias)
        return schema.schemaKey.name;
    }
    return undefined;
  }
}

type MutableKindOfQuantityProps = {
  -readonly [K in keyof KindOfQuantityProps]: KindOfQuantityProps[K]
};

/**
 * Parses KindOfQuantityProps JSON returned from an ECSql query and returns the correct KindOfQuantityProps JSON.
 * This is necessary as a small amount information (ie. unqualified type names of presentationUnits) returned from
 * the iModelDb is in a different format than is required for a KindOfQuantityProps JSON object.
 * @internal
 */
export class KindOfQuantityParser extends SchemaItemParser {
  /**
   * Parses the given KindOfQuantityProps JSON returned from an ECSql query.
   * @param data The KindOfQuantityProps JSON as returned from an iModelDb.
   * @returns The corrected KindOfQuantityProps Json.
   */
  public override async parse(data: KindOfQuantityProps): Promise<KindOfQuantityProps> {
    const mutableProps = await super.parse(data) as MutableKindOfQuantityProps;

    if (mutableProps.persistenceUnit) {
      mutableProps.persistenceUnit = await this.getQualifiedTypeName(mutableProps.persistenceUnit);
    }
    mutableProps.presentationUnits = await this.parsePresentationUnits(mutableProps);

    return mutableProps;
  }

  private async parsePresentationUnits(props: KindOfQuantityProps): Promise<string[]> {
    const presentationUnits: string[] = [];
    if (!props.presentationUnits)
      return [];

    for (const presentationUnit of props.presentationUnits) {
      const presFormatOverride: OverrideFormatProps = OverrideFormat.parseFormatString(presentationUnit);
      const formatString = await this.createOverrideFormatString(presFormatOverride);
      presentationUnits.push(formatString);
    };

    return presentationUnits;
  }

  private async createOverrideFormatString(overrideFormatProps: OverrideFormatProps): Promise<string> {

    let formatFullName = await this.getQualifiedTypeName(overrideFormatProps.name);
    if (overrideFormatProps.precision)
      formatFullName += `(${overrideFormatProps.precision.toString()})`;

    if (undefined === overrideFormatProps.unitAndLabels)
      return formatFullName;

    for (const [unit, unitLabel] of overrideFormatProps.unitAndLabels) {
      const unitFullName = await this.getQualifiedTypeName(unit);

      if (undefined === unitLabel)
        formatFullName += `[${unitFullName}]`;
      else
        formatFullName += `[${unitFullName}|${unitLabel}]`;
    }
    return formatFullName;
  }
}