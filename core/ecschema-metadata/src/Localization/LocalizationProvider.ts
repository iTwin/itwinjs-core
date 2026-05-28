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

  /**
   * Constructs a LocalizationProvider.
   * @param _loader Function that loads JSON content given a schema name and locale
   */
  constructor(private _loader: (schemaName: string, locale: string) => Promise<SchemaLocalizationJson | undefined>) {
  }

  /**
   * Load localization JSON for a given schema and locale.
   */
  public async getLocalization(schemaName: string, locale: string): Promise<SchemaLocalizationJson | undefined> {
    const localizationData = await this._loader(schemaName, locale);

    if (localizationData) {
      if (!localizationData.name || !localizationData.locale) {
        throw new Error(`Invalid localization JSON for ${schemaName}:${locale} - missing schema name or locale`);
      }

      if (localizationData.name !== schemaName) {
        throw new Error(`Localization JSON mismatch for ${schemaName}:${locale} - expected schema name "${schemaName}" but got "${localizationData.name}"`);
      }

      if (localizationData.locale !== locale) {
        throw new Error(`Localization JSON mismatch for ${schemaName}:${locale} - expected locale "${locale}" but got "${localizationData.locale}"`);
      }
    }

    return localizationData;
  }
}
