/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "../Metadata/Schema";
import { ECClass } from "../Metadata/Class";
import { Property } from "../Metadata/Property";
import { SchemaItem } from "../Metadata/SchemaItem";
import { AnyEnumerator, Enumeration } from "../Metadata/Enumeration";
import { SchemaView } from "../SchemaView";
import { SchemaKey } from "../SchemaKey";
import { ILocalizationProvider } from "./LocalizationProvider";
import { SchemaLocalizationJson } from "./LocalizationTypes";

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
    const baseLocale = this._locale.includes("-") ? this._locale.split("-")[0] : undefined;
    const promises: Promise<void>[] = [];
    for (const key of schemaKeys) {
      promises.push(this.loadLocalizationInfo(key.name, key.readVersion, this._locale));
      if (baseLocale !== undefined)
        promises.push(this.loadLocalizationInfo(key.name, key.readVersion, baseLocale));
    }
    await Promise.all(promises);
  }

  /**
   * Get a localized label for a schema, schema item, or member.
   */
  public getLabel(schemaName: string, itemName?: string, memberName?: string): string | undefined {
    const localization = this.getCachedLocalization(schemaName);
    const label = this.resolveLabel(localization, itemName, memberName);
    if (label)
      return label;

    const baseLocalization = this.getCachedBaseLocalization(schemaName);
    return this.resolveLabel(baseLocalization, itemName, memberName);
  }

  /**
   * Get a localized description for a schema, schema item, or member.
   */
  public getDescription(schemaName: string, itemName?: string, memberName?: string): string | undefined {
    const localization = this.getCachedLocalization(schemaName);
    const description = this.resolveDescription(localization, itemName, memberName);
    if (description)
      return description;

    const baseLocalization = this.getCachedBaseLocalization(schemaName);
    return this.resolveDescription(baseLocalization, itemName, memberName);
  }

  /**
   * Get localized label for a schema.
   * Fallback: localized label → base locale label → original label → schema name
   */
  public getSchemaLabel(schema: Schema | SchemaView.Schema): string {
    return this.getLabel(schema.name) ?? (schema.label || schema.name);
  }

  /**
   * Get localized description for a schema.
   * Fallback: localized description → base locale description → original description
   */
  public getSchemaDescription(schema: Schema | SchemaView.Schema): string | undefined {
    return this.getDescription(schema.name) ?? schema.description;
  }

  /**
   * Get localized label for a schema item (class, enumeration, unit, etc.).
   * Fallback: localized label → base locale label → original label → item name
   */
  public getSchemaItemLabel(item: SchemaItem | SchemaView.Class | SchemaView.Enumeration | SchemaView.KindOfQuantity | SchemaView.PropertyCategory): string {
    return this.getLabel(item.schema.name, item.name) ?? (item.label || item.name);
  }

  /**
   * Get localized description for a schema item.
   * Fallback: localized description → base locale description → original description
   */
  public getSchemaItemDescription(item: SchemaItem | SchemaView.Class | SchemaView.Enumeration | SchemaView.KindOfQuantity | SchemaView.PropertyCategory): string | undefined {
    return this.getDescription(item.schema.name, item.name) ?? item.description;
  }

  /**
   * Get localized label for a property.
   * Fallback: localized label → base locale label → original label → property name
   */
  public getPropertyLabel(ecClass: ECClass | SchemaView.Class, property: Property | SchemaView.Property): string {
    return this.getLabel(ecClass.schema.name, ecClass.name, property.name) ?? (property.label || property.name);
  }

  /**
   * Get localized description for a property.
   * Fallback: localized description → base locale description → original description
   */
  public getPropertyDescription(ecClass: ECClass | SchemaView.Class, property: Property | SchemaView.Property): string | undefined {
    return this.getDescription(ecClass.schema.name, ecClass.name, property.name) ?? property.description;
  }

  /**
   * Get localized label for an enumerator.
   * Fallback: localized label → base locale label → original label → enumerator name
   */
  public getEnumeratorLabel(enumeration: Enumeration | SchemaView.Enumeration, enumerator: AnyEnumerator | SchemaView.Enumerator): string {
    return this.getLabel(enumeration.schema.name, enumeration.name, enumerator.name) ?? (enumerator.label || enumerator.name);
  }

  /**
   * Get localized description for an enumerator.
   * Fallback: localized description → base locale description → original description
   */
  public getEnumeratorDescription(enumeration: Enumeration | SchemaView.Enumeration, enumerator: AnyEnumerator | SchemaView.Enumerator): string | undefined {
    return this.getDescription(enumeration.schema.name, enumeration.name, enumerator.name) ?? enumerator.description;
  }

  /**
   * Load localization information for a specific schema and locale.
   */
  private async loadLocalizationInfo(schemaName: string, readVersion: number, locale: string): Promise<void> {
    const cacheKey = `${schemaName}:${locale}`;
    if (this._cache.has(cacheKey))
      return;

    const localization = await this._provider.getLocalization(schemaName, locale);
    if (localization?.version) {
      const localizationMajor = this.getMajorVersion(localization.version);
      if (localizationMajor === undefined || readVersion !== localizationMajor) {
        // eslint-disable-next-line no-console
        console.warn(`Localization version mismatch for schema "${schemaName}". Schema major version is ${readVersion.toString()}, but localization is for major version ${localizationMajor?.toString() ?? "undefined"}.`);
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
   * Retrieve the cached localization for the active locale.
   */
  private getCachedLocalization(schemaName: string): SchemaLocalizationJson | undefined {
    return this._cache.get(`${schemaName}:${this._locale}`);
  }

  /**
   * Retrieve the cached localization for the base locale (e.g., "es" from "es-CO").
   */
  private getCachedBaseLocalization(schemaName: string): SchemaLocalizationJson | undefined {
    if (!this._locale.includes("-"))
      return undefined;
    const baseLocale = this._locale.split("-")[0];
    return this._cache.get(`${schemaName}:${baseLocale}`);
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
