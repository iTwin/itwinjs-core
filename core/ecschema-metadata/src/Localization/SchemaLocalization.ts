/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "../Metadata/Schema";
import { ECClass } from "../Metadata/Class";
import { Property } from "../Metadata/Property";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Enumeration } from "../Metadata/Enumeration";
import { SchemaItemType } from "../ECObjects";
import { ILocalizationProvider } from "./LocalizationProvider";
import { LocalizedText, SchemaLocalizationJson } from "./LocalizationTypes";

/**
 * Manages schema localization to provide localized labels and descriptions
 *
 * @beta
 */
export class SchemaLocalization {
  private _provider: ILocalizationProvider;
  private _locale: string;
  private _cache: Map<string, SchemaLocalizationJson | undefined> = new Map();

  private constructor(provider: ILocalizationProvider, locale: string) {
    this._provider = provider;
    this._locale = locale;
  }

  /**
   * Create a SchemaLocalization instance and pre-load localization files for the given schemas.
   * @param provider The localization provider to use for loading localization files
   * @param locale The target locale (e.g., "de", "fr", "es-CO")
   * @param schemas The schemas whose localization should be pre-loaded
   */
  public static async create(provider: ILocalizationProvider, locale: string, schemas: Iterable<Schema>): Promise<SchemaLocalization> {
    const localization = new SchemaLocalization(provider, locale);
    await localization.loadLocalizations(schemas);
    return localization;
  }

  public get locale(): string {
    return this._locale;
  }

  /**
   * Get localization provider.
   */
  public get provider(): ILocalizationProvider {
    return this._provider;
  }

  /**
   * Load localizations for given schemas
   * @param schemas The schemas to load
   */
  public async loadLocalizations(schemas: Iterable<Schema>): Promise<void> {
    const baseLocale = this._locale.includes("-") ? this._locale.split("-")[0] : undefined;
    const promises: Promise<void>[] = [];
    for (const schema of schemas) {
      promises.push(this.loadLocalizationInfo(schema, this._locale));
      if (baseLocale !== undefined) {
        promises.push(this.loadLocalizationInfo(schema, baseLocale));
      }
    }
    await Promise.all(promises);
  }

  /**
   * Load the localization JSON for a schema and locale
   */
  private async loadLocalizationInfo(schema: Schema, locale: string): Promise<void> {
    const cacheKey = `${schema.name}:${locale}`;
    if (this._cache.has(cacheKey))
      return;

    const localization = await this._provider.getLocalization(schema.name, locale);
    if (localization && localization.version) {
      const localizationMajor = this.getMajorVersion(localization.version);

      if (localizationMajor === undefined || schema.schemaKey.readVersion !== localizationMajor) {
        // eslint-disable-next-line no-console
        console.warn(`Localization version mismatch for schema "${schema.name}". Schema major version is ${schema.schemaKey.readVersion.toString()}, but localization is for major version ${localizationMajor?.toString() ?? "undefined"}.`);
        this._cache.set(cacheKey, undefined);
        return;
      }
    }

    this._cache.set(cacheKey, localization);
  }

  /**
   * Provide major version of localized schema
   * @param version The version string.
   * @returns Major version number, or undefined
   */
  private getMajorVersion(version: string): number | undefined {
    const rawVersion = version.split(".");
    if (rawVersion.length > 0) {
      const majorVersion = parseInt(rawVersion[0], 10);
      return isNaN(majorVersion) ? undefined : majorVersion;
    }

    return undefined;
  }

  /**
   * Get the cached localization JSON for a schema at the current locale.
   * @returns The cached entry for the current locale
   */
  private getSchemaLocalizationJson(schema: Schema): SchemaLocalizationJson | undefined {
    return this._cache.get(`${schema.name}:${this._locale}`);
  }

  /**
   * Get the cached localization JSON for a schema at the base locale (e.g., "es" from "es-CO").
   * @returns The cached entry for base locale, or undefined
   */
  private getBaseLocalizationJson(schema: Schema): SchemaLocalizationJson | undefined {
    if (!this._locale.includes("-"))
      return undefined;

    const baseLocale = this._locale.split("-")[0];
    return this._cache.get(`${schema.name}:${baseLocale}`);
  }

  /**
   * Get localized label for a schema.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → schema name
   */
  public getSchemaLabel(schema: Schema): string {
    const localization = this.getSchemaLocalizationJson(schema);
    if (localization?.label)
      return localization.label;

    const baseLocalization = this.getBaseLocalizationJson(schema);
    if (baseLocalization?.label)
      return baseLocalization.label;

    return schema.label || schema.name;
  }

