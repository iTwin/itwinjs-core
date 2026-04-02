/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "../Metadata/Schema";
import { ECClass } from "../Metadata/Class";
import { Property } from "../Metadata/Property";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Enumeration } from "../Metadata/Enumeration";
import { ILocalizationProvider } from "./LocalizationProvider";
import { SchemaLocalizationJson, LocalizedText } from "./LocalizationTypes";

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

  /**
   * Get the current locale.
   */
  public get locale(): string {
    return this._locale;
  }

  /**
   * Set a new locale.
   */
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
   * Load and cache the localization JSON for a schema.
   * @param schemaName The name of the schema
   * @returns The localization JSON, or null if not found
   * @internal
   */
  private async getSchemaLocalizationJson(schemaName: string): Promise<SchemaLocalizationJson | null> {
    const cacheKey = `${schemaName}:${this._locale}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey) || null;
    }

    const localization = await this._provider.getLocalization(schemaName, this._locale);
    this._cache.set(cacheKey, localization || null);
    return localization || null;
  }

  /**
   * Load the base locale localization if the current locale has a region (e.g., "es" from "es-CO").
   * @param schemaName The name of the schema
   * @returns The base localization JSON, or null if not found or not applicable
   * @internal
   */
  private async getBaseLocalizationJson(schemaName: string): Promise<SchemaLocalizationJson | null> {
    if (!this._locale.includes("-")) {
      return null;
    }

    const baseLocale = this._locale.split("-")[0];
    const cacheKey = `${schemaName}:${baseLocale}`;

    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey) || null;
    }

    const localization = await this._provider.getLocalization(schemaName, baseLocale);
    this._cache.set(cacheKey, localization || null);
    return localization || null;
  }

  /**
   * Get localized label for a schema.
   * Fallback: localized label → original label → schema name
   */
  public async getSchemaLabel(schema: Schema): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(schema.name);

    if (localization?.label) {
      return localization.label;
    }

    return schema.label || schema.name;
  }

  /**
   * Get localized description for a schema.
   * Fallback: localized description → original description
   */
  public async getSchemaDescription(schema: Schema): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(schema.name);

    if (localization?.description) {
      return localization.description;
    }

    return schema.description;
  }

  /**
   * Get localized label for a schema item
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → item name
   */
  public async getSchemaItemLabel(item: SchemaItem): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(item.schema.name);

    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.label) {
        return localizedText.label;
      }
    }

    // Try base locale if specific locale didn't have the item
    const baseLocalization = await this.getBaseLocalizationJson(item.schema.name);
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
    const localization = await this.getSchemaLocalizationJson(item.schema.name);

    if (localization) {
      const localizedText = this.findItemLocalization(localization, item);
      if (localizedText?.description) {
        return localizedText.description;
      }
    }

    // Try base locale if specific locale didn't have the item
    const baseLocalization = await this.getBaseLocalizationJson(item.schema.name);
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
    const localization = await this.getSchemaLocalizationJson(ecClass.schema.name);

    if (localization?.classes?.[ecClass.name]?.properties?.[property.name]?.label) {
      return localization.classes[ecClass.name].properties![property.name].label!;
    }

    // Try base locale if specific locale didn't have the property
    const baseLocalization = await this.getBaseLocalizationJson(ecClass.schema.name);
    if (baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.label) {
      return baseLocalization.classes[ecClass.name].properties![property.name].label!;
    }

    return property.label || property.name;
  }

  /**
   * Get localized description for a property.
   * Fallback: localized description (specific locale) → localized description (base locale) → original description
   */
  public async getPropertyDescription(ecClass: ECClass, property: Property): Promise<string | undefined> {
    const localization = await this.getSchemaLocalizationJson(ecClass.schema.name);

    if (localization?.classes?.[ecClass.name]?.properties?.[property.name]?.description) {
      return localization.classes[ecClass.name].properties![property.name].description!;
    }

    // Try base locale if specific locale didn't have the property
    const baseLocalization = await this.getBaseLocalizationJson(ecClass.schema.name);
    if (baseLocalization?.classes?.[ecClass.name]?.properties?.[property.name]?.description) {
      return baseLocalization.classes[ecClass.name].properties![property.name].description!;
    }

    return property.description;
  }

  /**
   * Get localized label for an enumerator.
   * Fallback: localized label (specific locale) → localized label (base locale) → original label → enumerator name
   */
  public async getEnumeratorLabel(enumeration: Enumeration, enumeratorName: string): Promise<string> {
    const localization = await this.getSchemaLocalizationJson(enumeration.schema.name);

    if (localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label) {
      return localization.enumerations[enumeration.name].enumerators![enumeratorName].label!;
    }

    // Try base locale if specific locale didn't have the enumerator
    const baseLocalization = await this.getBaseLocalizationJson(enumeration.schema.name);
    if (baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.label) {
      return baseLocalization.enumerations[enumeration.name].enumerators![enumeratorName].label!;
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
    const localization = await this.getSchemaLocalizationJson(enumeration.schema.name);

    if (localization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description) {
      return localization.enumerations[enumeration.name].enumerators![enumeratorName].description!;
    }

    // Try base locale if specific locale didn't have the enumerator
    const baseLocalization = await this.getBaseLocalizationJson(enumeration.schema.name);
    if (baseLocalization?.enumerations?.[enumeration.name]?.enumerators?.[enumeratorName]?.description) {
      return baseLocalization.enumerations[enumeration.name].enumerators![enumeratorName].description!;
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

    if (item.schemaItemType === "EntityClass" ||
      item.schemaItemType === "StructClass" ||
      item.schemaItemType === "CustomAttributeClass" ||
      item.schemaItemType === "RelationshipClass" ||
      item.schemaItemType === "Mixin") {
      return localization.classes?.[itemName];
    }

    if (item.schemaItemType === "Enumeration") {
      return localization.enumerations?.[itemName];
    }

    if (item.schemaItemType === "Unit") {
      return localization.units?.[itemName];
    }

    if (item.schemaItemType === "Phenomenon") {
      return localization.phenomena?.[itemName];
    }

    if (item.schemaItemType === "UnitSystem") {
      return localization.unitSystems?.[itemName];
    }

    if (item.schemaItemType === "PropertyCategory") {
      return localization.propertyCategories?.[itemName];
    }

    if (item.schemaItemType === "Format") {
      return localization.formats?.[itemName];
    }

    if (item.schemaItemType === "KindOfQuantity") {
      return localization.kindOfQuantities?.[itemName];
    }

    if (item.schemaItemType === "Constant") {
      return localization.constants?.[itemName];
    }

    return undefined;
  }

  /**
   * Clear the localization cache.
   */
  public clearCache(): void {
    this._cache.clear();
  }
}
