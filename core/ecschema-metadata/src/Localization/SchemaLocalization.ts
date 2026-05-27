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
  private _cache: Map<string, SchemaLocalizationJson | null> = new Map();

  /**
   * Constructs a SchemaLocalization instance.
   * @param provider The localization provider to use for loading localization files
   * @param locale The target locale (e.g., "de", "fr", "es-CO")
   */
  constructor(provider: ILocalizationProvider, locale: string) {
    this._provider = provider;
    this._locale = locale;
  }

  public get locale(): string {
    return this._locale;
  }

  public set locale(value: string) {
    if (this._locale !== value) {
      this._locale = value;
      this._cache.clear();
    }
  }

  /**
   * Get localization provider.
   */
  public get provider(): ILocalizationProvider {
    return this._provider;
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
   * Load and cache the localization JSON for a schema.
   * @param schema The schema to load localization for
   * @returns The localization JSON, or null if not found
   * @internal
   */
  private async getSchemaLocalizationJson(schema: Schema): Promise<SchemaLocalizationJson | null> {
    const cacheKey = `${schema.name}:${this._locale}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey) || null;
    }

    const localization = await this._provider.getLocalization(schema.name, this._locale);
    if (localization && localization.version) {
      const localizationMajor = this.getMajorVersion(localization.version);

      if (localizationMajor === undefined)
        throw new Error(`Schema localization major version is undefined.`);

      if (schema.schemaKey.readVersion !== localizationMajor)
        throw new Error(`Localization version mismatch for schema "${schema.name}". Schema major version is ${schema.schemaKey.readVersion.toString()}, but localization is for major version ${localizationMajor}.`);
    }

    this._cache.set(cacheKey, localization || null);
    return localization || null;
  }

  /**
   * Load the base locale localization if the current locale has a region (e.g., "es" from "es-CO").
   * @param schema The schema to load localization for
   * @returns The base localization JSON, or null if not found or not applicable
   * @internal
   */
  private async getBaseLocalizationJson(schema: Schema): Promise<SchemaLocalizationJson | null> {
    if (!this._locale.includes("-")) {
      return null;
    }

    const baseLocale = this._locale.split("-")[0];
    const cacheKey = `${schema.name}:${baseLocale}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey) || null;
    }

    const localization = await this._provider.getLocalization(schema.name, baseLocale);
    if (localization && localization.version) {
      const localizationMajor = this.getMajorVersion(localization.version);
      if (schema.schemaKey.readVersion !== localizationMajor) {
        throw new Error(`Localization version mismatch for schema "${schema.name}". Schema major version is ${schema.schemaKey.readVersion.toString()}, but localization is for major version ${localizationMajor}.`);
      }
    }

    this._cache.set(cacheKey, localization || null);
    return localization || null;
  }

  /**
   * Get localized label for a schema.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → schema name
   */
  public async getSchemaLabel(schema: Schema): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(schema);

    if (localization?.label) {
      return localization.label;
    }

    // Try base locale if specific locale didn't have the schema label
    const baseLocalization = await this.getBaseLocalizationJson(schema);
    if (baseLocalization?.label) {
      return baseLocalization.label;
    }

    return schema.label || schema.name;
  }

  /**
   * Get localized description for a schema.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public async getSchemaDescription(schema: Schema): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(schema);

    if (localization?.description) {
      return localization.description;
    }

    // Try base locale if specific locale didn't have the schema description
    const baseLocalization = await this.getBaseLocalizationJson(schema);
    if (baseLocalization?.description) {
      return baseLocalization.description;
    }

    return schema.description;
  }

  /**
   * Get localized label for a schema item
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → item name
   */
  public async getSchemaItemLabel(item: SchemaItem): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(item.schema);

    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.label) {
        return localizedText.label;
      }
    }

    // Try base locale if specific locale didn't have the item
    const baseLocalization = await this.getBaseLocalizationJson(item.schema);
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
  public async getSchemaItemDescription(item: SchemaItem): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(item.schema);

    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.description) {
        return localizedText.description;
      }
    }

    // Try base locale if specific locale didn't have the item
    const baseLocalization = await this.getBaseLocalizationJson(item.schema);
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
  public async getPropertyLabel(ecClass: ECClass, property: Property): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(ecClass.schema);

    const localizedLabel = localization?.classes?.[ecClass.name]?.properties?.[property.name]?.label;
    if (localizedLabel) {
      return localizedLabel;
    }

    // Try base locale if specific locale didn't have the property
    const baseLocalization = await this.getBaseLocalizationJson(ecClass.schema);
    const baseLocalizedLabel = baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.label;
    if (baseLocalizedLabel) {
      return baseLocalizedLabel;
    }

    return property.label || property.name;
  }

  /**
   * Get localized description for a property.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public async getPropertyDescription(ecClass: ECClass, property: Property): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(ecClass.schema);

    const localizedDescription = localization?.classes?.[ecClass.name]?.properties?.[property.name]?.description;
    if (localizedDescription) {
      return localizedDescription;
    }

    // Try base locale if specific locale didn't have the property
    const baseLocalization = await this.getBaseLocalizationJson(ecClass.schema);
    const baseLocalizedDescription = baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.description;
    if (baseLocalizedDescription) {
      return baseLocalizedDescription;
    }

    return property.description;
  }

  /**
   * Get localized label for an enumerator.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → enumerator name
   */
  public async getEnumeratorLabel(enumeration: Enumeration, enumeratorName: string): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(enumeration.schema);

    const localizedLabel = localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label;
    if (localizedLabel) {
      return localizedLabel;
    }

    // Try base locale if specific locale didn't have the enumerator
    const baseLocalization = await this.getBaseLocalizationJson(enumeration.schema);
    const baseLocalizedLabel = baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label;
    if (baseLocalizedLabel) {
      return baseLocalizedLabel;
    }

    // Find the enumerator in the enumeration
    const enumerator = enumeration.enumerators.find(e => e.name === enumeratorName);
    return enumerator?.label || enumeratorName;
  }

  /**
   * Get localized description for an enumerator.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public async getEnumeratorDescription(enumeration: Enumeration, enumeratorName: string): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(enumeration.schema);

    const localizedDescription = localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description;
    if (localizedDescription) {
      return localizedDescription;
    }

    // Try base locale if specific locale didn't have the enumerator
    const baseLocalization = await this.getBaseLocalizationJson(enumeration.schema);
    const baseLocalizedDescription = baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description;
    if (baseLocalizedDescription) {
      return baseLocalizedDescription;
    }

    // Find the enumerator in the enumeration
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

  /**
   * Clear the localization cache.
   */
  public clearCache(): void {
    this._cache.clear();
  }
}