  /**
   * Get localized description for a schema.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public getSchemaDescription(schema: Schema): string | undefined {
    const localization = this.getSchemaLocalizationJson(schema);
    if (localization?.description)
      return localization.description;

    const baseLocalization = this.getBaseLocalizationJson(schema);
    if (baseLocalization?.description)
      return baseLocalization.description;

    return schema.description;
  }

  /**
   * Get localized label for a schema item
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → item name
   */
  public getSchemaItemLabel(item: SchemaItem): string {
    const localization = this.getSchemaLocalizationJson(item.schema);
    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.label) {
        return localizedText.label;
      }
    }

    const baseLocalization = this.getBaseLocalizationJson(item.schema);
    if (baseLocalization) {
      const localizedText = this.findItemLocalization(baseLocalization, item);
      if (localizedText?.label) {
        return localizedText.label;
      }
    }

    return item.label || item.name;
  }

  /**
   * Get localized description for a schema item.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public getSchemaItemDescription(item: SchemaItem): string | undefined {
    const localization = this.getSchemaLocalizationJson(item.schema);
    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.description) {
        return localizedText.description;
      }
    }

    const baseLocalization = this.getBaseLocalizationJson(item.schema);
    if (baseLocalization) {
      const localizedText = this.findItemLocalization(baseLocalization, item);
      if (localizedText?.description) {
        return localizedText.description;
      }
    }

    return item.description;
  }

  /**
   * Get localized label for a property.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → property name
   */
  public getPropertyLabel(ecClass: ECClass, property: Property): string {
    const localization = this.getSchemaLocalizationJson(ecClass.schema);
    const localizedLabel = localization?.classes?.[ecClass.name]?.properties?.[property.name]?.label;

    if (localizedLabel)
      return localizedLabel;

    const baseLocalization = this.getBaseLocalizationJson(ecClass.schema);
    const baseLocalizedLabel = baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.label;

    if (baseLocalizedLabel)
      return baseLocalizedLabel;

    return property.label || property.name;
  }

  /**
   * Get localized description for a property.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public getPropertyDescription(ecClass: ECClass, property: Property): string | undefined {
    const localization = this.getSchemaLocalizationJson(ecClass.schema);
    const localizedDescription = localization?.classes?.[ecClass.name]?.properties?.[property.name]?.description;

    if (localizedDescription)
      return localizedDescription;

    const baseLocalization = this.getBaseLocalizationJson(ecClass.schema);
    const baseLocalizedDescription = baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.description;

    if (baseLocalizedDescription)
      return baseLocalizedDescription;

    return property.description;
  }

  /**
   * Get localized label for an enumerator.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → enumerator name
   */
  public getEnumeratorLabel(enumeration: Enumeration, enumeratorName: string): string {
    const localization = this.getSchemaLocalizationJson(enumeration.schema);
    const localizedLabel = localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label;

    if (localizedLabel)
      return localizedLabel;

    const baseLocalization = this.getBaseLocalizationJson(enumeration.schema);
    const baseLocalizedLabel = baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label;

    if (baseLocalizedLabel)
      return baseLocalizedLabel;


    const enumerator = enumeration.enumerators.find(e => e.name === enumeratorName);
    return enumerator?.label || enumeratorName;
  }

  /**
   * Get localized description for an enumerator.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public getEnumeratorDescription(enumeration: Enumeration, enumeratorName: string): string | undefined {
    const localization = this.getSchemaLocalizationJson(enumeration.schema);
    const localizedDescription = localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description;

    if (localizedDescription)
      return localizedDescription;

    const baseLocalization = this.getBaseLocalizationJson(enumeration.schema);
    const baseLocalizedDescription = baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description;

    if (baseLocalizedDescription)
      return baseLocalizedDescription;


    const enumerator = enumeration.enumerators.find(e => e.name === enumeratorName);
    return enumerator?.description;
  }

  /**
   * Find the localized text for a schema item.
   * @internal
   */
  private findItemLocalization(localization: SchemaLocalizationJson, item: SchemaItem): LocalizedText | undefined {
    const itemName = item.name;

    switch (item.schemaItemType) {
      case SchemaItemType.EntityClass:
      case SchemaItemType.StructClass:
      case SchemaItemType.CustomAttributeClass:
      case SchemaItemType.RelationshipClass:
      case SchemaItemType.Mixin:
        return localization.classes?.[itemName];

      case SchemaItemType.Enumeration:
        return localization.enumerations?.[itemName];

      case SchemaItemType.Unit:
        return localization.units?.[itemName];

      case SchemaItemType.InvertedUnit:
        return localization.invertedUnits?.[itemName];

      case SchemaItemType.Phenomenon:
        return localization.phenomena?.[itemName];

      case SchemaItemType.UnitSystem:
        return localization.unitSystems?.[itemName];

      case SchemaItemType.PropertyCategory:
        return localization.propertyCategories?.[itemName];

      case SchemaItemType.Format:
        return localization.formats?.[itemName];

      case SchemaItemType.KindOfQuantity:
        return localization.kindOfQuantities?.[itemName];

      case SchemaItemType.Constant:
        return localization.constants?.[itemName];

      default:
        // eslint-disable-next-line no-console
        console.warn(`Localization not supported for schema item type: ${String(item.schemaItemType)}`);
        return undefined;
    }
  }
}
