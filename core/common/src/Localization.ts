/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

/** Options for Localization
 * @public
 */
interface LocalizationOptions {
  /** for interpolation values */
  [key: string]: any;
  /**
   * defaultValue to return if a translation was not found
   */
  defaultValue?: any;
  /**
   * count value used for plurals
   */
  count?: number;
  /**
   * used for contexts (eg. male\female)
   */
  context?: any;
  /**
   * override languages to use
   */
  lngs?: string[];
  /**
   * override language to lookup key if not found see fallbacks for details
   */
  fallbackLng?: string;
}

/** The interface defining the localization requirements of [IModelApp]($frontend).
 * @public
 */
export interface Localization {
  /** Returns the localized string. If an array is provided, localizes and returns the first recognized key in the array. */
  getLocalizedString(key: string | string[], options?: LocalizationOptions): string;
  /** Returns the localized string under the provided namespace. If an array is provided, localizes and returns the first recognized key in the array. */
  getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getEnglishString(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getLocalizedKeys(inputString: string): string;
  registerNamespace(namespace: string, setDefault?: true): Promise<void>;
  unregisterNamespace(namespace: string): void;
  getNamespacePromise(name: string): Promise<void> | undefined;
  /** Get the list of available languages for translations */
  getLanguageList(): string[];
  /** change the language for translations. This overrides the language from the browser. */
  changeLanguage(language: string): void;
}

/** The default [[Localization]] used in the event that an implementation is not provided to [IModelApp]($frontend). Does not perform localizations.
 * @public
 */
export class EmptyLocalization implements Localization {
  public getLocalizedString(key: string | string[]): string { return typeof (key) == "string" ? key : key[0]; }
  public getLocalizedStringWithNamespace(_namespace: string, key: string | string[]): string { return this.getLocalizedString(key); }
  public getEnglishString(_namespace: string, key: string | string[]): string { return this.getLocalizedString(key); }
  public getLocalizedKeys(inputString: string): string { return inputString; }
  public async registerNamespace(): Promise<void> { return; }
  public unregisterNamespace(): void { }
  public getNamespacePromise(): Promise<void> | undefined { return; }
  public getLanguageList(): string[] { return []; }
  public changeLanguage(): void { }
}
