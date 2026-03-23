/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaLocalizationJson } from "./LocalizationTypes";

/**
 * Interface for providing localization JSON files for schemas.
 * @beta
 */
export interface ILocalizationProvider {
  /**
   * Load localization JSON for a given schema and locale.
   * @param schemaName The name of the schema
   * @param locale The locale identifier (e.g., "de", "fr", "es-CO")
   * @returns Promise resolving to the localization JSON, or undefined if not found
   */
  getLocalization(schemaName: string, locale: string): Promise<SchemaLocalizationJson | undefined>;
}

/**
 * The provider to load the localization JSON files.
 * @beta
 */
export class LocalizationProvider implements ILocalizationProvider {
  private _localizationCache: Map<string, SchemaLocalizationJson> = new Map();

  /**
   * Constructs a LocalizationProvider.
   * @param _loader Function that loads JSON content given a schema name and locale
   */
  constructor(private _loader: (schemaName: string, locale: string) => Promise<any | undefined>) {
  }

  /**
   * Load localization JSON for a given schema and locale.
   * Implements locale fallback: "es-CO" → "es" → undefined
   */
  public async getLocalization(schemaName: string, locale: string): Promise<SchemaLocalizationJson | undefined> {
    const cacheKey = `${schemaName}:${locale}`;

    // Check cache first
    if (this._localizationCache.has(cacheKey)) {
      return this._localizationCache.get(cacheKey);
    }

    // Try exact locale match
    let localizationData = await this._loader(schemaName, locale);

    // Try fallback to language without region (e.g., "es-CO" → "es")
    if (!localizationData && locale.includes("-")) {
      const baseLocale = locale.split("-")[0];
      localizationData = await this._loader(schemaName, baseLocale);
    }

    if (localizationData) {
      // Validate basic structure
      if (!localizationData.name || !localizationData.locale) {
        throw new Error(`Invalid localization JSON for ${schemaName}:${locale} - missing schema name or locale`);
      }

      this._localizationCache.set(cacheKey, localizationData);
      return localizationData;
    }

    return undefined;
  }

  /**
   * Clear the localization cache.
   */
  public clearCache(): void {
    this._localizationCache.clear();
  }
}
