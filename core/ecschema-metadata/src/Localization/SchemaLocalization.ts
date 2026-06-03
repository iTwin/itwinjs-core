/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaKey } from "../SchemaKey";
import { SchemaView } from "../SchemaView";
import { Schema } from "../Metadata/Schema";
import { ECClass } from "../Metadata/Class";
import { Logger } from "@itwin/core-bentley";
import { Property } from "../Metadata/Property";
import { SchemaItem } from "../Metadata/SchemaItem";
import { ILocalizationProvider } from "./LocalizationProvider";
import { AnyEnumerator, Enumeration } from "../Metadata/Enumeration";
import { LocalizedText, SchemaLocalizationJson } from "./LocalizationTypes";

const loggerCategory = "SchemaLocalization";

type SchemaViewItem = SchemaView.Class | SchemaView.Enumeration | SchemaView.KindOfQuantity | SchemaView.PropertyCategory;

/**
 * Manages schema localization to provide localized labels and descriptions.
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

  private get _baseLocale(): string | undefined {
    return this._locale.includes("-") ? this._locale.split("-")[0] : undefined;
  }

  private cacheKey(schemaName: string, locale: string): string {
    return `${schemaName}:${locale}`;
  }

  /**
   * Create a SchemaLocalization instance and pre-load localization files for the given schemas.
   * @param provider The localization provider to use for loading localization files
   * @param locale The target locale (e.g., "de", "fr", "es-CO")
   * @param schemas The schemas whose localization should be pre-loaded
   */
  public static async create(provider: ILocalizationProvider, locale: string, schemaKeys: Iterable<SchemaKey>): Promise<SchemaLocalization> {
    const localization = new SchemaLocalization(provider, locale);
    await localization.loadLocalizations(schemaKeys);
    return localization;
  }

  public get locale(): string {
    return this._locale;
  }

  public setLocale(locale: string): void {
    this._locale = locale;
    this._cache.clear();
  }

  /**
   * Get localization provider.
   */
  public get provider(): ILocalizationProvider {
    return this._provider;
  }

  /**
   * Load localizations for the given schema keys.
   * @param schemaKeys The schema keys to load localization for
   */
  public async loadLocalizations(schemaKeys: Iterable<SchemaKey>): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const key of schemaKeys) {
      promises.push(this.loadLocalizationInfo(key.name, key.readVersion, this._locale));
      if (this._baseLocale !== undefined)
        promises.push(this.loadLocalizationInfo(key.name, key.readVersion, this._baseLocale));
    }
    await Promise.all(promises);
  }

  /**
   * Get a localized label for a schema, schema item, or member.
   */
  public getLabel(schemaName: string, itemName?: string, memberName?: string): string | undefined {
    const localization = this.getCachedLocalization(schemaName, this._locale);
    const label = this.resolveLabel(localization, itemName, memberName);
    if (label)
      return label;

    if (this._baseLocale) {
      const baseLocalization = this.getCachedLocalization(schemaName, this._baseLocale);
      return this.resolveLabel(baseLocalization, itemName, memberName);
    }

    return undefined;
  }

  /**
   * Get a localized description for a schema, schema item, or member.
   */
  public getDescription(schemaName: string, itemName?: string, memberName?: string): string | undefined {
    const localization = this.getCachedLocalization(schemaName, this._locale);
    const description = this.resolveDescription(localization, itemName, memberName);
    if (description)
      return description;

    if (this._baseLocale) {
      const baseLocalization = this.getCachedLocalization(schemaName, this._baseLocale);
      return this.resolveDescription(baseLocalization, itemName, memberName);
    }

    return undefined;
  }

  /**
   * Get localized label and description of a schema.
   * Label fallback: localized label → base locale label → original label → schema name
   * Description fallback: localized description → base locale description → original description
   */
  public getLocalizedSchema(schema: Schema | SchemaView.Schema): LocalizedText {
    const label = this.getLabel(schema.name) ?? (schema.label || schema.name);
    const description = this.getDescription(schema.name) ?? schema.description;
    return { label, description };
  }

  /**
   * Get localized label and description of a schema item (class, enumeration, unit, etc.).
   * Label fallback: localized label → base locale label → original label → item name
   * Description fallback: localized description → base locale description → original description
   */
  public getLocalizedSchemaItem(item: SchemaItem | SchemaViewItem): LocalizedText {
    const label = this.getLabel(item.schema.name, item.name) ?? (item.label || item.name);
    const description = this.getDescription(item.schema.name, item.name) ?? item.description;
    return { label, description };
  }

  /**
   * Get localized label and description of a property.
   * Label fallback: localized label → base locale label → original label → property name
   * Description fallback: localized description → base locale description → original description
   */
  public getLocalizedProperty(ecClass: ECClass | SchemaView.Class, property: Property | SchemaView.Property): LocalizedText {
    const label = this.getLabel(ecClass.schema.name, ecClass.name, property.name) ?? (property.label || property.name);
    const description = this.getDescription(ecClass.schema.name, ecClass.name, property.name) ?? property.description;
    return { label, description };
  }

  /**
   * Get localized label and description of an enumerator.
   * Label fallback: localized label → base locale label → original label → enumerator name
   * Description fallback: localized description → base locale description → original description
   */
  public getLocalizedEnumerator(enumeration: Enumeration | SchemaView.Enumeration, enumerator: AnyEnumerator | SchemaView.Enumerator): LocalizedText {
    const label = this.getLabel(enumeration.schema.name, enumeration.name, enumerator.name) ?? (enumerator.label || enumerator.name);
    const description = this.getDescription(enumeration.schema.name, enumeration.name, enumerator.name) ?? enumerator.description;
    return { label, description };
  }

  /**
   * Load localization information for a specific schema and locale.
   */
  private async loadLocalizationInfo(schemaName: string, readVersion: number, locale: string): Promise<void> {
    const cacheKey = this.cacheKey(schemaName, locale);
    if (this._cache.has(cacheKey))
      return;

    const localization = await this._provider.getLocalization(schemaName, locale);
    if (localization?.version) {
      const localizationMajor = this.getMajorVersion(localization.version);
      if (localizationMajor === undefined || readVersion !== localizationMajor) {
        Logger.logWarning(loggerCategory, `Localization version mismatch for schema "${schemaName}". Schema major version is ${readVersion.toString()}, but localization is for major version ${localizationMajor?.toString() ?? "undefined"}.`);
        this._cache.set(cacheKey, undefined);
        return;
      }
    }

    this._cache.set(cacheKey, localization);
  }

  /**
   * Get major version from version string
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
   * Retrieve the cached localization for a locale
   */
  private getCachedLocalization(schemaName: string, locale: string): SchemaLocalizationJson | undefined {
    const cacheKey = this.cacheKey(schemaName, locale);
    return this._cache.get(cacheKey);
  }

  /**
   * Resolve a label from a localization object by item and optional member path.
   */
  private resolveLabel(localization: SchemaLocalizationJson | undefined, itemName?: string, memberName?: string): string | undefined {
    if (!localization)
      return undefined;
    if (!itemName)
      return localization.label;
    const item = localization.items?.[itemName];
    if (!memberName)
      return item?.label;
    return item?.members?.[memberName]?.label;
  }

  /**
   * Resolve a description from a localization object by item and optional member path.
   */
  private resolveDescription(localization: SchemaLocalizationJson | undefined, itemName?: string, memberName?: string): string | undefined {
    if (!localization)
      return undefined;
    if (!itemName)
      return localization.description;
    const item = localization.items?.[itemName];
    if (!memberName)
      return item?.description;
    return item?.members?.[memberName]?.description;
  }
}
