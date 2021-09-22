/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

import { Logger } from "@bentley/bentleyjs-core";

 /** @public */
 // This should be more clearly defined or removed as we remove I18N and its dependencies (Formerly i18next::TranslationOptions).
 type LocalizationOptions = any;

/** The interface defining the localization requirements of iModelJs.
 * @public
 */
export interface LocalizationClient {
  getLocalizedString(key: string | string[], options?: LocalizationOptions): string;
  getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getEnglishString(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getLocalizedKeys(inputString: string): string;
  registerNamespace(namespace: string): Promise<void>;
  unregisterNamespace(namespace: string): void;
  getNamespace(name: string): Promise<void> | undefined;
  languageList(): string[];
}

/** The default [[LocalizationClient]] used in the event that an implementation is not provided to [[IModelApp]]. Does not perform localizations.
 * @public
 */
export class EmptyLocalizationClient implements LocalizationClient {
  public getLocalizedString(key: string | string[]): string {
    Logger.logWarning("Localization", `Empty localization client ignored call to getLocalizedString. (key: ${key})`);
    return typeof(key) == "string" ? key : key[0];
  }
  public getLocalizedStringWithNamespace(namespace: string, key: string | string[]): string {
    Logger.logWarning("Localization", `Empty localization client ignored call to getLocalizedStringWithNamespace. (namespace: ${namespace}, key: ${key})`);
    return typeof(key) == "string" ? key : key[0];
  }
  public getEnglishString(namespace: string, key: string | string[]): string {
    Logger.logWarning("Localization", `Empty localization client ignored call to getEnglishString. (namespace: ${namespace}, key: ${key})`);
    return typeof(key) == "string" ? key : key[0];
  }
  public getLocalizedKeys(inputString: string): string {
    Logger.logWarning("Localization", `Empty localization client ignored call to getLocalizedKeys. (inputString: ${inputString})`);
    return inputString;
  }
  public async registerNamespace(): Promise<void> {
    Logger.logWarning("Localization", "Empty localization client ignored call to registerNamespace.");
    return Promise.resolve();
  }
  public unregisterNamespace(): void {
    Logger.logWarning("Localization", "Empty localization client ignored call to unregisterNamespace.");
  }
  public getNamespace(): Promise<void> | undefined {
    Logger.logWarning("Localization", "Empty localization client ignored call to getNamespace.");
    return Promise.resolve();
  }
  public languageList(): string[] {
    Logger.logWarning("Localization", "Empty localization client ignored call to languageList.");
    return [];
  }
}
